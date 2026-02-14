"""Model registry for multi-model healthcare assistant.

Manages available models and their capabilities for intelligent routing.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Protocol

import structlog

from src.config import settings

logger = structlog.get_logger()


class ModelCapability(str, Enum):
    """Capabilities that models can provide."""

    # Clinical capabilities
    LITERATURE_SYNTHESIS = "literature_synthesis"
    EVIDENCE_GRADING = "evidence_grading"
    DRUG_INTERACTION = "drug_interaction"
    CLINICAL_REASONING = "clinical_reasoning"
    DIFFERENTIAL_DIAGNOSIS = "differential_diagnosis"

    # Documentation capabilities
    CLINICAL_DOCUMENTATION = "clinical_documentation"
    PATIENT_EDUCATION = "patient_education"
    DISCHARGE_SUMMARY = "discharge_summary"
    HANDOFF_SUMMARY = "handoff_summary"

    # General capabilities
    SUMMARIZATION = "summarization"
    QUESTION_ANSWERING = "question_answering"
    EXTRACTION = "extraction"
    TRANSLATION = "translation"


class ModelProvider(Protocol):
    """Protocol for model providers."""

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 2048,
        temperature: float = 0.3,
    ) -> str:
        """Generate text from the model."""
        ...

    @property
    def is_available(self) -> bool:
        """Check if model is available."""
        ...


@dataclass
class ModelConfig:
    """Configuration for a model in the registry."""

    name: str
    provider: str  # "local", "google", "anthropic"
    model_id: str
    capabilities: list[ModelCapability]
    priority: int = 0  # Higher = preferred when multiple models match
    max_context: int = 8192
    cost_per_1k_tokens: float = 0.0  # For cloud models
    is_local: bool = False
    supports_medical: bool = False
    metadata: dict[str, Any] = field(default_factory=dict)


class ModelRegistry:
    """Registry of available models and their capabilities.

    Manages model selection based on:
    - Task requirements (capabilities needed)
    - Model availability (local vs cloud)
    - Cost optimization (prefer local when possible)
    - Performance requirements
    """

    def __init__(self):
        self._models: dict[str, ModelConfig] = {}
        self._providers: dict[str, ModelProvider] = {}
        self._initialized = False

        # Register default models
        self._register_default_models()

    def _register_default_models(self):
        """Register the default set of models."""

        # MedGemma - Local medical model (highest priority for medical tasks)
        self.register_model(ModelConfig(
            name="medgemma",
            provider="local",
            model_id=settings.medgemma_model,
            capabilities=[
                ModelCapability.LITERATURE_SYNTHESIS,
                ModelCapability.EVIDENCE_GRADING,
                ModelCapability.DRUG_INTERACTION,
                ModelCapability.CLINICAL_REASONING,
                ModelCapability.QUESTION_ANSWERING,
                ModelCapability.EXTRACTION,
            ],
            priority=100,  # Highest priority for medical
            max_context=settings.medgemma_context_length,
            cost_per_1k_tokens=0.0,
            is_local=True,
            supports_medical=True,
            metadata={"quantization": "Q4_K_M", "family": "gemma"},
        ))

        # Gemini Flash - Fast cloud model for general tasks
        self.register_model(ModelConfig(
            name="gemini-flash",
            provider="google",
            model_id="gemini-2.0-flash",
            capabilities=[
                ModelCapability.SUMMARIZATION,
                ModelCapability.QUESTION_ANSWERING,
                ModelCapability.EXTRACTION,
                ModelCapability.CLINICAL_DOCUMENTATION,
                ModelCapability.PATIENT_EDUCATION,
                ModelCapability.HANDOFF_SUMMARY,
                ModelCapability.DISCHARGE_SUMMARY,
                ModelCapability.TRANSLATION,
            ],
            priority=50,
            max_context=32000,
            cost_per_1k_tokens=0.00035,
            is_local=False,
            supports_medical=False,
            metadata={"version": "2.0", "speed": "fast"},
        ))

        # Gemini Pro - Complex reasoning
        self.register_model(ModelConfig(
            name="gemini-pro",
            provider="google",
            model_id="gemini-1.5-pro",
            capabilities=[
                ModelCapability.DIFFERENTIAL_DIAGNOSIS,
                ModelCapability.CLINICAL_REASONING,
                ModelCapability.LITERATURE_SYNTHESIS,
                ModelCapability.EVIDENCE_GRADING,
                ModelCapability.SUMMARIZATION,
                ModelCapability.QUESTION_ANSWERING,
            ],
            priority=75,  # High priority for complex reasoning
            max_context=128000,
            cost_per_1k_tokens=0.00125,
            is_local=False,
            supports_medical=True,
            metadata={"version": "1.5", "reasoning": "advanced"},
        ))

    def register_model(self, config: ModelConfig):
        """Register a model configuration."""
        self._models[config.name] = config
        logger.info(
            "Model registered",
            name=config.name,
            provider=config.provider,
            capabilities=len(config.capabilities),
        )

    def register_provider(self, name: str, provider: ModelProvider):
        """Register a model provider instance."""
        self._providers[name] = provider
        logger.info("Provider registered", name=name)

    def get_model(self, name: str) -> ModelConfig | None:
        """Get a model configuration by name."""
        return self._models.get(name)

    def get_provider(self, name: str) -> ModelProvider | None:
        """Get a model provider by name."""
        return self._providers.get(name)

    def find_models_for_capability(
        self,
        capability: ModelCapability,
        prefer_local: bool = True,
        require_medical: bool = False,
    ) -> list[ModelConfig]:
        """Find models that support a given capability.

        Args:
            capability: Required capability
            prefer_local: Prefer local models over cloud
            require_medical: Only return medical-specialized models

        Returns:
            List of matching models sorted by priority
        """
        matches = []

        for model in self._models.values():
            if capability not in model.capabilities:
                continue
            if require_medical and not model.supports_medical:
                continue
            matches.append(model)

        # Sort by priority, then by local preference
        def sort_key(m: ModelConfig) -> tuple:
            local_bonus = 1000 if (prefer_local and m.is_local) else 0
            return (-(m.priority + local_bonus), m.cost_per_1k_tokens)

        matches.sort(key=sort_key)
        return matches

    def get_best_model(
        self,
        capabilities: list[ModelCapability],
        prefer_local: bool = True,
        require_medical: bool = False,
    ) -> ModelConfig | None:
        """Get the best model that supports all required capabilities.

        Args:
            capabilities: List of required capabilities
            prefer_local: Prefer local models
            require_medical: Require medical specialization

        Returns:
            Best matching model or None
        """
        candidates = list(self._models.values())

        # Filter by capabilities
        for cap in capabilities:
            candidates = [m for m in candidates if cap in m.capabilities]

        # Filter by medical requirement
        if require_medical:
            candidates = [m for m in candidates if m.supports_medical]

        if not candidates:
            return None

        # Sort and return best
        def sort_key(m: ModelConfig) -> tuple:
            local_bonus = 1000 if (prefer_local and m.is_local) else 0
            return (-(m.priority + local_bonus), m.cost_per_1k_tokens)

        candidates.sort(key=sort_key)
        return candidates[0]

    def list_models(self) -> list[ModelConfig]:
        """List all registered models."""
        return list(self._models.values())

    async def initialize_providers(self):
        """Initialize all model providers."""
        if self._initialized:
            return

        # Initialize MedGemma provider
        try:
            from src.medgemma import get_medgemma_client
            medgemma = get_medgemma_client()
            self.register_provider("medgemma", medgemma)
        except Exception as e:
            logger.warning("Failed to initialize MedGemma", error=str(e))

        # Initialize Gemini provider
        try:
            from src.gemini import get_gemini_client
            gemini = get_gemini_client()
            # Wrap Gemini client to match protocol
            self.register_provider("gemini-flash", GeminiProviderWrapper(gemini, "gemini-2.0-flash"))
            self.register_provider("gemini-pro", GeminiProviderWrapper(gemini, "gemini-1.5-pro"))
        except Exception as e:
            logger.warning("Failed to initialize Gemini", error=str(e))

        self._initialized = True
        logger.info("Model providers initialized", count=len(self._providers))


class GeminiProviderWrapper:
    """Wrapper to adapt GeminiClient to ModelProvider protocol."""

    def __init__(self, client, model_id: str):
        self._client = client
        self._model_id = model_id

    async def generate(
        self,
        prompt: str,
        system_prompt: str | None = None,
        max_tokens: int = 2048,
        temperature: float = 0.3,
    ) -> str:
        """Generate text using Gemini."""
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"

        return await self._client.generate(
            prompt=full_prompt,
            max_tokens=max_tokens,
            temperature=temperature,
        )

    @property
    def is_available(self) -> bool:
        """Gemini is available if API key is configured."""
        return bool(settings.gemini_api_key)


# Singleton instance
_model_registry: ModelRegistry | None = None


def get_model_registry() -> ModelRegistry:
    """Get or create model registry singleton."""
    global _model_registry
    if _model_registry is None:
        _model_registry = ModelRegistry()
    return _model_registry
