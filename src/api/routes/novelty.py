"""Novelty detection API routes."""

from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel

from src.novelty.checker import get_novelty_checker, NoveltyLevel

router = APIRouter(prefix="/novelty", tags=["Novelty"])


class CheckTechniqueRequest(BaseModel):
    name: str
    description: str
    formula: str | None = None
    top_k: int = 5


class CheckClaimRequest(BaseModel):
    statement: str
    category: str | None = None
    top_k: int = 5


class CheckPaperRequest(BaseModel):
    title: str
    abstract: str
    top_k: int = 5


class NoveltyResponse(BaseModel):
    novelty_score: float
    novelty_level: str
    max_similarity: float
    explanation: str
    should_pivot: bool
    similar_items: list[dict[str, Any]]


@router.post("/check/technique", response_model=NoveltyResponse)
async def check_technique_novelty(request: CheckTechniqueRequest):
    """Check novelty of a technique.

    Compares the technique against existing techniques in the knowledge graph
    and returns a novelty score and similar items.

    Novelty levels:
    - highly_novel: < 0.70 max similarity - New concept
    - moderately_novel: 0.70-0.82 similarity - Notable differences
    - incremental: 0.82-0.88 similarity - Minor improvement
    - derivative: > 0.88 similarity - Very similar to existing
    """
    checker = get_novelty_checker()

    result = await checker.check_technique_novelty(
        name=request.name,
        description=request.description,
        formula=request.formula,
        top_k=request.top_k,
    )

    return NoveltyResponse(
        novelty_score=result.novelty_score,
        novelty_level=result.novelty_level.value,
        max_similarity=result.max_similarity,
        explanation=result.explanation,
        should_pivot=result.should_pivot,
        similar_items=result.similar_items,
    )


@router.post("/check/claim", response_model=NoveltyResponse)
async def check_claim_novelty(request: CheckClaimRequest):
    """Check novelty of a claim.

    Compares the claim against existing claims in the knowledge graph
    and returns a novelty score and similar items.
    """
    checker = get_novelty_checker()

    result = await checker.check_claim_novelty(
        statement=request.statement,
        category=request.category,
        top_k=request.top_k,
    )

    return NoveltyResponse(
        novelty_score=result.novelty_score,
        novelty_level=result.novelty_level.value,
        max_similarity=result.max_similarity,
        explanation=result.explanation,
        should_pivot=result.should_pivot,
        similar_items=result.similar_items,
    )


@router.post("/check/paper", response_model=NoveltyResponse)
async def check_paper_novelty(request: CheckPaperRequest):
    """Check novelty of a paper.

    Compares the paper against existing papers in the knowledge graph
    and returns a novelty score and similar papers.
    """
    checker = get_novelty_checker()

    result = await checker.check_paper_novelty(
        title=request.title,
        abstract=request.abstract,
        top_k=request.top_k,
    )

    return NoveltyResponse(
        novelty_score=result.novelty_score,
        novelty_level=result.novelty_level.value,
        max_similarity=result.max_similarity,
        explanation=result.explanation,
        should_pivot=result.should_pivot,
        similar_items=result.similar_items,
    )


@router.get("/thresholds")
async def get_novelty_thresholds():
    """Get the novelty detection thresholds."""
    from src.novelty.checker import SIMILARITY_THRESHOLDS

    return {
        "thresholds": {
            "derivative": {
                "min_similarity": SIMILARITY_THRESHOLDS["high"],
                "description": "Very similar to existing work",
            },
            "incremental": {
                "min_similarity": SIMILARITY_THRESHOLDS["medium"],
                "max_similarity": SIMILARITY_THRESHOLDS["high"],
                "description": "Minor improvement over existing work",
            },
            "moderately_novel": {
                "min_similarity": SIMILARITY_THRESHOLDS["low"],
                "max_similarity": SIMILARITY_THRESHOLDS["medium"],
                "description": "Notable differences from existing work",
            },
            "highly_novel": {
                "max_similarity": SIMILARITY_THRESHOLDS["low"],
                "description": "New concept with no close matches",
            },
        },
        "levels": [level.value for level in NoveltyLevel],
    }


@router.post("/batch/techniques")
async def batch_check_techniques(
    techniques: list[CheckTechniqueRequest],
):
    """Check novelty for multiple techniques in batch."""
    checker = get_novelty_checker()

    results = await checker.batch_check_techniques([
        {
            "name": t.name,
            "description": t.description,
            "formula": t.formula,
        }
        for t in techniques
    ])

    return {
        "results": [
            {
                "name": techniques[i].name,
                "novelty_score": r.novelty_score,
                "novelty_level": r.novelty_level.value,
                "should_pivot": r.should_pivot,
            }
            for i, r in enumerate(results)
        ],
        "summary": {
            "total": len(results),
            "highly_novel": sum(1 for r in results if r.novelty_level == NoveltyLevel.HIGHLY_NOVEL),
            "moderately_novel": sum(1 for r in results if r.novelty_level == NoveltyLevel.MODERATELY_NOVEL),
            "incremental": sum(1 for r in results if r.novelty_level == NoveltyLevel.INCREMENTAL),
            "derivative": sum(1 for r in results if r.novelty_level == NoveltyLevel.DERIVATIVE),
        },
    }
