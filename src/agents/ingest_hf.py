"""Ingest agent for fetching papers from HuggingFace Daily Papers."""

from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

import httpx
import structlog

from src.agents.base import AgentResult, BaseAgent
from src.kg.models import PaperNode
from src.models import Task

logger = structlog.get_logger()

# HuggingFace API endpoints
HF_PAPERS_API = "https://huggingface.co/api/daily_papers"


class IngestHFAgent(BaseAgent):
    """Agent for ingesting papers from HuggingFace Daily Papers.

    HuggingFace Daily Papers provides:
    - Community-curated important papers
    - Upvotes and engagement metrics
    - Links to related models and spaces
    - Discussion threads
    """

    name = "ingest_hf"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.http_client = httpx.AsyncClient(timeout=30.0)

    async def execute(self, task: Task) -> AgentResult:
        """Execute paper ingestion from HuggingFace Daily Papers."""
        try:
            payload = task.payload or {}
            max_results = payload.get("max_results", 50)
            days_back = payload.get("days_back", 7)
            min_upvotes = payload.get("min_upvotes", 0)

            self.logger.info(
                "Starting HuggingFace Papers ingestion",
                max_results=max_results,
                days_back=days_back,
                min_upvotes=min_upvotes,
            )

            # Fetch papers from HuggingFace
            papers = await self._fetch_papers(
                max_results=max_results,
                days_back=days_back,
                min_upvotes=min_upvotes,
            )

            if not papers:
                return AgentResult(
                    success=True,
                    data={"papers_ingested": 0, "message": "No new papers found"},
                    metrics={"papers_fetched": 0, "papers_added": 0},
                )

            # Add papers to knowledge graph
            kg = await self._get_kg()
            added_count = 0
            skipped_count = 0

            if kg:
                for paper in papers:
                    # Check if paper already exists
                    if paper.arxiv_id:
                        existing = await kg.get_paper_by_arxiv_id(paper.arxiv_id)
                    else:
                        existing = await kg.get_paper_by_title(paper.title)

                    if existing:
                        skipped_count += 1
                        continue

                    await kg.add_paper(paper)
                    added_count += 1
            else:
                self.logger.warning("Knowledge graph unavailable, papers not stored")
                added_count = len(papers)

            # Create thought signature
            thought = await self.create_thought_signature(
                task=task,
                context_summary="Ingested papers from HuggingFace Daily Papers",
                decision_made=f"Added {added_count} new papers, skipped {skipped_count} existing",
                reasoning=f"Fetched {len(papers)} papers from HuggingFace, filtered by upvotes and date",
                confidence=0.9,
                assumptions=[
                    "HuggingFace API returned accurate results",
                    "High-upvoted papers are community-validated as important",
                ],
                expected_outcomes=[
                    f"{added_count} papers will be analyzed",
                    "Papers represent community interest in ML research",
                ],
            )

            self.logger.info(
                "HuggingFace Papers ingestion complete",
                fetched=len(papers),
                added=added_count,
                skipped=skipped_count,
            )

            return AgentResult(
                success=True,
                data={
                    "papers_ingested": added_count,
                    "papers_skipped": skipped_count,
                    "total_fetched": len(papers),
                    "source": "huggingface",
                },
                thought_signature=thought,
                metrics={
                    "papers_fetched": len(papers),
                    "papers_added": added_count,
                    "papers_skipped": skipped_count,
                },
            )

        except Exception as e:
            return await self._handle_error(e, task, {})

    async def _fetch_papers(
        self,
        max_results: int = 50,
        days_back: int = 7,
        min_upvotes: int = 0,
    ) -> list[PaperNode]:
        """Fetch papers from HuggingFace Daily Papers API."""
        papers = []
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)

        self.logger.debug("Fetching from HuggingFace Daily Papers")

        try:
            response = await self.http_client.get(HF_PAPERS_API)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as e:
            self.logger.warning("HuggingFace API error", error=str(e))
            return []

        self.logger.debug("Got results from HuggingFace", count=len(data))

        for item in data:
            # Get paper details
            paper_data = item.get("paper", {})

            # Check upvotes threshold
            upvotes = item.get("numComments", 0) + item.get("numUpvotes", 0)
            if upvotes < min_upvotes:
                continue

            # Parse published date
            published_str = item.get("publishedAt") or paper_data.get("publishedAt")
            published_date = None
            if published_str:
                try:
                    published_date = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
                except ValueError:
                    pass

            # Skip old papers
            if published_date and published_date.replace(tzinfo=None) < cutoff_date:
                continue

            # Extract arxiv ID
            arxiv_id = paper_data.get("id", "")

            # Build PDF URL from arxiv ID
            pdf_url = None
            if arxiv_id:
                pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"

            # Get authors
            authors = []
            for author in paper_data.get("authors", []):
                if isinstance(author, dict):
                    authors.append(author.get("name", ""))
                elif isinstance(author, str):
                    authors.append(author)

            paper = PaperNode(
                id=str(uuid4()),
                arxiv_id=arxiv_id,
                title=paper_data.get("title", "").strip(),
                abstract=paper_data.get("summary", "").strip(),
                authors=authors,
                categories=[],
                published_date=published_date,
                pdf_url=pdf_url,
                source_url=f"https://huggingface.co/papers/{arxiv_id}" if arxiv_id else None,
                analyzed=False,
            )

            papers.append(paper)

            if len(papers) >= max_results:
                break

        # Sort by engagement (upvotes)
        papers_with_scores = list(
            zip(papers, [item.get("numUpvotes", 0) for item in data[: len(papers)]], strict=False)
        )
        papers_with_scores.sort(key=lambda x: x[1], reverse=True)
        papers = [p for p, _ in papers_with_scores]

        self.logger.debug("Parsed papers from HuggingFace", count=len(papers))
        return papers

    async def fetch_paper_discussions(self, arxiv_id: str) -> list[dict[str, Any]]:
        """Fetch discussion comments for a paper.

        Args:
            arxiv_id: arXiv ID of the paper

        Returns:
            List of discussion comments
        """
        try:
            url = f"https://huggingface.co/api/papers/{arxiv_id}/comments"
            response = await self.http_client.get(url)
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            self.logger.debug("Failed to fetch paper discussions", arxiv_id=arxiv_id, error=str(e))

        return []

    async def close(self):
        """Close the HTTP client."""
        await self.http_client.aclose()
