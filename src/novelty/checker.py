"""Novelty checker for assessing research originality."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any

import structlog

from src.novelty.index import NoveltyIndex, get_novelty_index

logger = structlog.get_logger()


class NoveltyLevel(str, Enum):
    """Novelty classification levels."""

    HIGHLY_NOVEL = "highly_novel"  # < 0.70 max similarity
    MODERATELY_NOVEL = "moderately_novel"  # 0.70 - 0.82 similarity
    INCREMENTAL = "incremental"  # 0.82 - 0.88 similarity
    DERIVATIVE = "derivative"  # > 0.88 similarity (very similar to existing)


# Thresholds inspired by Idea2Paper
SIMILARITY_THRESHOLDS = {
    "high": 0.88,  # Above this = derivative
    "medium": 0.82,  # Above this = incremental
    "low": 0.70,  # Above this = moderately novel
}


@dataclass
class NoveltyResult:
    """Result of novelty assessment."""

    novelty_score: float  # 0-1 score (higher = more novel)
    novelty_level: NoveltyLevel
    max_similarity: float  # Highest similarity to existing items
    similar_items: list[dict[str, Any]] = field(default_factory=list)
    explanation: str = ""
    should_pivot: bool = False  # If true, item is too similar to existing work


def _similarity_to_novelty(similarity: float) -> float:
    """Convert similarity score to novelty score.

    Uses a non-linear mapping where:
    - 0.0 similarity -> 1.0 novelty (completely new)
    - 0.88 similarity -> 0.1 novelty (derivative)
    - 1.0 similarity -> 0.0 novelty (duplicate)
    """
    if similarity >= 1.0:
        return 0.0
    elif similarity >= SIMILARITY_THRESHOLDS["high"]:
        # Derivative range: 0.88-1.0 -> novelty 0.0-0.1
        return 0.1 * (1.0 - similarity) / (1.0 - SIMILARITY_THRESHOLDS["high"])
    elif similarity >= SIMILARITY_THRESHOLDS["medium"]:
        # Incremental range: 0.82-0.88 -> novelty 0.1-0.3
        range_size = SIMILARITY_THRESHOLDS["high"] - SIMILARITY_THRESHOLDS["medium"]
        return 0.1 + 0.2 * (SIMILARITY_THRESHOLDS["high"] - similarity) / range_size
    elif similarity >= SIMILARITY_THRESHOLDS["low"]:
        # Moderately novel range: 0.70-0.82 -> novelty 0.3-0.6
        range_size = SIMILARITY_THRESHOLDS["medium"] - SIMILARITY_THRESHOLDS["low"]
        return 0.3 + 0.3 * (SIMILARITY_THRESHOLDS["medium"] - similarity) / range_size
    else:
        # Highly novel range: 0.0-0.70 -> novelty 0.6-1.0
        return 0.6 + 0.4 * (SIMILARITY_THRESHOLDS["low"] - similarity) / SIMILARITY_THRESHOLDS["low"]


def _classify_novelty(max_similarity: float) -> NoveltyLevel:
    """Classify novelty level based on max similarity."""
    if max_similarity >= SIMILARITY_THRESHOLDS["high"]:
        return NoveltyLevel.DERIVATIVE
    elif max_similarity >= SIMILARITY_THRESHOLDS["medium"]:
        return NoveltyLevel.INCREMENTAL
    elif max_similarity >= SIMILARITY_THRESHOLDS["low"]:
        return NoveltyLevel.MODERATELY_NOVEL
    else:
        return NoveltyLevel.HIGHLY_NOVEL


class NoveltyChecker:
    """Checks novelty of techniques, claims, and papers.

    Inspired by Idea2Paper's novelty detection system.
    """

    def __init__(self, index: NoveltyIndex | None = None):
        self.index = index or get_novelty_index()
        self.collision_threshold = SIMILARITY_THRESHOLDS["high"]

    async def check_technique_novelty(
        self,
        name: str,
        description: str,
        formula: str | None = None,
        top_k: int = 5,
    ) -> NoveltyResult:
        """Check novelty of a technique.

        Args:
            name: Technique name
            description: Technique description
            formula: Optional formula
            top_k: Number of similar items to return

        Returns:
            NoveltyResult with score, level, and similar items
        """
        # Find similar techniques
        similar = await self.index.find_similar_techniques(
            name=name,
            description=description,
            formula=formula,
            limit=top_k,
            threshold=0.3,  # Low threshold to catch most similar items
        )

        # Calculate novelty
        max_similarity = similar[0].score if similar else 0.0
        novelty_score = _similarity_to_novelty(max_similarity)
        novelty_level = _classify_novelty(max_similarity)

        # Build explanation
        if novelty_level == NoveltyLevel.DERIVATIVE:
            explanation = f"Very similar to existing technique: {similar[0].metadata.get('name', 'unknown')}"
        elif novelty_level == NoveltyLevel.INCREMENTAL:
            explanation = f"Incremental improvement over: {similar[0].metadata.get('name', 'unknown')}"
        elif novelty_level == NoveltyLevel.MODERATELY_NOVEL:
            explanation = "Moderately novel - builds on existing concepts with notable differences"
        else:
            explanation = "Highly novel - no close matches in existing techniques"

        # Determine if pivot is needed
        should_pivot = max_similarity >= self.collision_threshold

        similar_items = [
            {
                "id": item.id,
                "name": item.metadata.get("name"),
                "description": item.metadata.get("description"),
                "similarity": item.score,
            }
            for item in similar
        ]

        logger.info(
            "Checked technique novelty",
            name=name,
            novelty_score=novelty_score,
            novelty_level=novelty_level.value,
            max_similarity=max_similarity,
            similar_count=len(similar),
        )

        return NoveltyResult(
            novelty_score=novelty_score,
            novelty_level=novelty_level,
            max_similarity=max_similarity,
            similar_items=similar_items,
            explanation=explanation,
            should_pivot=should_pivot,
        )

    async def check_claim_novelty(
        self,
        statement: str,
        category: str | None = None,
        top_k: int = 5,
    ) -> NoveltyResult:
        """Check novelty of a claim.

        Args:
            statement: Claim statement
            category: Optional category
            top_k: Number of similar items to return

        Returns:
            NoveltyResult with score, level, and similar items
        """
        # Find similar claims
        similar = await self.index.find_similar_claims(
            statement=statement,
            category=category,
            limit=top_k,
            threshold=0.3,
        )

        # Calculate novelty
        max_similarity = similar[0].score if similar else 0.0
        novelty_score = _similarity_to_novelty(max_similarity)
        novelty_level = _classify_novelty(max_similarity)

        # Build explanation
        if novelty_level == NoveltyLevel.DERIVATIVE:
            similar_statement = similar[0].metadata.get("statement", "")[:100]
            explanation = f"Very similar to existing claim: '{similar_statement}...'"
        elif novelty_level == NoveltyLevel.INCREMENTAL:
            explanation = "Incremental refinement of existing claims"
        elif novelty_level == NoveltyLevel.MODERATELY_NOVEL:
            explanation = "Moderately novel claim with some overlap to existing research"
        else:
            explanation = "Highly novel claim - no close matches found"

        should_pivot = max_similarity >= self.collision_threshold

        similar_items = [
            {
                "id": item.id,
                "statement": item.metadata.get("statement"),
                "category": item.metadata.get("category"),
                "paper_id": item.metadata.get("paper_id"),
                "similarity": item.score,
            }
            for item in similar
        ]

        logger.info(
            "Checked claim novelty",
            statement=statement[:50],
            novelty_score=novelty_score,
            novelty_level=novelty_level.value,
            max_similarity=max_similarity,
        )

        return NoveltyResult(
            novelty_score=novelty_score,
            novelty_level=novelty_level,
            max_similarity=max_similarity,
            similar_items=similar_items,
            explanation=explanation,
            should_pivot=should_pivot,
        )

    async def check_paper_novelty(
        self,
        title: str,
        abstract: str,
        top_k: int = 5,
    ) -> NoveltyResult:
        """Check novelty of a paper.

        Args:
            title: Paper title
            abstract: Paper abstract
            top_k: Number of similar items to return

        Returns:
            NoveltyResult with score, level, and similar papers
        """
        # Find similar papers
        similar = await self.index.find_similar_papers(
            title=title,
            abstract=abstract,
            limit=top_k,
            threshold=0.3,
        )

        # Calculate novelty
        max_similarity = similar[0].score if similar else 0.0
        novelty_score = _similarity_to_novelty(max_similarity)
        novelty_level = _classify_novelty(max_similarity)

        # Build explanation
        if novelty_level == NoveltyLevel.DERIVATIVE:
            similar_title = similar[0].metadata.get("title", "")[:80]
            explanation = f"Very similar to: '{similar_title}...'"
        elif novelty_level == NoveltyLevel.INCREMENTAL:
            explanation = "Incremental advancement over existing papers"
        elif novelty_level == NoveltyLevel.MODERATELY_NOVEL:
            explanation = "Moderately novel contribution with related prior work"
        else:
            explanation = "Highly novel paper - represents new research direction"

        should_pivot = max_similarity >= self.collision_threshold

        similar_items = [
            {
                "id": item.id,
                "title": item.metadata.get("title"),
                "abstract_preview": item.metadata.get("abstract_preview"),
                "similarity": item.score,
            }
            for item in similar
        ]

        logger.info(
            "Checked paper novelty",
            title=title[:50],
            novelty_score=novelty_score,
            novelty_level=novelty_level.value,
            max_similarity=max_similarity,
        )

        return NoveltyResult(
            novelty_score=novelty_score,
            novelty_level=novelty_level,
            max_similarity=max_similarity,
            similar_items=similar_items,
            explanation=explanation,
            should_pivot=should_pivot,
        )

    async def batch_check_techniques(
        self,
        techniques: list[dict[str, Any]],
    ) -> list[NoveltyResult]:
        """Check novelty for multiple techniques.

        Args:
            techniques: List of dicts with name, description, formula keys

        Returns:
            List of NoveltyResult in same order as input
        """
        results = []
        for tech in techniques:
            result = await self.check_technique_novelty(
                name=tech.get("name", ""),
                description=tech.get("description", ""),
                formula=tech.get("formula"),
            )
            results.append(result)
        return results

    async def batch_check_claims(
        self,
        claims: list[dict[str, Any]],
    ) -> list[NoveltyResult]:
        """Check novelty for multiple claims.

        Args:
            claims: List of dicts with statement, category keys

        Returns:
            List of NoveltyResult in same order as input
        """
        results = []
        for claim in claims:
            result = await self.check_claim_novelty(
                statement=claim.get("statement", ""),
                category=claim.get("category"),
            )
            results.append(result)
        return results


# Singleton instance
_novelty_checker: NoveltyChecker | None = None


def get_novelty_checker() -> NoveltyChecker:
    """Get or create the novelty checker singleton."""
    global _novelty_checker
    if _novelty_checker is None:
        _novelty_checker = NoveltyChecker()
    return _novelty_checker
