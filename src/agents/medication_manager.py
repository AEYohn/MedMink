"""Medication Manager Agent for drug interaction checking.

Uses medical literature and MedGemma to check for potential
drug-drug interactions and provide safety recommendations.
"""

import asyncio
from dataclasses import dataclass
from typing import Any, Literal

import dspy
import structlog

from src.agents.base import AgentResult, BaseAgent
from src.medgemma import get_medgemma_client
from src.models import Task

logger = structlog.get_logger()


SeverityLevel = Literal["major", "moderate", "minor"]


@dataclass
class DrugInteraction:
    """A potential drug-drug interaction."""

    drug1: str
    drug2: str
    severity: SeverityLevel
    description: str
    recommendation: str
    evidence_level: str


@dataclass
class InteractionCheckResult:
    """Result of drug interaction check."""

    safe: bool
    interactions: list[DrugInteraction]
    recommendations: list[str]
    confidence: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "safe": self.safe,
            "interactions": [
                {
                    "drug1": i.drug1,
                    "drug2": i.drug2,
                    "severity": i.severity,
                    "description": i.description,
                    "recommendation": i.recommendation,
                    "evidence_level": i.evidence_level,
                }
                for i in self.interactions
            ],
            "recommendations": self.recommendations,
            "confidence": self.confidence,
        }


class DrugInteractionSignature(dspy.Signature):
    """Check for potential drug-drug interactions.

    You are a medical AI assistant checking for drug interactions.
    Analyze the list of medications and identify potential interactions.

    IMPORTANT: When in doubt, flag as potential interaction. Patient
    safety is the priority.
    """

    medications: str = dspy.InputField(desc="Comma-separated list of medication names")

    interactions: str = dspy.OutputField(
        desc="JSON list of interactions with drug1, drug2, severity (major/moderate/minor), description, recommendation"
    )
    safe: bool = dspy.OutputField(desc="Whether all medications are safe to take together")
    recommendations: str = dspy.OutputField(desc="JSON list of general recommendations")
    confidence: float = dspy.OutputField(desc="Confidence level 0-1")


class MedicationManagerAgent(BaseAgent):
    """Agent for checking drug interactions.

    Uses MedGemma to identify potential drug interactions.
    """

    name = "medication_manager"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.medgemma = get_medgemma_client()
        self.interaction_checker = dspy.ChainOfThought(DrugInteractionSignature)

    async def execute(self, task: Task) -> AgentResult:
        """Execute drug interaction check task.

        Task parameters:
            - medications: List of medication names
        """
        params = task.payload
        medications = params.get("medications", [])

        if not medications or len(medications) < 2:
            return AgentResult(
                success=False,
                error="At least 2 medications required for interaction check",
            )

        try:
            result = await self.check_interactions(medications)

            thought = await self.create_thought_signature(
                task=task,
                context_summary=f"Checking {len(medications)} medications",
                decision_made=f"Safe: {result.safe}, Found {len(result.interactions)} interactions",
                reasoning="Analyzed interactions between all medication pairs",
                confidence=result.confidence,
                expected_outcomes=[
                    "Patient informed of potential interactions",
                    "Safety recommendations provided",
                ],
            )

            return AgentResult(
                success=True,
                data=result.to_dict(),
                thought_signature=thought,
                metrics={
                    "medications_checked": len(medications),
                    "interactions_found": len(result.interactions),
                    "is_safe": result.safe,
                },
            )

        except Exception as e:
            return await self._handle_error(e, task, params)

    async def check_interactions(
        self,
        medications: list[str],
    ) -> InteractionCheckResult:
        """Check for drug-drug interactions.

        Args:
            medications: List of medication names

        Returns:
            InteractionCheckResult with any found interactions
        """
        self.logger.info("Checking drug interactions", medications=medications)
        normalized = [self._normalize_drug_name(m) for m in medications]

        # MedGemma is the sole interaction checker
        interactions = await self._ai_interaction_check(normalized)

        is_safe = not any(i.severity == "major" for i in interactions)
        recommendations = self._generate_recommendations(interactions, medications)

        return InteractionCheckResult(
            safe=is_safe,
            interactions=interactions,
            recommendations=recommendations,
            confidence=self._calculate_confidence(interactions, len(medications)),
        )

    def _normalize_drug_name(self, name: str) -> str:
        """Normalize a drug name for comparison."""
        return name.lower().strip()

    async def _ai_interaction_check(
        self,
        medications: list[str],
    ) -> list[DrugInteraction]:
        """Use AI to check for interactions."""
        medications_str = ", ".join(medications)

        try:
            result = await asyncio.to_thread(
                self.interaction_checker,
                medications=medications_str,
            )

            return self._parse_ai_interactions(result.interactions)
        except Exception as e:
            self.logger.warning("AI interaction parsing failed", error=str(e))
            return []

    def _parse_ai_interactions(self, interactions_json: str) -> list[DrugInteraction]:
        """Parse AI-generated interactions."""
        import json

        try:
            interactions = json.loads(interactions_json)
            result = []
            for i in interactions:
                severity = i.get("severity", "moderate").lower()
                if severity not in ["major", "moderate", "minor"]:
                    severity = "moderate"

                result.append(
                    DrugInteraction(
                        drug1=i.get("drug1", ""),
                        drug2=i.get("drug2", ""),
                        severity=severity,
                        description=i.get("description", "Potential interaction detected"),
                        recommendation=i.get("recommendation", "Consult your pharmacist"),
                        evidence_level="ai-assessed",
                    )
                )
            return result
        except (json.JSONDecodeError, TypeError):
            return []

    def _generate_recommendations(
        self,
        interactions: list[DrugInteraction],
        medications: list[str],
    ) -> list[str]:
        """Generate general recommendations based on interactions."""
        recommendations = []

        if not interactions:
            recommendations.append("No significant interactions found between these medications.")
            recommendations.append(
                "Always take medications as prescribed by your healthcare provider."
            )
        else:
            major_count = sum(1 for i in interactions if i.severity == "major")
            if major_count > 0:
                recommendations.append(
                    f"Found {major_count} major interaction(s). Discuss with your "
                    "healthcare provider before taking these medications together."
                )

            recommendations.append("Consider scheduling a medication review with your pharmacist.")

        recommendations.append("Keep an updated list of all medications and supplements you take.")
        recommendations.append("Report any unusual symptoms to your healthcare provider.")

        return recommendations

    def _calculate_confidence(
        self,
        interactions: list[DrugInteraction],
        num_medications: int,
    ) -> float:
        """Calculate confidence in the interaction check."""
        if interactions:
            return 0.7

        # If no interactions found, moderate confidence
        return 0.75


# Convenience function for direct use
async def check_drug_interactions(
    medications: list[str],
) -> dict[str, Any]:
    """Check for drug-drug interactions.

    Args:
        medications: List of medication names

    Returns:
        Interaction check result as dictionary
    """
    agent = MedicationManagerAgent()
    result = await agent.check_interactions(medications)
    return result.to_dict()
