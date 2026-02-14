"""Unified Healthcare AI Assistant with multi-model routing.

Combines all healthcare capabilities into a single assistant that
intelligently routes queries to the optimal model.
"""

from dataclasses import dataclass
from typing import Any

import structlog

from src.agents.base import AgentResult, BaseAgent
from src.agents.medical_agent import ClinicalAnswer, MedicalLiteratureAgent
from src.models import Task
from src.routing import (
    RoutingDecision,
    TaskType,
    get_model_registry,
    get_task_router,
)

logger = structlog.get_logger()


@dataclass
class AssistantResponse:
    """Response from the healthcare assistant."""

    query: str
    response: str
    task_type: str
    model_used: str
    confidence: float
    reasoning: str
    sources: list[dict[str, Any]]
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "query": self.query,
            "response": self.response,
            "task_type": self.task_type,
            "model_used": self.model_used,
            "confidence": self.confidence,
            "reasoning": self.reasoning,
            "sources": self.sources,
            "metadata": self.metadata,
        }


class HealthcareAssistant(BaseAgent):
    """Unified healthcare AI assistant with intelligent routing.

    Capabilities:
    - Clinical literature search and synthesis (MedGemma)
    - Drug interaction checking (MedGemma)
    - Differential diagnosis support (Gemini Pro)
    - Clinical documentation assistance (Gemma Flash)
    - Patient education materials (Gemma Flash)
    - Shift handoff summaries (Gemma Flash)
    """

    name = "healthcare_assistant"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.router = get_task_router()
        self.registry = get_model_registry()

        # Specialized agents
        self._medical_agent: MedicalLiteratureAgent | None = None

    @property
    def medical_agent(self) -> MedicalLiteratureAgent:
        """Lazy-load medical literature agent."""
        if self._medical_agent is None:
            self._medical_agent = MedicalLiteratureAgent()
        return self._medical_agent

    async def execute(self, task: Task) -> AgentResult:
        """Execute a healthcare assistant task.

        Task parameters:
            - query: The user's query
            - context: Additional context (user role, patient info)
            - prefer_local: Prefer local models (default: True)
        """
        params = task.payload
        query = params.get("query", "")
        context = params.get("context", "")
        prefer_local = params.get("prefer_local", True)

        if not query:
            return AgentResult(
                success=False,
                error="No query provided",
            )

        try:
            response = await self.answer(
                query=query,
                context=context,
                prefer_local=prefer_local,
            )

            thought = await self.create_thought_signature(
                task=task,
                context_summary=f"Query: {query[:100]}",
                decision_made=f"Routed to {response.model_used} for {response.task_type}",
                reasoning=response.reasoning,
                confidence=response.confidence,
            )

            return AgentResult(
                success=True,
                data=response.to_dict(),
                thought_signature=thought,
                metrics={
                    "model_used": response.model_used,
                    "task_type": response.task_type,
                    "confidence": response.confidence,
                },
            )

        except Exception as e:
            return await self._handle_error(e, task, params)

    async def answer(
        self,
        query: str,
        context: str = "",
        prefer_local: bool = True,
    ) -> AssistantResponse:
        """Answer a healthcare query with intelligent routing.

        Args:
            query: The user's query
            context: Additional context
            prefer_local: Prefer local models

        Returns:
            AssistantResponse with answer and metadata
        """
        # Route the query
        decision = await self.router.route(
            query=query,
            context=context,
            prefer_local=prefer_local,
        )

        self.logger.info(
            "Query routed",
            task_type=decision.task_type.value,
            model=decision.model_name,
            confidence=decision.confidence,
        )

        # Handle based on task type
        response_text = ""
        sources = []
        extra_metadata = {}

        if decision.task_type in {
            TaskType.LITERATURE_SEARCH,
            TaskType.EVIDENCE_SYNTHESIS,
            TaskType.EVIDENCE_GRADING,
        }:
            # Use medical literature agent
            answer = await self.medical_agent.answer_clinical_question(query)
            response_text = self._format_clinical_answer(answer)
            sources = [
                {"pmid": p.get("pmid"), "title": p.get("title"), "source": p.get("source")}
                for p in answer.papers[:10]
            ]
            extra_metadata = {
                "evidence_grade": answer.evidence_grade,
                "pico": answer.pico,
                "recommendation_strength": answer.recommendation_strength,
            }

        elif decision.task_type == TaskType.DRUG_INTERACTION:
            # Extract drugs and check interactions
            response_text, sources = await self._handle_drug_interaction(query, decision)

        elif decision.task_type == TaskType.DIFFERENTIAL_DIAGNOSIS:
            # Use Gemini Pro for complex reasoning
            response_text = await self._handle_differential(query, decision)
            extra_metadata["disclaimer"] = "This is for educational purposes only. Always consult a physician."

        elif decision.task_type in {
            TaskType.CLINICAL_NOTE,
            TaskType.DISCHARGE_SUMMARY,
            TaskType.HANDOFF_SUMMARY,
        }:
            # Use documentation-focused model
            response_text = await self._handle_documentation(query, decision)

        elif decision.task_type == TaskType.PATIENT_EDUCATION:
            # Generate patient-friendly explanation
            response_text = await self._handle_patient_education(query, decision)

        else:
            # General query - use routed model
            response_text, _ = await self.router.execute_routed(
                query=query,
                context=context,
            )

        return AssistantResponse(
            query=query,
            response=response_text,
            task_type=decision.task_type.value,
            model_used=decision.model_name,
            confidence=decision.confidence,
            reasoning=decision.reasoning,
            sources=sources,
            metadata={
                **extra_metadata,
                "routing": decision.metadata,
                "fallback_models": decision.fallback_models,
            },
        )

    def _format_clinical_answer(self, answer: ClinicalAnswer) -> str:
        """Format a clinical answer into readable text."""
        parts = []

        # Summary
        parts.append(f"## Summary\n{answer.synthesis}\n")

        # Evidence grade
        parts.append(f"**Evidence Quality:** {answer.evidence_grade.upper()}\n")

        # Key findings
        if answer.key_findings:
            parts.append("## Key Findings")
            for i, finding in enumerate(answer.key_findings, 1):
                finding_text = finding.get("finding", "")
                citation = finding.get("citation", "")
                effect = finding.get("effect_size", "")
                line = f"{i}. {finding_text}"
                if effect:
                    line += f" ({effect})"
                if citation:
                    line += f" — {citation}"
                parts.append(line)
            parts.append("")

        # Contradictions
        if answer.contradictions:
            parts.append("## Conflicting Evidence")
            for c in answer.contradictions:
                parts.append(f"- **{c.get('topic', 'Unknown')}**: {c.get('possible_explanation', '')}")
            parts.append("")

        # Recommendation
        if answer.recommendation:
            strength = answer.recommendation_strength.upper()
            parts.append(f"## Clinical Recommendation ({strength})")
            parts.append(answer.recommendation)
            parts.append("")

        # Limitations
        if answer.limitations:
            parts.append("## Limitations")
            for lim in answer.limitations:
                parts.append(f"- {lim}")

        return "\n".join(parts)

    async def _handle_drug_interaction(
        self,
        query: str,
        decision: RoutingDecision,
    ) -> tuple[str, list[dict]]:
        """Handle drug interaction queries."""
        # Extract drug names from query
        drugs = self._extract_drugs_from_query(query)

        if len(drugs) < 2:
            # Use general model to answer about single drug
            await self.registry.initialize_providers()
            provider = self.registry.get_provider(decision.model_name)
            if provider:
                response = await provider.generate(
                    prompt=query,
                    system_prompt="You are a clinical pharmacology assistant. Provide accurate drug information.",
                )
                return response, []
            return "Please specify at least two drugs to check for interactions.", []

        # Check interactions using medical agent
        from src.agents.ingest_pubmed import search_pubmed_papers

        # Search for interaction papers
        interaction_query = " ".join(drugs) + " drug interaction"
        papers = await search_pubmed_papers(
            query=interaction_query,
            article_types=["Review", "Meta-Analysis"],
            max_results=10,
        )

        paper_dicts = [
            {"pmid": p.id, "title": p.title, "abstract": p.abstract}
            for p in papers
        ]

        interactions = await self.medical_agent.check_drug_interactions(
            drugs=drugs,
            papers=paper_dicts,
        )

        # Format response
        parts = [f"## Drug Interaction Check: {', '.join(drugs)}\n"]

        if interactions.get("interactions"):
            parts.append("### Potential Interactions Found\n")
            for inter in interactions["interactions"]:
                severity = inter.get("severity", "unknown").upper()
                parts.append(f"**{inter.get('drug_a', '')} + {inter.get('drug_b', '')}** ({severity})")
                parts.append(f"- Effect: {inter.get('effect', 'Unknown')}")
                parts.append(f"- Mechanism: {inter.get('mechanism', 'Unknown')}")
                parts.append(f"- Management: {inter.get('management', 'Consult pharmacist')}")
                parts.append("")
        else:
            parts.append("No significant interactions found in the literature.\n")
            parts.append("*Note: Always verify with a pharmacist or drug interaction database.*")

        sources = [{"pmid": p.id, "title": p.title} for p in papers[:5]]

        return "\n".join(parts), sources

    def _extract_drugs_from_query(self, query: str) -> list[str]:
        """Extract drug names from a query (simple heuristic)."""
        # Common drug name patterns - this is simplified
        # In production, use a proper NER model or drug database
        import re

        # Look for words that might be drug names (capitalized or common patterns)
        words = query.split()
        potential_drugs = []

        for word in words:
            # Clean the word
            clean = re.sub(r'[^\w]', '', word)
            if len(clean) < 3:
                continue

            # Skip common non-drug words
            skip_words = {
                "the", "and", "with", "can", "take", "drug", "interaction",
                "between", "what", "are", "does", "have", "taking", "together",
            }
            if clean.lower() in skip_words:
                continue

            # Keep if it starts with capital (proper noun) or ends in common suffixes
            if clean[0].isupper() or any(clean.lower().endswith(suf) for suf in [
                "mab", "nib", "zole", "pril", "sartan", "statin", "cillin", "mycin",
                "pam", "lam", "done", "ine", "ide", "ate", "ol"
            ]):
                potential_drugs.append(clean)

        return potential_drugs[:5]  # Limit to 5 drugs

    async def _handle_differential(
        self,
        query: str,
        decision: RoutingDecision,
    ) -> str:
        """Handle differential diagnosis queries."""
        system_prompt = """You are a clinical reasoning assistant helping healthcare professionals
think through differential diagnoses.

IMPORTANT DISCLAIMERS:
- This is for educational and decision support purposes only
- Always correlate with clinical findings and additional testing
- Final diagnostic decisions must be made by licensed clinicians

When analyzing symptoms, consider:
1. Most likely diagnoses (common things are common)
2. Must-not-miss diagnoses (serious conditions to rule out)
3. Key differentiating features
4. Recommended next steps for workup"""

        await self.registry.initialize_providers()
        provider = self.registry.get_provider(decision.model_name)

        if provider:
            response = await provider.generate(
                prompt=query,
                system_prompt=system_prompt,
                max_tokens=3000,
                temperature=0.3,
            )
            return response

        return "Unable to process differential diagnosis request. Please consult a physician."

    async def _handle_documentation(
        self,
        query: str,
        decision: RoutingDecision,
    ) -> str:
        """Handle clinical documentation requests."""
        doc_type = decision.task_type.value.replace("_", " ").title()

        system_prompt = f"""You are a clinical documentation assistant helping healthcare professionals
write {doc_type}s efficiently.

Guidelines:
- Use clear, concise medical language
- Include all relevant clinical details
- Follow standard documentation formats
- Maintain patient privacy (use placeholders for PHI)
- Be objective and factual

For {doc_type}, include appropriate sections based on the documentation type."""

        await self.registry.initialize_providers()
        provider = self.registry.get_provider(decision.model_name)

        if provider:
            response = await provider.generate(
                prompt=query,
                system_prompt=system_prompt,
                max_tokens=2000,
            )
            return response

        return f"Unable to generate {doc_type}. Please try again."

    async def _handle_patient_education(
        self,
        query: str,
        decision: RoutingDecision,
    ) -> str:
        """Handle patient education requests."""
        system_prompt = """You are a patient education specialist helping create clear,
understandable health information for patients and families.

Guidelines:
- Use simple, non-medical language (6th grade reading level)
- Avoid jargon - explain any medical terms you must use
- Use bullet points and short sentences
- Include practical, actionable advice
- Be encouraging and supportive
- Address common concerns and questions
- Include when to seek medical attention"""

        await self.registry.initialize_providers()
        provider = self.registry.get_provider(decision.model_name)

        if provider:
            response = await provider.generate(
                prompt=query,
                system_prompt=system_prompt,
                max_tokens=1500,
            )
            return response

        return "Unable to generate patient education materials. Please try again."


# Convenience function
async def ask_healthcare_assistant(
    query: str,
    context: str = "",
    prefer_local: bool = True,
) -> AssistantResponse:
    """Ask the healthcare assistant a question.

    Args:
        query: Your healthcare question
        context: Additional context (role, patient info)
        prefer_local: Prefer local models

    Returns:
        AssistantResponse with answer and metadata
    """
    assistant = HealthcareAssistant()
    return await assistant.answer(query, context, prefer_local)
