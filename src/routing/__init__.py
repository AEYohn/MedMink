"""Multi-model routing for healthcare AI assistant.

Routes queries to the optimal model based on task type:
- MedGemma: Clinical literature, evidence synthesis, drug info
- Gemma 2: General documentation, patient education
- Gemini Pro: Complex reasoning, differential diagnosis
"""

from src.routing.model_registry import (
    ModelCapability,
    ModelRegistry,
    get_model_registry,
)
from src.routing.task_router import (
    RoutingDecision,
    TaskRouter,
    TaskType,
    get_task_router,
)

__all__ = [
    "ModelRegistry",
    "ModelCapability",
    "get_model_registry",
    "TaskRouter",
    "TaskType",
    "RoutingDecision",
    "get_task_router",
]
