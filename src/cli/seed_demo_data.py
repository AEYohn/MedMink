"""Seed demo data for the Research Synthesizer."""

import asyncio
import random
from datetime import datetime, timedelta
from uuid import uuid4

import click
import structlog

from src.db import close_databases, init_databases
from src.kg import get_knowledge_graph
from src.kg.models import ClaimNode, MethodNode, PaperNode, PredictionNode, TrendNode

logger = structlog.get_logger()

# Demo papers data
DEMO_PAPERS = [
    {
        "arxiv_id": "2401.00001",
        "title": "Scaling Laws for Neural Language Models: A Comprehensive Study",
        "abstract": "We investigate the scaling properties of transformer-based language models across multiple orders of magnitude. Our results demonstrate predictable performance improvements with increased compute, suggesting efficient training strategies.",
        "authors": ["Alice Smith", "Bob Johnson"],
        "categories": ["cs.CL", "cs.LG"],
    },
    {
        "arxiv_id": "2401.00002",
        "title": "Attention Is All You Need: Revisited with Modern Architectures",
        "abstract": "We revisit the transformer architecture with modern modifications including rotary embeddings, grouped query attention, and flash attention. Our experiments show 2x speedup with comparable accuracy.",
        "authors": ["Carol Williams", "David Brown"],
        "categories": ["cs.LG", "cs.AI"],
    },
    {
        "arxiv_id": "2401.00003",
        "title": "Emergent Abilities in Large Language Models",
        "abstract": "We document several emergent abilities that appear only in models above certain scale thresholds. These include chain-of-thought reasoning, few-shot learning, and complex task decomposition.",
        "authors": ["Eve Davis", "Frank Miller"],
        "categories": ["cs.AI", "cs.CL"],
    },
    {
        "arxiv_id": "2401.00004",
        "title": "Mixture of Experts: Efficient Scaling of Neural Networks",
        "abstract": "We present a novel mixture of experts architecture that achieves state-of-the-art performance while using only 10% of the computational budget. Our approach enables training trillion-parameter models.",
        "authors": ["Grace Wilson", "Henry Moore"],
        "categories": ["cs.LG", "cs.AI"],
    },
    {
        "arxiv_id": "2401.00005",
        "title": "Constitutional AI: Training Helpful, Harmless, and Honest Assistants",
        "abstract": "We introduce Constitutional AI, a method for training AI assistants to be helpful, harmless, and honest using a set of principles rather than human feedback on specific outputs.",
        "authors": ["Ivy Taylor", "Jack Anderson"],
        "categories": ["cs.AI", "cs.CL"],
    },
    {
        "arxiv_id": "2401.00006",
        "title": "Reinforcement Learning from Human Feedback: Limitations and Alternatives",
        "abstract": "We analyze the limitations of RLHF for aligning language models, including reward hacking and distribution shift. We propose Direct Preference Optimization as a simpler alternative.",
        "authors": ["Kate Thomas", "Leo Jackson"],
        "categories": ["cs.LG", "cs.AI"],
    },
    {
        "arxiv_id": "2401.00007",
        "title": "Vision Transformers Outperform CNNs: A Critical Analysis",
        "abstract": "We conduct extensive experiments comparing Vision Transformers to CNNs across various benchmarks. Results show ViTs consistently outperform CNNs when sufficient data is available.",
        "authors": ["Mary White", "Nick Harris"],
        "categories": ["cs.CV", "cs.LG"],
    },
    {
        "arxiv_id": "2401.00008",
        "title": "CNNs Still Dominate: When Vision Transformers Fail",
        "abstract": "Contrary to recent claims, we demonstrate scenarios where CNNs significantly outperform Vision Transformers, particularly in data-limited and computational-constrained settings.",
        "authors": ["Olivia Martin", "Peter Garcia"],
        "categories": ["cs.CV", "cs.LG"],
    },
    {
        "arxiv_id": "2401.00009",
        "title": "Multimodal Foundation Models: Unifying Vision and Language",
        "abstract": "We present a multimodal foundation model that achieves strong performance across vision and language tasks through joint pretraining on image-text pairs.",
        "authors": ["Quinn Martinez", "Rachel Robinson"],
        "categories": ["cs.CV", "cs.CL"],
    },
    {
        "arxiv_id": "2401.00010",
        "title": "Retrieval Augmented Generation: Grounding LLMs in External Knowledge",
        "abstract": "We introduce RAG, a method that augments language models with retrieval from external knowledge bases, reducing hallucination and improving factual accuracy.",
        "authors": ["Sam Clark", "Tina Lewis"],
        "categories": ["cs.CL", "cs.IR"],
    },
]

DEMO_METHODS = [
    {
        "name": "Transformer",
        "description": "Self-attention based architecture for sequence modeling",
    },
    {"name": "Mixture of Experts", "description": "Sparse activation for efficient scaling"},
    {"name": "RLHF", "description": "Reinforcement Learning from Human Feedback for alignment"},
    {"name": "DPO", "description": "Direct Preference Optimization for simpler alignment"},
    {"name": "RAG", "description": "Retrieval Augmented Generation for grounding"},
    {"name": "Flash Attention", "description": "IO-aware exact attention algorithm"},
    {"name": "Chain-of-Thought", "description": "Prompting technique for complex reasoning"},
    {"name": "Constitutional AI", "description": "Principle-based AI alignment approach"},
]

DEMO_TRENDS = [
    {
        "name": "Scaling Laws",
        "description": "Research into predictable scaling behavior of neural networks",
        "direction": "rising",
        "velocity": 8.5,
    },
    {
        "name": "Multimodal Models",
        "description": "Unifying vision, language, and other modalities",
        "direction": "rising",
        "velocity": 9.2,
    },
    {
        "name": "AI Alignment",
        "description": "Methods for ensuring AI systems are safe and beneficial",
        "direction": "rising",
        "velocity": 7.8,
    },
    {
        "name": "Efficient Inference",
        "description": "Techniques for faster and cheaper model inference",
        "direction": "rising",
        "velocity": 8.0,
    },
    {
        "name": "CNN Architectures",
        "description": "Classical convolutional neural network research",
        "direction": "declining",
        "velocity": 3.5,
    },
]


async def seed_demo_data(clear_existing: bool = False):
    """Seed the knowledge graph with demo data."""
    logger.info("Starting demo data seeding")

    await init_databases()
    kg = await get_knowledge_graph()

    if clear_existing:
        logger.info("Clearing existing data not implemented - continuing with seed")

    # Add papers
    papers = []
    for _i, paper_data in enumerate(DEMO_PAPERS):
        paper = PaperNode(
            id=str(uuid4()),
            arxiv_id=paper_data["arxiv_id"],
            title=paper_data["title"],
            abstract=paper_data["abstract"],
            authors=paper_data["authors"],
            categories=paper_data["categories"],
            published_date=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
            analyzed=True,
            created_at=datetime.utcnow() - timedelta(days=random.randint(1, 30)),
        )
        await kg.add_paper(paper)
        papers.append(paper)
        logger.info(f"Added paper: {paper.title[:50]}")

    # Add claims for each paper
    claims = []
    claim_templates = [
        ("Our method achieves {metric}% improvement on {benchmark}", "performance", 0.85),
        ("We demonstrate that {concept} leads to better generalization", "theoretical", 0.7),
        ("The proposed approach reduces computational cost by {metric}x", "methodology", 0.8),
        ("Experiments show consistent improvements across {count} benchmarks", "empirical", 0.9),
        ("A key limitation is the requirement for {resource}", "limitation", 0.75),
    ]

    for paper in papers:
        num_claims = random.randint(2, 4)
        for _ in range(num_claims):
            template, category, base_confidence = random.choice(claim_templates)
            statement = template.format(
                metric=random.randint(10, 50),
                benchmark=random.choice(["ImageNet", "GLUE", "SuperGLUE", "MMLU"]),
                concept=random.choice(["scaling", "attention", "sparsity", "pretraining"]),
                count=random.randint(3, 10),
                resource=random.choice(["large compute", "extensive data", "careful tuning"]),
            )

            claim = ClaimNode(
                id=str(uuid4()),
                paper_id=paper.id,
                statement=statement,
                category=category,
                confidence=base_confidence + random.uniform(-0.1, 0.1),
                status="unverified",
                created_at=datetime.utcnow() - timedelta(days=random.randint(1, 25)),
            )
            await kg.add_claim(claim, paper.id)
            claims.append(claim)

    logger.info(f"Added {len(claims)} claims")

    # Add a contradiction (papers 7 and 8 contradict on ViT vs CNN)
    vit_claim = next((c for c in claims if c.paper_id == papers[6].id), None)
    cnn_claim = next((c for c in claims if c.paper_id == papers[7].id), None)
    if vit_claim and cnn_claim:
        await kg.add_contradiction(
            claim1_id=vit_claim.id,
            claim2_id=cnn_claim.id,
            strength=0.8,
            explanation="These papers make contradictory claims about the relative performance of Vision Transformers vs CNNs",
            contradiction_type="empirical",
        )
        logger.info("Added contradiction between ViT and CNN papers")

    # Add methods
    for method_data in DEMO_METHODS:
        method = MethodNode(
            id=str(uuid4()),
            name=method_data["name"],
            description=method_data["description"],
            paper_count=random.randint(1, 10),
            is_novel=random.random() > 0.7,
            created_at=datetime.utcnow() - timedelta(days=random.randint(1, 60)),
        )
        await kg.add_method(method, paper_id=random.choice(papers).id)

    logger.info(f"Added {len(DEMO_METHODS)} methods")

    # Add trends
    for trend_data in DEMO_TRENDS:
        trend = TrendNode(
            id=str(uuid4()),
            name=trend_data["name"],
            description=trend_data["description"],
            direction=trend_data["direction"],
            velocity=trend_data["velocity"],
            confidence=random.uniform(0.7, 0.95),
            first_seen=datetime.utcnow() - timedelta(days=random.randint(30, 90)),
            last_updated=datetime.utcnow(),
            created_at=datetime.utcnow() - timedelta(days=random.randint(7, 30)),
        )
        await kg.add_trend(trend)

    logger.info(f"Added {len(DEMO_TRENDS)} trends")

    # Add predictions
    predictions = [
        (
            "Mixture of Experts will become the dominant architecture for LLMs by end of year",
            "method_adoption",
            0.75,
        ),
        (
            "Multimodal models will achieve human-level performance on VQA benchmarks",
            "performance_improvement",
            0.6,
        ),
        (
            "A new attention mechanism will reduce quadratic complexity to linear",
            "new_capability",
            0.4,
        ),
        (
            "Constitutional AI approaches will be adopted by major AI labs",
            "trend_continuation",
            0.8,
        ),
    ]

    for statement, category, confidence in predictions:
        timeframe = random.choice(["1_month", "3_months", "6_months"])
        months = {"1_month": 1, "3_months": 3, "6_months": 6}[timeframe]

        prediction = PredictionNode(
            id=str(uuid4()),
            statement=statement,
            category=category,
            confidence=confidence,
            timeframe=timeframe,
            due_date=datetime.utcnow() + timedelta(days=months * 30),
            outcome="pending",
            created_at=datetime.utcnow() - timedelta(days=random.randint(1, 14)),
        )
        await kg.add_prediction(prediction)

    logger.info(f"Added {len(predictions)} predictions")

    # Print summary
    stats = await kg.get_stats()
    logger.info("Demo data seeding complete", stats=stats)

    await close_databases()
    return stats


@click.command()
@click.option("--clear", is_flag=True, help="Clear existing data before seeding")
def main(clear: bool):
    """Seed demo data for the Research Synthesizer."""
    asyncio.run(seed_demo_data(clear_existing=clear))


if __name__ == "__main__":
    main()
