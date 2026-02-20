"""RAG Query Engine for answering questions using retrieved context."""

import json
from dataclasses import dataclass, field
from typing import Any

import structlog

from src.gemini import get_gemini_client
from src.kg import get_knowledge_graph
from src.rag.search import RankedResult, get_hybrid_search

logger = structlog.get_logger()


@dataclass
class Source:
    """A source citation for an answer."""

    id: str
    content_type: str
    title: str
    relevance: float
    snippet: str | None = None
    paper_id: str | None = None


@dataclass
class RAGResponse:
    """Response from the RAG query engine."""

    answer: str
    sources: list[Source]
    follow_up_questions: list[str] = field(default_factory=list)
    confidence: float = 0.0
    context_used: int = 0


class RAGQueryEngine:
    """Answer questions using retrieved context from the knowledge base."""

    def __init__(self):
        self.search = get_hybrid_search()
        self.gemini = get_gemini_client()

    def _build_context(self, results: list[RankedResult], max_tokens: int = 8000) -> str:
        """Build context string from search results."""
        context_parts = []
        estimated_tokens = 0

        for i, result in enumerate(results):
            # Build content based on type
            if result.content_type == "paper":
                content = f"[Paper {i+1}] {result.metadata.get('title', 'Unknown')}\n"
                content += f"Abstract: {result.metadata.get('abstract_preview', 'N/A')}\n"
            elif result.content_type == "claim":
                content = f"[Claim {i+1}] Category: {result.metadata.get('category', 'unknown')}\n"
                content += f"Statement: {result.metadata.get('statement', 'N/A')}\n"
            elif result.content_type == "technique":
                content = f"[Technique {i+1}] {result.metadata.get('name', 'Unknown')}\n"
                content += f"Description: {result.metadata.get('description', 'N/A')}\n"
                if result.metadata.get("formula"):
                    content += f"Formula: {result.metadata.get('formula')}\n"
            else:
                content = f"[{result.content_type} {i+1}] {json.dumps(result.metadata)}\n"

            content += f"Relevance: {result.combined_score:.2f}\n\n"

            # Estimate tokens (~4 chars per token)
            content_tokens = len(content) // 4
            if estimated_tokens + content_tokens > max_tokens:
                break

            context_parts.append(content)
            estimated_tokens += content_tokens

        return "".join(context_parts)

    def _extract_sources(self, results: list[RankedResult], limit: int = 10) -> list[Source]:
        """Extract source citations from results."""
        sources = []

        for result in results[:limit]:
            if result.content_type == "paper":
                title = result.metadata.get("title", "Unknown Paper")
                snippet = result.metadata.get("abstract_preview", "")[:200]
            elif result.content_type == "claim":
                title = result.metadata.get("statement", "Unknown Claim")[:100]
                snippet = result.metadata.get("statement", "")
            elif result.content_type == "technique":
                title = result.metadata.get("name", "Unknown Technique")
                snippet = result.metadata.get("description", "")[:200]
            else:
                title = "Unknown"
                snippet = ""

            sources.append(
                Source(
                    id=result.id,
                    content_type=result.content_type,
                    title=title,
                    relevance=result.combined_score,
                    snippet=snippet if snippet else None,
                    paper_id=result.metadata.get("paper_id"),
                )
            )

        return sources

    async def query(
        self,
        question: str,
        content_types: list[str] | None = None,
        max_sources: int = 10,
    ) -> RAGResponse:
        """
        Answer a question using retrieved context.

        Args:
            question: The question to answer.
            content_types: Types of content to search (paper, claim, technique).
            max_sources: Maximum number of sources to include.

        Returns:
            RAGResponse with answer, sources, and follow-up questions.
        """
        # Search for relevant content
        search_results = await self.search.search(
            query=question,
            content_types=content_types,
            limit=max_sources * 2,  # Get extra for context building
            threshold=0.35,
        )

        if not search_results.results:
            return RAGResponse(
                answer="I couldn't find any relevant information in the research corpus to answer your question. Try rephrasing your question or searching for different terms.",
                sources=[],
                follow_up_questions=[
                    "What specific topic are you interested in?",
                    "Would you like me to search for related papers?",
                ],
                confidence=0.0,
                context_used=0,
            )

        # Build context from results
        context = self._build_context(search_results.results)

        # Generate answer using Gemini
        prompt = f"""You are a research assistant helping users understand academic papers and research findings.

Based on the following research context, answer the user's question. Be specific, cite the sources by their numbers (e.g., [Paper 1], [Claim 2]), and acknowledge any uncertainty.

CONTEXT:
{context}

USER QUESTION: {question}

Provide:
1. A clear, informative answer based on the context above
2. Cite specific sources using [Paper N], [Claim N], or [Technique N] notation
3. If the context doesn't fully answer the question, acknowledge this
4. Suggest 2-3 follow-up questions the user might want to explore

Format your response as JSON with these fields:
- "answer": Your detailed answer with citations
- "confidence": How confident you are (0-1) based on context relevance
- "follow_up_questions": List of 2-3 suggested follow-up questions
"""

        response = await self.gemini.generate(
            prompt=prompt,
            schema={"type": "object"},
            operation="rag_query",
            temperature=0.3,
        )

        content = response.get("content", {})

        # Handle both dict and string responses
        if isinstance(content, str):
            answer = content
            confidence = 0.7
            follow_ups = []
        else:
            answer = content.get("answer", "Unable to generate an answer.")
            confidence = content.get("confidence", 0.7)
            follow_ups = content.get("follow_up_questions", [])

        # Extract sources
        sources = self._extract_sources(search_results.results, max_sources)

        return RAGResponse(
            answer=answer,
            sources=sources,
            follow_up_questions=follow_ups if isinstance(follow_ups, list) else [],
            confidence=confidence if isinstance(confidence, int | float) else 0.7,
            context_used=len(search_results.results),
        )

    async def get_context_for_paper(
        self,
        title: str,
        abstract: str,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        """
        Get related papers for context-aware analysis.

        This is used by the analysis pipeline to provide context when
        analyzing a new paper, improving contradiction detection and
        claim validation.

        Args:
            title: Paper title.
            abstract: Paper abstract.
            limit: Maximum number of related papers.

        Returns:
            List of related paper information.
        """
        # Search using the paper's content as query
        query = f"{title} {abstract[:500]}"

        search_results = await self.search.search_papers(
            query=query,
            limit=limit,
            threshold=0.5,
        )

        kg = await get_knowledge_graph()

        related_papers = []
        for result in search_results.results:
            paper_id = result.id

            # Get paper details from KG
            paper = await kg.get_paper(paper_id)
            if paper:
                # Get claims for this paper
                claims = await kg.get_claims_for_paper(paper_id)

                related_papers.append(
                    {
                        "paper_id": paper_id,
                        "title": paper.title,
                        "abstract": paper.abstract[:500] if paper.abstract else "",
                        "relevance": result.combined_score,
                        "claims": [
                            {
                                "statement": c.statement,
                                "category": c.category,
                                "confidence": c.confidence,
                            }
                            for c in claims[:5]  # Top 5 claims
                        ],
                    }
                )

        logger.debug(
            "Retrieved context for paper",
            paper_title=title[:50],
            related_papers=len(related_papers),
        )

        return related_papers

    async def answer_with_context(
        self,
        question: str,
        additional_context: str | None = None,
    ) -> RAGResponse:
        """
        Answer a question with optional additional context.

        Useful for follow-up questions in a conversation.
        """
        full_question = question
        if additional_context:
            full_question = f"Context: {additional_context}\n\nQuestion: {question}"

        return await self.query(full_question)


# Singleton instance
_rag_engine: RAGQueryEngine | None = None


async def get_rag_engine() -> RAGQueryEngine:
    """Get or create the RAG query engine singleton."""
    global _rag_engine
    if _rag_engine is None:
        _rag_engine = RAGQueryEngine()
    return _rag_engine
