"""Consensus API endpoints with streaming support.

Provides real-time streaming updates during multi-model analysis.
"""

import asyncio
import json
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.agents.medical_agent import MedicalLiteratureAgent
from src.medgemma.consensus import (
    get_consensus_engine,
    StepUpdate,
    ConsensusResult,
    ConsensusStep,
)
from src.dspy_analysis.medical_signatures import PICOElements

logger = structlog.get_logger()
router = APIRouter(prefix="/consensus", tags=["consensus"])


class ConsensusRequest(BaseModel):
    """Request for consensus analysis."""
    question: str = Field(..., min_length=10, max_length=2000)
    include_preprints: bool = Field(default=False)
    max_papers: int = Field(default=5, ge=3, le=20)


class ConsensusResponse(BaseModel):
    """Final consensus response."""
    question: str
    pico: dict[str, str]

    # Perspectives
    primary_synthesis: str
    primary_grade: str
    primary_confidence: float
    primary_key_points: list[str]

    skeptical_synthesis: str
    skeptical_concerns: list[str]

    # Vision (optional)
    vision_findings: list[str] | None = None

    # Consensus
    agreement_score: float
    divergence_points: list[str]
    final_synthesis: str
    final_recommendation: str
    final_grade: str
    confidence: float

    # Sources
    papers: list[dict[str, Any]]
    search_terms: list[str]


def serialize_step_update(update: StepUpdate) -> str:
    """Serialize step update to SSE format."""
    data = {
        "type": "step",
        "step": update.step.value,
        "status": update.status,
        "message": update.message,
        "progress": update.progress,
        "data": update.data,
    }
    return f"data: {json.dumps(data)}\n\n"


def serialize_result(result: ConsensusResult) -> str:
    """Serialize final result to SSE format."""
    data = {
        "type": "result",
        "question": result.question,
        "pico": result.pico,
        "primary_synthesis": result.primary.synthesis,
        "primary_grade": result.primary.evidence_grade,
        "primary_confidence": result.primary.confidence,
        "primary_key_points": result.primary.key_points,
        "skeptical_synthesis": result.skeptical.synthesis,
        "skeptical_concerns": result.skeptical.concerns,
        "vision_findings": result.vision.key_points if result.vision else None,
        "agreement_score": result.agreement_score,
        "divergence_points": result.divergence_points,
        "final_synthesis": result.final_synthesis,
        "final_recommendation": result.final_recommendation,
        "final_grade": result.final_grade,
        "confidence": result.confidence,
        "papers": result.papers,
        "search_terms": result.search_terms,
    }
    return f"data: {json.dumps(data)}\n\n"


async def consensus_stream_generator(
    question: str,
    include_preprints: bool,
    max_papers: int,
    image_path: str | None = None,
):
    """Generate SSE stream for consensus analysis."""
    engine = get_consensus_engine()
    agent = MedicalLiteratureAgent()

    try:
        # Step 1: PICO extraction
        yield f"data: {json.dumps({'type': 'step', 'step': 'parsing', 'status': 'started', 'message': 'Parsing clinical question...', 'progress': 0.05})}\n\n"

        pico, search_terms = await agent._parse_question(question)
        pico_dict = {
            "population": pico.population,
            "intervention": pico.intervention,
            "comparison": pico.comparison,
            "outcome": pico.outcome,
            "question_type": pico.question_type,
        }

        yield f"data: {json.dumps({'type': 'step', 'step': 'parsing', 'status': 'completed', 'message': f'PICO extracted: {pico.intervention} for {pico.population[:30]}...', 'progress': 0.1, 'data': pico_dict})}\n\n"

        # Step 2: Evidence search
        yield f"data: {json.dumps({'type': 'step', 'step': 'evidence_search', 'status': 'started', 'message': 'Searching medical literature...', 'progress': 0.12})}\n\n"

        papers = await agent._retrieve_papers(
            pico=pico,
            search_terms=search_terms,
            include_preprints=include_preprints,
            max_papers=max_papers,
        )
        paper_dicts = [agent._paper_to_dict(p) for p in papers]

        yield f"data: {json.dumps({'type': 'step', 'step': 'evidence_search', 'status': 'completed', 'message': f'Found {len(papers)} relevant papers', 'progress': 0.2, 'data': {'count': len(papers)}})}\n\n"

        # Step 3-6: Consensus analysis with streaming
        async for update in engine.analyze_with_consensus(
            question=question,
            papers=paper_dicts,
            pico=pico_dict,
            image_path=image_path,
        ):
            if isinstance(update, StepUpdate):
                yield serialize_step_update(update)
            elif isinstance(update, ConsensusResult):
                yield serialize_result(update)

        # Done
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    except Exception as e:
        logger.error("Consensus stream failed", error=str(e))
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


@router.post("/analyze/stream")
async def analyze_with_consensus_stream(request: ConsensusRequest):
    """Analyze clinical question with multi-model consensus (streaming).

    Returns Server-Sent Events (SSE) stream with real-time progress updates.

    Event types:
    - step: Pipeline step update with progress
    - result: Final consensus result
    - error: Error occurred
    - done: Stream complete
    """
    return StreamingResponse(
        consensus_stream_generator(
            question=request.question,
            include_preprints=request.include_preprints,
            max_papers=request.max_papers,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/analyze", response_model=ConsensusResponse)
async def analyze_with_consensus(request: ConsensusRequest):
    """Analyze clinical question with multi-model consensus (non-streaming).

    For clients that don't support SSE. Returns final result only.
    """
    engine = get_consensus_engine()
    agent = MedicalLiteratureAgent()

    try:
        # PICO extraction
        pico, search_terms = await agent._parse_question(request.question)
        pico_dict = {
            "population": pico.population,
            "intervention": pico.intervention,
            "comparison": pico.comparison,
            "outcome": pico.outcome,
            "question_type": pico.question_type,
        }

        # Evidence search
        papers = await agent._retrieve_papers(
            pico=pico,
            search_terms=search_terms,
            include_preprints=request.include_preprints,
            max_papers=request.max_papers,
        )
        paper_dicts = [agent._paper_to_dict(p) for p in papers]

        # Consensus analysis
        result = None
        async for update in engine.analyze_with_consensus(
            question=request.question,
            papers=paper_dicts,
            pico=pico_dict,
        ):
            if isinstance(update, ConsensusResult):
                result = update

        if not result:
            raise HTTPException(status_code=500, detail="Consensus analysis failed")

        return ConsensusResponse(
            question=result.question,
            pico=result.pico,
            primary_synthesis=result.primary.synthesis,
            primary_grade=result.primary.evidence_grade,
            primary_confidence=result.primary.confidence,
            primary_key_points=result.primary.key_points,
            skeptical_synthesis=result.skeptical.synthesis,
            skeptical_concerns=result.skeptical.concerns,
            vision_findings=result.vision.key_points if result.vision else None,
            agreement_score=result.agreement_score,
            divergence_points=result.divergence_points,
            final_synthesis=result.final_synthesis,
            final_recommendation=result.final_recommendation,
            final_grade=result.final_grade,
            confidence=result.confidence,
            papers=result.papers,
            search_terms=result.search_terms,
        )

    except Exception as e:
        logger.error("Consensus analysis failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze/image/stream")
async def analyze_image_with_consensus_stream(
    image: UploadFile = File(...),
    question: str = Form(...),
    include_preprints: bool = Form(default=False),
    max_papers: int = Form(default=5),
):
    """Analyze medical image with clinical context (streaming).

    Supports X-rays, CT scans, MRI, pathology slides, dermatology images.
    """
    # Save uploaded image temporarily
    import tempfile
    import os

    try:
        suffix = os.path.splitext(image.filename)[1] if image.filename else ".png"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await image.read()
            tmp.write(content)
            image_path = tmp.name

        return StreamingResponse(
            consensus_stream_generator(
                question=question,
                include_preprints=include_preprints,
                max_papers=max_papers,
                image_path=image_path,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        )
    except Exception as e:
        logger.error("Image analysis failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
