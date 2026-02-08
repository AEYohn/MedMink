"""PubMed paper ingestion agent.

Fetches medical papers from PubMed/PMC using the NCBI Entrez API.
Focuses on clinical trials, systematic reviews, and meta-analyses.
"""

import asyncio
from datetime import datetime
from typing import Any
from xml.etree import ElementTree

import httpx
import structlog

from src.agents.base import BaseAgent, AgentResult
from src.config import settings
from src.models import Task, Paper

logger = structlog.get_logger()

# PubMed Entrez API endpoints
PUBMED_SEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PUBMED_FETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
PUBMED_SUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"


class IngestPubMedAgent(BaseAgent):
    """Agent for fetching medical papers from PubMed."""

    name = "ingest_pubmed"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.api_key = settings.pubmed_api_key
        self.email = settings.pubmed_email

    async def execute(self, task: Task) -> AgentResult:
        """Execute PubMed ingestion task.

        Task parameters:
            - query: Search query string
            - mesh_terms: List of MeSH terms to search
            - date_range: Tuple of (start_date, end_date) in YYYY/MM/DD format
            - max_results: Maximum number of papers to fetch
            - article_types: List of article types to filter
        """
        params = task.payload
        query = params.get("query", "")
        mesh_terms = params.get("mesh_terms", settings.default_mesh_terms)
        date_range = params.get("date_range")
        max_results = params.get("max_results", 100)
        article_types = params.get(
            "article_types",
            ["Clinical Trial", "Meta-Analysis", "Systematic Review", "Randomized Controlled Trial"]
        )

        try:
            # Build search query
            search_query = self._build_query(query, mesh_terms, article_types)

            self.logger.info(
                "Starting PubMed search",
                query=search_query[:100],
                max_results=max_results,
            )

            # Search for PMIDs
            pmids = await self._search_pubmed(
                query=search_query,
                date_range=date_range,
                max_results=max_results,
            )

            if not pmids:
                return AgentResult(
                    success=True,
                    data={"papers": [], "count": 0},
                )

            # Fetch paper details
            papers = await self._fetch_papers(pmids)

            thought = await self.create_thought_signature(
                task=task,
                context_summary=f"PubMed search for: {query or mesh_terms}",
                decision_made=f"Fetched {len(papers)} medical papers",
                reasoning=f"Search returned {len(pmids)} PMIDs, successfully parsed {len(papers)}",
                confidence=0.9,
                expected_outcomes=[
                    f"Papers ready for analysis",
                    "Medical claims can be extracted",
                ],
            )

            return AgentResult(
                success=True,
                data={
                    "papers": [p.model_dump() for p in papers],
                    "count": len(papers),
                    "pmids": pmids,
                },
                thought_signature=thought,
                metrics={
                    "papers_fetched": len(papers),
                    "search_results": len(pmids),
                },
            )

        except Exception as e:
            return await self._handle_error(e, task, params)

    def _build_query(
        self,
        query: str,
        mesh_terms: list[str],
        article_types: list[str],
    ) -> str:
        """Build PubMed search query with filters."""
        parts = []

        # Add free text query
        if query:
            parts.append(f"({query})")

        # Add MeSH terms
        if mesh_terms:
            mesh_query = " OR ".join(f'"{term}"[MeSH Terms]' for term in mesh_terms)
            parts.append(f"({mesh_query})")

        # Combine with AND
        base_query = " AND ".join(parts) if parts else "*"

        # Add article type filters
        if article_types:
            type_filter = " OR ".join(f'"{t}"[Publication Type]' for t in article_types)
            base_query = f"({base_query}) AND ({type_filter})"

        return base_query

    async def _search_pubmed(
        self,
        query: str,
        date_range: tuple[str, str] | None,
        max_results: int,
    ) -> list[str]:
        """Search PubMed and return list of PMIDs."""
        params = {
            "db": "pubmed",
            "term": query,
            "retmax": max_results,
            "retmode": "json",
            "sort": "relevance",
        }

        if self.api_key:
            params["api_key"] = self.api_key
        if self.email:
            params["email"] = self.email

        if date_range:
            params["datetype"] = "pdat"
            params["mindate"] = date_range[0]
            params["maxdate"] = date_range[1]

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(PUBMED_SEARCH_URL, params=params)
            response.raise_for_status()

        data = response.json()
        return data.get("esearchresult", {}).get("idlist", [])

    async def _fetch_papers(self, pmids: list[str]) -> list[Paper]:
        """Fetch paper details for a list of PMIDs."""
        papers = []

        # Fetch in batches to avoid API limits
        batch_size = 50
        for i in range(0, len(pmids), batch_size):
            batch = pmids[i:i + batch_size]
            batch_papers = await self._fetch_batch(batch)
            papers.extend(batch_papers)

            # Rate limiting
            if i + batch_size < len(pmids):
                await asyncio.sleep(0.5)

        return papers

    async def _fetch_batch(self, pmids: list[str]) -> list[Paper]:
        """Fetch a batch of papers from PubMed."""
        params = {
            "db": "pubmed",
            "id": ",".join(pmids),
            "rettype": "abstract",
            "retmode": "xml",
        }

        if self.api_key:
            params["api_key"] = self.api_key

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(PUBMED_FETCH_URL, params=params)
            response.raise_for_status()

        return self._parse_pubmed_xml(response.text)

    def _parse_pubmed_xml(self, xml_text: str) -> list[Paper]:
        """Parse PubMed XML response into Paper objects."""
        papers = []

        try:
            root = ElementTree.fromstring(xml_text)

            for article in root.findall(".//PubmedArticle"):
                paper = self._parse_article(article)
                if paper:
                    papers.append(paper)

        except ElementTree.ParseError as e:
            self.logger.error("Failed to parse PubMed XML", error=str(e))

        return papers

    def _parse_article(self, article: ElementTree.Element) -> Paper | None:
        """Parse a single PubMed article into a Paper object."""
        try:
            # Get PMID
            pmid_elem = article.find(".//PMID")
            if pmid_elem is None:
                return None
            pmid = pmid_elem.text

            # Get article info
            medline = article.find(".//MedlineCitation")
            if medline is None:
                return None

            article_elem = medline.find(".//Article")
            if article_elem is None:
                return None

            # Title
            title_elem = article_elem.find(".//ArticleTitle")
            title = title_elem.text if title_elem is not None else ""

            # Abstract
            abstract_parts = []
            for abstract_text in article_elem.findall(".//AbstractText"):
                label = abstract_text.get("Label", "")
                text = abstract_text.text or ""
                if label:
                    abstract_parts.append(f"{label}: {text}")
                else:
                    abstract_parts.append(text)
            abstract = " ".join(abstract_parts)

            # Authors
            authors = []
            for author in article_elem.findall(".//Author"):
                last_name = author.findtext("LastName", "")
                first_name = author.findtext("ForeName", "")
                if last_name:
                    authors.append(f"{last_name} {first_name}".strip())

            # Publication date
            pub_date = article_elem.find(".//PubDate")
            year = pub_date.findtext("Year", "") if pub_date is not None else ""
            month = pub_date.findtext("Month", "01") if pub_date is not None else "01"
            day = pub_date.findtext("Day", "01") if pub_date is not None else "01"

            try:
                published_date = datetime.strptime(f"{year}-{month}-{day}", "%Y-%m-%d")
            except ValueError:
                try:
                    published_date = datetime.strptime(f"{year}-01-01", "%Y-%m-%d")
                except ValueError:
                    published_date = datetime.now()

            # DOI
            doi = None
            for article_id in article.findall(".//ArticleId"):
                if article_id.get("IdType") == "doi":
                    doi = article_id.text
                    break

            # MeSH terms
            mesh_terms = []
            for mesh in medline.findall(".//MeshHeading/DescriptorName"):
                mesh_terms.append(mesh.text)

            # Journal
            journal = article_elem.findtext(".//Journal/Title", "")

            # Article type
            pub_types = []
            for pub_type in article_elem.findall(".//PublicationType"):
                pub_types.append(pub_type.text)

            return Paper(
                id=f"pmid:{pmid}",
                arxiv_id=None,
                title=title,
                abstract=abstract,
                authors=authors,
                categories=mesh_terms[:10],  # Limit MeSH terms
                published=published_date,
                source="pubmed",
                pdf_url=f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                metadata={
                    "pmid": pmid,
                    "doi": doi,
                    "journal": journal,
                    "publication_types": pub_types,
                    "mesh_terms": mesh_terms,
                },
            )

        except Exception as e:
            self.logger.warning("Failed to parse article", error=str(e))
            return None


async def search_pubmed_papers(
    query: str | None = None,
    mesh_terms: list[str] | None = None,
    article_types: list[str] | None = None,
    max_results: int = 50,
    date_range: tuple[str, str] | None = None,
) -> list[Paper]:
    """Convenience function to search PubMed papers.

    Args:
        query: Free text search query
        mesh_terms: MeSH terms to search
        article_types: Article types to filter (default: clinical trials, reviews)
        max_results: Maximum papers to return
        date_range: Tuple of (start_date, end_date) in YYYY/MM/DD format

    Returns:
        List of Paper objects
    """
    agent = IngestPubMedAgent()

    # Create a minimal task
    task = Task(
        id="pubmed-search",
        type="ingest",
        payload={
            "query": query or "",
            "mesh_terms": mesh_terms or [],
            "article_types": article_types,
            "max_results": max_results,
            "date_range": date_range,
        },
    )

    result = await agent.execute(task)

    if result.success:
        return [Paper(**p) for p in result.data.get("papers", [])]
    return []
