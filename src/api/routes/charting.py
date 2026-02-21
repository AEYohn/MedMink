"""API routes for clinical charting with voice dictation."""

import json
import tempfile
from pathlib import Path
from typing import Any

import structlog
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.medgemma.client import get_medgemma_client
from src.medgemma.prompts import SOAP_STRUCTURING_PROMPT
from src.medgemma.speech import get_medasr_client

logger = structlog.get_logger()
router = APIRouter(prefix="/api/chart", tags=["charting"])


class EnhanceRequest(BaseModel):
    """Request for enhancing dictated text with SOAP structuring."""

    dictation_text: str = Field(
        ...,
        min_length=10,
        description="Raw dictation text to enhance and structure",
    )


class SOAPNote(BaseModel):
    """Structured SOAP note response."""

    corrections: list[dict[str, str]] = Field(
        default_factory=list,
        description="List of medical term corrections applied",
    )
    soap: dict[str, Any] = Field(
        ...,
        description="Structured SOAP note",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Processing metadata",
    )


async def enhance_stream_generator(dictation_text: str):
    """Generate SSE stream for dictation enhancement."""
    try:
        yield f"data: {json.dumps({'type': 'step', 'step': 'processing', 'message': 'Analyzing dictation...'})}\n\n"

        medgemma = get_medgemma_client()

        # Format prompt with dictation
        prompt = SOAP_STRUCTURING_PROMPT.format(dictation_text=dictation_text)

        yield f"data: {json.dumps({'type': 'step', 'step': 'structuring', 'message': 'Structuring into SOAP format...'})}\n\n"

        # Generate structured response
        response = await medgemma.generate(
            prompt=prompt,
            temperature=0.2,
            max_tokens=3000,
        )

        # Parse JSON response
        try:
            result = medgemma._parse_json_response(response)

            # Ensure required structure
            if "corrections" not in result:
                result["corrections"] = []
            if "soap" not in result:
                result["soap"] = {}

            result["metadata"] = {
                "timestamp": __import__("datetime").datetime.now().isoformat(),
                "processing_model": "medgemma-1.5-4b-it",
                "dictation_length": len(dictation_text),
            }

            yield f"data: {json.dumps({'type': 'result', 'data': result})}\n\n"

        except Exception as parse_error:
            logger.warning("Failed to parse SOAP response", error=str(parse_error))
            # Return raw text if parsing fails
            yield f"data: {json.dumps({'type': 'result', 'data': {'raw_response': response, 'parse_error': str(parse_error), 'corrections': [], 'soap': {}}})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    except Exception as e:
        logger.error("Enhancement stream failed", error=str(e))
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


@router.post("/enhance")
async def enhance_dictation(request: EnhanceRequest):
    """Apply medical corrections and SOAP structure to transcript.

    Returns Server-Sent Events (SSE) stream with:
    - step: Progress updates
    - result: Structured SOAP note with corrections
    - error: If processing fails
    - done: Stream complete
    """
    return StreamingResponse(
        enhance_stream_generator(request.dictation_text),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/enhance-sync", response_model=SOAPNote)
async def enhance_dictation_sync(request: EnhanceRequest):
    """Apply medical corrections and SOAP structure (non-streaming).

    Returns structured SOAP note when processing completes.
    """
    medgemma = get_medgemma_client()

    prompt = SOAP_STRUCTURING_PROMPT.format(dictation_text=request.dictation_text)

    try:
        response = await medgemma.generate(
            prompt=prompt,
            temperature=0.2,
            max_tokens=3000,
        )

        result = medgemma._parse_json_response(response)

        if "corrections" not in result:
            result["corrections"] = []
        if "soap" not in result:
            result["soap"] = {}

        result["metadata"] = {
            "timestamp": __import__("datetime").datetime.now().isoformat(),
            "processing_model": "medgemma-1.5-4b-it",
        }

        return SOAPNote(**result)

    except Exception as e:
        logger.error("Enhancement failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


async def transcribe_and_structure_generator(audio_path: str):
    """Generate SSE stream for audio transcription and SOAP structuring."""
    try:
        yield f"data: {json.dumps({'type': 'step', 'step': 'transcribing', 'message': 'Transcribing audio...'})}\n\n"

        # Transcribe audio
        medasr = get_medasr_client()
        transcription = await medasr.transcribe(
            audio_path=audio_path,
            apply_corrections=True,
        )

        if transcription.get("error"):
            yield f"data: {json.dumps({'type': 'error', 'message': transcription['error']})}\n\n"
            return

        transcript_text = transcription.get("text", "")
        if not transcript_text:
            yield f"data: {json.dumps({'type': 'error', 'message': 'No speech detected in audio'})}\n\n"
            return

        yield f"data: {json.dumps({'type': 'transcript', 'data': {'text': transcript_text, 'duration': transcription.get('audio_duration_seconds', 0)}})}\n\n"

        yield f"data: {json.dumps({'type': 'step', 'step': 'structuring', 'message': 'Structuring into SOAP format...'})}\n\n"

        # Structure into SOAP
        medgemma = get_medgemma_client()
        prompt = SOAP_STRUCTURING_PROMPT.format(dictation_text=transcript_text)

        response = await medgemma.generate(
            prompt=prompt,
            temperature=0.2,
            max_tokens=3000,
        )

        try:
            result = medgemma._parse_json_response(response)

            if "corrections" not in result:
                result["corrections"] = []
            if "soap" not in result:
                result["soap"] = {}

            result["metadata"] = {
                "timestamp": __import__("datetime").datetime.now().isoformat(),
                "processing_model": "medgemma-1.5-4b-it",
                "audio_duration_seconds": transcription.get("audio_duration_seconds", 0),
                "transcription_model": transcription.get("model", "unknown"),
            }

            yield f"data: {json.dumps({'type': 'result', 'data': result})}\n\n"

        except Exception as parse_error:
            logger.warning("Failed to parse SOAP response", error=str(parse_error))
            yield f"data: {json.dumps({'type': 'result', 'data': {'raw_response': response, 'corrections': [], 'soap': {}}})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    except Exception as e:
        logger.error("Transcribe and structure failed", error=str(e))
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


@router.post("/transcribe")
async def transcribe_audio(audio: UploadFile = File(...)):
    """Transcribe audio to text using MedASR (no SOAP structuring).

    Returns JSON: {"text": "...", "duration": 0.0}
    """
    content_type = audio.content_type or ""
    if not content_type.startswith("audio/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {content_type}. Expected audio file.",
        )

    try:
        suffix = Path(audio.filename or "audio.webm").suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            content = await audio.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        medasr = get_medasr_client()
        transcription = await medasr.transcribe(
            audio_path=tmp_path,
            apply_corrections=True,
        )

        if transcription.get("error"):
            raise HTTPException(status_code=500, detail=transcription["error"])

        text = transcription.get("text", "")
        if not text:
            raise HTTPException(status_code=422, detail="No speech detected in audio")

        return {
            "text": text,
            "duration": transcription.get("audio_duration_seconds", 0),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Transcription failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/transcribe-and-structure")
async def transcribe_and_structure(audio: UploadFile = File(...)):
    """Full pipeline for audio transcription and SOAP structuring.

    Accepts audio file upload, transcribes using MedASR, then structures
    into SOAP format using MedGemma.

    Returns Server-Sent Events (SSE) stream with:
    - step: Progress updates (transcribing, structuring)
    - transcript: Raw transcription result
    - result: Structured SOAP note
    - error: If processing fails
    - done: Stream complete
    """
    # Validate file type
    content_type = audio.content_type or ""
    if not content_type.startswith("audio/"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type: {content_type}. Expected audio file.",
        )

    # Save uploaded file temporarily
    try:
        suffix = Path(audio.filename or "audio.webm").suffix
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            content = await audio.read()
            tmp_file.write(content)
            tmp_path = tmp_file.name

        logger.info(
            "Audio file uploaded",
            filename=audio.filename,
            size=len(content),
            path=tmp_path,
        )

        return StreamingResponse(
            transcribe_and_structure_generator(tmp_path),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    except Exception as e:
        logger.error("Failed to process audio upload", error=str(e))
        raise HTTPException(status_code=500, detail=str(e)) from e


# Example dictation for testing
EXAMPLE_DICTATION = """
Patient is a 65-year-old male presenting with chief complaint of chest pain that started about 2 hours ago.
He describes it as pressure-like, radiating to left arm, rated 7 out of 10.
History of hypertension and type 2 diabetes, currently on met form in 1000 milligrams twice daily and
lice in oh pril 10 milligrams daily.
Vital signs: blood pressure 158 over 95, heart rate 88, respiratory rate 18, oxygen sat 97 percent on room air.
Physical exam shows regular rate and rhythm, no murmurs, lungs clear bilaterally.
EKG shows ST elevations in leads V2 through V4.
Assessment is likely STEMI, acute ST elevation myocardial infarction.
Plan: Activate cath lab, give aspirin 325 milligrams, start heparin drip,
cardiology consult stat, admit to CCU.
"""


@router.get("/example")
async def get_example_dictation():
    """Get an example dictation for testing."""
    return {"dictation_text": EXAMPLE_DICTATION.strip()}
