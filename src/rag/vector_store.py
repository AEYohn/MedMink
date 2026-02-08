"""Vector store using PostgreSQL with pgvector extension."""

import asyncio
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Literal

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.db import AsyncSessionLocal
from src.rag.embeddings import EMBEDDING_DIMENSION, get_embedding_service

logger = structlog.get_logger()

ContentType = Literal["paper", "claim", "technique"]


@dataclass
class SearchResult:
    """Result from vector similarity search."""

    id: str
    content_type: ContentType
    score: float  # Cosine similarity score (0-1, higher is more similar)
    metadata: dict[str, Any]


class VectorStore:
    """PostgreSQL + pgvector for vector similarity search."""

    def __init__(self):
        self.embedding_service = get_embedding_service()
        self.dimension = EMBEDDING_DIMENSION

    async def _get_session(self) -> AsyncSession:
        """Get database session."""
        return AsyncSessionLocal()

    async def add_paper_embedding(
        self,
        paper_id: str,
        title: str,
        abstract: str,
        embedding: list[float] | None = None,
    ) -> None:
        """Add or update embedding for a paper."""
        if embedding is None:
            embedding = await self.embedding_service.embed_paper(title, abstract)

        async with AsyncSessionLocal() as session:
            # Upsert the embedding
            await session.execute(
                text("""
                    INSERT INTO paper_embeddings (paper_id, embedding, title, abstract_preview, created_at)
                    VALUES (:paper_id, :embedding, :title, :abstract_preview, NOW())
                    ON CONFLICT (paper_id) DO UPDATE SET
                        embedding = :embedding,
                        title = :title,
                        abstract_preview = :abstract_preview
                """),
                {
                    "paper_id": paper_id,
                    "embedding": str(embedding),
                    "title": title,
                    "abstract_preview": abstract[:500] if abstract else "",
                },
            )
            await session.commit()

        logger.debug("Added paper embedding", paper_id=paper_id)

    async def add_claim_embedding(
        self,
        claim_id: str,
        statement: str,
        category: str | None = None,
        paper_id: str | None = None,
        embedding: list[float] | None = None,
    ) -> None:
        """Add or update embedding for a claim."""
        if embedding is None:
            embedding = await self.embedding_service.embed_claim(statement, category)

        async with AsyncSessionLocal() as session:
            await session.execute(
                text("""
                    INSERT INTO claim_embeddings (claim_id, paper_id, embedding, statement, category, created_at)
                    VALUES (:claim_id, :paper_id, :embedding, :statement, :category, NOW())
                    ON CONFLICT (claim_id) DO UPDATE SET
                        embedding = :embedding,
                        statement = :statement,
                        category = :category,
                        paper_id = :paper_id
                """),
                {
                    "claim_id": claim_id,
                    "paper_id": paper_id,
                    "embedding": str(embedding),
                    "statement": statement,
                    "category": category,
                },
            )
            await session.commit()

        logger.debug("Added claim embedding", claim_id=claim_id)

    async def add_technique_embedding(
        self,
        technique_id: str,
        name: str,
        description: str,
        formula: str | None = None,
        embedding: list[float] | None = None,
    ) -> None:
        """Add or update embedding for a technique."""
        if embedding is None:
            embedding = await self.embedding_service.embed_technique(name, description, formula)

        async with AsyncSessionLocal() as session:
            await session.execute(
                text("""
                    INSERT INTO technique_embeddings (technique_id, embedding, name, description, formula, created_at)
                    VALUES (:technique_id, :embedding, :name, :description, :formula, NOW())
                    ON CONFLICT (technique_id) DO UPDATE SET
                        embedding = :embedding,
                        name = :name,
                        description = :description,
                        formula = :formula
                """),
                {
                    "technique_id": technique_id,
                    "embedding": str(embedding),
                    "name": name,
                    "description": description,
                    "formula": formula,
                },
            )
            await session.commit()

        logger.debug("Added technique embedding", technique_id=technique_id)

    async def search_papers(
        self,
        query_embedding: list[float],
        limit: int = 10,
        threshold: float = 0.5,
    ) -> list[SearchResult]:
        """Search for similar papers using cosine similarity."""
        async with AsyncSessionLocal() as session:
            # Use cosine distance (<=>), convert to similarity (1 - distance)
            result = await session.execute(
                text("""
                    SELECT
                        paper_id,
                        title,
                        abstract_preview,
                        1 - (embedding <=> :query_embedding) as similarity
                    FROM paper_embeddings
                    WHERE 1 - (embedding <=> :query_embedding) >= :threshold
                    ORDER BY embedding <=> :query_embedding
                    LIMIT :limit
                """),
                {
                    "query_embedding": str(query_embedding),
                    "threshold": threshold,
                    "limit": limit,
                },
            )

            rows = result.fetchall()
            return [
                SearchResult(
                    id=row.paper_id,
                    content_type="paper",
                    score=float(row.similarity),
                    metadata={
                        "title": row.title,
                        "abstract_preview": row.abstract_preview,
                    },
                )
                for row in rows
            ]

    async def search_claims(
        self,
        query_embedding: list[float],
        limit: int = 10,
        threshold: float = 0.5,
        category: str | None = None,
    ) -> list[SearchResult]:
        """Search for similar claims using cosine similarity."""
        async with AsyncSessionLocal() as session:
            query = """
                SELECT
                    claim_id,
                    paper_id,
                    statement,
                    category,
                    1 - (embedding <=> :query_embedding) as similarity
                FROM claim_embeddings
                WHERE 1 - (embedding <=> :query_embedding) >= :threshold
            """

            params = {
                "query_embedding": str(query_embedding),
                "threshold": threshold,
                "limit": limit,
            }

            if category:
                query += " AND category = :category"
                params["category"] = category

            query += " ORDER BY embedding <=> :query_embedding LIMIT :limit"

            result = await session.execute(text(query), params)
            rows = result.fetchall()

            return [
                SearchResult(
                    id=row.claim_id,
                    content_type="claim",
                    score=float(row.similarity),
                    metadata={
                        "paper_id": row.paper_id,
                        "statement": row.statement,
                        "category": row.category,
                    },
                )
                for row in rows
            ]

    async def search_techniques(
        self,
        query_embedding: list[float],
        limit: int = 10,
        threshold: float = 0.5,
    ) -> list[SearchResult]:
        """Search for similar techniques using cosine similarity."""
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                text("""
                    SELECT
                        technique_id,
                        name,
                        description,
                        formula,
                        1 - (embedding <=> :query_embedding) as similarity
                    FROM technique_embeddings
                    WHERE 1 - (embedding <=> :query_embedding) >= :threshold
                    ORDER BY embedding <=> :query_embedding
                    LIMIT :limit
                """),
                {
                    "query_embedding": str(query_embedding),
                    "threshold": threshold,
                    "limit": limit,
                },
            )

            rows = result.fetchall()
            return [
                SearchResult(
                    id=row.technique_id,
                    content_type="technique",
                    score=float(row.similarity),
                    metadata={
                        "name": row.name,
                        "description": row.description,
                        "formula": row.formula,
                    },
                )
                for row in rows
            ]

    async def search_all(
        self,
        query_embedding: list[float],
        limit: int = 20,
        threshold: float = 0.5,
        content_types: list[ContentType] | None = None,
    ) -> list[SearchResult]:
        """Search across all content types and merge results."""
        if content_types is None:
            content_types = ["paper", "claim", "technique"]

        tasks = []
        per_type_limit = limit // len(content_types) + 1

        if "paper" in content_types:
            tasks.append(self.search_papers(query_embedding, per_type_limit, threshold))
        if "claim" in content_types:
            tasks.append(self.search_claims(query_embedding, per_type_limit, threshold))
        if "technique" in content_types:
            tasks.append(self.search_techniques(query_embedding, per_type_limit, threshold))

        results = await asyncio.gather(*tasks)

        # Merge and sort by score
        all_results = []
        for result_list in results:
            all_results.extend(result_list)

        all_results.sort(key=lambda x: x.score, reverse=True)
        return all_results[:limit]

    async def find_similar_papers(
        self,
        paper_id: str,
        limit: int = 10,
        threshold: float = 0.5,
    ) -> list[SearchResult]:
        """Find papers similar to a given paper."""
        async with AsyncSessionLocal() as session:
            # First get the paper's embedding
            result = await session.execute(
                text("SELECT embedding FROM paper_embeddings WHERE paper_id = :paper_id"),
                {"paper_id": paper_id},
            )
            row = result.fetchone()

            if not row:
                logger.warning("Paper embedding not found", paper_id=paper_id)
                return []

            # Parse the embedding string back to list
            embedding_str = row.embedding
            if isinstance(embedding_str, str):
                embedding = [float(x) for x in embedding_str.strip("[]").split(",")]
            else:
                embedding = list(embedding_str)

            # Search excluding the source paper
            result = await session.execute(
                text("""
                    SELECT
                        paper_id,
                        title,
                        abstract_preview,
                        1 - (embedding <=> :query_embedding) as similarity
                    FROM paper_embeddings
                    WHERE paper_id != :source_paper_id
                        AND 1 - (embedding <=> :query_embedding) >= :threshold
                    ORDER BY embedding <=> :query_embedding
                    LIMIT :limit
                """),
                {
                    "query_embedding": str(embedding),
                    "source_paper_id": paper_id,
                    "threshold": threshold,
                    "limit": limit,
                },
            )

            rows = result.fetchall()
            return [
                SearchResult(
                    id=row.paper_id,
                    content_type="paper",
                    score=float(row.similarity),
                    metadata={
                        "title": row.title,
                        "abstract_preview": row.abstract_preview,
                    },
                )
                for row in rows
            ]

    async def get_embedding_stats(self) -> dict[str, int]:
        """Get count of embeddings by type."""
        async with AsyncSessionLocal() as session:
            papers = await session.execute(text("SELECT COUNT(*) FROM paper_embeddings"))
            claims = await session.execute(text("SELECT COUNT(*) FROM claim_embeddings"))
            techniques = await session.execute(text("SELECT COUNT(*) FROM technique_embeddings"))

            return {
                "papers": papers.scalar() or 0,
                "claims": claims.scalar() or 0,
                "techniques": techniques.scalar() or 0,
            }

    async def create_indexes(self) -> None:
        """Create vector indexes for faster search (call after initial data load)."""
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT create_vector_indexes()"))
            await session.commit()

        logger.info("Created vector indexes")


# Singleton instance
_vector_store: VectorStore | None = None


def get_vector_store() -> VectorStore:
    """Get or create the vector store singleton."""
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore()
    return _vector_store
