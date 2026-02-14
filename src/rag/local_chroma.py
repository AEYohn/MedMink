"""Local ChromaDB vector store for medical literature.

Provides persistent local storage of medical paper embeddings using ChromaDB
with PubMedBERT embeddings for privacy-preserving semantic search.
"""

import asyncio
from pathlib import Path
from typing import Any

import structlog

from src.config import settings

logger = structlog.get_logger()


class LocalChromaStore:
    """Local ChromaDB vector store for medical papers.

    Uses PubMedBERT embeddings optimized for medical text.
    All data persists locally for privacy-preserving operation.
    """

    def __init__(
        self,
        persist_directory: str | None = None,
        collection_name: str | None = None,
        embedding_model: str | None = None,
    ):
        """Initialize local ChromaDB store.

        Args:
            persist_directory: Directory for persistent storage
            collection_name: Name of the ChromaDB collection
            embedding_model: Sentence transformer model for embeddings
        """
        self.persist_directory = persist_directory or settings.chroma_persist_directory
        self.collection_name = collection_name or settings.chroma_collection_name
        self.embedding_model_name = embedding_model or settings.medical_embedding_model

        self._client = None
        self._collection = None
        self._embedding_fn = None
        self._initialized = False

        logger.info(
            "LocalChromaStore configured",
            persist_dir=self.persist_directory,
            collection=self.collection_name,
            embedding_model=self.embedding_model_name,
        )

    def _ensure_initialized(self):
        """Lazily initialize ChromaDB and embeddings."""
        if self._initialized:
            return

        # Ensure persist directory exists
        Path(self.persist_directory).mkdir(parents=True, exist_ok=True)

        try:
            import chromadb

            # Initialize ChromaDB with persistence (new API for chromadb >= 0.4.0)
            self._client = chromadb.PersistentClient(
                path=self.persist_directory,
            )

            # Try to load embedding model
            self._embedding_fn = self._create_embedding_function()

            # Get or create collection
            self._collection = self._client.get_or_create_collection(
                name=self.collection_name,
                embedding_function=self._embedding_fn,
                metadata={"description": "Medical literature embeddings"},
            )

            logger.info(
                "ChromaDB initialized",
                collection_size=self._collection.count(),
            )

        except ImportError:
            logger.warning("chromadb not installed, using fallback mode")

        self._initialized = True

    def _create_embedding_function(self):
        """Create embedding function using sentence transformers."""
        try:
            from chromadb.utils import embedding_functions

            # Try to use PubMedBERT or fall back to all-MiniLM
            try:
                return embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name=self.embedding_model_name,
                )
            except Exception:
                logger.warning(
                    f"Could not load {self.embedding_model_name}, using fallback"
                )
                return embedding_functions.SentenceTransformerEmbeddingFunction(
                    model_name="all-MiniLM-L6-v2",
                )

        except ImportError:
            logger.warning("sentence-transformers not installed")
            return None

    async def add_paper(
        self,
        paper_id: str,
        title: str,
        abstract: str,
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        """Add a paper to the vector store.

        Args:
            paper_id: Unique identifier (PMID, DOI, etc.)
            title: Paper title
            abstract: Paper abstract
            metadata: Additional metadata (authors, year, MeSH terms, etc.)

        Returns:
            True if successful
        """
        return await asyncio.to_thread(
            self._add_paper_sync,
            paper_id=paper_id,
            title=title,
            abstract=abstract,
            metadata=metadata,
        )

    def _add_paper_sync(
        self,
        paper_id: str,
        title: str,
        abstract: str,
        metadata: dict[str, Any] | None,
    ) -> bool:
        """Synchronous paper addition."""
        self._ensure_initialized()

        if self._collection is None:
            logger.warning("Collection not available")
            return False

        try:
            # Combine title and abstract for embedding
            document = f"{title}\n\n{abstract}"

            # Prepare metadata
            meta = metadata.copy() if metadata else {}
            meta["title"] = title
            meta["has_abstract"] = bool(abstract)

            # Filter out None values and convert lists to strings
            filtered_meta = {}
            for k, v in meta.items():
                if v is not None:
                    if isinstance(v, list):
                        filtered_meta[k] = ", ".join(str(x) for x in v[:10])
                    elif isinstance(v, str | int | float | bool):
                        filtered_meta[k] = v

            self._collection.add(
                ids=[paper_id],
                documents=[document],
                metadatas=[filtered_meta],
            )

            return True

        except Exception as e:
            logger.error("Failed to add paper", paper_id=paper_id, error=str(e))
            return False

    async def add_papers_batch(
        self,
        papers: list[dict[str, Any]],
    ) -> int:
        """Add multiple papers in batch.

        Args:
            papers: List of paper dicts with id, title, abstract, metadata

        Returns:
            Number of papers successfully added
        """
        return await asyncio.to_thread(self._add_papers_batch_sync, papers)

    def _add_papers_batch_sync(self, papers: list[dict[str, Any]]) -> int:
        """Synchronous batch addition."""
        self._ensure_initialized()

        if self._collection is None:
            return 0

        ids = []
        documents = []
        metadatas = []

        for paper in papers:
            paper_id = paper.get("id", "")
            title = paper.get("title", "")
            abstract = paper.get("abstract", "")
            metadata = paper.get("metadata", {})

            if not paper_id or not title:
                continue

            ids.append(paper_id)
            documents.append(f"{title}\n\n{abstract}")

            meta = metadata.copy()
            meta["title"] = title
            meta["has_abstract"] = bool(abstract)

            # Filter metadata
            filtered_meta = {}
            for k, v in meta.items():
                if v is not None:
                    if isinstance(v, list):
                        filtered_meta[k] = ", ".join(str(x) for x in v[:10])
                    elif isinstance(v, str | int | float | bool):
                        filtered_meta[k] = v

            metadatas.append(filtered_meta)

        if not ids:
            return 0

        try:
            self._collection.add(
                ids=ids,
                documents=documents,
                metadatas=metadatas,
            )
            return len(ids)
        except Exception as e:
            logger.error("Batch add failed", error=str(e))
            return 0

    async def search(
        self,
        query: str,
        n_results: int = 10,
        filter_dict: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Search for similar papers.

        Args:
            query: Search query text
            n_results: Number of results to return
            filter_dict: Metadata filters (e.g., {"year": 2024})

        Returns:
            List of matching papers with scores
        """
        return await asyncio.to_thread(
            self._search_sync,
            query=query,
            n_results=n_results,
            filter_dict=filter_dict,
        )

    def _search_sync(
        self,
        query: str,
        n_results: int,
        filter_dict: dict[str, Any] | None,
    ) -> list[dict[str, Any]]:
        """Synchronous search."""
        self._ensure_initialized()

        if self._collection is None:
            return []

        try:
            results = self._collection.query(
                query_texts=[query],
                n_results=n_results,
                where=filter_dict,
                include=["documents", "metadatas", "distances"],
            )

            papers = []
            ids = results.get("ids", [[]])[0]
            docs = results.get("documents", [[]])[0]
            metas = results.get("metadatas", [[]])[0]
            distances = results.get("distances", [[]])[0]

            for i, paper_id in enumerate(ids):
                papers.append({
                    "id": paper_id,
                    "document": docs[i] if i < len(docs) else "",
                    "metadata": metas[i] if i < len(metas) else {},
                    "distance": distances[i] if i < len(distances) else 1.0,
                    "similarity": 1.0 - (distances[i] if i < len(distances) else 1.0),
                })

            return papers

        except Exception as e:
            logger.error("Search failed", error=str(e))
            return []

    async def search_by_pico(
        self,
        population: str,
        intervention: str,
        comparison: str | None = None,
        outcome: str | None = None,
        n_results: int = 20,
    ) -> list[dict[str, Any]]:
        """Search using PICO elements.

        Args:
            population: Patient population description
            intervention: Intervention/treatment
            comparison: Comparator (optional)
            outcome: Outcome measure (optional)
            n_results: Number of results

        Returns:
            List of matching papers
        """
        # Build search query from PICO elements
        query_parts = [population, intervention]
        if comparison and comparison.lower() != "none":
            query_parts.append(comparison)
        if outcome:
            query_parts.append(outcome)

        query = " ".join(query_parts)
        return await self.search(query, n_results)

    async def get_paper(self, paper_id: str) -> dict[str, Any] | None:
        """Get a specific paper by ID.

        Args:
            paper_id: Paper identifier

        Returns:
            Paper data or None if not found
        """
        return await asyncio.to_thread(self._get_paper_sync, paper_id)

    def _get_paper_sync(self, paper_id: str) -> dict[str, Any] | None:
        """Synchronous paper retrieval."""
        self._ensure_initialized()

        if self._collection is None:
            return None

        try:
            results = self._collection.get(
                ids=[paper_id],
                include=["documents", "metadatas"],
            )

            if not results["ids"]:
                return None

            return {
                "id": results["ids"][0],
                "document": results["documents"][0] if results["documents"] else "",
                "metadata": results["metadatas"][0] if results["metadatas"] else {},
            }

        except Exception as e:
            logger.error("Get paper failed", paper_id=paper_id, error=str(e))
            return None

    async def delete_paper(self, paper_id: str) -> bool:
        """Delete a paper from the store.

        Args:
            paper_id: Paper identifier

        Returns:
            True if successful
        """
        return await asyncio.to_thread(self._delete_paper_sync, paper_id)

    def _delete_paper_sync(self, paper_id: str) -> bool:
        """Synchronous paper deletion."""
        self._ensure_initialized()

        if self._collection is None:
            return False

        try:
            self._collection.delete(ids=[paper_id])
            return True
        except Exception as e:
            logger.error("Delete failed", paper_id=paper_id, error=str(e))
            return False

    @property
    def count(self) -> int:
        """Get number of papers in the store."""
        self._ensure_initialized()
        if self._collection is None:
            return 0
        return self._collection.count()

    def persist(self):
        """Persist data to disk (no-op for PersistentClient - auto-persists)."""
        # PersistentClient automatically persists, no explicit call needed
        pass


# Singleton instance
_local_chroma: LocalChromaStore | None = None


def get_local_chroma() -> LocalChromaStore:
    """Get or create local ChromaDB singleton."""
    global _local_chroma
    if _local_chroma is None:
        _local_chroma = LocalChromaStore()
    return _local_chroma
