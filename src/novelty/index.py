"""Novelty index for tracking existing techniques and claims."""

from dataclasses import dataclass
from typing import Any

import structlog

from src.rag.embeddings import get_embedding_service
from src.rag.vector_store import get_vector_store, SearchResult

logger = structlog.get_logger()


@dataclass
class IndexedItem:
    """An item in the novelty index."""

    id: str
    item_type: str  # "technique" or "claim"
    name: str
    description: str
    embedding: list[float] | None = None


class NoveltyIndex:
    """Index of existing techniques and claims for novelty comparison.

    Uses the vector store to find similar items and assess novelty.
    """

    def __init__(self):
        self.embedding_service = get_embedding_service()
        self.vector_store = get_vector_store()

    async def find_similar_techniques(
        self,
        name: str,
        description: str,
        formula: str | None = None,
        limit: int = 10,
        threshold: float = 0.5,
    ) -> list[SearchResult]:
        """Find techniques similar to the given one.

        Args:
            name: Technique name
            description: Technique description
            formula: Optional formula
            limit: Maximum number of results
            threshold: Minimum similarity threshold

        Returns:
            List of similar techniques ordered by similarity (highest first)
        """
        embedding = await self.embedding_service.embed_technique(name, description, formula)
        results = await self.vector_store.search_techniques(
            query_embedding=embedding,
            limit=limit,
            threshold=threshold,
        )
        return results

    async def find_similar_claims(
        self,
        statement: str,
        category: str | None = None,
        limit: int = 10,
        threshold: float = 0.5,
    ) -> list[SearchResult]:
        """Find claims similar to the given one.

        Args:
            statement: Claim statement
            category: Optional category filter
            limit: Maximum number of results
            threshold: Minimum similarity threshold

        Returns:
            List of similar claims ordered by similarity (highest first)
        """
        embedding = await self.embedding_service.embed_claim(statement, category)
        results = await self.vector_store.search_claims(
            query_embedding=embedding,
            limit=limit,
            threshold=threshold,
            category=category,
        )
        return results

    async def find_similar_papers(
        self,
        title: str,
        abstract: str,
        limit: int = 10,
        threshold: float = 0.5,
    ) -> list[SearchResult]:
        """Find papers similar to the given one.

        Args:
            title: Paper title
            abstract: Paper abstract
            limit: Maximum number of results
            threshold: Minimum similarity threshold

        Returns:
            List of similar papers ordered by similarity (highest first)
        """
        embedding = await self.embedding_service.embed_paper(title, abstract)
        results = await self.vector_store.search_papers(
            query_embedding=embedding,
            limit=limit,
            threshold=threshold,
        )
        return results

    async def get_max_similarity_technique(
        self,
        name: str,
        description: str,
        formula: str | None = None,
    ) -> tuple[float, SearchResult | None]:
        """Get the maximum similarity score for a technique.

        Returns:
            Tuple of (max_similarity, most_similar_item)
        """
        results = await self.find_similar_techniques(
            name=name,
            description=description,
            formula=formula,
            limit=1,
            threshold=0.0,  # Get any match
        )

        if results:
            return results[0].score, results[0]
        return 0.0, None

    async def get_max_similarity_claim(
        self,
        statement: str,
        category: str | None = None,
    ) -> tuple[float, SearchResult | None]:
        """Get the maximum similarity score for a claim.

        Returns:
            Tuple of (max_similarity, most_similar_item)
        """
        results = await self.find_similar_claims(
            statement=statement,
            category=category,
            limit=1,
            threshold=0.0,
        )

        if results:
            return results[0].score, results[0]
        return 0.0, None


# Singleton instance
_novelty_index: NoveltyIndex | None = None


def get_novelty_index() -> NoveltyIndex:
    """Get or create the novelty index singleton."""
    global _novelty_index
    if _novelty_index is None:
        _novelty_index = NoveltyIndex()
    return _novelty_index
