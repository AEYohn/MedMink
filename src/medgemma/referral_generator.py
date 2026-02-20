"""Smart Referral & Handoff Note Generator powered by MedGemma.

Generates specialty-filtered referral notes and structured handoff notes
in I-PASS or SBAR format.
"""

from dataclasses import dataclass, field
from typing import Any

import structlog

from src.medgemma.client import get_medgemma_client

logger = structlog.get_logger()

REFERRAL_NOTE_PROMPT = """Generate a focused referral note for {specialty} consultation.

PATIENT:
- Age: {age}, Sex: {sex}
- Relevant History: {history}
- Presentation: {presentation}
- Timeline: {timeline}
- Physical Exam: {physical_exam}
- Labs: {labs}
- Imaging: {imaging}
- Current Medications: {medications}
- Current Management: {current_management}

TOP RECOMMENDATION: {top_recommendation}
ACUTE MANAGEMENT: {acute_summary}

Generate a referral note that:
1. Formulates a SPECIFIC clinical question for the specialist
2. Filters history to include ONLY information relevant to {specialty}
3. Highlights findings the specialist needs to know
4. States what has already been done and what is being asked

Return JSON:
{{
    "urgency": "emergent|urgent|routine",
    "clinical_question": "The specific question for the specialist",
    "relevant_history": "Filtered patient history relevant to this specialty",
    "pertinent_findings": ["Key findings the specialist needs"],
    "current_management": "What has been started/done so far",
    "specific_asks": ["Specific things requested from the specialist"],
    "reason_for_urgency": "Why this level of urgency (if urgent/emergent)"
}}

Output ONLY the JSON object. No preamble, no explanation. Start with {{ and end with }}."""


HANDOFF_IPASS_PROMPT = """Generate a structured I-PASS handoff note for this patient.

PATIENT:
- Age: {age}, Sex: {sex}
- Presentation: {presentation}
- Relevant History: {history}
- Current Medications: {medications}

CLINICAL STATUS:
- Acute Management: {acute_summary}
- Treatments: {treatments}
- Disposition: {disposition}
- Monitoring: {monitoring}

PENDING TASKS: {pending_tasks}

Generate I-PASS format:
- I = Illness severity (stable, watcher, unstable)
- P = Patient summary (one-liner)
- A = Action list (what needs to be done)
- S = Situation awareness & contingency (what to watch for, if-then plans)
- S = Synthesis by receiver (key questions for the receiving team)

Return JSON:
{{
    "illness_severity": "stable|watcher|unstable",
    "patient_summary": "One-sentence summary of the patient",
    "action_list": ["Pending actions and tasks"],
    "situation_awareness": [
        {{
            "watch_for": "what to monitor",
            "if_then": "contingency plan"
        }}
    ],
    "synthesis_questions": ["Questions the receiving team should consider"]
}}

Output ONLY the JSON object. No preamble, no explanation. Start with {{ and end with }}."""


HANDOFF_SBAR_PROMPT = """Generate a structured SBAR handoff note for this patient.

PATIENT:
- Age: {age}, Sex: {sex}
- Presentation: {presentation}
- Relevant History: {history}
- Current Medications: {medications}

CLINICAL STATUS:
- Acute Management: {acute_summary}
- Treatments: {treatments}
- Disposition: {disposition}
- Monitoring: {monitoring}

PENDING TASKS: {pending_tasks}

Generate SBAR format:
- S = Situation (why you're calling/handing off)
- B = Background (relevant history)
- A = Assessment (current clinical status and concerns)
- R = Recommendation (what needs to happen next)

Return JSON:
{{
    "situation": "Brief statement of the current situation and reason for handoff",
    "background": "Relevant patient history and hospital course",
    "assessment": "Current clinical status, concerns, and active problems",
    "recommendation": ["Specific recommendations and pending actions"]
}}

Output ONLY the JSON object. No preamble, no explanation. Start with {{ and end with }}."""


@dataclass
class ReferralNote:
    """Structured referral note."""

    specialty: str = ""
    urgency: str = "routine"  # emergent, urgent, routine
    clinical_question: str = ""
    relevant_history: str = ""
    pertinent_findings: list[str] = field(default_factory=list)
    current_management: str = ""
    specific_asks: list[str] = field(default_factory=list)
    reason_for_urgency: str = ""


@dataclass
class HandoffNote:
    """Structured handoff note (I-PASS or SBAR)."""

    format: str = "ipass"  # ipass or sbar
    content: dict[str, Any] = field(default_factory=dict)


async def generate_referral_note(
    specialty: str,
    parsed_case: dict[str, Any],
    treatment_options: list[dict[str, Any]],
    acute_management: dict[str, Any],
) -> ReferralNote:
    """Generate a specialty-specific referral note.

    Args:
        specialty: Target specialty for referral
        parsed_case: Parsed case data dict
        treatment_options: List of treatment option dicts
        acute_management: Acute management plan dict

    Returns:
        ReferralNote with filtered, focused content
    """
    medgemma = get_medgemma_client()

    patient = parsed_case.get("patient", {})
    findings = parsed_case.get("findings", {})
    management = parsed_case.get("management", {})

    recommended = [t for t in treatment_options if t.get("verdict") == "recommended"]
    top_rec = recommended[0].get("name", "") if recommended else "See treatment plan"

    acute_bits = []
    if acute_management.get("disposition"):
        acute_bits.append(f"Disposition: {acute_management['disposition']}")
    if acute_management.get("immediate_actions"):
        acute_bits.append(f"Actions: {', '.join(acute_management['immediate_actions'][:3])}")
    acute_summary = "; ".join(acute_bits) or "See management plan"

    prompt = REFERRAL_NOTE_PROMPT.format(
        specialty=specialty,
        age=patient.get("age", "unknown"),
        sex=patient.get("sex", "unknown"),
        history=", ".join(patient.get("relevant_history", [])) or "None",
        presentation=findings.get("presentation", ""),
        timeline=findings.get("timeline", ""),
        physical_exam=", ".join(findings.get("physical_exam", [])[:6]) or "Not documented",
        labs=", ".join(findings.get("labs", [])[:8]) or "None",
        imaging=", ".join(findings.get("imaging", [])[:5]) or "None",
        medications=", ".join(management.get("medications", [])) or "None",
        current_management=", ".join(t.get("name", "") for t in recommended[:5]) or "See plan",
        top_recommendation=top_rec,
        acute_summary=acute_summary,
    )

    try:
        response = await medgemma.generate(
            prompt=prompt,
            temperature=0.3,
            max_tokens=2000,
        )

        data = medgemma._parse_json_response(response)

        return ReferralNote(
            specialty=specialty,
            urgency=data.get("urgency", "routine"),
            clinical_question=data.get("clinical_question", ""),
            relevant_history=data.get("relevant_history", ""),
            pertinent_findings=data.get("pertinent_findings", []),
            current_management=data.get("current_management", ""),
            specific_asks=data.get("specific_asks", []),
            reason_for_urgency=data.get("reason_for_urgency", ""),
        )

    except Exception as e:
        logger.error("Referral note generation failed", error=str(e))
        return ReferralNote(
            specialty=specialty,
            clinical_question=f"Unable to generate referral note: {str(e)[:100]}",
        )


async def generate_handoff_note(
    format: str,
    parsed_case: dict[str, Any],
    treatment_options: list[dict[str, Any]],
    acute_management: dict[str, Any],
    pending_tasks: list[str] | None = None,
) -> HandoffNote:
    """Generate a structured handoff note in I-PASS or SBAR format.

    Args:
        format: "ipass" or "sbar"
        parsed_case: Parsed case data dict
        treatment_options: List of treatment option dicts
        acute_management: Acute management plan dict
        pending_tasks: Optional list of pending tasks

    Returns:
        HandoffNote with structured content
    """
    medgemma = get_medgemma_client()

    patient = parsed_case.get("patient", {})
    findings = parsed_case.get("findings", {})
    management = parsed_case.get("management", {})

    treatments_str = ", ".join(
        f"{t.get('name', '')} ({t.get('verdict', '')})" for t in treatment_options[:6]
    )

    acute_bits = []
    if acute_management.get("immediate_actions"):
        acute_bits.append(f"Actions: {', '.join(acute_management['immediate_actions'][:4])}")
    if acute_management.get("do_not_do"):
        acute_bits.append(f"Avoid: {', '.join(acute_management['do_not_do'][:3])}")
    acute_summary = "; ".join(acute_bits) or "See management plan"

    template_args = {
        "age": patient.get("age", "unknown"),
        "sex": patient.get("sex", "unknown"),
        "presentation": findings.get("presentation", ""),
        "history": ", ".join(patient.get("relevant_history", [])) or "None",
        "medications": ", ".join(management.get("medications", [])) or "None",
        "acute_summary": acute_summary,
        "treatments": treatments_str or "See plan",
        "disposition": acute_management.get("disposition", "Pending"),
        "monitoring": ", ".join(acute_management.get("monitoring_plan", [])[:4]) or "Standard",
        "pending_tasks": ", ".join(pending_tasks) if pending_tasks else "None specified",
    }

    if format == "sbar":
        prompt = HANDOFF_SBAR_PROMPT.format(**template_args)
    else:
        prompt = HANDOFF_IPASS_PROMPT.format(**template_args)

    try:
        response = await medgemma.generate(
            prompt=prompt,
            temperature=0.2,
            max_tokens=1500,
        )

        data = medgemma._parse_json_response(response)

        return HandoffNote(format=format, content=data)

    except Exception as e:
        logger.error("Handoff note generation failed", error=str(e), format=format)
        return HandoffNote(
            format=format,
            content={"error": f"Unable to generate handoff note: {str(e)[:100]}"},
        )


def referral_note_to_dict(note: ReferralNote) -> dict[str, Any]:
    """Convert ReferralNote to JSON-serializable dict."""
    return {
        "specialty": note.specialty,
        "urgency": note.urgency,
        "clinical_question": note.clinical_question,
        "relevant_history": note.relevant_history,
        "pertinent_findings": note.pertinent_findings,
        "current_management": note.current_management,
        "specific_asks": note.specific_asks,
        "reason_for_urgency": note.reason_for_urgency,
    }


def handoff_note_to_dict(note: HandoffNote) -> dict[str, Any]:
    """Convert HandoffNote to JSON-serializable dict."""
    return {
        "format": note.format,
        "content": note.content,
    }
