"""Hybrid search engine combining vector similarity with keyword filtering."""

from dataclasses import dataclass, field
from typing import Any

import structlog

from src.rag.embeddings import get_embedding_service
from src.rag.vector_store import ContentType, SearchResult, get_vector_store

logger = structlog.get_logger()


@dataclass
class SearchFilters:
    """Filters to apply to search results."""

    categories: list[str] | None = None
    keywords: list[str] | None = None
    date_from: str | None = None
    date_to: str | None = None
    min_confidence: float | None = None


@dataclass
class RankedResult:
    """Search result with combined ranking information."""

    id: str
    content_type: ContentType
    semantic_score: float
    keyword_score: float
    combined_score: float
    metadata: dict[str, Any]
    highlights: list[str] = field(default_factory=list)


@dataclass
class SearchResults:
    """Collection of search results with metadata."""

    results: list[RankedResult]
    total_found: int
    query: str
    filters_applied: dict[str, Any]


class HybridSearch:
    """Combines vector similarity search with keyword filtering and re-ranking."""

    def __init__(
        self,
        semantic_weight: float = 0.7,
        keyword_weight: float = 0.3,
    ):
        self.embedding_service = get_embedding_service()
        self.vector_store = get_vector_store()
        self.semantic_weight = semantic_weight
        self.keyword_weight = keyword_weight

    def _calculate_keyword_score(
        self,
        query_terms: list[str],
        text: str,
    ) -> float:
        """Calculate simple keyword match score."""
        if not text or not query_terms:
            return 0.0

        text_lower = text.lower()
        matches = sum(1 for term in query_terms if term.lower() in text_lower)
        return matches / len(query_terms) if query_terms else 0.0

    def _extract_highlights(
        self,
        query_terms: list[str],
        text: str,
        max_highlights: int = 3,
    ) -> list[str]:
        """Extract text snippets containing query terms."""
        if not text or not query_terms:
            return []

        highlights = []
        sentences = text.replace("\n", " ").split(". ")

        for sentence in sentences:
            sentence_lower = sentence.lower()
            if any(term.lower() in sentence_lower for term in query_terms):
                # Truncate long sentences
                if len(sentence) > 200:
                    sentence = sentence[:200] + "..."
                highlights.append(sentence.strip())
                if len(highlights) >= max_highlights:
                    break

        return highlights

    def _apply_filters(
        self,
        results: list[SearchResult],
        filters: SearchFilters,
    ) -> list[SearchResult]:
        """Apply filters to search results."""
        if not filters:
            return results

        filtered = results

        if filters.categories:
            filtered = [r for r in filtered if r.metadata.get("category") in filters.categories]

        if filters.min_confidence is not None:
            filtered = [
                r for r in filtered if r.metadata.get("confidence", 1.0) >= filters.min_confidence
            ]

        if filters.keywords:
            # Keep results that contain at least one keyword
            def has_keyword(result: SearchResult) -> bool:
                text = " ".join(str(v) for v in result.metadata.values())
                text_lower = text.lower()
                return any(kw.lower() in text_lower for kw in filters.keywords)

            filtered = [r for r in filtered if has_keyword(r)]

        return filtered

    async def search(
        self,
        query: str,
        content_types: list[ContentType] | None = None,
        filters: SearchFilters | None = None,
        limit: int = 20,
        threshold: float = 0.4,
    ) -> SearchResults:
        """
        Perform hybrid search combining semantic and keyword matching.

        Args:
            query: The search query.
            content_types: Types of content to search (paper, claim, technique).
            filters: Additional filters to apply.
            limit: Maximum number of results.
            threshold: Minimum semantic similarity threshold.

        Returns:
            SearchResults with ranked results.
        """
        if content_types is None:
            content_types = ["paper", "claim", "technique"]

        # Generate query embedding
        query_embedding = await self.embedding_service.embed_query(query)

        # Perform vector search (get more results to allow for filtering)
        semantic_results = await self.vector_store.search_all(
            query_embedding=query_embedding,
            limit=limit * 3,  # Fetch extra for filtering
            threshold=threshold,
            content_types=content_types,
        )

        # Apply filters
        if filters:
            semantic_results = self._apply_filters(semantic_results, filters)

        # Extract query terms for keyword scoring
        query_terms = [term for term in query.split() if len(term) > 2]

        # Combine scores and create ranked results
        ranked_results = []
        for result in semantic_results:
            # Build searchable text from metadata
            searchable_text = " ".join(str(v) for v in result.metadata.values() if v)

            keyword_score = self._calculate_keyword_score(query_terms, searchable_text)

            # Combined score using weights
            combined_score = (
                self.semantic_weight * result.score + self.keyword_weight * keyword_score
            )

            highlights = self._extract_highlights(query_terms, searchable_text)

            ranked_results.append(
                RankedResult(
                    id=result.id,
                    content_type=result.content_type,
                    semantic_score=result.score,
                    keyword_score=keyword_score,
                    combined_score=combined_score,
                    metadata=result.metadata,
                    highlights=highlights,
                )
            )

        # Sort by combined score
        ranked_results.sort(key=lambda x: x.combined_score, reverse=True)

        # Limit results
        ranked_results = ranked_results[:limit]

        filters_info = {}
        if filters:
            if filters.categories:
                filters_info["categories"] = filters.categories
            if filters.keywords:
                filters_info["keywords"] = filters.keywords
            if filters.min_confidence:
                filters_info["min_confidence"] = filters.min_confidence

        return SearchResults(
            results=ranked_results,
            total_found=len(semantic_results),
            query=query,
            filters_applied=filters_info,
        )

    async def search_papers(
        self,
        query: str,
        limit: int = 20,
        threshold: float = 0.4,
    ) -> SearchResults:
        """Convenience method to search only papers."""
        return await self.search(
            query=query,
            content_types=["paper"],
            limit=limit,
            threshold=threshold,
        )

    async def search_claims(
        self,
        query: str,
        categories: list[str] | None = None,
        limit: int = 20,
        threshold: float = 0.4,
    ) -> SearchResults:
        """Convenience method to search only claims."""
        filters = SearchFilters(categories=categories) if categories else None
        return await self.search(
            query=query,
            content_types=["claim"],
            filters=filters,
            limit=limit,
            threshold=threshold,
        )

    async def search_techniques(
        self,
        query: str,
        limit: int = 20,
        threshold: float = 0.4,
    ) -> SearchResults:
        """Convenience method to search only techniques."""
        return await self.search(
            query=query,
            content_types=["technique"],
            limit=limit,
            threshold=threshold,
        )

    async def find_similar(
        self,
        paper_id: str,
        limit: int = 10,
    ) -> list[RankedResult]:
        """Find papers similar to a given paper."""
        results = await self.vector_store.find_similar_papers(
            paper_id=paper_id,
            limit=limit,
            threshold=0.5,
        )

        return [
            RankedResult(
                id=r.id,
                content_type=r.content_type,
                semantic_score=r.score,
                keyword_score=0.0,
                combined_score=r.score,
                metadata=r.metadata,
                highlights=[],
            )
            for r in results
        ]


# Singleton instance
_hybrid_search: HybridSearch | None = None


def get_hybrid_search() -> HybridSearch:
    """Get or create the hybrid search singleton."""
    global _hybrid_search
    if _hybrid_search is None:
        _hybrid_search = HybridSearch()
    return _hybrid_search
