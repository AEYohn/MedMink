"""Knowledge graph API routes."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from src.api.deps import get_kg
from src.kg import KnowledgeGraph

router = APIRouter(prefix="/graph", tags=["Knowledge Graph"])


def parse_confidence(value: Any) -> float:
    """Convert confidence value to float."""
    if isinstance(value, int | float):
        return float(value)
    if isinstance(value, str):
        mapping = {
            "high": 0.9,
            "medium": 0.6,
            "low": 0.3,
            "very high": 0.95,
            "very low": 0.1,
        }
        return mapping.get(value.lower(), 0.5)
    return 0.5


class PaperResponse(BaseModel):
    id: str
    arxiv_id: str
    title: str
    abstract: str
    authors: list[str]
    categories: list[str]
    published_date: str | None
    pdf_url: str | None = None
    analyzed: bool


class ClaimResponse(BaseModel):
    id: str
    paper_id: str
    statement: str
    category: str
    status: str
    confidence: float


class TrendResponse(BaseModel):
    id: str
    name: str
    description: str
    direction: str
    velocity: float
    confidence: float


class ContradictionResponse(BaseModel):
    claim1: ClaimResponse
    claim2: ClaimResponse
    strength: float
    explanation: str


class PredictionResponse(BaseModel):
    id: str
    statement: str
    category: str
    confidence: float
    timeframe: str
    outcome: str
    due_date: str | None


class TechniqueResponse(BaseModel):
    id: str
    name: str
    technique_type: str
    description: str
    formula: str | None
    pseudocode: str | None
    implementation_notes: str | None
    is_novel: bool
    improves_upon: str | None
    paper_count: int


class GraphStatsResponse(BaseModel):
    papers: int
    claims: int
    methods: int
    techniques: int = 0
    trends: int
    predictions: int
    contradictions: int


@router.get("/stats", response_model=GraphStatsResponse)
async def get_graph_stats(kg: KnowledgeGraph = Depends(get_kg)):
    """Get knowledge graph statistics."""
    stats = await kg.get_stats()
    return GraphStatsResponse(**stats)


@router.get("/papers", response_model=list[PaperResponse])
async def get_papers(
    limit: int = Query(default=50, le=200),
    analyzed: bool | None = None,
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Get papers from the knowledge graph."""
    if analyzed is False:
        papers = await kg.get_unanalyzed_papers(limit=limit)
    else:
        # Get all papers (would need to add method)
        papers = await kg.get_unanalyzed_papers(limit=limit)  # Placeholder

    return [
        PaperResponse(
            id=p.id,
            arxiv_id=p.arxiv_id,
            title=p.title,
            abstract=p.abstract[:500] + "..." if len(p.abstract) > 500 else p.abstract,
            authors=p.authors,
            categories=p.categories,
            published_date=p.published_date.isoformat() if p.published_date else None,
            pdf_url=p.pdf_url,
            analyzed=p.analyzed,
        )
        for p in papers
    ]


@router.get("/papers/{paper_id}")
async def get_paper(paper_id: str, kg: KnowledgeGraph = Depends(get_kg)):
    """Get a specific paper with its claims and methods."""
    paper = await kg.get_paper(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    claims = await kg.get_claims_for_paper(paper_id)

    return {
        "paper": PaperResponse(
            id=paper.id,
            arxiv_id=paper.arxiv_id,
            title=paper.title,
            abstract=paper.abstract,
            authors=paper.authors,
            categories=paper.categories,
            published_date=paper.published_date.isoformat() if paper.published_date else None,
            analyzed=paper.analyzed,
        ),
        "claims": [
            ClaimResponse(
                id=c.id,
                paper_id=c.paper_id,
                statement=c.statement,
                category=c.category,
                status=c.status,
                confidence=c.confidence,
            )
            for c in claims
        ],
    }


@router.get("/claims", response_model=list[ClaimResponse])
async def get_claims(
    limit: int = Query(default=100, le=500),
    category: str | None = None,
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Get claims from the knowledge graph."""
    claims = await kg.get_all_claims(limit=limit)

    if category:
        claims = [c for c in claims if c.category == category]

    return [
        ClaimResponse(
            id=c.id,
            paper_id=c.paper_id,
            statement=c.statement,
            category=c.category,
            status=c.status,
            confidence=parse_confidence(c.confidence),
        )
        for c in claims
    ]


@router.get("/trends", response_model=list[TrendResponse])
async def get_trends(
    limit: int = Query(default=20, le=50),
    direction: str | None = None,
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Get research trends."""
    if direction == "rising":
        trends = await kg.get_rising_trends(limit=limit)
    else:
        trends = await kg.get_trends(limit=limit)

    return [
        TrendResponse(
            id=t.id,
            name=t.name,
            description=t.description,
            direction=t.direction,
            velocity=float(t.velocity) if t.velocity else 0.0,
            confidence=parse_confidence(t.confidence),
        )
        for t in trends
    ]


@router.get("/techniques", response_model=list[TechniqueResponse])
async def get_techniques(
    limit: int = Query(default=100, le=500),
    technique_type: str | None = None,
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Get techniques, algorithms, and mathematical formulations."""
    techniques = await kg.get_techniques(limit=limit)

    if technique_type:
        techniques = [t for t in techniques if t.technique_type == technique_type]

    return [
        TechniqueResponse(
            id=t.id,
            name=t.name,
            technique_type=t.technique_type,
            description=t.description,
            formula=t.formula,
            pseudocode=getattr(t, "pseudocode", None),
            implementation_notes=getattr(t, "implementation_notes", None),
            is_novel=t.is_novel,
            improves_upon=t.improves_upon,
            paper_count=t.paper_count,
        )
        for t in techniques
    ]


@router.get("/contradictions", response_model=list[ContradictionResponse])
async def get_contradictions(
    limit: int = Query(default=20, le=100),
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Get detected contradictions."""
    contradictions = await kg.get_contradictions(limit=limit)

    return [
        ContradictionResponse(
            claim1=ClaimResponse(
                id=c["claim1"].id,
                paper_id=c["claim1"].paper_id,
                statement=c["claim1"].statement,
                category=c["claim1"].category,
                status=c["claim1"].status,
                confidence=c["claim1"].confidence,
            ),
            claim2=ClaimResponse(
                id=c["claim2"].id,
                paper_id=c["claim2"].paper_id,
                statement=c["claim2"].statement,
                category=c["claim2"].category,
                status=c["claim2"].status,
                confidence=c["claim2"].confidence,
            ),
            strength=c["relation"].get("strength", 0.5),
            explanation=c["relation"].get("explanation", ""),
        )
        for c in contradictions
    ]


@router.get("/predictions", response_model=list[PredictionResponse])
async def get_predictions(
    outcome: str | None = None,
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Get predictions."""
    if outcome == "pending":
        predictions = await kg.get_pending_predictions()
    else:
        predictions = await kg.get_pending_predictions()  # Would add filter

    return [
        PredictionResponse(
            id=p.id,
            statement=p.statement,
            category=p.category,
            confidence=p.confidence,
            timeframe=p.timeframe,
            outcome=p.outcome,
            due_date=p.due_date.isoformat() if p.due_date else None,
        )
        for p in predictions
    ]


@router.get("/predictions/accuracy")
async def get_prediction_accuracy(kg: KnowledgeGraph = Depends(get_kg)):
    """Get prediction accuracy statistics."""
    return await kg.get_prediction_accuracy()


@router.get("/methods")
async def get_methods(
    limit: int = Query(default=20, le=100),
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Get popular methods."""
    methods = await kg.get_popular_methods(limit=limit)

    return [
        {
            "id": m.id,
            "name": m.name,
            "description": m.description,
            "paper_count": m.paper_count,
            "is_novel": m.is_novel,
        }
        for m in methods
    ]


class ClearDataResponse(BaseModel):
    message: str
    deleted_counts: dict[str, int]


@router.delete("/clear", response_model=ClearDataResponse)
async def clear_all_data(
    confirm: bool = Query(default=False, description="Must be true to confirm deletion"),
    kg: KnowledgeGraph = Depends(get_kg),
):
    """Clear all data from the knowledge graph. USE WITH EXTREME CAUTION.

    Requires confirm=true query parameter to proceed.
    """
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="Must set confirm=true to clear all data. This action is irreversible.",
        )

    deleted_counts = await kg.clear_all_data()

    return ClearDataResponse(
        message="All data has been cleared from the knowledge graph",
        deleted_counts=deleted_counts,
    )
