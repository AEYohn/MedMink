"""medRxiv/bioRxiv preprint ingestion agent.

Fetches recent medical preprints from medRxiv and bioRxiv.
Focus on COVID, oncology, cardiology, neurology, and other medical specialties.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Any

import httpx
import structlog

from src.agents.base import BaseAgent, AgentResult
from src.config import settings
from src.models import Task, Paper

logger = structlog.get_logger()

# medRxiv/bioRxiv API endpoints
MEDRXIV_API_URL = "https://api.medrxiv.org/details"
BIORXIV_API_URL = "https://api.biorxiv.org/details"


class IngestMedRxivAgent(BaseAgent):
    """Agent for fetching preprints from medRxiv and bioRxiv."""

    name = "ingest_medxiv"

    # Category mappings for medical specialties
    MEDICAL_CATEGORIES = {
        "oncology": ["oncology", "cancer", "tumor", "carcinoma", "neoplasm"],
        "cardiology": ["cardiovascular", "cardiology", "heart", "cardiac", "hypertension"],
        "neurology": ["neurology", "neurological", "brain", "neural", "cognitive"],
        "infectious": ["infectious disease", "epidemiology", "viral", "bacterial", "covid"],
        "endocrinology": ["endocrinology", "diabetes", "metabolic", "thyroid", "hormone"],
        "immunology": ["immunology", "immune", "autoimmune", "allergy", "inflammation"],
        "pulmonology": ["respiratory", "pulmonary", "lung", "asthma", "copd"],
        "gastroenterology": ["gastroenterology", "hepatology", "liver", "gut", "intestinal"],
    }

    async def execute(self, task: Task) -> AgentResult:
        """Execute medRxiv/bioRxiv ingestion task.

        Task parameters:
            - server: "medrxiv" or "biorxiv" (default: medrxiv)
            - days_back: Number of days to look back (default: 30)
            - categories: List of medical categories to filter
            - max_results: Maximum number of papers to fetch
            - keywords: Keywords to filter by
        """
        params = task.payload
        server = params.get("server", "medrxiv")
        days_back = params.get("days_back", 30)
        categories = params.get("categories", settings.medical_specialties)
        max_results = params.get("max_results", 100)
        keywords = params.get("keywords", [])

        try:
            # Calculate date range
            end_date = datetime.now()
            start_date = end_date - timedelta(days=days_back)

            self.logger.info(
                "Starting preprint search",
                server=server,
                days_back=days_back,
                categories=categories,
            )

            # Fetch preprints
            papers = await self._fetch_preprints(
                server=server,
                start_date=start_date,
                end_date=end_date,
                max_results=max_results,
            )

            # Filter by categories and keywords
            filtered_papers = self._filter_papers(papers, categories, keywords)

            thought = await self.create_thought_signature(
                task=task,
                context_summary=f"Preprint search from {server}",
                decision_made=f"Fetched {len(filtered_papers)} preprints",
                reasoning=f"Retrieved {len(papers)} total, {len(filtered_papers)} matched filters",
                confidence=0.85,
                expected_outcomes=[
                    "Preprints ready for analysis",
                    "Recent medical research captured",
                ],
            )

            return AgentResult(
                success=True,
                data={
                    "papers": [p.model_dump() for p in filtered_papers],
                    "count": len(filtered_papers),
                    "total_retrieved": len(papers),
                },
                thought_signature=thought,
                metrics={
                    "papers_fetched": len(filtered_papers),
                    "total_retrieved": len(papers),
                },
            )

        except Exception as e:
            return await self._handle_error(e, task, params)

    async def _fetch_preprints(
        self,
        server: str,
        start_date: datetime,
        end_date: datetime,
        max_results: int,
    ) -> list[Paper]:
        """Fetch preprints from medRxiv or bioRxiv API."""
        base_url = MEDRXIV_API_URL if server == "medrxiv" else BIORXIV_API_URL

        # Format dates
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")

        papers = []
        cursor = 0
        page_size = 100

        async with httpx.AsyncClient(timeout=60.0) as client:
            while len(papers) < max_results:
                url = f"{base_url}/{server}/{start_str}/{end_str}/{cursor}"

                response = await client.get(url)
                response.raise_for_status()

                data = response.json()
                collection = data.get("collection", [])

                if not collection:
                    break

                for item in collection:
                    paper = self._parse_preprint(item, server)
                    if paper:
                        papers.append(paper)

                if len(collection) < page_size:
                    break

                cursor += page_size
                await asyncio.sleep(0.3)  # Rate limiting

        return papers[:max_results]

    def _parse_preprint(self, item: dict, server: str) -> Paper | None:
        """Parse a preprint item into a Paper object."""
        try:
            doi = item.get("doi", "")
            title = item.get("title", "")
            abstract = item.get("abstract", "")
            authors_str = item.get("authors", "")
            date_str = item.get("date", "")
            category = item.get("category", "")

            # Parse authors
            authors = [a.strip() for a in authors_str.split(";") if a.strip()]

            # Parse date
            try:
                published = datetime.strptime(date_str, "%Y-%m-%d")
            except ValueError:
                published = datetime.now()

            # Build PDF URL
            if doi:
                pdf_url = f"https://www.{server}.org/content/{doi}.full.pdf"
            else:
                pdf_url = None

            return Paper(
                id=f"{server}:{doi}" if doi else f"{server}:{hash(title)}",
                arxiv_id=None,
                title=title,
                abstract=abstract,
                authors=authors[:20],  # Limit authors
                categories=[category] if category else [],
                published=published,
                source=server,
                pdf_url=pdf_url,
                metadata={
                    "doi": doi,
                    "server": server,
                    "category": category,
                    "preprint": True,
                },
            )

        except Exception as e:
            self.logger.warning("Failed to parse preprint", error=str(e))
            return None

    def _filter_papers(
        self,
        papers: list[Paper],
        categories: list[str],
        keywords: list[str],
    ) -> list[Paper]:
        """Filter papers by medical categories and keywords."""
        filtered = []

        # Build keyword sets for each category
        category_keywords = set()
        for cat in categories:
            cat_lower = cat.lower()
            if cat_lower in self.MEDICAL_CATEGORIES:
                category_keywords.update(self.MEDICAL_CATEGORIES[cat_lower])
            else:
                category_keywords.add(cat_lower)

        # Add explicit keywords
        if keywords:
            category_keywords.update(kw.lower() for kw in keywords)

        for paper in papers:
            # Check title and abstract for keywords
            text = f"{paper.title} {paper.abstract}".lower()

            # Check category
            paper_cat = paper.categories[0].lower() if paper.categories else ""

            if any(kw in text or kw in paper_cat for kw in category_keywords):
                filtered.append(paper)

        return filtered


async def search_preprints(
    server: str = "medrxiv",
    days_back: int = 30,
    categories: list[str] | None = None,
    keywords: list[str] | None = None,
    max_results: int = 50,
) -> list[Paper]:
    """Convenience function to search medRxiv/bioRxiv preprints.

    Args:
        server: "medrxiv" or "biorxiv"
        days_back: Number of days to look back
        categories: Medical categories to filter
        keywords: Additional keywords to filter
        max_results: Maximum papers to return

    Returns:
        List of Paper objects
    """
    agent = IngestMedRxivAgent()

    task = Task(
        id="preprint-search",
        type="ingest",
        payload={
            "server": server,
            "days_back": days_back,
            "categories": categories or settings.medical_specialties,
            "keywords": keywords or [],
            "max_results": max_results,
        },
    )

    result = await agent.execute(task)

    if result.success:
        return [Paper(**p) for p in result.data.get("papers", [])]
    return []
