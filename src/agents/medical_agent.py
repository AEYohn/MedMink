"""Medical Literature Agent for clinical evidence synthesis.

Multi-step agentic workflow for answering clinical questions using
medical literature retrieval and synthesis with MedGemma.
"""

import asyncio
from dataclasses import dataclass
from typing import Any

import dspy
import structlog

from src.agents.base import AgentResult, BaseAgent
from src.agents.ingest_medxiv import search_preprints
from src.agents.ingest_pubmed import search_pubmed_papers
from src.dspy_analysis.medical_signatures import (
    ClinicalQueryUnderstanding,
    DrugInteractionCheck,
    EvidenceSynthesis,
    EvidenceSynthesisResult,
    PICOElements,
    TreatmentComparisonAnalysis,
)
from src.medgemma import get_medgemma_client
from src.models import Paper, Task
from src.rag.local_chroma import get_local_chroma

logger = structlog.get_logger()


@dataclass
class ClinicalAnswer:
    """Structured clinical answer with evidence."""

    question: str
    pico: dict[str, str]
    synthesis: str
    evidence_grade: str
    key_findings: list[dict[str, Any]]
    contradictions: list[dict[str, Any]]
    recommendation: str
    recommendation_strength: str
    papers: list[dict[str, Any]]
    limitations: list[str]
    search_terms: list[str]
    confidence: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "question": self.question,
            "pico": self.pico,
            "synthesis": self.synthesis,
            "evidence_grade": self.evidence_grade,
            "key_findings": self.key_findings,
            "contradictions": self.contradictions,
            "recommendation": self.recommendation,
            "recommendation_strength": self.recommendation_strength,
            "papers": self.papers,
            "limitations": self.limitations,
            "search_terms": self.search_terms,
            "confidence": self.confidence,
        }


class MedicalLiteratureAgent(BaseAgent):
    """Multi-step agent for clinical evidence synthesis.

    Workflow:
    1. Parse clinical question (PICO format)
    2. Search for relevant papers (PubMed, medRxiv, local store)
    3. Grade evidence quality (GRADE methodology)
    4. Detect contradictions between studies
    5. Synthesize evidence with MedGemma
    6. Generate clinical recommendation
    """

    name = "medical_agent"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.medgemma = get_medgemma_client()
        self.local_store = get_local_chroma()

        # DSPy modules
        self.query_parser = dspy.ChainOfThought(ClinicalQueryUnderstanding)
        self.evidence_synthesizer = dspy.ChainOfThought(EvidenceSynthesis)
        self.drug_checker = dspy.ChainOfThought(DrugInteractionCheck)
        self.treatment_comparer = dspy.ChainOfThought(TreatmentComparisonAnalysis)

    async def execute(self, task: Task) -> AgentResult:
        """Execute clinical question answering task.

        Task parameters:
            - question: Clinical question in natural language
            - include_preprints: Whether to search medRxiv (default: True)
            - max_papers: Maximum papers to retrieve (default: 20)
            - check_interactions: Whether to check drug interactions (default: False)
            - drugs: List of drugs if checking interactions
        """
        params = task.payload
        question = params.get("question", "")
        include_preprints = params.get("include_preprints", True)
        max_papers = params.get("max_papers", 20)
        check_interactions = params.get("check_interactions", False)
        drugs = params.get("drugs", [])

        if not question:
            return AgentResult(
                success=False,
                error="No clinical question provided",
            )

        try:
            # Full agentic workflow
            answer = await self.answer_clinical_question(
                question=question,
                include_preprints=include_preprints,
                max_papers=max_papers,
            )

            # Optional drug interaction check
            interactions = None
            if check_interactions and drugs:
                interactions = await self.check_drug_interactions(
                    drugs=drugs,
                    papers=list(answer.papers[:10]),
                )

            thought = await self.create_thought_signature(
                task=task,
                context_summary=f"Clinical question: {question[:100]}",
                decision_made=f"Synthesized {len(answer.papers)} papers, grade: {answer.evidence_grade}",
                reasoning=f"PICO: {answer.pico}, found {len(answer.contradictions)} contradictions",
                confidence=answer.confidence,
                expected_outcomes=[
                    "Evidence-based answer provided",
                    "Clinical recommendation generated",
                ],
            )

            result_data = answer.to_dict()
            if interactions:
                result_data["drug_interactions"] = interactions

            return AgentResult(
                success=True,
                data=result_data,
                thought_signature=thought,
                metrics={
                    "papers_analyzed": len(answer.papers),
                    "evidence_grade": answer.evidence_grade,
                    "contradictions_found": len(answer.contradictions),
                },
            )

        except Exception as e:
            return await self._handle_error(e, task, params)

    async def answer_clinical_question(
        self,
        question: str,
        include_preprints: bool = True,
        max_papers: int = 20,
    ) -> ClinicalAnswer:
        """Complete workflow for answering a clinical question.

        Args:
            question: Clinical question in natural language
            include_preprints: Include medRxiv preprints in search
            max_papers: Maximum papers to retrieve

        Returns:
            ClinicalAnswer with synthesis and recommendations
        """
        self.logger.info("Starting clinical question workflow", question=question[:100])

        # Step 1: Parse clinical question into PICO format
        pico, search_terms = await self._parse_question(question)

        self.logger.info(
            "PICO extracted",
            population=pico.population[:50],
            intervention=pico.intervention[:50],
        )

        # Step 2: Retrieve relevant papers
        papers = await self._retrieve_papers(
            pico=pico,
            search_terms=search_terms,
            include_preprints=include_preprints,
            max_papers=max_papers,
        )

        self.logger.info("Papers retrieved", count=len(papers))

        if not papers:
            return ClinicalAnswer(
                question=question,
                pico=self._pico_to_dict(pico),
                synthesis="No relevant papers found for this clinical question.",
                evidence_grade="insufficient",
                key_findings=[],
                contradictions=[],
                recommendation="Unable to make recommendation due to lack of evidence.",
                recommendation_strength="none",
                papers=[],
                limitations=["No papers matched the search criteria"],
                search_terms=search_terms,
                confidence=0.0,
            )

        # Step 3: Grade evidence quality
        paper_dicts = [self._paper_to_dict(p) for p in papers]
        await self._grade_evidence(paper_dicts)

        # Step 4: Detect contradictions
        contradictions = await self._detect_contradictions(paper_dicts)

        # Step 5: Synthesize evidence
        synthesis_result = await self._synthesize_evidence(
            question=question,
            papers=paper_dicts,
        )

        # Step 6: Calculate confidence
        confidence = self._calculate_confidence(
            evidence_grade=synthesis_result.evidence_grade,
            num_papers=len(papers),
            num_contradictions=len(contradictions),
        )

        return ClinicalAnswer(
            question=question,
            pico=self._pico_to_dict(pico),
            synthesis=synthesis_result.summary,
            evidence_grade=synthesis_result.evidence_grade,
            key_findings=[f.model_dump() for f in synthesis_result.key_findings],
            contradictions=[c.model_dump() for c in synthesis_result.contradictions],
            recommendation=synthesis_result.clinical_recommendation,
            recommendation_strength=synthesis_result.recommendation_strength,
            papers=paper_dicts,
            limitations=synthesis_result.limitations,
            search_terms=search_terms,
            confidence=confidence,
        )

    async def _parse_question(
        self,
        question: str,
    ) -> tuple[PICOElements, list[str]]:
        """Parse clinical question into PICO elements."""
        try:
            # Use DSPy module
            result = await asyncio.to_thread(
                self.query_parser,
                question=question,
            )
            return result.pico, result.search_terms

        except Exception as e:
            self.logger.warning("DSPy PICO extraction failed, using MedGemma", error=str(e))

            # Fallback to MedGemma
            pico_dict = await self.medgemma.extract_pico(question)

            pico = PICOElements(
                population=pico_dict.get("population", ""),
                intervention=pico_dict.get("intervention", ""),
                comparison=pico_dict.get("comparison", "standard of care"),
                outcome=pico_dict.get("outcome", ""),
                question_type=pico_dict.get("question_type", "therapy"),
            )

            search_terms = pico_dict.get("mesh_terms", [])
            return pico, search_terms

    async def _retrieve_papers(
        self,
        pico: PICOElements,
        search_terms: list[str],
        include_preprints: bool,
        max_papers: int,
    ) -> list[Paper]:
        """Retrieve papers from multiple sources with timeout protection."""
        papers = []
        papers_per_source = max_papers // (3 if include_preprints else 2)

        # Build search query from PICO - extract key terms only
        # Stop words to filter out
        stop_words = {
            "patients",
            "with",
            "the",
            "in",
            "and",
            "or",
            "who",
            "have",
            "had",
            "are",
            "for",
            "to",
            "of",
            "a",
            "an",
            "that",
            "this",
            "from",
            "by",
            "as",
            "on",
            "treatment",
            "treatments",
            "therapy",
            "therapies",
            "including",
            "such",
            "options",
            "strategies",
            "defined",
            "significant",
            "improvement",
            "e.g.",
            "e.g",
            "i.e.",
            "i.e",
            "other",
            "different",
            "various",
            "standard",
            "first-line",
            "first",
            "line",
            "second-line",
            "second",
            "typically",
        }

        # Extract key medical terms from intervention (not the whole sentence)
        intervention_keywords = [
            w.strip("(),.")
            for w in pico.intervention.lower().replace("-", " ").split()
            if w.strip("(),.") not in stop_words
            and len(w.strip("(),.")) > 3
            and not w.startswith("(")
        ][
            :5
        ]  # Take top 5 keywords

        # Extract key terms from population
        population_keywords = [
            w.strip("(),.")
            for w in pico.population.lower().replace("-", " ").split()
            if w.strip("(),.") not in stop_words and len(w.strip("(),.")) > 3
        ][:3]

        # Combine unique keywords
        query_parts = list(dict.fromkeys(intervention_keywords + population_keywords))

        self.logger.debug(
            "Query construction",
            intervention=pico.intervention[:50],
            intervention_kw=intervention_keywords,
            population_kw=population_keywords,
            query_parts=query_parts,
            search_terms_count=len(search_terms) if search_terms else 0,
        )

        # If we have good MeSH search terms, prefer those for better results
        if search_terms and len(search_terms) >= 3:
            # Use first 3-4 MeSH terms as primary query
            query = " ".join(search_terms[:4])
        elif query_parts:
            query = " ".join(query_parts[:6])
        else:
            # Ultimate fallback: extract key terms from the intervention directly
            # This handles cases where everything got filtered out
            fallback_terms = [
                w
                for w in pico.intervention.split()
                if len(w) > 4
                and w.lower() not in {"first", "second", "standard", "treatment", "therapy"}
            ]
            if fallback_terms:
                query = " ".join(fallback_terms[:4])
            else:
                # Last resort: use the core medical condition/intervention
                query = pico.intervention.split(",")[0].strip()[:50]

        # Final safety check - never use empty query
        if not query or not query.strip():
            query = "depression treatment"  # Generic medical fallback
            self.logger.warning("Empty query, using fallback", fallback=query)

        self.logger.info("Built search query", query=query[:80], has_mesh_terms=bool(search_terms))

        # Search local store first (fast, no timeout needed)
        try:
            local_results = await self.local_store.search_by_pico(
                population=pico.population,
                intervention=pico.intervention,
                comparison=pico.comparison if pico.comparison != "standard of care" else None,
                outcome=pico.outcome,
                n_results=papers_per_source,
            )

            # Convert local results to Paper-like dicts
            for result in local_results:
                meta = result.get("metadata", {})
                doc = result.get("document", "")
                title = meta.get("title", doc[:100] if doc else "Unknown")

                papers.append(
                    Paper(
                        id=result.get("id", ""),
                        arxiv_id=None,
                        title=title,
                        abstract=doc,
                        authors=[],
                        categories=[],
                        published=None,
                        source="local",
                        metadata=meta,
                    )
                )

            self.logger.info("Local search complete", found=len(local_results))
        except Exception as e:
            self.logger.warning("Local search failed", error=str(e))

        # Search PubMed with 60s timeout
        try:
            pubmed_papers = await asyncio.wait_for(
                search_pubmed_papers(
                    query=query,
                    mesh_terms=search_terms[:5],
                    max_results=papers_per_source,
                ),
                timeout=60.0,
            )
            papers.extend(pubmed_papers)
            self.logger.info("PubMed search complete", found=len(pubmed_papers))
        except TimeoutError:
            self.logger.warning("PubMed search timed out after 60s")
        except Exception as e:
            self.logger.warning("PubMed search failed", error=str(e))

        # Search medRxiv if enabled with 60s timeout
        if include_preprints:
            try:
                preprints = await asyncio.wait_for(
                    search_preprints(
                        server="medrxiv",
                        keywords=[pico.intervention, pico.population],
                        max_results=papers_per_source,
                        days_back=90,
                    ),
                    timeout=60.0,
                )
                papers.extend(preprints)
                self.logger.info("medRxiv search complete", found=len(preprints))
            except TimeoutError:
                self.logger.warning("medRxiv search timed out after 60s")
            except Exception as e:
                self.logger.warning("medRxiv search failed", error=str(e))

        # Deduplicate by title similarity
        unique_papers = self._deduplicate_papers(papers)

        return unique_papers[:max_papers]

    def _deduplicate_papers(self, papers: list[Paper]) -> list[Paper]:
        """Remove duplicate papers based on title similarity."""
        seen_titles = set()
        unique = []

        for paper in papers:
            # Normalize title for comparison
            title_key = paper.title.lower().strip()[:100]

            if title_key not in seen_titles:
                seen_titles.add(title_key)
                unique.append(paper)

        return unique

    async def _grade_evidence(
        self,
        papers: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Grade evidence quality using GRADE methodology."""
        return await self.medgemma.grade_evidence(papers)

    async def _detect_contradictions(
        self,
        papers: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Detect contradictions between papers."""
        # Extract key claims from abstracts for contradiction detection
        try:
            synthesis = await self.medgemma.synthesize_evidence(
                question="Identify contradictions",
                papers=papers,
            )
            return synthesis.get("contradictions", [])
        except Exception as e:
            self.logger.warning("Contradiction detection failed", error=str(e))
            return []

    async def _synthesize_evidence(
        self,
        question: str,
        papers: list[dict[str, Any]],
    ) -> EvidenceSynthesisResult:
        """Synthesize evidence from papers."""
        try:
            # Try DSPy module first
            result = await asyncio.to_thread(
                self.evidence_synthesizer,
                question=question,
                papers=papers,
            )
            return result.synthesis

        except Exception as e:
            self.logger.warning("DSPy synthesis failed, using MedGemma", error=str(e))

            try:
                # Fallback to MedGemma
                synthesis = await self.medgemma.synthesize_evidence(question, papers)

                return EvidenceSynthesisResult(
                    summary=synthesis.get("summary", ""),
                    key_findings=[],
                    contradictions=[],
                    limitations=synthesis.get("limitations", []),
                    clinical_recommendation=synthesis.get("recommendation", ""),
                    recommendation_strength=synthesis.get("recommendation_strength", "none"),
                    evidence_grade=synthesis.get("evidence_grade", "very_low"),
                )
            except Exception as e2:
                self.logger.error("MedGemma synthesis also failed", error=str(e2))

                # Return a basic synthesis with paper summaries
                paper_count = len(papers)
                paper_titles = [p.get("title", "")[:50] for p in papers[:3]]

                return EvidenceSynthesisResult(
                    summary=f"Found {paper_count} papers related to the query. Key studies: {'; '.join(paper_titles)}...",
                    key_findings=[],
                    contradictions=[],
                    limitations=[
                        "Automated synthesis unavailable - manual review of papers recommended"
                    ],
                    clinical_recommendation="Review the retrieved papers for detailed evidence.",
                    recommendation_strength="none",
                    evidence_grade="very_low",
                )

    async def check_drug_interactions(
        self,
        drugs: list[str],
        papers: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Check for drug interactions in literature.

        Args:
            drugs: List of drug names
            papers: Papers to search for interaction data

        Returns:
            Drug interaction assessment
        """
        return await self.medgemma.check_drug_interactions(drugs, papers)

    async def compare_treatments(
        self,
        condition: str,
        treatments: list[str],
        papers: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Compare treatments for a condition.

        Args:
            condition: Medical condition
            treatments: Treatments to compare
            papers: Papers with comparison data

        Returns:
            Treatment comparison analysis
        """
        try:
            result = await asyncio.to_thread(
                self.treatment_comparer,
                condition=condition,
                treatments=treatments,
                papers=papers,
            )
            return {
                "comparison": result.comparison.model_dump(),
                "evidence_summary": result.evidence_summary,
            }
        except Exception as e:
            self.logger.error("Treatment comparison failed", error=str(e))
            return {"error": str(e)}

    def _paper_to_dict(self, paper: Paper) -> dict[str, Any]:
        """Convert Paper to dict for prompts."""
        return {
            "pmid": paper.metadata.get("pmid", paper.id) if paper.metadata else paper.id,
            "doi": paper.metadata.get("doi") if paper.metadata else None,
            "title": paper.title,
            "abstract": paper.abstract,
            "year": paper.published.year if paper.published else "",
            "authors": paper.authors[:5],
            "source": paper.source,
        }

    def _pico_to_dict(self, pico: PICOElements) -> dict[str, str]:
        """Convert PICO elements to dict."""
        return {
            "population": pico.population,
            "intervention": pico.intervention,
            "comparison": pico.comparison,
            "outcome": pico.outcome,
            "question_type": pico.question_type,
        }

    def _calculate_confidence(
        self,
        evidence_grade: str,
        num_papers: int,
        num_contradictions: int,
    ) -> float:
        """Calculate overall confidence in the answer."""
        # Base confidence from evidence grade
        grade_scores = {
            "high": 0.9,
            "moderate": 0.7,
            "low": 0.5,
            "very_low": 0.3,
            "insufficient": 0.1,
        }
        base = grade_scores.get(evidence_grade, 0.3)

        # Adjust for number of papers
        if num_papers >= 10:
            base += 0.05
        elif num_papers < 3:
            base -= 0.1

        # Adjust for contradictions
        if num_contradictions > 3:
            base -= 0.15
        elif num_contradictions > 0:
            base -= 0.05

        return max(0.0, min(1.0, base))


# Convenience function for direct use
async def ask_clinical_question(
    question: str,
    include_preprints: bool = True,
    max_papers: int = 10,
) -> ClinicalAnswer:
    """Ask a clinical question and get evidence-based answer.

    Args:
        question: Clinical question in natural language
        include_preprints: Include medRxiv preprints
        max_papers: Maximum papers to retrieve

    Returns:
        ClinicalAnswer with synthesis and recommendations
    """
    agent = MedicalLiteratureAgent()
    return await agent.answer_clinical_question(
        question=question,
        include_preprints=include_preprints,
        max_papers=max_papers,
    )
