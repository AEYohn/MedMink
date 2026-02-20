"""Differential Diagnosis Engine powered by MedGemma.

Generates ranked differential diagnoses with Bayesian-style reasoning,
supporting/refuting findings, and must-rule-out flags.
"""

from dataclasses import dataclass, field
from typing import Any

import structlog

from src.medgemma.client import get_medgemma_client

logger = structlog.get_logger()

DDX_PROMPT = """Generate a differential diagnosis for this clinical case using Bayesian reasoning.

CLINICAL CASE:
- Patient: {age} {sex}
- History: {history}
- Presentation: {presentation}
- Timeline: {timeline}
- Physical Exam: {physical_exam}
- Vitals: {vitals}
- Labs: {labs}
- Imaging: {imaging}
- Precipitating Factors: {precipitating_factors}
- Context of Onset: {context_of_onset}
- Associated Symptoms: {associated_symptoms}
- Current Medications: {medications}
- Clinical Question: {clinical_question}

Generate 5-8 differential diagnoses ranked by likelihood. For each:
1. Estimate likelihood based on the findings (high/moderate/low)
2. List findings that SUPPORT this diagnosis
3. List findings that ARGUE AGAINST this diagnosis
4. Flag diagnoses that MUST BE RULED OUT (life-threatening or time-sensitive)
5. Suggest the key distinguishing test or finding

Return JSON:
{{
    "clinical_reasoning_summary": "2-3 sentence summary of the clinical reasoning approach",
    "key_distinguishing_tests": ["tests that would most help differentiate between top diagnoses"],
    "diagnoses": [
        {{
            "diagnosis": "diagnosis name",
            "likelihood": "high|moderate|low",
            "must_rule_out": true/false,
            "supporting_findings": ["findings from the case that support this"],
            "refuting_findings": ["findings from the case that argue against this"],
            "diagnostic_pathway": ["ordered steps to confirm or exclude this diagnosis"],
            "distinguishing_feature": "the single most helpful differentiating finding or test"
        }}
    ]
}}

RULES:
- Rank by likelihood (highest first), but list must-rule-out diagnoses prominently even if low likelihood
- Be specific about which case findings support or refute each diagnosis
- Include at least one "must_rule_out" diagnosis if any life-threatening condition is in the differential
- Diagnostic pathways should be actionable and specific
- Output ONLY the JSON object. No preamble, no explanation. Start with {{ and end with }}."""


@dataclass
class DDxDiagnosis:
    """A single differential diagnosis entry."""

    diagnosis: str = ""
    likelihood: str = "low"  # high, moderate, low
    must_rule_out: bool = False
    supporting_findings: list[str] = field(default_factory=list)
    refuting_findings: list[str] = field(default_factory=list)
    diagnostic_pathway: list[str] = field(default_factory=list)
    distinguishing_feature: str = ""


@dataclass
class DDxResult:
    """Complete differential diagnosis result."""

    clinical_reasoning_summary: str = ""
    key_distinguishing_tests: list[str] = field(default_factory=list)
    diagnoses: list[DDxDiagnosis] = field(default_factory=list)


async def generate_differential_diagnosis(
    parsed_case: dict[str, Any],
    case_text: str,
) -> DDxResult:
    """Generate a differential diagnosis for a clinical case.

    Args:
        parsed_case: Parsed case data dict (patient, findings, management, etc.)
        case_text: Original clinical vignette text

    Returns:
        DDxResult with ranked diagnoses
    """
    medgemma = get_medgemma_client()

    patient = parsed_case.get("patient", {})
    findings = parsed_case.get("findings", {})
    management = parsed_case.get("management", {})

    prompt = DDX_PROMPT.format(
        age=patient.get("age", "unknown"),
        sex=patient.get("sex", "unknown"),
        history=", ".join(patient.get("relevant_history", [])[:8]) or "None provided",
        presentation=findings.get("presentation", "Not specified"),
        timeline=findings.get("timeline", "Not specified"),
        physical_exam=", ".join(findings.get("physical_exam", [])[:6]) or "Not documented",
        vitals=", ".join(findings.get("vitals", [])[:5]) or "Not documented",
        labs=", ".join(findings.get("labs", [])[:8]) or "None",
        imaging=", ".join(findings.get("imaging", [])[:5]) or "None",
        precipitating_factors=findings.get("precipitating_factors", "None identified"),
        context_of_onset=findings.get("context_of_onset", "Not specified"),
        associated_symptoms=", ".join(findings.get("associated_symptoms", [])) or "None",
        medications=", ".join(management.get("medications", [])) or "None",
        clinical_question=parsed_case.get("clinical_question", ""),
    )

    try:
        response = await medgemma.generate(
            prompt=prompt,
            temperature=0.3,
            max_tokens=3000,
        )

        data = medgemma._parse_json_response(response)

        diagnoses = []
        for dx in data.get("diagnoses", []):
            diagnoses.append(
                DDxDiagnosis(
                    diagnosis=dx.get("diagnosis", ""),
                    likelihood=dx.get("likelihood", "low"),
                    must_rule_out=dx.get("must_rule_out", False),
                    supporting_findings=dx.get("supporting_findings", []),
                    refuting_findings=dx.get("refuting_findings", []),
                    diagnostic_pathway=dx.get("diagnostic_pathway", []),
                    distinguishing_feature=dx.get("distinguishing_feature", ""),
                )
            )

        return DDxResult(
            clinical_reasoning_summary=data.get("clinical_reasoning_summary", ""),
            key_distinguishing_tests=data.get("key_distinguishing_tests", []),
            diagnoses=diagnoses,
        )

    except Exception as e:
        logger.error("Differential diagnosis generation failed", error=str(e))
        return DDxResult(
            clinical_reasoning_summary=f"Unable to generate differential diagnosis: {str(e)[:100]}",
        )


def ddx_result_to_dict(result: DDxResult) -> dict[str, Any]:
    """Convert DDxResult to JSON-serializable dict."""
    return {
        "clinical_reasoning_summary": result.clinical_reasoning_summary,
        "key_distinguishing_tests": result.key_distinguishing_tests,
        "diagnoses": [
            {
                "diagnosis": dx.diagnosis,
                "likelihood": dx.likelihood,
                "must_rule_out": dx.must_rule_out,
                "supporting_findings": dx.supporting_findings,
                "refuting_findings": dx.refuting_findings,
                "diagnostic_pathway": dx.diagnostic_pathway,
                "distinguishing_feature": dx.distinguishing_feature,
            }
            for dx in result.diagnoses
        ],
    }
