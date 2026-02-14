"""Lightweight consensus route for Modal deployment.

Avoids heavy dependencies (DSPy, chromadb, sentence-transformers, torch)
by using MedGemma directly for PICO extraction and PubMed for paper search.
"""

import json

import structlog
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from src.medgemma.client import get_medgemma_client
from src.medgemma.consensus import (
    ConsensusResult,
    StepUpdate,
    get_consensus_engine,
)

logger = structlog.get_logger()
router = APIRouter(prefix="/api/consensus", tags=["consensus"])


class ConsensusRequest(BaseModel):
    question: str = Field(..., min_length=10, max_length=2000)
    include_preprints: bool = Field(default=False)
    max_papers: int = Field(default=5, ge=3, le=20)


PICO_EXTRACTION_PROMPT = """Extract PICO elements from this clinical question.

Question: {question}

Output ONLY valid JSON:
{{
    "population": "target patient population",
    "intervention": "treatment or intervention being studied",
    "comparison": "comparator or control",
    "outcome": "primary outcomes of interest",
    "question_type": "treatment|diagnosis|prognosis|etiology|prevention",
    "search_terms": ["term1", "term2", "term3"]
}}"""


async def _extract_pico(question: str) -> tuple[dict[str, str], list[str]]:
    """Extract PICO elements using MedGemma."""
    client = get_medgemma_client()
    response = await client.generate(
        prompt=PICO_EXTRACTION_PROMPT.format(question=question),
        system_prompt="You are a medical librarian. Extract structured PICO elements from clinical questions.",
        temperature=0.2,
        max_tokens=512,
    )
    try:
        data = client._parse_json_response(response)
        search_terms = data.pop("search_terms", [])
        return data, search_terms
    except Exception:
        return {
            "population": "Not specified",
            "intervention": "Not specified",
            "comparison": "Standard care",
            "outcome": "Not specified",
            "question_type": "treatment",
        }, [question[:80]]


async def _search_pubmed(terms: list[str], max_results: int = 5) -> list[dict]:
    """Search PubMed for relevant papers via Entrez API."""
    try:
        from Bio import Entrez
        Entrez.email = "medlit-agent@example.com"

        query = " AND ".join(f"({t})" for t in terms[:4])
        handle = Entrez.esearch(db="pubmed", term=query, retmax=max_results, sort="relevance")
        record = Entrez.read(handle)
        handle.close()

        ids = record.get("IdList", [])
        if not ids:
            return []

        handle = Entrez.efetch(db="pubmed", id=",".join(ids), rettype="xml", retmode="xml")
        records = Entrez.read(handle)
        handle.close()

        papers = []
        for article in records.get("PubmedArticle", []):
            medline = article.get("MedlineCitation", {})
            art = medline.get("Article", {})
            title = str(art.get("ArticleTitle", ""))
            abstract_parts = art.get("Abstract", {}).get("AbstractText", [])
            abstract = " ".join(str(p) for p in abstract_parts)[:500]
            pmid = str(medline.get("PMID", ""))

            # Year
            pub_date = art.get("Journal", {}).get("JournalIssue", {}).get("PubDate", {})
            year = str(pub_date.get("Year", ""))

            papers.append({
                "title": title,
                "abstract": abstract,
                "pmid": pmid,
                "year": year,
            })

        return papers

    except Exception as e:
        logger.warning("PubMed search failed", error=str(e))
        return []


def _serialize_step(step: str, status: str, message: str, progress: float, data: dict | None = None) -> str:
    return f"data: {json.dumps({'type': 'step', 'step': step, 'status': status, 'message': message, 'progress': progress, 'data': data or {}})}\n\n"


def _serialize_result(result: ConsensusResult) -> str:
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


async def _stream_generator(question: str, include_preprints: bool, max_papers: int):
    """SSE stream for consensus analysis without heavy dependencies."""
    try:
        # Step 1: PICO extraction
        yield _serialize_step("parsing", "started", "Parsing clinical question...", 0.05)
        pico, search_terms = await _extract_pico(question)
        yield _serialize_step("parsing", "completed", f"PICO extracted: {pico.get('intervention', 'N/A')[:40]}", 0.1, pico)

        # Step 2: Evidence search
        yield _serialize_step("evidence_search", "started", "Searching PubMed...", 0.12)
        papers = await _search_pubmed(search_terms, max_results=max_papers)
        yield _serialize_step("evidence_search", "completed", f"Found {len(papers)} papers", 0.2, {"count": len(papers)})

        # Steps 3-6: Consensus engine (only uses medgemma client)
        engine = get_consensus_engine()
        async for update in engine.analyze_with_consensus(
            question=question,
            papers=papers,
            pico=pico,
        ):
            if isinstance(update, StepUpdate):
                yield f"data: {json.dumps({'type': 'step', 'step': update.step.value, 'status': update.status, 'message': update.message, 'progress': update.progress, 'data': update.data})}\n\n"
            elif isinstance(update, ConsensusResult):
                yield _serialize_result(update)

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    except Exception as e:
        logger.error("Consensus stream failed", error=str(e))
        yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"


@router.post("/analyze/stream")
async def analyze_stream(request: ConsensusRequest):
    """Streaming consensus analysis (lightweight, no DSPy/chromadb)."""
    return StreamingResponse(
        _stream_generator(request.question, request.include_preprints, request.max_papers),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/analyze")
async def analyze(request: ConsensusRequest):
    """Non-streaming consensus analysis."""
    pico, search_terms = await _extract_pico(request.question)
    papers = await _search_pubmed(search_terms, max_results=request.max_papers)

    engine = get_consensus_engine()
    result = None
    async for update in engine.analyze_with_consensus(
        question=request.question,
        papers=papers,
        pico=pico,
    ):
        if isinstance(update, ConsensusResult):
            result = update

    if not result:
        raise HTTPException(status_code=500, detail="Consensus analysis failed")

    return {
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
