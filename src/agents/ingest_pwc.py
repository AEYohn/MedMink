"""Ingest agent for fetching papers from PapersWithCode."""

from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

import httpx
import structlog

from src.agents.base import AgentResult, BaseAgent
from src.kg.models import PaperNode
from src.models import Task

logger = structlog.get_logger()

# PapersWithCode API endpoints
PWC_API_BASE = "https://paperswithcode.com/api/v1"


class IngestPWCAgent(BaseAgent):
    """Agent for ingesting papers from PapersWithCode.

    PapersWithCode provides:
    - Papers with associated code implementations
    - Benchmark results and leaderboards
    - GitHub repository links
    - Method/task associations
    """

    name = "ingest_pwc"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.http_client = httpx.AsyncClient(timeout=30.0)

    async def execute(self, task: Task) -> AgentResult:
        """Execute paper ingestion from PapersWithCode."""
        try:
            payload = task.payload or {}
            topic = payload.get("topic", "machine learning")
            max_results = payload.get("max_results", 50)
            days_back = payload.get("days_back", 30)
            with_code_only = payload.get("with_code_only", True)

            self.logger.info(
                "Starting PapersWithCode ingestion",
                topic=topic,
                max_results=max_results,
                with_code_only=with_code_only,
            )

            # Fetch papers from PapersWithCode
            papers = await self._fetch_papers(
                topic=topic,
                max_results=max_results,
                days_back=days_back,
                with_code_only=with_code_only,
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
                    # Check if paper already exists (by arxiv_id or title)
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
                context_summary=f"Ingested papers from PapersWithCode for topic '{topic}'",
                decision_made=f"Added {added_count} new papers, skipped {skipped_count} existing",
                reasoning=f"Fetched {len(papers)} papers from PapersWithCode API, filtered by code availability",
                confidence=0.9,
                assumptions=[
                    "PapersWithCode API returned accurate results",
                    "Papers with code have higher implementation quality",
                ],
                expected_outcomes=[
                    f"{added_count} papers will be analyzed",
                    "Papers have code implementations for reference",
                ],
            )

            self.logger.info(
                "PapersWithCode ingestion complete",
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
                    "source": "paperswithcode",
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
        max_results: int = 50,
        days_back: int = 30,
        with_code_only: bool = True,
    ) -> list[PaperNode]:
        """Fetch papers from PapersWithCode API."""
        papers = []
        cutoff_date = datetime.utcnow() - timedelta(days=days_back)

        # Search for papers
        search_url = f"{PWC_API_BASE}/papers/"
        params = {
            "q": topic,
            "page": 1,
            "items_per_page": min(max_results, 50),  # API limit per page
        }

        self.logger.debug("Fetching from PapersWithCode", query=topic, params=params)

        try:
            response = await self.http_client.get(search_url, params=params)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as e:
            self.logger.warning("PapersWithCode API error", error=str(e))
            return []

        results = data.get("results", [])
        self.logger.debug("Got results from PapersWithCode", count=len(results))

        for item in results:
            # Skip papers without code if requested
            if with_code_only and not item.get("repository_url"):
                continue

            # Parse published date
            published_str = item.get("published")
            published_date = None
            if published_str:
                try:
                    published_date = datetime.fromisoformat(published_str.replace("Z", "+00:00"))
                except ValueError:
                    try:
                        published_date = datetime.strptime(published_str, "%Y-%m-%d")
                    except ValueError:
                        pass

            # Skip old papers
            if published_date and published_date < cutoff_date:
                continue

            # Extract arxiv ID from URL if present
            arxiv_id = None
            arxiv_url = item.get("arxiv_id") or item.get("url_abs", "")
            if "arxiv.org" in arxiv_url:
                arxiv_id = arxiv_url.split("/")[-1]
            elif item.get("arxiv_id"):
                arxiv_id = item.get("arxiv_id")

            # Build PDF URL from arxiv ID
            pdf_url = None
            if arxiv_id:
                pdf_url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"

            paper = PaperNode(
                id=str(uuid4()),
                arxiv_id=arxiv_id or "",
                title=item.get("title", "").strip(),
                abstract=item.get("abstract", "").strip(),
                authors=item.get("authors", []),
                categories=[],  # PWC doesn't provide arxiv categories directly
                published_date=published_date,
                pdf_url=pdf_url,
                source_url=item.get("url_abs") or f"https://paperswithcode.com{item.get('url', '')}",
                analyzed=False,
            )

            papers.append(paper)

            if len(papers) >= max_results:
                break

        self.logger.debug("Parsed papers from PapersWithCode", count=len(papers))
        return papers

    async def fetch_paper_code(self, paper_url: str) -> dict[str, Any] | None:
        """Fetch code repository information for a paper.

        Args:
            paper_url: URL of the paper on PapersWithCode

        Returns:
            Dictionary with repository info or None
        """
        try:
            # Extract paper ID from URL
            paper_id = paper_url.split("/")[-1]
            url = f"{PWC_API_BASE}/papers/{paper_id}/repositories/"

            response = await self.http_client.get(url)
            if response.status_code == 200:
                data = response.json()
                repos = data.get("results", [])
                if repos:
                    # Return the most starred repository
                    repos.sort(key=lambda x: x.get("stars", 0), reverse=True)
                    return {
                        "url": repos[0].get("url"),
                        "stars": repos[0].get("stars", 0),
                        "framework": repos[0].get("framework"),
                    }
        except Exception as e:
            self.logger.debug("Failed to fetch paper code", url=paper_url, error=str(e))

        return None

    async def close(self):
        """Close the HTTP client."""
        await self.http_client.aclose()
