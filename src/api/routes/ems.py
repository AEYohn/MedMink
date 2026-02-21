"""API routes for the EMS Run Report system."""

import json
from dataclasses import asdict
from typing import Any

import structlog
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.medgemma.ems_interviewer import (
    create_ems_session,
    get_ems_assistant,
    get_ems_session,
    restore_ems_session,
)
from src.medgemma.ems_storage import get_ems_storage

logger = structlog.get_logger()
router = APIRouter(prefix="/api/ems", tags=["ems"])


class StartEMSRequest(BaseModel):
    dispatch_info: dict[str, Any] | None = None


class DictateRequest(BaseModel):
    session_id: str
    text: str = Field(..., min_length=1, max_length=10000)
    conversation_history: list[dict[str, str]] | None = None
    phase: str | None = None
    extracted_data: dict[str, Any] | None = None


class QuickVitalsRequest(BaseModel):
    session_id: str
    bp_systolic: int | None = None
    bp_diastolic: int | None = None
    heart_rate: int | None = None
    respiratory_rate: int | None = None
    spo2: int | None = None
    temperature: float | None = None
    blood_glucose: int | None = None
    etco2: int | None = None
    pain_scale: int | None = None
    gcs_total: int | None = None
    time: str = ""


class QuickInterventionRequest(BaseModel):
    session_id: str
    procedure: str
    details: str = ""
    performed_by: str = ""
    success: bool = True
    time: str = ""


class QuickMedicationRequest(BaseModel):
    session_id: str
    medication: str
    dose: str = ""
    route: str = ""
    response: str = ""
    time: str = ""


@router.post("/start")
async def start_ems_report(body: StartEMSRequest | None = None):
    """Start a new EMS run report session."""
    dispatch_info = body.dispatch_info if body else None
    session = create_ems_session(dispatch_info=dispatch_info)
    assistant = get_ems_assistant()
    result = await assistant.start_session(session, dispatch_info=dispatch_info)
    return result


@router.post("/dictate")
async def process_dictation(request: DictateRequest):
    """Process text dictation from the medic."""
    session = get_ems_session(request.session_id)
    if not session and request.conversation_history:
        session = restore_ems_session(
            request.session_id,
            request.conversation_history,
            request.phase,
            request.extracted_data,
        )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.phase == "complete":
        raise HTTPException(status_code=400, detail="Report already complete")

    assistant = get_ems_assistant()
    result = await assistant.process_dictation(session, request.text)
    return result


@router.post("/dictate/audio")
async def process_audio_dictation(
    session_id: str = Form(...),
    audio: UploadFile = File(...),
    conversation_history: str | None = Form(default=None),
    phase: str | None = Form(default=None),
    extracted_data: str | None = Form(default=None),
):
    """Process audio dictation — transcribe then extract."""
    session = get_ems_session(session_id)
    if not session and conversation_history:
        history = json.loads(conversation_history)
        ed = json.loads(extracted_data) if extracted_data else None
        session = restore_ems_session(session_id, history, phase, ed)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.phase == "complete":
        raise HTTPException(status_code=400, detail="Report already complete")

    transcript = await _transcribe_audio(audio)
    if not transcript:
        raise HTTPException(status_code=422, detail="Could not transcribe audio")

    assistant = get_ems_assistant()
    result = await assistant.process_dictation(session, transcript)
    result["transcript"] = transcript
    return result


@router.post("/dictate/stream")
async def process_dictation_stream(
    session_id: str = Form(...),
    text: str = Form(default=""),
    audio: UploadFile | None = File(default=None),
    conversation_history: str | None = Form(default=None),
    phase: str | None = Form(default=None),
    extracted_data: str | None = Form(default=None),
):
    """SSE stream: transcribing → extracting → validating."""
    session = get_ems_session(session_id)
    if not session and conversation_history:
        history = json.loads(conversation_history)
        ed = json.loads(extracted_data) if extracted_data else None
        session = restore_ems_session(session_id, history, phase, ed)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    async def generate():
        medic_input = text

        if audio and not text:
            yield f"data: {json.dumps({'type': 'status', 'status': 'transcribing'})}\n\n"
            medic_input = await _transcribe_audio(audio)
            yield f"data: {json.dumps({'type': 'transcript', 'text': medic_input or ''})}\n\n"
            if not medic_input:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Transcription failed'})}\n\n"
                return

        yield f"data: {json.dumps({'type': 'status', 'status': 'extracting'})}\n\n"

        assistant = get_ems_assistant()
        result = await assistant.process_dictation(session, medic_input)

        yield f"data: {json.dumps({'type': 'status', 'status': 'validating'})}\n\n"
        yield f"data: {json.dumps({'type': 'response', 'data': result})}\n\n"
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/vitals")
async def add_vitals(request: QuickVitalsRequest):
    """Quick-entry vital signs set."""
    session = get_ems_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    vitals = {k: v for k, v in request.model_dump().items() if k != "session_id" and v is not None}

    # Merge into extracted data
    if "vitals_sets" not in session.extracted_data:
        session.extracted_data["vitals_sets"] = []
    session.extracted_data["vitals_sets"].append(vitals)

    # Also set as current vitals
    session.extracted_data["vitals"] = vitals

    # Auto-save
    assistant = get_ems_assistant()
    assistant._auto_save(session)

    return {"success": True, "vitals": vitals, "extracted_data": session.extracted_data}


@router.post("/intervention")
async def add_intervention(request: QuickInterventionRequest):
    """Quick-entry intervention/procedure."""
    session = get_ems_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    intervention = {k: v for k, v in request.model_dump().items() if k != "session_id"}

    if "interventions" not in session.extracted_data:
        session.extracted_data["interventions"] = []
    session.extracted_data["interventions"].append(intervention)

    assistant = get_ems_assistant()
    assistant._auto_save(session)

    return {"success": True, "intervention": intervention, "extracted_data": session.extracted_data}


@router.post("/medication")
async def add_medication(request: QuickMedicationRequest):
    """Quick-entry medication given."""
    session = get_ems_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    med = {k: v for k, v in request.model_dump().items() if k != "session_id"}

    if "medications" not in session.extracted_data:
        session.extracted_data["medications"] = []
    session.extracted_data["medications"].append(med)

    assistant = get_ems_assistant()
    assistant._auto_save(session)

    return {"success": True, "medication": med, "extracted_data": session.extracted_data}


@router.get("/{session_id}")
async def get_session_state(session_id: str):
    """Get current run report state for a session."""
    session = get_ems_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    assistant = get_ems_assistant()
    report = assistant._build_report(session)
    from src.medgemma.ems_models import compute_section_completeness

    return {
        "session_id": session.session_id,
        "run_id": session.run_id,
        "phase": session.phase,
        "started_at": session.started_at,
        "conversation_history": session.conversation_history,
        "extracted_data": session.extracted_data,
        "validation_flags": session.validation_flags,
        "section_completeness": compute_section_completeness(report),
    }


@router.get("/{session_id}/validate")
async def validate_session(session_id: str):
    """Run full validation (deterministic + AI) on the current report."""
    session = get_ems_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    assistant = get_ems_assistant()
    report = assistant._build_report(session)

    from src.medgemma.ems_validation import validate_report

    flags = await validate_report(report, include_ai=True)

    flag_dicts = [asdict(f) for f in flags]
    session.validation_flags = flag_dicts

    return {"session_id": session_id, "validation_flags": flag_dicts}


@router.post("/{session_id}/complete")
async def complete_report(session_id: str):
    """Finalize report: narrative + ICD-10 + medical necessity."""
    session = get_ems_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    assistant = get_ems_assistant()

    # Run full validation first
    from src.medgemma.ems_validation import validate_report

    report = assistant._build_report(session)
    flags = await validate_report(report, include_ai=True)
    flag_dicts = [asdict(f) for f in flags]

    # Generate completion outputs
    narrative = await assistant.generate_narrative(session)
    icd10_codes = await assistant.suggest_icd10(session)
    medical_necessity = await assistant.generate_medical_necessity(session)

    # Save final report
    report = assistant._build_report(session)
    report.narrative = narrative
    report.icd10_codes = icd10_codes
    report.medical_necessity = medical_necessity
    report.validation_flags = flags
    report.status = "complete"

    storage = get_ems_storage()
    saved = storage.save_run(report)

    session.phase = "complete"

    return {
        "session_id": session_id,
        "run_id": session.run_id,
        "status": "complete",
        "narrative": narrative,
        "icd10_codes": icd10_codes,
        "medical_necessity": medical_necessity,
        "validation_flags": flag_dicts,
        "section_completeness": saved.get("section_completeness", {}),
    }


@router.get("/runs/list")
async def list_runs():
    """List saved run reports."""
    storage = get_ems_storage()
    runs = storage.list_runs()
    return {"runs": runs}


@router.get("/runs/{run_id}")
async def get_run(run_id: str):
    """Get a specific saved run report."""
    storage = get_ems_storage()
    run = storage.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


async def _transcribe_audio(audio: UploadFile) -> str | None:
    """Transcribe audio — Gemini primary, Modal fallback."""
    from src.config import settings
    from src.medgemma.speech import transcribe_audio_gemini

    audio_data = await audio.read()

    # Primary: Gemini
    transcript = await transcribe_audio_gemini(
        audio_data,
        mime_type=audio.content_type or "audio/webm",
    )
    if transcript:
        return transcript

    # Fallback: Modal
    asr_url = getattr(settings, "medasr_modal_url", "") or getattr(
        settings, "whisper_modal_url", ""
    )
    if not asr_url:
        return None

    try:
        import aiohttp

        timeout = aiohttp.ClientTimeout(total=60)
        async with aiohttp.ClientSession(timeout=timeout) as http_session:
            form = aiohttp.FormData()
            form.add_field(
                "audio",
                audio_data,
                filename=audio.filename or "recording.webm",
                content_type=audio.content_type or "audio/webm",
            )
            async with http_session.post(f"{asr_url}/transcribe", data=form) as resp:
                if resp.status != 200:
                    return None
                result = await resp.json()
                return result.get("text", "")
    except Exception as e:
        logger.error("EMS audio transcription failed", error=str(e))
        return None
