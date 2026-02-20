"""Management Reasoning Agent — AMIE-style clinical plan builder.

Runs in parallel with the Dialogue Agent during patient interviews.
Takes accumulated interview data and produces a structured management plan
(differential, investigations, treatment plan, monitoring).

Updates incrementally as the Dialogue Agent feeds new information.
Uses MedGemma 27B with a clinical guideline system prompt.
"""

import json
from dataclasses import dataclass, field
from typing import Any

import structlog

from src.medgemma.client import get_medgemma_client

logger = structlog.get_logger()

MANAGEMENT_SYSTEM_PROMPT = """You are a senior attending physician building a clinical management plan during a patient encounter.

Your role is to synthesize information gathered so far and produce a structured plan.
Update the plan incrementally as new information arrives.

Be evidence-based, thorough, and actionable. Flag knowledge gaps."""

MANAGEMENT_PLAN_PROMPT = """Based on the following interview data collected so far, generate a comprehensive management plan.

INTERVIEW PHASE: {phase}
EXTRACTED DATA:
{extracted_data}

CONVERSATION SUMMARY:
{conversation_summary}

RED FLAGS IDENTIFIED: {red_flags}

Generate a management plan as JSON:
{{
    "differential_diagnosis": [
        {{
            "diagnosis": "name",
            "likelihood": "high|moderate|low",
            "key_findings_for": ["supporting finding 1"],
            "key_findings_against": ["against finding 1"]
        }}
    ],
    "recommended_investigations": [
        {{
            "test": "test name",
            "urgency": "stat|routine|if_available",
            "rationale": "why this test"
        }}
    ],
    "treatment_plan": {{
        "immediate": ["action 1", "action 2"],
        "short_term": ["action 1"],
        "monitoring": ["what to monitor"]
    }},
    "disposition": {{
        "recommendation": "admit|observe|discharge",
        "level_of_care": "ICU|telemetry|floor|outpatient",
        "rationale": "why this disposition"
    }},
    "knowledge_gaps": ["what information is still needed"],
    "plan_confidence": 0.0-1.0,
    "plan_completeness": "preliminary|partial|comprehensive"
}}

Output ONLY the JSON. No preamble."""


@dataclass
class ManagementPlan:
    """Structured management plan built by the Management Reasoning Agent."""

    differential_diagnosis: list[dict[str, Any]] = field(default_factory=list)
    recommended_investigations: list[dict[str, Any]] = field(default_factory=list)
    treatment_plan: dict[str, Any] = field(default_factory=dict)
    disposition: dict[str, Any] = field(default_factory=dict)
    knowledge_gaps: list[str] = field(default_factory=list)
    plan_confidence: float = 0.0
    plan_completeness: str = "preliminary"
    last_updated_phase: str = ""


class ManagementReasoningAgent:
    """AMIE-inspired Management Reasoning Agent.

    Builds and maintains a clinical management plan that updates
    incrementally as the interview progresses.
    """

    def __init__(self):
        self._client = get_medgemma_client()
        self._plans: dict[str, ManagementPlan] = {}  # session_id → plan

    async def update_plan(self, session) -> ManagementPlan:
        """Update the management plan based on current interview state.

        Args:
            session: InterviewSession with conversation history and extracted data

        Returns:
            Updated ManagementPlan
        """
        session_id = session.session_id

        # Get or create plan for this session
        plan = self._plans.get(session_id, ManagementPlan())

        # Skip if no new data since last update
        if plan.last_updated_phase == session.phase and plan.plan_completeness != "preliminary":
            return plan

        # Summarize conversation (last 6 messages)
        conv_summary = ""
        for msg in session.conversation_history[-6:]:
            role = "Nurse" if msg["role"] == "assistant" else "Patient"
            content = msg["content"][:200]
            conv_summary += f"{role}: {content}\n"

        prompt = MANAGEMENT_PLAN_PROMPT.format(
            phase=session.phase,
            extracted_data=json.dumps(session.extracted_data, indent=2)[:2000],
            conversation_summary=conv_summary,
            red_flags=", ".join(session.red_flags) if session.red_flags else "None identified",
        )

        try:
            response = await self._client.generate(
                prompt=prompt,
                system_prompt=MANAGEMENT_SYSTEM_PROMPT,
                temperature=0.3,
                max_tokens=2048,
            )

            data = self._client._parse_json_response(response)

            plan.differential_diagnosis = data.get(
                "differential_diagnosis", plan.differential_diagnosis
            )
            plan.recommended_investigations = data.get(
                "recommended_investigations", plan.recommended_investigations
            )
            plan.treatment_plan = data.get("treatment_plan", plan.treatment_plan)
            plan.disposition = data.get("disposition", plan.disposition)
            plan.knowledge_gaps = data.get("knowledge_gaps", plan.knowledge_gaps)
            plan.plan_confidence = data.get("plan_confidence", plan.plan_confidence)
            plan.plan_completeness = data.get("plan_completeness", plan.plan_completeness)
            plan.last_updated_phase = session.phase

            self._plans[session_id] = plan

            logger.info(
                "Management plan updated",
                session_id=session_id,
                phase=session.phase,
                ddx_count=len(plan.differential_diagnosis),
                confidence=plan.plan_confidence,
            )

        except Exception as e:
            logger.error("Management plan update failed", error=str(e), session_id=session_id)

        return plan

    async def get_management_plan(self, session) -> dict[str, Any]:
        """Get the current management plan for a session as a dict."""
        plan = await self.update_plan(session)

        return {
            "differential_diagnosis": plan.differential_diagnosis,
            "recommended_investigations": plan.recommended_investigations,
            "treatment_plan": plan.treatment_plan,
            "disposition": plan.disposition,
            "knowledge_gaps": plan.knowledge_gaps,
            "plan_confidence": plan.plan_confidence,
            "plan_completeness": plan.plan_completeness,
            "last_updated_phase": plan.last_updated_phase,
        }

    def clear_plan(self, session_id: str):
        """Clear the management plan for a session."""
        self._plans.pop(session_id, None)


# Singleton
_management_agent: ManagementReasoningAgent | None = None


def get_management_agent() -> ManagementReasoningAgent:
    global _management_agent
    if _management_agent is None:
        _management_agent = ManagementReasoningAgent()
    return _management_agent
