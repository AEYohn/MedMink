"""Discharge Planning Assistant powered by MedGemma.

Generates patient-readable discharge instructions, medication reconciliation,
follow-up timelines, return-to-ED red flags, and readmission risk assessment.
"""

from dataclasses import dataclass, field
from typing import Any

import structlog

from src.medgemma.client import get_medgemma_client

logger = structlog.get_logger()

DISCHARGE_PLAN_PROMPT = """Generate a comprehensive discharge plan for this patient.

PATIENT:
- Age: {age}, Sex: {sex}
- Conditions: {conditions}
- Presentation: {presentation}
- Disposition: {disposition}

CURRENT MEDICATIONS: {current_meds}
RECOMMENDED TREATMENTS: {recommended_treatments}
TOP RECOMMENDATION: {top_recommendation}

ACUTE MANAGEMENT SUMMARY:
- Immediate Actions Taken: {immediate_actions}
- Monitoring Plan: {monitoring}
- Activity Restrictions: {activity_restrictions}
- Key Counseling Points: {key_counseling}

Generate a discharge plan with these sections:

1. PATIENT INSTRUCTIONS: Written at a 6th-grade reading level. Simple, clear language. Explain the diagnosis, what was done, and what the patient needs to do at home.

2. MEDICATION RECONCILIATION: For each medication, specify action (continue/stop/new/dose_change) with clear instructions.

3. FOLLOW-UP TIMELINE: When to see which provider and why.

4. RED FLAGS: Specific symptoms that should prompt an immediate return to the ED.

5. RESTRICTIONS: Activity, dietary, or other restrictions.

6. READMISSION RISK: Assess risk level based on patient factors.

Return JSON:
{{
    "patient_instructions": "Clear, simple paragraph(s) explaining the diagnosis and home care plan. Use short sentences. Avoid medical jargon.",
    "medication_reconciliation": [
        {{
            "medication": "drug name and dose",
            "action": "continue|stop|new|dose_change",
            "instructions": "specific instructions (when to take, with/without food, etc.)",
            "reason": "brief reason for this action"
        }}
    ],
    "follow_up": [
        {{
            "timeframe": "e.g., '2-3 days', '1 week', '1 month'",
            "provider": "specialty or PCP",
            "reason": "why this follow-up is needed"
        }}
    ],
    "red_flags": ["specific symptom or sign that requires immediate ED return"],
    "restrictions": [
        {{
            "type": "activity|dietary|other",
            "restriction": "specific restriction",
            "duration": "how long",
            "reason": "why"
        }}
    ],
    "readmission_risk": {{
        "level": "high|moderate|low",
        "factors": ["risk factors present"],
        "mitigation": ["steps to reduce readmission risk"]
    }}
}}

Output ONLY the JSON object. No preamble, no explanation. Start with {{ and end with }}."""


@dataclass
class DischargePlan:
    """Complete discharge plan."""
    patient_instructions: str = ""
    medication_reconciliation: list[dict[str, Any]] = field(default_factory=list)
    follow_up: list[dict[str, Any]] = field(default_factory=list)
    red_flags: list[str] = field(default_factory=list)
    restrictions: list[dict[str, Any]] = field(default_factory=list)
    readmission_risk: dict[str, Any] = field(default_factory=dict)


async def generate_discharge_plan(
    parsed_case: dict[str, Any],
    treatment_options: list[dict[str, Any]],
    acute_management: dict[str, Any],
    top_recommendation: str = "",
) -> DischargePlan:
    """Generate a discharge plan for a clinical case.

    Args:
        parsed_case: Parsed case data dict
        treatment_options: List of treatment option dicts
        acute_management: Acute management plan dict
        top_recommendation: Name of the top recommended treatment

    Returns:
        DischargePlan with all discharge components
    """
    medgemma = get_medgemma_client()

    patient = parsed_case.get("patient", {})
    findings = parsed_case.get("findings", {})
    management = parsed_case.get("management", {})

    recommended = [t for t in treatment_options if t.get("verdict") == "recommended"]
    rec_names = ", ".join(t.get("name", "") for t in recommended) or "See treatment plan"

    prompt = DISCHARGE_PLAN_PROMPT.format(
        age=patient.get("age", "unknown"),
        sex=patient.get("sex", "unknown"),
        conditions=", ".join(patient.get("relevant_history", [])) or "See case",
        presentation=findings.get("presentation", ""),
        disposition=acute_management.get("disposition", "Discharge"),
        current_meds=", ".join(management.get("medications", [])) or "None",
        recommended_treatments=rec_names,
        top_recommendation=top_recommendation or "See treatment plan",
        immediate_actions=", ".join(acute_management.get("immediate_actions", [])) or "Supportive care",
        monitoring=", ".join(acute_management.get("monitoring_plan", [])) or "Standard",
        activity_restrictions=acute_management.get("activity_restrictions", "None specified"),
        key_counseling=", ".join(acute_management.get("key_counseling", [])) or "Standard discharge counseling",
    )

    try:
        response = await medgemma.generate(
            prompt=prompt,
            temperature=0.3,
            max_tokens=3000,
        )

        data = medgemma._parse_json_response(response)

        return DischargePlan(
            patient_instructions=data.get("patient_instructions", ""),
            medication_reconciliation=data.get("medication_reconciliation", []),
            follow_up=data.get("follow_up", []),
            red_flags=data.get("red_flags", []),
            restrictions=data.get("restrictions", []),
            readmission_risk=data.get("readmission_risk", {}),
        )

    except Exception as e:
        logger.error("Discharge plan generation failed", error=str(e))
        return DischargePlan(
            patient_instructions=f"Unable to generate discharge instructions: {str(e)[:100]}. Please consult with attending physician.",
        )


def discharge_plan_to_dict(plan: DischargePlan) -> dict[str, Any]:
    """Convert DischargePlan to JSON-serializable dict."""
    return {
        "patient_instructions": plan.patient_instructions,
        "medication_reconciliation": plan.medication_reconciliation,
        "follow_up": plan.follow_up,
        "red_flags": plan.red_flags,
        "restrictions": plan.restrictions,
        "readmission_risk": plan.readmission_risk,
    }
