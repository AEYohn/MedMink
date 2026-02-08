"""Embedding service using Gemini's embedding model."""

import asyncio
from typing import Any

import google.generativeai as genai
import structlog
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import settings

logger = structlog.get_logger()

# Gemini embedding model produces 768-dimensional vectors
EMBEDDING_DIMENSION = 768
EMBEDDING_MODEL = "models/text-embedding-004"

# Batch limits for Gemini embedding API
MAX_BATCH_SIZE = 100
MAX_TOKENS_PER_TEXT = 2048  # Truncate longer texts


class EmbeddingService:
    """Generate embeddings using Gemini's embedding API."""

    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.gemini_api_key
        genai.configure(api_key=self.api_key)
        self.dimension = EMBEDDING_DIMENSION
        logger.info("Embedding service initialized", model=EMBEDDING_MODEL, dimension=EMBEDDING_DIMENSION)

    def _truncate_text(self, text: str) -> str:
        """Truncate text to fit within token limits (rough approximation)."""
        # Rough estimate: ~4 characters per token
        max_chars = MAX_TOKENS_PER_TEXT * 4
        if len(text) > max_chars:
            return text[:max_chars]
        return text

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
    )
    async def embed_text(self, text: str, task_type: str = "RETRIEVAL_DOCUMENT") -> list[float]:
        """
        Generate embedding for a single text.

        Args:
            text: The text to embed.
            task_type: The embedding task type. Use "RETRIEVAL_DOCUMENT" for content
                      to be searched, "RETRIEVAL_QUERY" for search queries.

        Returns:
            768-dimensional embedding vector.
        """
        if not text or not text.strip():
            # Return zero vector for empty text
            return [0.0] * EMBEDDING_DIMENSION

        truncated = self._truncate_text(text.strip())

        result = await asyncio.to_thread(
            genai.embed_content,
            model=EMBEDDING_MODEL,
            content=truncated,
            task_type=task_type,
        )

        embedding = result["embedding"]

        logger.debug(
            "Generated embedding",
            text_length=len(truncated),
            embedding_dim=len(embedding),
        )

        return embedding

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
    )
    async def embed_batch(
        self,
        texts: list[str],
        task_type: str = "RETRIEVAL_DOCUMENT",
    ) -> list[list[float]]:
        """
        Generate embeddings for multiple texts efficiently.

        Args:
            texts: List of texts to embed.
            task_type: The embedding task type.

        Returns:
            List of 768-dimensional embedding vectors.
        """
        if not texts:
            return []

        # Filter and truncate
        processed_texts = []
        valid_indices = []
        for i, text in enumerate(texts):
            if text and text.strip():
                processed_texts.append(self._truncate_text(text.strip()))
                valid_indices.append(i)

        if not processed_texts:
            return [[0.0] * EMBEDDING_DIMENSION for _ in texts]

        # Process in batches
        all_embeddings = []
        for batch_start in range(0, len(processed_texts), MAX_BATCH_SIZE):
            batch = processed_texts[batch_start:batch_start + MAX_BATCH_SIZE]

            result = await asyncio.to_thread(
                genai.embed_content,
                model=EMBEDDING_MODEL,
                content=batch,
                task_type=task_type,
            )

            all_embeddings.extend(result["embedding"])

        # Map back to original positions
        result_embeddings = [[0.0] * EMBEDDING_DIMENSION for _ in texts]
        for idx, embedding in zip(valid_indices, all_embeddings):
            result_embeddings[idx] = embedding

        logger.info(
            "Generated batch embeddings",
            total_texts=len(texts),
            valid_texts=len(processed_texts),
        )

        return result_embeddings

    async def embed_query(self, query: str) -> list[float]:
        """
        Generate embedding for a search query.

        Uses RETRIEVAL_QUERY task type optimized for queries.
        """
        return await self.embed_text(query, task_type="RETRIEVAL_QUERY")

    async def embed_document(self, document: str) -> list[float]:
        """
        Generate embedding for a document to be searched.

        Uses RETRIEVAL_DOCUMENT task type optimized for documents.
        """
        return await self.embed_text(document, task_type="RETRIEVAL_DOCUMENT")

    async def embed_paper(self, title: str, abstract: str) -> list[float]:
        """Generate embedding for a paper using title and abstract."""
        combined = f"{title}\n\n{abstract}"
        return await self.embed_document(combined)

    async def embed_claim(self, statement: str, category: str | None = None) -> list[float]:
        """Generate embedding for a claim."""
        text = statement
        if category:
            text = f"[{category}] {statement}"
        return await self.embed_document(text)

    async def embed_technique(
        self,
        name: str,
        description: str,
        formula: str | None = None,
    ) -> list[float]:
        """Generate embedding for a technique."""
        parts = [name, description]
        if formula:
            parts.append(f"Formula: {formula}")
        text = "\n".join(parts)
        return await self.embed_document(text)


# Singleton instance
_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    """Get or create the embedding service singleton."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
