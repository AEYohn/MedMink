"""API routes for the patient interview system."""

import json
from typing import Any

import structlog
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.medgemma.interview import (
    create_session,
    get_interviewer,
    get_session,
    restore_session,
)

logger = structlog.get_logger()
router = APIRouter(prefix="/api/interview", tags=["interview"])


class StartInterviewResponse(BaseModel):
    session_id: str
    question: str
    phase: str
    extracted_data: dict[str, Any] = {}


class TextRespondRequest(BaseModel):
    session_id: str
    text: str = Field(..., min_length=1, max_length=5000)
    conversation_history: list[dict[str, str]] | None = None
    phase: str | None = None
    patient_id: str | None = None


class CompleteRequest(BaseModel):
    conversation_history: list[dict[str, str]] | None = None
    phase: str | None = None
    patient_id: str | None = None


class InterviewRespondResponse(BaseModel):
    session_id: str
    transcript: str | None = None
    question: str
    phase: str
    phase_complete: bool = False
    extracted_data: dict[str, Any] = {}
    red_flags: list[str] = []


class TriageResponse(BaseModel):
    chief_complaint: str = ""
    hpi: dict[str, Any] = {}
    review_of_systems: dict[str, Any] = {}
    past_medical_history: list[str] = []
    medications: list[str] = []
    allergies: list[str] = []
    esi_level: int = 3
    esi_reasoning: str = ""
    recommended_setting: str = ""
    setting_reasoning: str = ""
    red_flags: list[str] = []


@router.post("/start", response_model=StartInterviewResponse)
async def start_interview():
    """Create a new interview session and return the first question."""
    session = create_session()
    interviewer = get_interviewer()

    result = await interviewer.start_interview(session)

    return StartInterviewResponse(
        session_id=result["session_id"],
        question=result["question"],
        phase=result["phase"],
        extracted_data=result.get("extracted_data", {}),
    )


@router.post("/respond", response_model=InterviewRespondResponse)
async def respond_text(request: TextRespondRequest):
    """Process a text response from the patient."""
    session = get_session(request.session_id)
    if not session and request.conversation_history:
        session = restore_session(
            request.session_id, request.conversation_history,
            request.phase, request.patient_id,
        )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.phase == "complete":
        raise HTTPException(status_code=400, detail="Interview already complete")

    interviewer = get_interviewer()
    result = await interviewer.process_response(session, request.text)

    return InterviewRespondResponse(
        session_id=result["session_id"],
        transcript=request.text,
        question=result["question"],
        phase=result["phase"],
        phase_complete=result.get("phase_complete", False),
        extracted_data=result.get("extracted_data", {}),
        red_flags=result.get("red_flags", []),
    )


@router.post("/respond/audio", response_model=InterviewRespondResponse)
async def respond_audio(
    session_id: str = Form(...),
    audio: UploadFile = File(...),
    conversation_history: str | None = Form(default=None),
    phase: str | None = Form(default=None),
    patient_id: str | None = Form(default=None),
):
    """Process an audio response — transcribe then feed to interview."""
    session = get_session(session_id)
    if not session and conversation_history:
        history = json.loads(conversation_history)
        session = restore_session(session_id, history, phase, patient_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.phase == "complete":
        raise HTTPException(status_code=400, detail="Interview already complete")

    # Transcribe audio via Modal Whisper
    transcript = await _transcribe_audio(audio)
    if not transcript:
        raise HTTPException(status_code=422, detail="Could not transcribe audio")

    # Process the transcribed text
    interviewer = get_interviewer()
    result = await interviewer.process_response(session, transcript)

    return InterviewRespondResponse(
        session_id=result["session_id"],
        transcript=transcript,
        question=result["question"],
        phase=result["phase"],
        phase_complete=result.get("phase_complete", False),
        extracted_data=result.get("extracted_data", {}),
        red_flags=result.get("red_flags", []),
    )


@router.post("/respond/stream")
async def respond_stream(
    session_id: str = Form(...),
    text: str = Form(default=""),
    audio: UploadFile | None = File(default=None),
    conversation_history: str | None = Form(default=None),
    phase: str | None = Form(default=None),
    patient_id: str | None = Form(default=None),
):
    """SSE stream version: transcribing → thinking → responding."""
    session = get_session(session_id)
    if not session and conversation_history:
        history = json.loads(conversation_history)
        session = restore_session(session_id, history, phase, patient_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    async def generate():
        patient_input = text

        # Transcribe if audio provided
        if audio and not text:
            yield f"data: {json.dumps({'type': 'status', 'status': 'transcribing'})}\n\n"
            patient_input = await _transcribe_audio(audio)
            yield f"data: {json.dumps({'type': 'transcript', 'text': patient_input or ''})}\n\n"

            if not patient_input:
                yield f"data: {json.dumps({'type': 'error', 'message': 'Transcription failed'})}\n\n"
                return

        # Process response
        yield f"data: {json.dumps({'type': 'status', 'status': 'thinking'})}\n\n"

        interviewer = get_interviewer()
        result = await interviewer.process_response(session, patient_input)

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


@router.post("/{session_id}/complete", response_model=TriageResponse)
async def complete_interview(session_id: str, body: CompleteRequest | None = None):
    """Force-complete an interview and generate triage assessment."""
    session = get_session(session_id)
    if not session and body and body.conversation_history:
        session = restore_session(
            session_id, body.conversation_history,
            body.phase, body.patient_id,
        )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    interviewer = get_interviewer()
    triage = await interviewer.generate_triage(session)

    return TriageResponse(**triage)


@router.get("/{session_id}/triage", response_model=TriageResponse)
async def get_triage(session_id: str):
    """Get the triage result for a completed interview."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if not session.triage_result:
        raise HTTPException(status_code=400, detail="Interview not yet triaged")

    return TriageResponse(**session.triage_result)


@router.get("/{session_id}")
async def get_interview_status(session_id: str):
    """Get current interview state."""
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session_id": session.session_id,
        "phase": session.phase,
        "started_at": session.started_at,
        "conversation_length": len(session.conversation_history),
        "extracted_data": session.extracted_data,
        "red_flags": session.red_flags,
        "has_triage": session.triage_result is not None,
    }


# --- HeAR Respiratory Sound Screening ---

@router.post("/analyze-cough")
async def analyze_cough(audio: UploadFile = File(...)):
    """Analyze cough/breathing audio for respiratory conditions using HeAR.

    Accepts audio file, returns respiratory risk assessment with
    condition probabilities (TB, COVID-19, COPD, asthma, pneumonia).
    """
    try:
        from src.medgemma.hear_client import get_hear_client

        hear = get_hear_client()
        if not hear.is_available:
            raise HTTPException(status_code=503, detail="HeAR model not configured")

        # Save to temp file for processing
        import os
        import tempfile

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            content = await audio.read()
            tmp.write(content)
            tmp_path = tmp.name

        try:
            result = await hear.classify_respiratory(tmp_path)
            if "error" in result and not result.get("classifications"):
                raise HTTPException(status_code=500, detail=result["error"])
            return result
        finally:
            os.unlink(tmp_path)

    except HTTPException:
        raise
    except ImportError as e:
        raise HTTPException(status_code=503, detail="HeAR client not available") from e
    except Exception as e:
        logger.error("Cough analysis failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


# --- AMIE-style Management Plan ---

@router.get("/management-plan/{session_id}")
async def get_management_plan(session_id: str):
    """Get the current management plan for an interview session.

    The Management Reasoning Agent builds a clinical plan in parallel
    with the Dialogue Agent during the interview.
    """
    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        from src.medgemma.management_agent import get_management_agent

        agent = get_management_agent()
        plan = await agent.get_management_plan(session)
        return plan
    except ImportError:
        return {"error": "Management agent not available", "plan": None}
    except Exception as e:
        logger.error("Management plan retrieval failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


# --- Longitudinal Visit Management ---

@router.get("/visits/{patient_id}")
async def get_visit_history(patient_id: str):
    """Get visit history for a patient (longitudinal tracking)."""
    try:
        from src.medgemma.visit_tracker import get_visit_tracker

        tracker = get_visit_tracker()
        history = tracker.get_visit_history(patient_id)
        return {"patient_id": patient_id, "visits": history}
    except ImportError:
        return {"patient_id": patient_id, "visits": [], "error": "Visit tracker not available"}
    except Exception as e:
        logger.error("Visit history retrieval failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


class LinkVisitRequest(BaseModel):
    session_id: str
    patient_id: str


@router.post("/link-visit")
async def link_visit(request: LinkVisitRequest):
    """Associate an interview session with a patient for longitudinal tracking."""
    session = get_session(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        from src.medgemma.visit_tracker import get_visit_tracker

        tracker = get_visit_tracker()
        visit = tracker.save_visit(
            patient_id=request.patient_id,
            session=session,
        )
        return {"success": True, "visit": visit}
    except ImportError as e:
        raise HTTPException(status_code=503, detail="Visit tracker not available") from e
    except Exception as e:
        logger.error("Visit linking failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


async def _transcribe_audio(audio: UploadFile) -> str | None:
    """Transcribe audio via Modal MedASR/Whisper ASR endpoint.

    Prefers MedASR endpoint if configured, falls back to Whisper.
    """
    from src.config import settings

    # Prefer MedASR, fall back to Whisper
    asr_url = getattr(settings, "medasr_modal_url", "") or settings.whisper_modal_url
    if not asr_url:
        logger.warning("No ASR Modal URL configured, cannot transcribe audio")
        return None

    try:
        import aiohttp

        audio_data = await audio.read()

        timeout = aiohttp.ClientTimeout(total=60)
        async with aiohttp.ClientSession(timeout=timeout) as http_session:
            form = aiohttp.FormData()
            form.add_field(
                "audio",
                audio_data,
                filename=audio.filename or "recording.webm",
                content_type=audio.content_type or "audio/webm",
            )

            async with http_session.post(
                f"{asr_url}/transcribe",
                data=form,
            ) as resp:
                if resp.status != 200:
                    body = await resp.text()
                    logger.error("ASR transcription failed", status=resp.status, body=body[:200])
                    return None

                result = await resp.json()
                return result.get("text", "")

    except Exception as e:
        logger.error("Audio transcription failed", error=str(e))
        return None
