"""Anchor paper store for calibrated evaluation.

Anchor papers are well-established papers with known quality scores that serve
as reference points for evaluating new research. This approach is inspired by
Idea2Paper's anchored multi-agent review system.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

import structlog

from src.rag.embeddings import get_embedding_service
from src.rag.vector_store import get_vector_store

logger = structlog.get_logger()


@dataclass
class AnchorPaper:
    """Reference paper with known quality scores."""

    id: str
    title: str
    abstract: str
    venue: str  # e.g., "NeurIPS 2023", "ICLR 2024"
    venue_tier: str = "A"  # A, B, C tier
    year: int = 2024
    citation_count: int = 0
    domain: str = ""  # e.g., "vision", "nlp", "rl"
    keywords: list[str] = field(default_factory=list)

    # Calibrated scores (1-10 scale)
    overall_score: float = 5.0
    novelty_score: float = 5.0
    methodology_score: float = 5.0
    clarity_score: float = 5.0
    significance_score: float = 5.0
    reproducibility_score: float = 5.0

    # Embedding for similarity matching
    embedding: list[float] | None = None


# Pre-defined anchor papers representing different quality tiers
# These serve as reference points for comparative evaluation
DEFAULT_ANCHORS: list[dict[str, Any]] = [
    # Tier A - Landmark papers (score 9-10)
    {
        "id": "anchor_attention_2017",
        "title": "Attention Is All You Need",
        "abstract": "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
        "venue": "NeurIPS 2017",
        "venue_tier": "A",
        "year": 2017,
        "citation_count": 100000,
        "domain": "nlp",
        "keywords": ["transformer", "attention", "sequence-to-sequence"],
        "overall_score": 10.0,
        "novelty_score": 10.0,
        "methodology_score": 9.5,
        "clarity_score": 9.0,
        "significance_score": 10.0,
        "reproducibility_score": 9.0,
    },
    {
        "id": "anchor_bert_2018",
        "title": "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
        "abstract": "We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.",
        "venue": "NAACL 2019",
        "venue_tier": "A",
        "year": 2019,
        "citation_count": 80000,
        "domain": "nlp",
        "keywords": ["bert", "pre-training", "language model"],
        "overall_score": 9.5,
        "novelty_score": 9.0,
        "methodology_score": 9.5,
        "clarity_score": 9.0,
        "significance_score": 10.0,
        "reproducibility_score": 8.5,
    },
    {
        "id": "anchor_resnet_2015",
        "title": "Deep Residual Learning for Image Recognition",
        "abstract": "Deeper neural networks are more difficult to train. We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously. We explicitly reformulate the layers as learning residual functions with reference to the layer inputs, instead of learning unreferenced functions.",
        "venue": "CVPR 2016",
        "venue_tier": "A",
        "year": 2016,
        "citation_count": 150000,
        "domain": "vision",
        "keywords": ["resnet", "residual learning", "deep learning"],
        "overall_score": 10.0,
        "novelty_score": 9.5,
        "methodology_score": 9.5,
        "clarity_score": 9.5,
        "significance_score": 10.0,
        "reproducibility_score": 9.5,
    },
    # Tier B - Strong papers (score 7-8)
    {
        "id": "anchor_gpt2_2019",
        "title": "Language Models are Unsupervised Multitask Learners",
        "abstract": "Natural language processing tasks, such as question answering, machine translation, reading comprehension, and summarization, are typically approached with supervised learning on task-specific datasets. We demonstrate that language models begin to learn these tasks without any explicit supervision when trained on a new dataset of millions of webpages called WebText.",
        "venue": "OpenAI Technical Report",
        "venue_tier": "B",
        "year": 2019,
        "citation_count": 10000,
        "domain": "nlp",
        "keywords": ["gpt", "language model", "zero-shot"],
        "overall_score": 8.0,
        "novelty_score": 7.5,
        "methodology_score": 7.5,
        "clarity_score": 8.0,
        "significance_score": 8.5,
        "reproducibility_score": 6.0,  # Not open-sourced initially
    },
    {
        "id": "anchor_vit_2020",
        "title": "An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale",
        "abstract": "While the Transformer architecture has become the de-facto standard for natural language processing tasks, its applications to computer vision remain limited. In vision, attention is either applied in conjunction with convolutional networks, or used to replace certain components of convolutional networks while keeping their overall structure in place.",
        "venue": "ICLR 2021",
        "venue_tier": "A",
        "year": 2021,
        "citation_count": 20000,
        "domain": "vision",
        "keywords": ["vision transformer", "vit", "image classification"],
        "overall_score": 8.5,
        "novelty_score": 8.0,
        "methodology_score": 8.0,
        "clarity_score": 8.5,
        "significance_score": 9.0,
        "reproducibility_score": 8.5,
    },
    # Tier C - Solid papers (score 5-6)
    {
        "id": "anchor_typical_iclr",
        "title": "Improving Neural Network Training with Gradient Norm Clipping",
        "abstract": "Training deep neural networks is challenging due to gradient instability. We propose a simple yet effective method for gradient norm clipping that adaptively adjusts the clipping threshold during training. Our method improves convergence on standard benchmarks without requiring extensive hyperparameter tuning.",
        "venue": "ICLR 2023 Workshop",
        "venue_tier": "B",
        "year": 2023,
        "citation_count": 50,
        "domain": "optimization",
        "keywords": ["gradient clipping", "optimization", "training"],
        "overall_score": 6.0,
        "novelty_score": 5.5,
        "methodology_score": 6.5,
        "clarity_score": 7.0,
        "significance_score": 5.0,
        "reproducibility_score": 7.0,
    },
    {
        "id": "anchor_incremental_nlp",
        "title": "Fine-tuning BERT for Text Classification: A Comparative Study",
        "abstract": "We present a comprehensive study of fine-tuning strategies for BERT on text classification tasks. We compare different learning rates, batch sizes, and fine-tuning approaches across multiple datasets. Our results provide practical guidelines for practitioners.",
        "venue": "ACL 2022 Findings",
        "venue_tier": "B",
        "year": 2022,
        "citation_count": 200,
        "domain": "nlp",
        "keywords": ["bert", "fine-tuning", "text classification"],
        "overall_score": 5.5,
        "novelty_score": 4.0,  # Incremental
        "methodology_score": 7.0,
        "clarity_score": 7.5,
        "significance_score": 5.0,
        "reproducibility_score": 8.0,
    },
]


class AnchorStore:
    """Store and retrieve anchor papers for calibrated evaluation.

    Anchors are organized by domain and quality tier to enable
    fair comparisons within the same research area.
    """

    def __init__(self):
        self.anchors: dict[str, AnchorPaper] = {}
        self.domain_index: dict[str, list[str]] = {}  # domain -> anchor_ids
        self.tier_index: dict[str, list[str]] = {}  # tier -> anchor_ids
        self.embedding_service = get_embedding_service()
        self._initialized = False

    async def initialize(self) -> None:
        """Load default anchors and compute embeddings."""
        if self._initialized:
            return

        logger.info("Initializing anchor store with default anchors")

        for anchor_data in DEFAULT_ANCHORS:
            anchor = AnchorPaper(**anchor_data)

            # Compute embedding for similarity matching
            anchor.embedding = await self.embedding_service.embed_paper(
                anchor.title, anchor.abstract
            )

            self.anchors[anchor.id] = anchor

            # Index by domain
            if anchor.domain not in self.domain_index:
                self.domain_index[anchor.domain] = []
            self.domain_index[anchor.domain].append(anchor.id)

            # Index by tier
            if anchor.venue_tier not in self.tier_index:
                self.tier_index[anchor.venue_tier] = []
            self.tier_index[anchor.venue_tier].append(anchor.id)

        self._initialized = True
        logger.info(
            "Anchor store initialized",
            total_anchors=len(self.anchors),
            domains=list(self.domain_index.keys()),
        )

    async def add_anchor(self, anchor: AnchorPaper) -> None:
        """Add a new anchor paper."""
        if anchor.embedding is None:
            anchor.embedding = await self.embedding_service.embed_paper(
                anchor.title, anchor.abstract
            )

        self.anchors[anchor.id] = anchor

        # Update indexes
        if anchor.domain not in self.domain_index:
            self.domain_index[anchor.domain] = []
        if anchor.id not in self.domain_index[anchor.domain]:
            self.domain_index[anchor.domain].append(anchor.id)

        if anchor.venue_tier not in self.tier_index:
            self.tier_index[anchor.venue_tier] = []
        if anchor.id not in self.tier_index[anchor.venue_tier]:
            self.tier_index[anchor.venue_tier].append(anchor.id)

        logger.info("Added anchor paper", id=anchor.id, title=anchor.title[:50])

    def get_anchors_by_domain(self, domain: str) -> list[AnchorPaper]:
        """Get all anchors for a specific domain."""
        anchor_ids = self.domain_index.get(domain, [])
        return [self.anchors[aid] for aid in anchor_ids if aid in self.anchors]

    def get_anchors_by_tier(self, tier: str) -> list[AnchorPaper]:
        """Get all anchors for a specific tier."""
        anchor_ids = self.tier_index.get(tier, [])
        return [self.anchors[aid] for aid in anchor_ids if aid in self.anchors]

    def get_all_anchors(self) -> list[AnchorPaper]:
        """Get all anchor papers."""
        return list(self.anchors.values())

    async def find_similar_anchors(
        self,
        title: str,
        abstract: str,
        limit: int = 3,
    ) -> list[tuple[AnchorPaper, float]]:
        """Find anchors most similar to a given paper.

        Returns:
            List of (anchor, similarity_score) tuples sorted by similarity
        """
        await self.initialize()

        # Compute embedding for the query paper
        query_embedding = await self.embedding_service.embed_paper(title, abstract)

        # Compute similarity with all anchors
        similarities = []
        for anchor in self.anchors.values():
            if anchor.embedding:
                # Cosine similarity
                sim = self._cosine_similarity(query_embedding, anchor.embedding)
                similarities.append((anchor, sim))

        # Sort by similarity (highest first)
        similarities.sort(key=lambda x: x[1], reverse=True)

        return similarities[:limit]

    def _cosine_similarity(self, vec1: list[float], vec2: list[float]) -> float:
        """Compute cosine similarity between two vectors."""
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = sum(a * a for a in vec1) ** 0.5
        norm2 = sum(b * b for b in vec2) ** 0.5

        if norm1 == 0 or norm2 == 0:
            return 0.0

        return dot_product / (norm1 * norm2)


# Singleton instance
_anchor_store: AnchorStore | None = None


def get_anchor_store() -> AnchorStore:
    """Get or create the anchor store singleton."""
    global _anchor_store
    if _anchor_store is None:
        _anchor_store = AnchorStore()
    return _anchor_store
