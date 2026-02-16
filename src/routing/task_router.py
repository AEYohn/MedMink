"""Task router for multi-model healthcare assistant.

Uses DSPy to classify queries and route to the optimal model.
"""

from dataclasses import dataclass
try:
    from enum import StrEnum
except ImportError:
    import enum
    class StrEnum(str, enum.Enum):
        pass
from typing import Any

import dspy
import structlog

from src.routing.model_registry import (
    ModelCapability,
    ModelConfig,
    ModelRegistry,
    get_model_registry,
)

logger = structlog.get_logger()


class TaskType(StrEnum):
    """Types of healthcare tasks."""

    # Clinical literature tasks
    LITERATURE_SEARCH = "literature_search"
    EVIDENCE_SYNTHESIS = "evidence_synthesis"
    EVIDENCE_GRADING = "evidence_grading"

    # Clinical decision support
    DRUG_INTERACTION = "drug_interaction"
    DRUG_INFO = "drug_info"
    DIFFERENTIAL_DIAGNOSIS = "differential_diagnosis"
    TREATMENT_COMPARISON = "treatment_comparison"

    # Documentation tasks
    CLINICAL_NOTE = "clinical_note"
    DISCHARGE_SUMMARY = "discharge_summary"
    HANDOFF_SUMMARY = "handoff_summary"
    PATIENT_EDUCATION = "patient_education"

    # General tasks
    GENERAL_QUESTION = "general_question"
    SUMMARIZATION = "summarization"
    TRANSLATION = "translation"


# Mapping from task types to required capabilities
TASK_CAPABILITY_MAP: dict[TaskType, list[ModelCapability]] = {
    TaskType.LITERATURE_SEARCH: [ModelCapability.LITERATURE_SYNTHESIS],
    TaskType.EVIDENCE_SYNTHESIS: [ModelCapability.LITERATURE_SYNTHESIS, ModelCapability.EVIDENCE_GRADING],
    TaskType.EVIDENCE_GRADING: [ModelCapability.EVIDENCE_GRADING],
    TaskType.DRUG_INTERACTION: [ModelCapability.DRUG_INTERACTION],
    TaskType.DRUG_INFO: [ModelCapability.DRUG_INTERACTION, ModelCapability.QUESTION_ANSWERING],
    TaskType.DIFFERENTIAL_DIAGNOSIS: [ModelCapability.DIFFERENTIAL_DIAGNOSIS, ModelCapability.CLINICAL_REASONING],
    TaskType.TREATMENT_COMPARISON: [ModelCapability.CLINICAL_REASONING, ModelCapability.EVIDENCE_GRADING],
    TaskType.CLINICAL_NOTE: [ModelCapability.CLINICAL_DOCUMENTATION],
    TaskType.DISCHARGE_SUMMARY: [ModelCapability.DISCHARGE_SUMMARY],
    TaskType.HANDOFF_SUMMARY: [ModelCapability.HANDOFF_SUMMARY],
    TaskType.PATIENT_EDUCATION: [ModelCapability.PATIENT_EDUCATION],
    TaskType.GENERAL_QUESTION: [ModelCapability.QUESTION_ANSWERING],
    TaskType.SUMMARIZATION: [ModelCapability.SUMMARIZATION],
    TaskType.TRANSLATION: [ModelCapability.TRANSLATION],
}

# Tasks that require medical-specialized models
MEDICAL_TASKS = {
    TaskType.LITERATURE_SEARCH,
    TaskType.EVIDENCE_SYNTHESIS,
    TaskType.EVIDENCE_GRADING,
    TaskType.DRUG_INTERACTION,
    TaskType.DRUG_INFO,
    TaskType.DIFFERENTIAL_DIAGNOSIS,
    TaskType.TREATMENT_COMPARISON,
}


@dataclass
class RoutingDecision:
    """Decision made by the task router."""

    task_type: TaskType
    model_name: str
    model_config: ModelConfig
    confidence: float
    reasoning: str
    fallback_models: list[str]
    metadata: dict[str, Any]


class TaskClassification(dspy.Signature):
    """Classify a healthcare query into a task type.

    Analyze the query to determine what type of healthcare task it represents.
    Consider:
    - Is it asking about medical literature or evidence?
    - Is it about drug interactions or medications?
    - Is it requesting clinical documentation help?
    - Is it a diagnostic question?
    - Is it a general health question?
    """

    query: str = dspy.InputField(desc="The user's healthcare query")
    context: str = dspy.InputField(desc="Additional context about the user or session")

    task_type: str = dspy.OutputField(
        desc="One of: literature_search, evidence_synthesis, evidence_grading, "
             "drug_interaction, drug_info, differential_diagnosis, treatment_comparison, "
             "clinical_note, discharge_summary, handoff_summary, patient_education, "
             "general_question, summarization, translation"
    )
    confidence: float = dspy.OutputField(desc="Confidence score 0-1")
    reasoning: str = dspy.OutputField(desc="Brief explanation of classification")


class TaskRouter:
    """Routes healthcare queries to the optimal model.

    Uses DSPy for intelligent task classification, then maps to
    the best available model based on capabilities and preferences.
    """

    def __init__(self, registry: ModelRegistry | None = None):
        self.registry = registry or get_model_registry()
        self.classifier = dspy.ChainOfThought(TaskClassification)

        # Keyword-based fallback classification
        self._keyword_patterns = {
            TaskType.LITERATURE_SEARCH: [
                "evidence for", "studies on", "research on", "literature",
                "pubmed", "papers about", "systematic review", "meta-analysis"
            ],
            TaskType.EVIDENCE_SYNTHESIS: [
                "synthesize", "combine evidence", "what does the evidence say",
                "summarize the research", "evidence-based"
            ],
            TaskType.DRUG_INTERACTION: [
                "drug interaction", "interact with", "can i take", "together with",
                "contraindicated", "drug-drug"
            ],
            TaskType.DRUG_INFO: [
                "side effects", "dosage", "mechanism of action", "half-life",
                "contraindications", "indications"
            ],
            TaskType.DIFFERENTIAL_DIAGNOSIS: [
                "differential", "diagnose", "diagnosis", "what could cause",
                "symptoms suggest", "presenting with"
            ],
            TaskType.TREATMENT_COMPARISON: [
                "compare", "versus", "vs", "better than", "first-line",
                "treatment options", "which treatment"
            ],
            TaskType.CLINICAL_NOTE: [
                "write a note", "document", "chart", "progress note",
                "clinical note", "soap note"
            ],
            TaskType.DISCHARGE_SUMMARY: [
                "discharge", "discharge summary", "going home", "discharge instructions"
            ],
            TaskType.HANDOFF_SUMMARY: [
                "handoff", "hand off", "shift change", "sign out", "sbar"
            ],
            TaskType.PATIENT_EDUCATION: [
                "explain to patient", "patient education", "in simple terms",
                "layman", "easy to understand"
            ],
        }

    async def route(
        self,
        query: str,
        context: str = "",
        prefer_local: bool = True,
        use_dspy: bool = True,
    ) -> RoutingDecision:
        """Route a query to the best model.

        Args:
            query: The user's healthcare query
            context: Additional context (user role, session info)
            prefer_local: Prefer local models when possible
            use_dspy: Use DSPy classifier (falls back to keywords if False)

        Returns:
            RoutingDecision with model selection and reasoning
        """
        # Classify the task
        if use_dspy:
            try:
                task_type, confidence, reasoning = await self._classify_with_dspy(query, context)
            except Exception as e:
                logger.warning("DSPy classification failed, using fallback", error=str(e))
                task_type, confidence, reasoning = self._classify_with_keywords(query)
        else:
            task_type, confidence, reasoning = self._classify_with_keywords(query)

        # Get required capabilities
        capabilities = TASK_CAPABILITY_MAP.get(task_type, [ModelCapability.QUESTION_ANSWERING])
        require_medical = task_type in MEDICAL_TASKS

        # Find best model
        model = self.registry.get_best_model(
            capabilities=capabilities,
            prefer_local=prefer_local,
            require_medical=require_medical,
        )

        if model is None:
            # Fallback to any available model
            models = self.registry.list_models()
            model = models[0] if models else None

            if model is None:
                raise ValueError("No models available in registry")

        # Find fallback models
        all_matches = self.registry.find_models_for_capability(
            capability=capabilities[0] if capabilities else ModelCapability.QUESTION_ANSWERING,
            prefer_local=prefer_local,
            require_medical=False,
        )
        fallbacks = [m.name for m in all_matches if m.name != model.name][:3]

        decision = RoutingDecision(
            task_type=task_type,
            model_name=model.name,
            model_config=model,
            confidence=confidence,
            reasoning=reasoning,
            fallback_models=fallbacks,
            metadata={
                "capabilities_required": [c.value for c in capabilities],
                "require_medical": require_medical,
                "prefer_local": prefer_local,
                "model_is_local": model.is_local,
            },
        )

        logger.info(
            "Query routed",
            task_type=task_type.value,
            model=model.name,
            confidence=confidence,
        )

        return decision

    async def _classify_with_dspy(
        self,
        query: str,
        context: str,
    ) -> tuple[TaskType, float, str]:
        """Classify using DSPy."""
        import asyncio

        result = await asyncio.to_thread(
            self.classifier,
            query=query,
            context=context or "Healthcare professional query",
        )

        # Parse task type
        task_type_str = result.task_type.lower().strip()
        try:
            task_type = TaskType(task_type_str)
        except ValueError:
            # Try to match partial
            for tt in TaskType:
                if tt.value in task_type_str or task_type_str in tt.value:
                    task_type = tt
                    break
            else:
                task_type = TaskType.GENERAL_QUESTION

        confidence = float(result.confidence) if result.confidence else 0.7
        confidence = max(0.0, min(1.0, confidence))

        return task_type, confidence, result.reasoning

    def _classify_with_keywords(
        self,
        query: str,
    ) -> tuple[TaskType, float, str]:
        """Fallback keyword-based classification."""
        query_lower = query.lower()

        best_match = TaskType.GENERAL_QUESTION
        best_score = 0

        for task_type, keywords in self._keyword_patterns.items():
            score = sum(1 for kw in keywords if kw in query_lower)
            if score > best_score:
                best_score = score
                best_match = task_type

        confidence = min(0.9, 0.5 + (best_score * 0.1))
        reasoning = f"Keyword match for {best_match.value} (score: {best_score})"

        return best_match, confidence, reasoning

    async def execute_routed(
        self,
        query: str,
        context: str = "",
        system_prompt: str | None = None,
        **kwargs,
    ) -> tuple[str, RoutingDecision]:
        """Route and execute a query in one step.

        Args:
            query: The user's query
            context: Additional context
            system_prompt: Optional system prompt override
            **kwargs: Additional generation parameters

        Returns:
            Tuple of (response text, routing decision)
        """
        # Route the query
        decision = await self.route(query, context)

        # Get the provider
        await self.registry.initialize_providers()
        provider = self.registry.get_provider(decision.model_name)

        if provider is None:
            # Try fallbacks
            for fallback in decision.fallback_models:
                provider = self.registry.get_provider(fallback)
                if provider is not None:
                    decision.model_name = fallback
                    break

        if provider is None:
            raise ValueError(f"No provider available for {decision.model_name}")

        # Generate response
        response = await provider.generate(
            prompt=query,
            system_prompt=system_prompt,
            **kwargs,
        )

        return response, decision


# Singleton instance
_task_router: TaskRouter | None = None


def get_task_router() -> TaskRouter:
    """Get or create task router singleton."""
    global _task_router
    if _task_router is None:
        _task_router = TaskRouter()
    return _task_router
