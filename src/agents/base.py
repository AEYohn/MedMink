"""Base agent class with common functionality."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import uuid4

if TYPE_CHECKING:
    from src.gemini import GeminiClient
    from src.kg import KnowledgeGraph

import structlog

from src.models import Task, ThoughtSignature

logger = structlog.get_logger()


@dataclass
class AgentResult:
    """Result of an agent execution."""

    success: bool
    data: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    thought_signature: ThoughtSignature | None = None
    metrics: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "success": self.success,
            "data": self.data,
            "error": self.error,
            "thought_signature": (
                self.thought_signature.model_dump() if self.thought_signature else None
            ),
            "metrics": self.metrics,
        }


class BaseAgent(ABC):
    """Base class for all agents."""

    name: str = "base"

    def __init__(
        self,
        gemini_client: GeminiClient | None = None,
        knowledge_graph: KnowledgeGraph | None = None,
    ):
        self._gemini = gemini_client
        self._kg = knowledge_graph
        self.logger = logger.bind(agent=self.name)

    async def _get_gemini(self) -> GeminiClient:
        """Get Gemini client."""
        if self._gemini is None:
            from src.gemini import get_gemini_client

            self._gemini = get_gemini_client()
        return self._gemini

    async def _get_kg(self) -> KnowledgeGraph | None:
        """Get knowledge graph (returns None if unavailable)."""
        if self._kg is None:
            try:
                from src.kg import get_knowledge_graph

                self._kg = await get_knowledge_graph()
            except Exception as e:
                self.logger.warning("Knowledge graph unavailable", error=str(e))
                return None
        return self._kg

    @abstractmethod
    async def execute(self, task: Task) -> AgentResult:
        """Execute the agent's task."""
        pass

    async def create_thought_signature(
        self,
        task: Task,
        context_summary: str,
        decision_made: str,
        reasoning: str,
        confidence: float,
        assumptions: list[str] | None = None,
        expected_outcomes: list[str] | None = None,
    ) -> ThoughtSignature:
        """Create a thought signature for continuity and accountability."""
        signature = ThoughtSignature(
            id=str(uuid4()),
            agent_name=self.name,
            task_id=task.id,
            context_summary=context_summary,
            decision_made=decision_made,
            reasoning=reasoning,
            confidence=confidence,
            assumptions=assumptions or [],
            expected_outcomes=expected_outcomes or [],
            created_at=datetime.utcnow(),
        )

        self.logger.info(
            "Thought signature created",
            signature_id=signature.id,
            decision=decision_made[:100],
            confidence=confidence,
        )

        return signature

    async def _handle_error(
        self,
        error: Exception,
        task: Task,
        context: dict[str, Any],
    ) -> AgentResult:
        """Handle an error during execution."""
        self.logger.error(
            "Agent execution failed",
            error=str(error),
            task_id=task.id,
            task_type=task.type,
        )

        # Create thought signature for the failure
        thought = await self.create_thought_signature(
            task=task,
            context_summary=f"Error occurred: {str(error)[:200]}",
            decision_made="Execution failed, returning error",
            reasoning=f"Exception type: {type(error).__name__}",
            confidence=0.0,
            assumptions=[],
            expected_outcomes=["Task will be retried or escalated"],
        )

        return AgentResult(
            success=False,
            error=str(error),
            thought_signature=thought,
            data={"context": context},
        )
