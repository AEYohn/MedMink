"""PubMed evidence search integration for PostVisit AI companion.

Wraps the existing PubMed search pipeline with source labeling
for the companion chat (e.g., [Medical literature], [Guideline]).
"""

from typing import Any

import structlog

from src.agents.ingest_pubmed import search_pubmed_papers

logger = structlog.get_logger()


async def search_evidence(query: str, max_results: int = 5) -> list[dict[str, Any]]:
    """Search PubMed for evidence relevant to a patient question.

    Args:
        query: Search query derived from patient's question
        max_results: Maximum number of papers to return

    Returns:
        List of evidence citations with type, title, url, snippet
    """
    try:
        papers = await search_pubmed_papers(
            query=query,
            max_results=max_results,
            article_types=["Clinical Trial", "Meta-Analysis", "Systematic Review", "Practice Guideline"],
        )

        citations = []
        for paper in papers:
            # Determine citation type based on article type
            citation_type = "pubmed"
            title_lower = (paper.title or "").lower()
            if any(kw in title_lower for kw in ["guideline", "recommendation", "consensus", "statement"]):
                citation_type = "guideline"

            abstract_snippet = ""
            if paper.abstract:
                # Take first 200 chars as snippet
                abstract_snippet = paper.abstract[:200]
                if len(paper.abstract) > 200:
                    abstract_snippet += "..."

            citations.append({
                "type": citation_type,
                "title": paper.title,
                "url": paper.pdf_url or f"https://pubmed.ncbi.nlm.nih.gov/{paper.id}/",
                "snippet": abstract_snippet,
            })

        return citations

    except Exception as e:
        logger.warning("Evidence search failed", error=str(e), query=query)
        return []


def format_citations_for_prompt(citations: list[dict[str, Any]]) -> str:
    """Format citations as context for the LLM prompt."""
    if not citations:
        return ""

    parts = ["\n=== RELEVANT MEDICAL LITERATURE ==="]
    for i, c in enumerate(citations, 1):
        label = "[Guideline]" if c["type"] == "guideline" else "[PubMed]"
        parts.append(f"{i}. {label} {c['title']}")
        if c.get("snippet"):
            parts.append(f"   Summary: {c['snippet']}")
        if c.get("url"):
            parts.append(f"   Source: {c['url']}")
    return "\n".join(parts)
