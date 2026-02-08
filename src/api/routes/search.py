"""Semantic search API endpoints."""

from typing import Literal

import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.rag import get_hybrid_search, get_vector_store

logger = structlog.get_logger()
router = APIRouter(prefix="/search", tags=["search"])


class SearchResultItem(BaseModel):
    """A single search result."""

    id: str
    content_type: str
    semantic_score: float
    keyword_score: float
    combined_score: float
    title: str | None = None
    snippet: str | None = None
    metadata: dict


class SearchResponse(BaseModel):
    """Response model for search endpoints."""

    results: list[SearchResultItem]
    total_found: int
    query: str


class SimilarPaperResult(BaseModel):
    """A similar paper result."""

    paper_id: str
    title: str
    abstract_preview: str | None = None
    similarity: float


class SimilarPapersResponse(BaseModel):
    """Response model for similar papers endpoint."""

    source_paper_id: str
    similar_papers: list[SimilarPaperResult]


class EmbeddingStatsResponse(BaseModel):
    """Response model for embedding statistics."""

    papers: int
    claims: int
    techniques: int
    total: int


@router.get("/semantic", response_model=SearchResponse)
async def semantic_search(
    q: str = Query(..., min_length=2, description="Search query"),
    type: str = Query("all", description="Content type: all, papers, claims, techniques"),
    limit: int = Query(20, ge=1, le=100, description="Maximum results"),
    threshold: float = Query(0.4, ge=0.0, le=1.0, description="Minimum similarity threshold"),
) -> SearchResponse:
    """
    Perform semantic search across the knowledge base.

    This uses vector embeddings to find content by meaning, not just keywords.
    Useful for finding related papers, claims, or techniques even when exact
    terms don't match.

    Examples:
    - "transformer attention mechanisms" - finds papers about attention
    - "methods to improve model efficiency" - finds efficiency techniques
    - "claims about language model scaling" - finds relevant claims
    """
    try:
        search = get_hybrid_search()

        # Map type parameter to content types
        content_types = None
        if type != "all":
            type_map = {
                "papers": ["paper"],
                "claims": ["claim"],
                "techniques": ["technique"],
            }
            content_types = type_map.get(type)
            if content_types is None:
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid type: {type}. Use: all, papers, claims, techniques",
                )

        results = await search.search(
            query=q,
            content_types=content_types,
            limit=limit,
            threshold=threshold,
        )

        items = []
        for r in results.results:
            # Extract title and snippet based on content type
            if r.content_type == "paper":
                title = r.metadata.get("title")
                snippet = r.metadata.get("abstract_preview", "")[:300]
            elif r.content_type == "claim":
                title = None
                snippet = r.metadata.get("statement", "")
            elif r.content_type == "technique":
                title = r.metadata.get("name")
                snippet = r.metadata.get("description", "")[:300]
            else:
                title = None
                snippet = None

            items.append(
                SearchResultItem(
                    id=r.id,
                    content_type=r.content_type,
                    semantic_score=r.semantic_score,
                    keyword_score=r.keyword_score,
                    combined_score=r.combined_score,
                    title=title,
                    snippet=snippet,
                    metadata=r.metadata,
                )
            )

        return SearchResponse(
            results=items,
            total_found=results.total_found,
            query=q,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Semantic search error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/similar/{paper_id}", response_model=SimilarPapersResponse)
async def find_similar_papers(
    paper_id: str,
    limit: int = Query(10, ge=1, le=50, description="Maximum results"),
) -> SimilarPapersResponse:
    """
    Find papers similar to a given paper.

    Uses the paper's embedding to find semantically similar papers
    in the knowledge base. Useful for discovering related research.
    """
    try:
        search = get_hybrid_search()

        results = await search.find_similar(
            paper_id=paper_id,
            limit=limit,
        )

        similar_papers = [
            SimilarPaperResult(
                paper_id=r.id,
                title=r.metadata.get("title", "Unknown"),
                abstract_preview=r.metadata.get("abstract_preview"),
                similarity=r.semantic_score,
            )
            for r in results
        ]

        return SimilarPapersResponse(
            source_paper_id=paper_id,
            similar_papers=similar_papers,
        )

    except Exception as e:
        logger.error("Similar papers search error", error=str(e))
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/stats", response_model=EmbeddingStatsResponse)
async def get_embedding_stats() -> EmbeddingStatsResponse:
    """
    Get statistics about stored embeddings.

    Returns counts of embeddings by content type.
    """
    try:
        store = get_vector_store()
        stats = await store.get_embedding_stats()

        return EmbeddingStatsResponse(
            papers=stats["papers"],
            claims=stats["claims"],
            techniques=stats["techniques"],
            total=stats["papers"] + stats["claims"] + stats["techniques"],
        )

    except Exception as e:
        logger.error("Failed to get embedding stats", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/index/create")
async def create_search_indexes() -> dict[str, str]:
    """
    Create or rebuild vector search indexes.

    Call this after loading a significant amount of data to optimize
    search performance. Only needed after bulk imports.
    """
    try:
        store = get_vector_store()
        await store.create_indexes()

        return {
            "status": "success",
            "message": "Vector indexes created/updated successfully",
        }

    except Exception as e:
        logger.error("Failed to create indexes", error=str(e))
        raise HTTPException(status_code=500, detail=str(e))
