"""Embedding Store — in-memory + JSON file persistence for image embeddings.

Stores embeddings from CXR, Derm, and Path Foundation models for
similar case retrieval. Uses cosine similarity for matching.
"""

import json
from pathlib import Path
from typing import Any

import numpy as np
import structlog

logger = structlog.get_logger()

STORAGE_DIR = Path("data/embeddings")


class EmbeddingStore:
    """In-memory embedding store with JSON file persistence."""

    def __init__(self, modality: str, storage_dir: Path | None = None):
        """Initialize store for a specific modality.

        Args:
            modality: One of 'cxr', 'derm', 'pathology'
            storage_dir: Override storage directory (for testing)
        """
        self.modality = modality
        self._storage_dir = storage_dir or STORAGE_DIR
        self._entries: list[dict[str, Any]] = []
        self._load()

    def _storage_path(self) -> Path:
        return self._storage_dir / f"{self.modality}.json"

    def _load(self):
        """Load embeddings from disk."""
        path = self._storage_path()
        if path.exists():
            try:
                with open(path) as f:
                    data = json.load(f)
                self._entries = data.get("entries", [])
                logger.info(
                    "Loaded embeddings",
                    modality=self.modality,
                    count=len(self._entries),
                )
            except Exception as e:
                logger.error("Failed to load embeddings", modality=self.modality, error=str(e))
                self._entries = []
        else:
            self._entries = []

    def _save(self):
        """Persist embeddings to disk."""
        self._storage_dir.mkdir(parents=True, exist_ok=True)
        path = self._storage_path()
        with open(path, "w") as f:
            json.dump({"modality": self.modality, "entries": self._entries}, f)

    def add(
        self,
        case_id: str,
        embedding: list[float],
        metadata: dict[str, Any] | None = None,
    ):
        """Add an embedding to the store.

        Args:
            case_id: Unique identifier for this case
            embedding: Embedding vector as list of floats
            metadata: Optional metadata (diagnosis, description, thumbnail_url, etc.)
        """
        # Check for duplicate
        for entry in self._entries:
            if entry["case_id"] == case_id:
                entry["embedding"] = embedding
                entry["metadata"] = metadata or {}
                self._save()
                return

        self._entries.append({
            "case_id": case_id,
            "embedding": embedding,
            "metadata": metadata or {},
        })
        self._save()

    def find_similar(
        self,
        query_embedding: list[float],
        top_k: int = 3,
        exclude_case_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """Find the most similar cases to a query embedding.

        Args:
            query_embedding: Query embedding vector
            top_k: Number of results to return
            exclude_case_id: Optional case ID to exclude (e.g., the query case itself)

        Returns:
            List of dicts with case_id, metadata, similarity_score
        """
        if not self._entries:
            return []

        query = np.array(query_embedding, dtype=np.float32)
        query_norm = np.linalg.norm(query)
        if query_norm == 0:
            return []
        query = query / query_norm

        results = []
        for entry in self._entries:
            if exclude_case_id and entry["case_id"] == exclude_case_id:
                continue

            stored = np.array(entry["embedding"], dtype=np.float32)
            stored_norm = np.linalg.norm(stored)
            if stored_norm == 0:
                continue
            stored = stored / stored_norm

            # Cosine similarity
            similarity = float(np.dot(query, stored))
            results.append({
                "case_id": entry["case_id"],
                "metadata": entry["metadata"],
                "similarity_score": round(similarity, 4),
            })

        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        return results[:top_k]

    @property
    def count(self) -> int:
        return len(self._entries)


# Singleton stores per modality
_stores: dict[str, EmbeddingStore] = {}


def get_embedding_store(modality: str) -> EmbeddingStore:
    """Get the singleton embedding store for a modality."""
    if modality not in _stores:
        _stores[modality] = EmbeddingStore(modality)
    return _stores[modality]
