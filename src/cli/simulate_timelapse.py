"""Simulate a time-lapse of system activity for demos."""

import asyncio
import random
from datetime import datetime, timedelta
from uuid import uuid4

import click
import structlog

from src.db import init_databases, close_databases
from src.kg import get_knowledge_graph
from src.kg.models import PaperNode, ClaimNode, TrendNode

logger = structlog.get_logger()


async def simulate_paper_ingestion(kg, day: int, topic: str):
    """Simulate paper ingestion for a given day."""
    num_papers = random.randint(3, 8)
    papers = []

    for i in range(num_papers):
        paper = PaperNode(
            id=str(uuid4()),
            arxiv_id=f"2401.{day:02d}{i:03d}",
            title=f"Research on {topic}: Day {day} Paper {i+1}",
            abstract=f"This paper investigates novel approaches to {topic}. We present experimental results demonstrating improvements over baseline methods.",
            authors=[f"Author {j}" for j in range(random.randint(2, 5))],
            categories=["cs.AI", "cs.LG"],
            published_date=datetime.utcnow() - timedelta(days=7 - day),
            analyzed=False,
        )
        await kg.add_paper(paper)
        papers.append(paper)

    return papers


async def simulate_analysis(kg, papers):
    """Simulate paper analysis."""
    claims = []
    for paper in papers:
        num_claims = random.randint(2, 4)
        for j in range(num_claims):
            claim = ClaimNode(
                id=str(uuid4()),
                paper_id=paper.id,
                statement=f"Claim {j+1} from {paper.title[:30]}: We demonstrate improved performance",
                category=random.choice(["performance", "methodology", "empirical"]),
                confidence=random.uniform(0.6, 0.95),
                status="unverified",
            )
            await kg.add_claim(claim, paper.id)
            claims.append(claim)

        await kg.mark_paper_analyzed(paper.id)

    return claims


async def simulate_trend_update(kg, day: int):
    """Simulate trend velocity updates."""
    trends = await kg.get_trends()
    for trend in trends:
        # Simulate velocity changes
        change = random.uniform(-0.5, 0.5)
        new_velocity = max(0, min(10, trend.velocity + change))

        # Update direction based on velocity
        if new_velocity > 6:
            direction = "rising"
        elif new_velocity < 4:
            direction = "declining"
        else:
            direction = "stable"

        # Note: Would need to add update method to KG


async def run_timelapse(days: int = 7, speed: float = 1.0):
    """Run a time-lapse simulation."""
    logger.info(f"Starting {days}-day time-lapse simulation")

    await init_databases()
    kg = await get_knowledge_graph()

    topics = [
        "transformer architectures",
        "multimodal learning",
        "efficient inference",
        "AI alignment",
        "neural scaling",
    ]

    total_papers = 0
    total_claims = 0

    for day in range(1, days + 1):
        topic = random.choice(topics)
        logger.info(f"Day {day}: Simulating activity for '{topic}'")

        # Simulate ingestion
        papers = await simulate_paper_ingestion(kg, day, topic)
        total_papers += len(papers)
        logger.info(f"  Ingested {len(papers)} papers")

        # Simulate analysis
        claims = await simulate_analysis(kg, papers)
        total_claims += len(claims)
        logger.info(f"  Extracted {len(claims)} claims")

        # Simulate trend updates
        await simulate_trend_update(kg, day)

        # Wait between days (scaled by speed)
        await asyncio.sleep(2.0 / speed)

        # Print progress
        stats = await kg.get_stats()
        logger.info(f"  Graph stats: {stats}")

    logger.info(f"Time-lapse complete: {total_papers} papers, {total_claims} claims")

    await close_databases()


@click.command()
@click.option("--days", default=7, help="Number of days to simulate")
@click.option("--speed", default=1.0, help="Simulation speed multiplier")
def main(days: int, speed: float):
    """Simulate a time-lapse of system activity."""
    asyncio.run(run_timelapse(days=days, speed=speed))


if __name__ == "__main__":
    main()
