"""PostVisit AI API routes.

Provides endpoints for:
- AI companion chat (SSE streaming)
- Vital sign logging, import, trends, AI analysis
- Patient-clinician messaging with AI-drafted replies
"""

import asyncio
import csv
import io
import json
import os
import uuid
from datetime import datetime
from typing import Any

import httpx
import structlog
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.postvisit.context_builder import build_postvisit_context
from src.postvisit.evidence_search import format_citations_for_prompt, search_evidence
from src.postvisit.message_drafter import draft_clinician_reply
from src.postvisit.vital_analyzer import analyze_vitals

logger = structlog.get_logger()
router = APIRouter(prefix="/api/postvisit", tags=["postvisit"])

# ---------------------------------------------------------------------------
# In-memory stores (localStorage-aligned, no DB required for MVP)
# ---------------------------------------------------------------------------
_vital_readings: dict[str, list[dict]] = {}  # patient_id -> [readings]
_messages: dict[str, list[dict]] = {}  # summary_id -> [messages]
_conversations: dict[str, list[dict]] = {}  # summary_id -> [chat messages]

# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    conversation_history: list[dict[str, str]] = Field(default_factory=list)
    summary: dict[str, Any] = Field(default_factory=dict)
    patient_id: str = ""


class VitalReadingRequest(BaseModel):
    patient_id: str
    vital_type: str  # heart_rate, blood_pressure_systolic, etc.
    value: float
    unit: str = ""
    recorded_at: str | None = None  # ISO-8601, defaults to now
    source: str = "manual"
    notes: str = ""


class VitalBulkRequest(BaseModel):
    patient_id: str
    readings: list[VitalReadingRequest]


class MessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=5000)
    sender: str = "patient"
    patient_id: str = ""


class DraftRequest(BaseModel):
    patient_context: str = ""
    summary: dict[str, Any] = Field(default_factory=dict)
    patient_id: str = ""


class MessageUpdateRequest(BaseModel):
    content: str | None = None
    status: str | None = None  # sent, read, replied


# ---------------------------------------------------------------------------
# 1A. AI Companion Chat (SSE streaming)
# ---------------------------------------------------------------------------

COMPANION_SYSTEM_PROMPT = """You are a PostVisit AI health companion helping a patient understand their recent medical visit.

CORE RULES:
1. Explain in plain, empathetic language appropriate for a general audience
2. Reference the patient's specific visit data ("Your doctor prescribed X because...")
3. NEVER contradict the clinician's instructions or diagnoses
4. For clinical decisions, always say "Please discuss this with your doctor"
5. Label your information sources:
   - [Doctor-approved] for information directly from the visit summary
   - [Medical literature] for information from PubMed/guidelines
   - [AI explanation] for your own medical knowledge explanations
6. Be warm, supportive, and encouraging
7. Keep responses focused and concise (2-4 paragraphs max)
8. If the patient describes new or worsening symptoms, strongly encourage them to contact their healthcare provider

You have access to the patient's visit summary, medical history, and recent vitals below."""


async def _companion_stream(
    message: str,
    conversation_history: list[dict[str, str]],
    summary: dict[str, Any],
    patient_id: str,
    summary_id: str,
) -> Any:
    """Generate SSE stream for companion chat."""
    queue: asyncio.Queue = asyncio.Queue()
    done_event = asyncio.Event()

    async def _produce():
        try:
            # Build context
            await queue.put({"type": "status", "status": "building_context"})

            vital_readings = _vital_readings.get(patient_id, [])
            context = await build_postvisit_context(
                patient_id=patient_id,
                summary=summary,
                vital_readings=vital_readings,
            )

            # Check companion config for blocked topics
            companion_config = summary.get("companionConfig", {})
            blocked_topics = companion_config.get("blockedTopics", [])
            if blocked_topics:
                msg_lower = message.lower()
                for topic in blocked_topics:
                    if topic.lower() in msg_lower:
                        await queue.put({
                            "type": "response",
                            "data": {
                                "content": (
                                    f"I'm not able to discuss {topic} — your doctor has asked that you "
                                    "speak with them directly about this topic. Please reach out to "
                                    "your healthcare provider for guidance on this."
                                ),
                                "citations": [],
                            },
                        })
                        await queue.put({"type": "done"})
                        return

            # Search for evidence if enabled
            evidence_context = ""
            citations = []
            if companion_config.get("evidenceSearchEnabled", True):
                await queue.put({"type": "status", "status": "searching_evidence"})
                try:
                    citations = await search_evidence(message, max_results=3)
                    evidence_context = format_citations_for_prompt(citations)
                except Exception as e:
                    logger.warning("Evidence search failed", error=str(e))

            # Build system prompt with clinician notes
            system = COMPANION_SYSTEM_PROMPT
            clinician_notes = companion_config.get("clinicianNotesToAi", "")
            if clinician_notes:
                system += f"\n\nClinician's private notes about this patient: {clinician_notes}"

            # Build full prompt
            full_context = context
            if evidence_context:
                full_context += "\n" + evidence_context

            # Build messages for Claude API
            messages = []
            for msg in conversation_history[-10:]:  # Last 10 messages
                messages.append({
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                })
            messages.append({"role": "user", "content": message})

            # Prepend context to first user message
            if messages:
                messages[0]["content"] = (
                    f"Patient's medical context:\n{full_context}\n\n"
                    f"Patient's question: {messages[0]['content']}"
                )

            await queue.put({"type": "status", "status": "generating"})

            # Call Claude API with streaming
            api_key = os.environ.get("ANTHROPIC_API_KEY", "")
            if not api_key:
                await queue.put({
                    "type": "response",
                    "data": {
                        "content": (
                            "I'm sorry, the AI service is currently unavailable. "
                            "Please try again later or contact your healthcare provider directly."
                        ),
                        "citations": [],
                    },
                })
                await queue.put({"type": "done"})
                return

            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json",
                    },
                    json={
                        "model": "claude-sonnet-4-20250514",
                        "max_tokens": 2048,
                        "system": system,
                        "messages": messages,
                        "stream": True,
                    },
                )
                resp.raise_for_status()

                full_response = ""
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:]
                    if data_str == "[DONE]":
                        break
                    try:
                        event = json.loads(data_str)
                        if event.get("type") == "content_block_delta":
                            delta = event.get("delta", {})
                            text = delta.get("text", "")
                            if text:
                                full_response += text
                                await queue.put({
                                    "type": "token",
                                    "data": {"text": text},
                                })
                    except json.JSONDecodeError:
                        continue

            # Send final complete response
            await queue.put({
                "type": "response",
                "data": {
                    "content": full_response,
                    "citations": citations,
                },
            })

            # Store conversation
            conv = _conversations.setdefault(summary_id, [])
            conv.append({"role": "user", "content": message, "timestamp": datetime.utcnow().isoformat()})
            conv.append({
                "role": "assistant",
                "content": full_response,
                "citations": citations,
                "timestamp": datetime.utcnow().isoformat(),
            })

            await queue.put({"type": "done"})

        except Exception as e:
            logger.error("Companion chat stream failed", error=str(e))
            await queue.put({"type": "error", "message": str(e)})
        finally:
            done_event.set()

    producer = asyncio.create_task(_produce())

    try:
        while not done_event.is_set() or not queue.empty():
            try:
                update = await asyncio.wait_for(queue.get(), timeout=15)
                yield f"data: {json.dumps(update)}\n\n"
                if update.get("type") in ("done", "error"):
                    break
            except TimeoutError:
                yield ": heartbeat\n\n"
    finally:
        producer.cancel()


@router.post("/{summary_id}/chat")
async def companion_chat(summary_id: str, request: ChatRequest):
    """AI companion chat with SSE streaming.

    Streams responses with evidence citations and source labels.
    """
    return StreamingResponse(
        _companion_stream(
            message=request.message,
            conversation_history=request.conversation_history,
            summary=request.summary,
            patient_id=request.patient_id,
            summary_id=summary_id,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{summary_id}/conversation")
async def get_conversation(summary_id: str):
    """Get conversation history for a summary."""
    return {"messages": _conversations.get(summary_id, [])}


# ---------------------------------------------------------------------------
# 1B. Vitals Endpoints
# ---------------------------------------------------------------------------


@router.post("/vitals")
async def log_vital(request: VitalReadingRequest):
    """Log a single vital reading."""
    reading = {
        "id": str(uuid.uuid4()),
        "patient_id": request.patient_id,
        "vital_type": request.vital_type,
        "value": request.value,
        "unit": request.unit,
        "recorded_at": request.recorded_at or datetime.utcnow().isoformat(),
        "source": request.source,
        "notes": request.notes,
        "created_at": datetime.utcnow().isoformat(),
    }
    _vital_readings.setdefault(request.patient_id, []).append(reading)
    return reading


@router.post("/vitals/bulk")
async def log_vitals_bulk(request: VitalBulkRequest):
    """Log multiple vital readings at once."""
    results = []
    for r in request.readings:
        reading = {
            "id": str(uuid.uuid4()),
            "patient_id": request.patient_id,
            "vital_type": r.vital_type,
            "value": r.value,
            "unit": r.unit,
            "recorded_at": r.recorded_at or datetime.utcnow().isoformat(),
            "source": r.source,
            "notes": r.notes,
            "created_at": datetime.utcnow().isoformat(),
        }
        _vital_readings.setdefault(request.patient_id, []).append(reading)
        results.append(reading)
    return {"imported": len(results), "readings": results}


@router.post("/vitals/import")
async def import_vitals(
    patient_id: str = "",
    file: UploadFile = File(...),
):
    """Import vitals from CSV file.

    Expected CSV columns: date, vital_type, value, unit
    Also supports Apple Health XML and generic formats.
    """
    if not patient_id:
        raise HTTPException(status_code=400, detail="patient_id is required")

    content = await file.read()
    text = content.decode("utf-8", errors="replace")
    readings = []

    filename = file.filename or ""

    if filename.endswith(".xml") and "<HealthData" in text:
        # Apple Health XML export
        readings = _parse_apple_health_xml(text, patient_id)
    elif filename.endswith(".json"):
        # JSON array of readings
        try:
            data = json.loads(text)
            if isinstance(data, list):
                for item in data:
                    readings.append({
                        "id": str(uuid.uuid4()),
                        "patient_id": patient_id,
                        "vital_type": item.get("vital_type", item.get("type", "custom")),
                        "value": float(item.get("value", 0)),
                        "unit": item.get("unit", ""),
                        "recorded_at": item.get("recorded_at", item.get("date", datetime.utcnow().isoformat())),
                        "source": "csv_import",
                        "notes": item.get("notes", ""),
                        "created_at": datetime.utcnow().isoformat(),
                    })
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")
    else:
        # Generic CSV
        try:
            reader = csv.DictReader(io.StringIO(text))
            for row in reader:
                # Support common column name variations
                vital_type = (
                    row.get("vital_type")
                    or row.get("type")
                    or row.get("Vital Type")
                    or row.get("Type")
                    or "custom"
                )
                value_str = row.get("value") or row.get("Value") or row.get("Reading") or "0"
                unit = row.get("unit") or row.get("Unit") or ""
                date = (
                    row.get("date")
                    or row.get("Date")
                    or row.get("recorded_at")
                    or row.get("Timestamp")
                    or datetime.utcnow().isoformat()
                )
                readings.append({
                    "id": str(uuid.uuid4()),
                    "patient_id": patient_id,
                    "vital_type": vital_type,
                    "value": float(value_str),
                    "unit": unit,
                    "recorded_at": date,
                    "source": "csv_import",
                    "notes": "",
                    "created_at": datetime.utcnow().isoformat(),
                })
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"CSV parse error: {e}")

    _vital_readings.setdefault(patient_id, []).extend(readings)
    return {"imported": len(readings), "readings": readings}


def _parse_apple_health_xml(xml_text: str, patient_id: str) -> list[dict]:
    """Parse Apple Health XML export for vital readings."""
    from xml.etree import ElementTree

    # Map Apple Health types to our vital types
    type_map = {
        "HKQuantityTypeIdentifierHeartRate": "heart_rate",
        "HKQuantityTypeIdentifierBloodPressureSystolic": "blood_pressure_systolic",
        "HKQuantityTypeIdentifierBloodPressureDiastolic": "blood_pressure_diastolic",
        "HKQuantityTypeIdentifierBodyMass": "weight",
        "HKQuantityTypeIdentifierBodyTemperature": "temperature",
        "HKQuantityTypeIdentifierOxygenSaturation": "spo2",
        "HKQuantityTypeIdentifierBloodGlucose": "blood_glucose",
    }

    readings = []
    try:
        root = ElementTree.fromstring(xml_text)
        for record in root.iter("Record"):
            hk_type = record.get("type", "")
            vital_type = type_map.get(hk_type)
            if not vital_type:
                continue

            try:
                value = float(record.get("value", "0"))
            except ValueError:
                continue

            readings.append({
                "id": str(uuid.uuid4()),
                "patient_id": patient_id,
                "vital_type": vital_type,
                "value": value,
                "unit": record.get("unit", ""),
                "recorded_at": record.get("startDate", datetime.utcnow().isoformat()),
                "source": "apple_health",
                "notes": "",
                "created_at": datetime.utcnow().isoformat(),
            })
    except ElementTree.ParseError as e:
        logger.warning("Apple Health XML parse failed", error=str(e))

    return readings


@router.get("/vitals/{patient_id}")
async def get_vitals(
    patient_id: str,
    vital_type: str | None = None,
    after: str | None = None,
    before: str | None = None,
):
    """Get vital readings for a patient with optional filters."""
    readings = _vital_readings.get(patient_id, [])

    if vital_type:
        readings = [r for r in readings if r["vital_type"] == vital_type]
    if after:
        readings = [r for r in readings if r["recorded_at"] >= after]
    if before:
        readings = [r for r in readings if r["recorded_at"] <= before]

    readings.sort(key=lambda x: x.get("recorded_at", ""))
    return {"readings": readings}


@router.get("/vitals/{patient_id}/trends")
async def get_vital_trends(patient_id: str):
    """Get vital trends with statistical summaries."""
    from src.postvisit.vital_analyzer import _compute_stats, group_readings_by_type

    readings = _vital_readings.get(patient_id, [])
    grouped = group_readings_by_type(readings)

    # Reference ranges
    ref_ranges = {
        "heart_rate": {"low": 60, "high": 100},
        "blood_pressure_systolic": {"low": 90, "high": 140},
        "blood_pressure_diastolic": {"low": 60, "high": 90},
        "temperature": {"low": 36.1, "high": 37.2},
        "spo2": {"low": 95, "high": 100},
        "blood_glucose": {"low": 70, "high": 140},
    }

    trends = {}
    for vtype, type_readings in grouped.items():
        stats = _compute_stats(type_readings)
        trends[vtype] = {
            "vitalType": vtype,
            "readings": type_readings,
            "stats": stats,
            "referenceRange": ref_ranges.get(vtype),
        }

    return {"trends": trends}


@router.post("/vitals/{patient_id}/analyze")
async def analyze_patient_vitals(patient_id: str, request: ChatRequest | None = None):
    """Trigger AI analysis of patient vitals. Returns alerts and summary."""
    readings = _vital_readings.get(patient_id, [])
    if not readings:
        return {"alerts": [], "summary": "No vital readings to analyze.", "trends": {}}

    # Build context
    summary = request.summary if request else {}
    context = await build_postvisit_context(
        patient_id=patient_id,
        summary=summary,
        vital_readings=readings,
    )

    result = await analyze_vitals(patient_context=context, readings=readings)
    return result


# ---------------------------------------------------------------------------
# 1C. Messaging Endpoints
# ---------------------------------------------------------------------------


@router.get("/{summary_id}/messages")
async def get_messages(summary_id: str):
    """Get message thread for a summary."""
    return {"messages": _messages.get(summary_id, [])}


@router.post("/{summary_id}/messages")
async def send_message(summary_id: str, request: MessageRequest):
    """Patient or clinician sends a message."""
    msg = {
        "id": str(uuid.uuid4()),
        "summaryId": summary_id,
        "sender": request.sender,
        "content": request.content,
        "status": "sent",
        "evidenceRefs": [],
        "createdAt": datetime.utcnow().isoformat(),
    }
    _messages.setdefault(summary_id, []).append(msg)
    return msg


@router.post("/{summary_id}/messages/{message_id}/draft")
async def generate_draft_reply(summary_id: str, message_id: str, request: DraftRequest):
    """Generate AI draft reply for a clinician."""
    # Find the patient's message
    thread = _messages.get(summary_id, [])
    patient_msg = None
    for m in thread:
        if m["id"] == message_id:
            patient_msg = m
            break

    if not patient_msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Build context
    context = await build_postvisit_context(
        patient_id=request.patient_id,
        summary=request.summary,
        vital_readings=_vital_readings.get(request.patient_id, []),
    )

    draft = await draft_clinician_reply(
        patient_question=patient_msg["content"],
        patient_context=context,
    )

    # Store the draft on the message
    patient_msg["aiDraft"] = draft
    return {"draft": draft, "message_id": message_id}


@router.patch("/{summary_id}/messages/{message_id}")
async def update_message(summary_id: str, message_id: str, request: MessageUpdateRequest):
    """Update a message (clinician edits/approves/sends reply)."""
    thread = _messages.get(summary_id, [])
    for msg in thread:
        if msg["id"] == message_id:
            if request.content is not None:
                msg["content"] = request.content
            if request.status is not None:
                msg["status"] = request.status
                if request.status == "read":
                    msg["readAt"] = datetime.utcnow().isoformat()
                elif request.status == "replied":
                    msg["repliedAt"] = datetime.utcnow().isoformat()
            return msg

    raise HTTPException(status_code=404, detail="Message not found")
