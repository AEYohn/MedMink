"""Symptom Checker Agent for patient-facing symptom analysis.

Uses multi-model routing to analyze patient symptoms and provide
triage guidance with appropriate urgency levels.
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
from src.routing import get_task_router

logger = structlog.get_logger()


UrgencyLevel = Literal["emergency", "urgent", "routine", "self-care"]
ProbabilityLevel = Literal["high", "moderate", "low"]


@dataclass
class PossibleCondition:
    """A possible condition based on symptoms."""
    name: str
    probability: ProbabilityLevel
    description: str


@dataclass
class SymptomAnalysis:
    """Result of symptom analysis."""
    response: str
    urgency: UrgencyLevel
    possible_conditions: list[PossibleCondition]
    recommendations: list[str]
    seek_care: bool
    care_timeframe: str | None
    follow_up_questions: list[str]
    confidence: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "response": self.response,
            "urgency": self.urgency,
            "possible_conditions": [
                {
                    "name": c.name,
                    "probability": c.probability,
                    "description": c.description,
                }
                for c in self.possible_conditions
            ],
            "recommendations": self.recommendations,
            "seek_care": self.seek_care,
            "care_timeframe": self.care_timeframe,
            "follow_up_questions": self.follow_up_questions,
            "confidence": self.confidence,
        }


class SymptomTriageSignature(dspy.Signature):
    """Analyze patient symptoms and provide triage guidance.

    You are a medical AI assistant helping to triage patient symptoms.
    Analyze the symptoms described and provide appropriate guidance.

    IMPORTANT: This is NOT a diagnosis. Always recommend professional
    medical consultation for serious symptoms.
    """

    symptoms: str = dspy.InputField(desc="Patient's symptom description")
    conversation_history: str = dspy.InputField(desc="Previous conversation context")

    response: str = dspy.OutputField(desc="Empathetic response addressing the symptoms")
    urgency: str = dspy.OutputField(desc="Urgency level: emergency, urgent, routine, or self-care")
    possible_conditions: str = dspy.OutputField(
        desc="JSON list of possible conditions with name, probability (high/moderate/low), description"
    )
    recommendations: str = dspy.OutputField(desc="JSON list of recommended actions")
    seek_care: bool = dspy.OutputField(desc="Whether to seek professional medical care")
    care_timeframe: str = dspy.OutputField(desc="When to seek care (e.g., 'immediately', 'within 24 hours')")
    follow_up_questions: str = dspy.OutputField(desc="JSON list of follow-up questions to ask")


# Emergency symptoms that require immediate attention
EMERGENCY_SYMPTOMS = [
    "chest pain",
    "difficulty breathing",
    "severe bleeding",
    "loss of consciousness",
    "stroke symptoms",
    "severe allergic reaction",
    "suicidal thoughts",
    "severe head injury",
    "seizure",
    "poisoning",
    "heart attack",
    "anaphylaxis",
]

# Urgent symptoms requiring same-day care
URGENT_SYMPTOMS = [
    "high fever",
    "severe pain",
    "persistent vomiting",
    "dehydration",
    "sudden vision changes",
    "severe headache",
    "abdominal pain",
    "blood in urine",
    "blood in stool",
    "signs of infection",
]


class SymptomCheckerAgent(BaseAgent):
    """Patient-facing symptom analysis agent.

    Uses multi-model routing to analyze symptoms and provide
    appropriate triage guidance. Prioritizes patient safety
    with conservative urgency assessment.
    """

    name = "symptom_checker"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.medgemma = get_medgemma_client()
        self.router = get_task_router()
        self.triage_module = dspy.ChainOfThought(SymptomTriageSignature)

    async def execute(self, task: Task) -> AgentResult:
        """Execute symptom analysis task.

        Task parameters:
            - symptoms: Patient's symptom description
            - conversation_history: Previous messages in the conversation
        """
        params = task.payload
        symptoms = params.get("symptoms", "")
        conversation_history = params.get("conversation_history", [])

        if not symptoms:
            return AgentResult(
                success=False,
                error="No symptoms provided",
            )

        try:
            analysis = await self.analyze_symptoms(
                symptoms=symptoms,
                conversation_history=conversation_history,
            )

            thought = await self.create_thought_signature(
                task=task,
                context_summary=f"Symptom analysis: {symptoms[:100]}",
                decision_made=f"Urgency: {analysis.urgency}, Seek care: {analysis.seek_care}",
                reasoning=f"Found {len(analysis.possible_conditions)} possible conditions",
                confidence=analysis.confidence,
                expected_outcomes=[
                    "Patient receives appropriate guidance",
                    "Emergency symptoms flagged correctly",
                ],
            )

            return AgentResult(
                success=True,
                data=analysis.to_dict(),
                thought_signature=thought,
                metrics={
                    "urgency": analysis.urgency,
                    "conditions_identified": len(analysis.possible_conditions),
                    "seek_care": analysis.seek_care,
                },
            )

        except Exception as e:
            return await self._handle_error(e, task, params)

    async def analyze_symptoms(
        self,
        symptoms: str,
        conversation_history: list[dict[str, str]] | None = None,
    ) -> SymptomAnalysis:
        """Analyze symptoms and provide triage guidance.

        Args:
            symptoms: Patient's symptom description
            conversation_history: Previous messages for context

        Returns:
            SymptomAnalysis with urgency level and recommendations
        """
        self.logger.info("Analyzing symptoms", symptoms=symptoms[:100])

        # First, check for emergency symptoms (fast path)
        urgency = self._check_emergency_keywords(symptoms)
        if urgency == "emergency":
            return self._create_emergency_response(symptoms)

        # Format conversation history
        history_str = ""
        if conversation_history:
            history_str = "\n".join(
                f"{msg['role']}: {msg['content']}"
                for msg in conversation_history[-5:]  # Last 5 messages
            )

        try:
            # Use DSPy module for analysis
            result = await asyncio.to_thread(
                self.triage_module,
                symptoms=symptoms,
                conversation_history=history_str,
            )

            # Parse the response
            urgency = self._validate_urgency(result.urgency)
            possible_conditions = self._parse_conditions(result.possible_conditions)
            recommendations = self._parse_json_list(result.recommendations)
            follow_up_questions = self._parse_json_list(result.follow_up_questions)

            # Safety check: upgrade urgency if we detect concerning patterns
            urgency = self._safety_upgrade_urgency(symptoms, urgency)

            return SymptomAnalysis(
                response=result.response,
                urgency=urgency,
                possible_conditions=possible_conditions,
                recommendations=recommendations,
                seek_care=result.seek_care or urgency in ["emergency", "urgent"],
                care_timeframe=result.care_timeframe if result.seek_care else None,
                follow_up_questions=follow_up_questions,
                confidence=self._calculate_confidence(possible_conditions, urgency),
            )

        except Exception as e:
            self.logger.warning("DSPy analysis failed, using MedGemma", error=str(e))
            return await self._fallback_analysis(symptoms, history_str)

    async def _fallback_analysis(
        self,
        symptoms: str,
        conversation_history: str,
    ) -> SymptomAnalysis:
        """Fallback analysis using MedGemma directly."""
        prompt = f"""Analyze these patient symptoms and provide triage guidance.

Symptoms: {symptoms}

Previous conversation:
{conversation_history}

Provide:
1. An empathetic response
2. Urgency level (emergency/urgent/routine/self-care)
3. Possible conditions to consider
4. Recommendations
5. Whether to seek professional care

IMPORTANT: Be conservative - when in doubt, recommend seeking care.
"""

        try:
            response = await self.medgemma.generate(prompt)

            # Parse MedGemma response (simplified parsing)
            urgency = self._safety_upgrade_urgency(symptoms, "routine")

            return SymptomAnalysis(
                response=response,
                urgency=urgency,
                possible_conditions=[],
                recommendations=[
                    "Monitor your symptoms",
                    "Stay hydrated and rest",
                    "Contact a healthcare provider if symptoms worsen",
                ],
                seek_care=urgency in ["emergency", "urgent"],
                care_timeframe="within 24-48 hours" if urgency == "urgent" else None,
                follow_up_questions=[
                    "How long have you had these symptoms?",
                    "Have you taken any medications?",
                    "Do you have any other symptoms?",
                ],
                confidence=0.5,
            )
        except Exception as e:
            self.logger.error("Fallback analysis failed", error=str(e))
            return self._create_safe_response(symptoms)

    def _check_emergency_keywords(self, symptoms: str) -> UrgencyLevel:
        """Check for emergency keywords in symptoms."""
        symptoms_lower = symptoms.lower()

        for emergency in EMERGENCY_SYMPTOMS:
            if emergency in symptoms_lower:
                return "emergency"

        for urgent in URGENT_SYMPTOMS:
            if urgent in symptoms_lower:
                return "urgent"

        return "routine"

    def _safety_upgrade_urgency(
        self,
        symptoms: str,
        current_urgency: UrgencyLevel,
    ) -> UrgencyLevel:
        """Safety check to upgrade urgency if needed."""
        symptoms_lower = symptoms.lower()

        # Always upgrade to emergency for these
        emergency_patterns = [
            "can't breathe",
            "can not breathe",
            "cannot breathe",
            "crushing chest",
            "severe chest pain",
            "face drooping",
            "arm weakness",
            "speech difficulty",
            "want to die",
            "kill myself",
        ]

        for pattern in emergency_patterns:
            if pattern in symptoms_lower:
                return "emergency"

        # Upgrade to urgent for these
        urgent_patterns = [
            "very high fever",
            "can't keep anything down",
            "severe pain",
            "getting worse",
        ]

        if current_urgency == "self-care":
            for pattern in urgent_patterns:
                if pattern in symptoms_lower:
                    return "routine"

        return current_urgency

    def _validate_urgency(self, urgency: str) -> UrgencyLevel:
        """Validate and normalize urgency level."""
        urgency = urgency.lower().strip()
        if urgency in ["emergency", "urgent", "routine", "self-care"]:
            return urgency
        if "emergency" in urgency:
            return "emergency"
        if "urgent" in urgency:
            return "urgent"
        if "self" in urgency:
            return "self-care"
        return "routine"

    def _parse_conditions(self, conditions_str: str) -> list[PossibleCondition]:
        """Parse conditions from JSON string."""
        import json

        try:
            conditions = json.loads(conditions_str)
            return [
                PossibleCondition(
                    name=c.get("name", "Unknown"),
                    probability=c.get("probability", "low"),
                    description=c.get("description", ""),
                )
                for c in conditions[:5]  # Max 5 conditions
            ]
        except (json.JSONDecodeError, TypeError):
            return []

    def _parse_json_list(self, json_str: str) -> list[str]:
        """Parse a JSON list of strings."""
        import json

        try:
            items = json.loads(json_str)
            if isinstance(items, list):
                return [str(item) for item in items[:10]]
            return []
        except (json.JSONDecodeError, TypeError):
            return []

    def _calculate_confidence(
        self,
        conditions: list[PossibleCondition],
        urgency: UrgencyLevel,
    ) -> float:
        """Calculate confidence in the analysis."""
        # Base confidence
        confidence = 0.6

        # Higher confidence if we identified conditions
        if conditions:
            confidence += 0.1 * min(len(conditions), 3)

        # Lower confidence for emergencies (be conservative)
        if urgency == "emergency":
            confidence = max(0.7, confidence)

        return min(0.95, confidence)

    def _create_emergency_response(self, symptoms: str) -> SymptomAnalysis:
        """Create an emergency response."""
        return SymptomAnalysis(
            response=(
                "Based on the symptoms you've described, this may require immediate "
                "medical attention. Please call 911 or go to the nearest emergency room "
                "right away. If you're unsure, it's always better to err on the side of "
                "caution with these types of symptoms."
            ),
            urgency="emergency",
            possible_conditions=[],
            recommendations=[
                "Call 911 or your local emergency number immediately",
                "If driving yourself, have someone else drive",
                "Do not delay seeking care",
                "Bring a list of your current medications if possible",
            ],
            seek_care=True,
            care_timeframe="immediately",
            follow_up_questions=[],
            confidence=0.95,
        )

    def _create_safe_response(self, symptoms: str) -> SymptomAnalysis:
        """Create a safe fallback response."""
        return SymptomAnalysis(
            response=(
                "I understand you're experiencing some health concerns. While I can "
                "provide general information, I recommend consulting with a healthcare "
                "provider who can properly evaluate your symptoms and medical history. "
                "They can provide personalized advice and appropriate care."
            ),
            urgency="routine",
            possible_conditions=[],
            recommendations=[
                "Consider scheduling an appointment with your primary care provider",
                "Keep track of your symptoms, noting when they started and any patterns",
                "Stay hydrated and get adequate rest",
                "Seek immediate care if symptoms worsen or new concerning symptoms develop",
            ],
            seek_care=True,
            care_timeframe="within a few days",
            follow_up_questions=[
                "Can you describe your symptoms in more detail?",
                "When did these symptoms first start?",
                "Are you currently taking any medications?",
            ],
            confidence=0.3,
        )


# Convenience function for direct use
async def analyze_symptoms(
    symptoms: str,
    conversation_history: list[dict[str, str]] | None = None,
) -> dict[str, Any]:
    """Analyze patient symptoms.

    Args:
        symptoms: Patient's symptom description
        conversation_history: Previous messages for context

    Returns:
        Analysis result as dictionary
    """
    agent = SymptomCheckerAgent()
    analysis = await agent.analyze_symptoms(
        symptoms=symptoms,
        conversation_history=conversation_history,
    )
    return analysis.to_dict()
