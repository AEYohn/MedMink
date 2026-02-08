"""Medical and Healthcare API endpoints.

Provides endpoints for:
- Clinical evidence queries
- Multi-model routed healthcare assistant
- Drug interaction checking
- PubMed ingestion
"""

from typing import Any

import structlog
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.agents.healthcare_assistant import HealthcareAssistant, ask_healthcare_assistant
from src.agents.medical_agent import ask_clinical_question
from src.agents.ingest_pubmed import search_pubmed_papers
from src.agents.ingest_medxiv import search_preprints
from src.routing import get_task_router, get_model_registry

logger = structlog.get_logger()
router = APIRouter(prefix="/medical", tags=["medical"])


# ============================================================================
# Request/Response Models
# ============================================================================


class ClinicalQueryRequest(BaseModel):
    """Request for clinical evidence query."""

    question: str = Field(..., min_length=10, max_length=2000, description="Clinical question")
    include_preprints: bool = Field(default=True, description="Include medRxiv preprints")
    max_papers: int = Field(default=10, ge=5, le=50, description="Maximum papers to retrieve")


class ClinicalQueryResponse(BaseModel):
    """Response for clinical evidence query."""

    question: str
    pico: dict[str, str]
    synthesis: str
    evidence_grade: str
    key_findings: list[dict[str, Any]]
    contradictions: list[dict[str, Any]]
    recommendation: str
    recommendation_strength: str
    papers: list[dict[str, Any]]
    limitations: list[str]
    search_terms: list[str]
    confidence: float


class HealthcareQueryRequest(BaseModel):
    """Request for healthcare assistant."""

    query: str = Field(..., min_length=5, max_length=2000, description="Healthcare query")
    context: str = Field(default="", max_length=500, description="Additional context")
    prefer_local: bool = Field(default=True, description="Prefer local models")


class HealthcareQueryResponse(BaseModel):
    """Response from healthcare assistant."""

    query: str
    response: str
    task_type: str
    model_used: str
    confidence: float
    reasoning: str
    sources: list[dict[str, Any]]
    metadata: dict[str, Any]


class PubMedSearchRequest(BaseModel):
    """Request for PubMed search."""

    query: str | None = Field(default=None, description="Free text search query")
    mesh_terms: list[str] | None = Field(default=None, description="MeSH terms to search")
    article_types: list[str] | None = Field(default=None, description="Article type filters")
    max_results: int = Field(default=50, ge=10, le=200, description="Maximum results")
    date_range: tuple[str, str] | None = Field(default=None, description="Date range (YYYY/MM/DD)")


class PreprintSearchRequest(BaseModel):
    """Request for medRxiv/bioRxiv search."""

    server: str = Field(default="medrxiv", pattern="^(medrxiv|biorxiv)$")
    days_back: int = Field(default=30, ge=7, le=365)
    categories: list[str] | None = Field(default=None)
    keywords: list[str] | None = Field(default=None)
    max_results: int = Field(default=50, ge=10, le=200)


class PaperResponse(BaseModel):
    """Paper summary in response."""

    id: str
    title: str
    abstract: str
    authors: list[str]
    published: str | None
    source: str
    url: str | None


class ModelInfo(BaseModel):
    """Information about an available model."""

    name: str
    provider: str
    capabilities: list[str]
    is_local: bool
    supports_medical: bool
    priority: int


class RoutingInfo(BaseModel):
    """Information about query routing."""

    task_type: str
    model_name: str
    confidence: float
    reasoning: str
    fallback_models: list[str]


# ============================================================================
# Endpoints
# ============================================================================


@router.post("/ask", response_model=ClinicalQueryResponse)
async def clinical_evidence_query(request: ClinicalQueryRequest):
    """Query clinical evidence from medical literature.

    Uses PICO framework to parse the question, searches PubMed and medRxiv,
    grades evidence using GRADE methodology, and synthesizes findings.
    """
    try:
        answer = await ask_clinical_question(
            question=request.question,
            include_preprints=request.include_preprints,
            max_papers=request.max_papers,
        )

        return ClinicalQueryResponse(
            question=answer.question,
            pico=answer.pico,
            synthesis=answer.synthesis,
            evidence_grade=answer.evidence_grade,
            key_findings=answer.key_findings,
            contradictions=answer.contradictions,
            recommendation=answer.recommendation,
            recommendation_strength=answer.recommendation_strength,
            papers=answer.papers,
            limitations=answer.limitations,
            search_terms=answer.search_terms,
            confidence=answer.confidence,
        )

    except Exception as e:
        logger.error("Clinical query failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/assistant", response_model=HealthcareQueryResponse)
async def healthcare_assistant_query(request: HealthcareQueryRequest):
    """Ask the healthcare assistant any medical question.

    Intelligently routes queries to the optimal model:
    - Literature queries → MedGemma
    - Complex reasoning → Gemini Pro
    - Documentation → Gemma Flash
    """
    try:
        response = await ask_healthcare_assistant(
            query=request.query,
            context=request.context,
            prefer_local=request.prefer_local,
        )

        return HealthcareQueryResponse(
            query=response.query,
            response=response.response,
            task_type=response.task_type,
            model_used=response.model_used,
            confidence=response.confidence,
            reasoning=response.reasoning,
            sources=response.sources,
            metadata=response.metadata,
        )

    except Exception as e:
        logger.error("Healthcare assistant query failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/route")
async def route_query(request: HealthcareQueryRequest) -> RoutingInfo:
    """Preview how a query would be routed without executing it.

    Useful for understanding the routing logic and available models.
    """
    try:
        router = get_task_router()
        decision = await router.route(
            query=request.query,
            context=request.context,
            prefer_local=request.prefer_local,
        )

        return RoutingInfo(
            task_type=decision.task_type.value,
            model_name=decision.model_name,
            confidence=decision.confidence,
            reasoning=decision.reasoning,
            fallback_models=decision.fallback_models,
        )

    except Exception as e:
        logger.error("Routing failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models", response_model=list[ModelInfo])
async def list_models():
    """List all available models in the registry."""
    registry = get_model_registry()
    models = registry.list_models()

    return [
        ModelInfo(
            name=m.name,
            provider=m.provider,
            capabilities=[c.value for c in m.capabilities],
            is_local=m.is_local,
            supports_medical=m.supports_medical,
            priority=m.priority,
        )
        for m in models
    ]


@router.post("/ingest/pubmed", response_model=list[PaperResponse])
async def ingest_pubmed_papers(request: PubMedSearchRequest):
    """Search and ingest papers from PubMed.

    Fetches papers matching the query and adds them to the local store.
    """
    try:
        papers = await search_pubmed_papers(
            query=request.query,
            mesh_terms=request.mesh_terms,
            article_types=request.article_types,
            max_results=request.max_results,
            date_range=request.date_range,
        )

        return [
            PaperResponse(
                id=p.id,
                title=p.title,
                abstract=p.abstract[:500] + "..." if len(p.abstract) > 500 else p.abstract,
                authors=p.authors[:5],
                published=p.published.isoformat() if p.published else None,
                source=p.source,
                url=p.pdf_url,
            )
            for p in papers
        ]

    except Exception as e:
        logger.error("PubMed search failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ingest/preprints", response_model=list[PaperResponse])
async def ingest_preprints(request: PreprintSearchRequest):
    """Search and ingest preprints from medRxiv/bioRxiv."""
    try:
        papers = await search_preprints(
            server=request.server,
            days_back=request.days_back,
            categories=request.categories,
            keywords=request.keywords,
            max_results=request.max_results,
        )

        return [
            PaperResponse(
                id=p.id,
                title=p.title,
                abstract=p.abstract[:500] + "..." if len(p.abstract) > 500 else p.abstract,
                authors=p.authors[:5],
                published=p.published.isoformat() if p.published else None,
                source=p.source,
                url=p.pdf_url,
            )
            for p in papers
        ]

    except Exception as e:
        logger.error("Preprint search failed", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/health")
async def medical_health_check():
    """Check health of medical services."""
    from src.medgemma import get_medgemma_client
    from src.rag.local_chroma import get_local_chroma

    medgemma = get_medgemma_client()
    chroma = get_local_chroma()

    return {
        "status": "healthy",
        "medgemma_available": medgemma.is_available,
        "chroma_papers": chroma.count,
        "models_registered": len(get_model_registry().list_models()),
    }
