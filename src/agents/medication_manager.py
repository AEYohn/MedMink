"""Medication Manager Agent for drug interaction checking.

Uses medical literature and MedGemma to check for potential
drug-drug interactions and provide safety recommendations.
"""

import asyncio
from dataclasses import dataclass
from typing import Any, Literal

import dspy
import structlog

from src.agents.base import BaseAgent, AgentResult
from src.config import settings
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


# Known major interactions (simplified database)
KNOWN_MAJOR_INTERACTIONS = {
    ("warfarin", "aspirin"): {
        "description": "Increased risk of bleeding when combined",
        "recommendation": "Monitor closely for signs of bleeding. Consider alternative if possible.",
    },
    ("metformin", "alcohol"): {
        "description": "Risk of lactic acidosis, especially with heavy alcohol use",
        "recommendation": "Limit alcohol consumption. Monitor for symptoms of lactic acidosis.",
    },
    ("ssri", "maoi"): {
        "description": "Risk of serotonin syndrome, potentially life-threatening",
        "recommendation": "These medications should not be combined. Wait 14 days between.",
    },
    ("ace inhibitor", "potassium"): {
        "description": "Risk of dangerously high potassium levels (hyperkalemia)",
        "recommendation": "Monitor potassium levels regularly. May need dose adjustment.",
    },
    ("statin", "grapefruit"): {
        "description": "Grapefruit can increase statin levels, raising risk of side effects",
        "recommendation": "Avoid grapefruit and grapefruit juice while taking statins.",
    },
}

# Drug class mappings
DRUG_CLASSES = {
    "ssri": ["sertraline", "fluoxetine", "paroxetine", "citalopram", "escitalopram", "prozac", "zoloft", "paxil", "lexapro"],
    "maoi": ["phenelzine", "tranylcypromine", "selegiline", "isocarboxazid", "nardil", "parnate"],
    "statin": ["atorvastatin", "simvastatin", "rosuvastatin", "pravastatin", "lovastatin", "lipitor", "crestor", "zocor"],
    "ace inhibitor": ["lisinopril", "enalapril", "ramipril", "benazepril", "captopril", "prinivil", "vasotec"],
    "blood thinner": ["warfarin", "coumadin", "eliquis", "xarelto", "apixaban", "rivaroxaban"],
    "nsaid": ["ibuprofen", "naproxen", "aspirin", "advil", "motrin", "aleve"],
    "opioid": ["hydrocodone", "oxycodone", "morphine", "codeine", "tramadol", "vicodin", "percocet"],
    "benzodiazepine": ["alprazolam", "lorazepam", "diazepam", "clonazepam", "xanax", "ativan", "valium", "klonopin"],
}


class MedicationManagerAgent(BaseAgent):
    """Agent for checking drug interactions.

    Uses a combination of known interaction databases and
    AI analysis to identify potential drug interactions.
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
                reasoning=f"Analyzed interactions between all medication pairs",
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

        # Normalize medication names
        normalized = [self._normalize_drug_name(m) for m in medications]

        # First, check known interactions (fast path)
        known_interactions = self._check_known_interactions(normalized)

        # Then, use AI for more comprehensive check
        try:
            ai_interactions = await self._ai_interaction_check(normalized)
        except Exception as e:
            self.logger.warning("AI interaction check failed", error=str(e))
            ai_interactions = []

        # Merge and deduplicate interactions
        all_interactions = self._merge_interactions(known_interactions, ai_interactions)

        # Determine if safe (no major interactions)
        is_safe = not any(i.severity == "major" for i in all_interactions)

        # Generate recommendations
        recommendations = self._generate_recommendations(all_interactions, medications)

        return InteractionCheckResult(
            safe=is_safe,
            interactions=all_interactions,
            recommendations=recommendations,
            confidence=self._calculate_confidence(all_interactions, len(medications)),
        )

    def _normalize_drug_name(self, name: str) -> str:
        """Normalize a drug name for comparison."""
        return name.lower().strip()

    def _get_drug_class(self, drug: str) -> str | None:
        """Get the drug class for a medication."""
        drug_lower = drug.lower()
        for drug_class, members in DRUG_CLASSES.items():
            if drug_lower in members:
                return drug_class
        return None

    def _check_known_interactions(
        self,
        medications: list[str],
    ) -> list[DrugInteraction]:
        """Check for known interactions in our database."""
        interactions = []

        # Check each pair
        for i, drug1 in enumerate(medications):
            for drug2 in medications[i + 1:]:
                interaction = self._check_pair(drug1, drug2)
                if interaction:
                    interactions.append(interaction)

        return interactions

    def _check_pair(self, drug1: str, drug2: str) -> DrugInteraction | None:
        """Check a specific drug pair for interactions."""
        # Normalize
        d1 = self._normalize_drug_name(drug1)
        d2 = self._normalize_drug_name(drug2)

        # Get drug classes
        class1 = self._get_drug_class(d1) or d1
        class2 = self._get_drug_class(d2) or d2

        # Check known interactions
        for (c1, c2), info in KNOWN_MAJOR_INTERACTIONS.items():
            if (class1 == c1 and class2 == c2) or (class1 == c2 and class2 == c1):
                return DrugInteraction(
                    drug1=drug1,
                    drug2=drug2,
                    severity="major",
                    description=info["description"],
                    recommendation=info["recommendation"],
                    evidence_level="established",
                )

        # Check for common dangerous combinations
        dangerous_combos = [
            (["opioid"], ["benzodiazepine"], "Risk of respiratory depression"),
            (["blood thinner"], ["nsaid"], "Increased bleeding risk"),
        ]

        for classes1, classes2, desc in dangerous_combos:
            if (class1 in classes1 and class2 in classes2) or \
               (class1 in classes2 and class2 in classes1):
                return DrugInteraction(
                    drug1=drug1,
                    drug2=drug2,
                    severity="major",
                    description=desc,
                    recommendation="Consult your healthcare provider before combining these medications.",
                    evidence_level="established",
                )

        return None

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

                result.append(DrugInteraction(
                    drug1=i.get("drug1", ""),
                    drug2=i.get("drug2", ""),
                    severity=severity,
                    description=i.get("description", "Potential interaction detected"),
                    recommendation=i.get("recommendation", "Consult your pharmacist"),
                    evidence_level="ai-assessed",
                ))
            return result
        except (json.JSONDecodeError, TypeError):
            return []

    def _merge_interactions(
        self,
        known: list[DrugInteraction],
        ai: list[DrugInteraction],
    ) -> list[DrugInteraction]:
        """Merge known and AI-detected interactions."""
        # Known interactions take precedence
        seen_pairs = set()
        result = []

        for interaction in known:
            pair = frozenset([interaction.drug1.lower(), interaction.drug2.lower()])
            seen_pairs.add(pair)
            result.append(interaction)

        for interaction in ai:
            pair = frozenset([interaction.drug1.lower(), interaction.drug2.lower()])
            if pair not in seen_pairs:
                seen_pairs.add(pair)
                result.append(interaction)

        return result

    def _generate_recommendations(
        self,
        interactions: list[DrugInteraction],
        medications: list[str],
    ) -> list[str]:
        """Generate general recommendations based on interactions."""
        recommendations = []

        if not interactions:
            recommendations.append(
                "No significant interactions found between these medications."
            )
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

            recommendations.append(
                "Consider scheduling a medication review with your pharmacist."
            )

        recommendations.append(
            "Keep an updated list of all medications and supplements you take."
        )
        recommendations.append(
            "Report any unusual symptoms to your healthcare provider."
        )

        return recommendations

    def _calculate_confidence(
        self,
        interactions: list[DrugInteraction],
        num_medications: int,
    ) -> float:
        """Calculate confidence in the interaction check."""
        # Higher confidence if we checked known interactions
        established_count = sum(
            1 for i in interactions if i.evidence_level == "established"
        )

        if established_count > 0:
            return 0.9

        # Lower confidence for AI-only assessment
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
