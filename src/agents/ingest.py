"""Ingest agent for fetching papers from arxiv."""

from datetime import datetime, timedelta
from uuid import uuid4

import feedparser
import httpx
import structlog

from src.agents.base import AgentResult, BaseAgent
from src.config import settings
from src.kg.models import PaperNode
from src.models import Task

logger = structlog.get_logger()

ARXIV_API_URL = "https://export.arxiv.org/api/query"


class IngestAgent(BaseAgent):
    """Agent for ingesting papers from arxiv."""

    name = "ingest"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.http_client = httpx.AsyncClient(timeout=30.0)

    async def execute(self, task: Task) -> AgentResult:
        """Execute paper ingestion."""
        try:
            payload = task.payload or {}
            topic = payload.get("topic", "machine learning")
            max_results = payload.get("max_results", settings.arxiv_max_results)
            categories = payload.get("categories", settings.arxiv_categories)
            days_back = payload.get("days_back", 7)

            self.logger.info(
                "Starting paper ingestion",
                topic=topic,
                max_results=max_results,
                categories=categories,
            )

            # Fetch papers from arxiv
            papers = await self._fetch_papers(
                topic=topic,
                categories=categories,
                max_results=max_results,
                days_back=days_back,
            )

            if not papers:
                return AgentResult(
                    success=True,
                    data={"papers_ingested": 0, "message": "No new papers found"},
                    metrics={"papers_fetched": 0, "papers_added": 0},
                )

            # Add papers to knowledge graph (if available)
            kg = await self._get_kg()
            added_count = 0
            skipped_count = 0

            if kg:
                for paper in papers:
                    # Check if paper already exists
                    existing = await kg.get_paper_by_arxiv_id(paper.arxiv_id)
                    if existing:
                        skipped_count += 1
                        continue

                    await kg.add_paper(paper)
                    added_count += 1
            else:
                # Knowledge graph unavailable - just report papers fetched
                self.logger.warning("Knowledge graph unavailable, papers not stored")
                added_count = len(papers)

            # Create thought signature
            thought = await self.create_thought_signature(
                task=task,
                context_summary=f"Ingested papers for topic '{topic}' from {len(categories)} categories",
                decision_made=f"Added {added_count} new papers, skipped {skipped_count} existing",
                reasoning=f"Fetched {len(papers)} papers from arxiv API, filtered by date and category",
                confidence=0.9,
                assumptions=[
                    "arxiv API returned accurate results",
                    "Paper metadata is correctly parsed",
                ],
                expected_outcomes=[
                    f"{added_count} papers will be analyzed",
                    "Knowledge graph will grow with new claims and methods",
                ],
            )

            self.logger.info(
                "Paper ingestion complete",
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
                    "topic": topic,
                },
                thought_signature=thought,
                metrics={
                    "papers_fetched": len(papers),
                    "papers_added": added_count,
                    "papers_skipped": skipped_count,
                },
            )

        except Exception as e:
            return await self._handle_error(e, task, {"topic": task.payload.get("topic")})

    async def _fetch_papers(
        self,
        topic: str,
        categories: list[str],
        max_results: int = 100,
        days_back: int = 7,
    ) -> list[PaperNode]:
        """Fetch papers from arxiv API."""
        # Build category filter
        cat_query = " OR ".join(f"cat:{cat}" for cat in categories)

        # Build the search query
        query = f"all:{topic} AND ({cat_query})"

        params = {
            "search_query": query,
            "start": 0,
            "max_results": max_results,
            "sortBy": "submittedDate",
            "sortOrder": "descending",
        }

        self.logger.debug("Fetching from arxiv", query=query, max_results=max_results)

        response = await self.http_client.get(ARXIV_API_URL, params=params)
        response.raise_for_status()

        # Parse the Atom feed
        feed = feedparser.parse(response.text)

        papers = []
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)

        for entry in feed.entries:
            # Parse the published date
            published = datetime(*entry.published_parsed[:6])

            # Skip old papers
            if published < cutoff_date:
                continue

            # Extract arxiv ID from the entry ID
            arxiv_id = entry.id.split("/abs/")[-1]

            # Get PDF link
            pdf_url = None
            for link in entry.links:
                if link.get("title") == "pdf":
                    pdf_url = link.href
                    break

            # Extract categories
            categories = [tag.term for tag in entry.tags] if hasattr(entry, "tags") else []

            paper = PaperNode(
                id=str(uuid4()),
                arxiv_id=arxiv_id,
                title=entry.title.replace("\n", " ").strip(),
                abstract=entry.summary.replace("\n", " ").strip(),
                authors=[author.name for author in entry.authors],
                categories=categories,
                published_date=published,
                updated_date=(
                    datetime(*entry.updated_parsed[:6])
                    if hasattr(entry, "updated_parsed")
                    else None
                ),
                pdf_url=pdf_url,
                source_url=entry.id,
                analyzed=False,
            )

            papers.append(paper)

        self.logger.debug("Parsed papers from arxiv", count=len(papers))
        return papers

    async def fetch_citations(self, arxiv_id: str) -> int:
        """Fetch citation count from Semantic Scholar (optional integration)."""
        try:
            url = f"https://api.semanticscholar.org/graph/v1/paper/arXiv:{arxiv_id}"
            params = {"fields": "citationCount"}

            response = await self.http_client.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                return data.get("citationCount", 0)
        except Exception as e:
            self.logger.debug("Failed to fetch citations", arxiv_id=arxiv_id, error=str(e))

        return 0

    async def close(self):
        """Close the HTTP client."""
        await self.http_client.aclose()
