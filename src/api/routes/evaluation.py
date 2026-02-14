"""Anchored evaluation API routes."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from src.evaluation.anchors import get_anchor_store
from src.evaluation.evaluator import get_anchored_evaluator

router = APIRouter(prefix="/evaluate", tags=["Evaluation"])


class EvaluatePaperRequest(BaseModel):
    title: str
    abstract: str
    full_text: str | None = None
    num_anchors: int = 3


class EvaluateTechniqueRequest(BaseModel):
    name: str
    description: str
    formula: str | None = None
    pseudocode: str | None = None


class EvaluateClaimRequest(BaseModel):
    statement: str
    evidence: str | None = None
    category: str | None = None


class EvaluationResponse(BaseModel):
    overall_score: float
    novelty_score: float
    methodology_score: float
    clarity_score: float
    significance_score: float
    summary: str
    strengths: list[str]
    weaknesses: list[str]
    confidence: float
    anchor_comparisons: list[dict[str, Any]] | None = None


@router.post("/paper", response_model=EvaluationResponse)
async def evaluate_paper(request: EvaluatePaperRequest):
    """Evaluate a paper using anchored comparison.

    Compares the paper against anchor papers with known quality scores
    to produce calibrated ratings on a 1-10 scale.

    The evaluation is grounded in real papers rather than arbitrary LLM judgments:
    - Score 9-10: Landmark paper level (e.g., Attention Is All You Need)
    - Score 7-8: Strong contribution (e.g., ViT, GPT-2)
    - Score 5-6: Solid incremental work
    - Score 1-4: Below average or weak contribution
    """
    evaluator = get_anchored_evaluator()

    result = await evaluator.evaluate_paper(
        title=request.title,
        abstract=request.abstract,
        full_text=request.full_text,
        num_anchors=request.num_anchors,
    )

    return EvaluationResponse(
        overall_score=result.overall_score,
        novelty_score=result.novelty_score,
        methodology_score=result.methodology_score,
        clarity_score=result.clarity_score,
        significance_score=result.significance_score,
        summary=result.summary,
        strengths=result.strengths,
        weaknesses=result.weaknesses,
        confidence=result.confidence,
        anchor_comparisons=[
            {
                "anchor_id": c.anchor_id,
                "anchor_title": c.anchor_title,
                "anchor_score": c.anchor_score,
                "comparison": c.comparison.value,
                "reasoning": c.reasoning,
            }
            for c in result.anchor_comparisons
        ],
    )


@router.post("/technique", response_model=EvaluationResponse)
async def evaluate_technique(request: EvaluateTechniqueRequest):
    """Evaluate a technique using anchored comparison.

    Compares the technique against well-known techniques from landmark papers
    (e.g., self-attention, residual connections, layer normalization).
    """
    evaluator = get_anchored_evaluator()

    result = await evaluator.evaluate_technique(
        name=request.name,
        description=request.description,
        formula=request.formula,
        pseudocode=request.pseudocode,
    )

    return EvaluationResponse(
        overall_score=result.overall_score,
        novelty_score=result.novelty_score,
        methodology_score=result.methodology_score,
        clarity_score=result.clarity_score,
        significance_score=result.significance_score,
        summary=result.summary,
        strengths=result.strengths,
        weaknesses=result.weaknesses,
        confidence=result.confidence,
    )


@router.post("/claim", response_model=EvaluationResponse)
async def evaluate_claim(request: EvaluateClaimRequest):
    """Evaluate a claim using anchored comparison.

    Compares the claim's significance and support against claims
    from landmark papers to produce calibrated ratings.
    """
    evaluator = get_anchored_evaluator()

    result = await evaluator.evaluate_claim(
        statement=request.statement,
        evidence=request.evidence,
        category=request.category,
    )

    return EvaluationResponse(
        overall_score=result.overall_score,
        novelty_score=result.novelty_score,
        methodology_score=result.methodology_score,
        clarity_score=result.clarity_score,
        significance_score=result.significance_score,
        summary=result.summary,
        strengths=result.strengths,
        weaknesses=result.weaknesses,
        confidence=result.confidence,
    )


@router.get("/anchors")
async def get_anchors(
    domain: str | None = None,
    tier: str | None = None,
):
    """Get available anchor papers.

    Anchor papers are reference papers with known quality scores used
    for calibrated evaluation.
    """
    store = get_anchor_store()
    await store.initialize()

    if domain:
        anchors = store.get_anchors_by_domain(domain)
    elif tier:
        anchors = store.get_anchors_by_tier(tier)
    else:
        anchors = store.get_all_anchors()

    return {
        "anchors": [
            {
                "id": a.id,
                "title": a.title,
                "venue": a.venue,
                "venue_tier": a.venue_tier,
                "year": a.year,
                "domain": a.domain,
                "overall_score": a.overall_score,
                "novelty_score": a.novelty_score,
                "methodology_score": a.methodology_score,
                "citation_count": a.citation_count,
            }
            for a in anchors
        ],
        "total": len(anchors),
        "domains": list(store.domain_index.keys()),
        "tiers": list(store.tier_index.keys()),
    }


@router.get("/scale")
async def get_evaluation_scale():
    """Get the evaluation scale description."""
    return {
        "scale": {
            "min": 1,
            "max": 10,
            "levels": [
                {
                    "range": "9-10",
                    "label": "Landmark",
                    "description": "Field-defining work (e.g., Transformers, ResNet, BERT)",
                    "examples": ["Attention Is All You Need", "Deep Residual Learning"],
                },
                {
                    "range": "7-8",
                    "label": "Strong",
                    "description": "Significant contribution with lasting impact",
                    "examples": ["Vision Transformer", "GPT-2"],
                },
                {
                    "range": "5-6",
                    "label": "Solid",
                    "description": "Good incremental work, publishable quality",
                    "examples": ["Typical top-venue paper"],
                },
                {
                    "range": "3-4",
                    "label": "Marginal",
                    "description": "Limited novelty or weak methodology",
                    "examples": ["Minor variations, weak experiments"],
                },
                {
                    "range": "1-2",
                    "label": "Poor",
                    "description": "Significant issues or lack of contribution",
                    "examples": ["Flawed methodology, no novelty"],
                },
            ],
        },
        "dimensions": [
            {"name": "overall_score", "description": "Overall quality assessment"},
            {"name": "novelty_score", "description": "Originality of contribution"},
            {"name": "methodology_score", "description": "Rigor of approach"},
            {"name": "clarity_score", "description": "Quality of presentation"},
            {"name": "significance_score", "description": "Impact potential"},
        ],
    }
