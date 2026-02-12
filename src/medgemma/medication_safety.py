"""Medication Safety Verification powered by hybrid deterministic + MedGemma approach.

Checks for drug-drug interactions, drug-disease conflicts, dosing concerns,
allergy cross-reactivity, and provides overall safety assessment.
"""

import json
from dataclasses import dataclass, field
from typing import Any

import structlog

from src.medgemma.client import get_medgemma_client

logger = structlog.get_logger()

# Import known interaction data from existing medication manager
from src.agents.medication_manager import KNOWN_MAJOR_INTERACTIONS, DRUG_CLASSES


def _classify_drug(drug_name: str) -> str | None:
    """Map a drug name to its drug class using DRUG_CLASSES dict."""
    drug_lower = drug_name.lower().strip()
    # Strip dosage info (e.g., "aspirin 325mg" → "aspirin")
    drug_base = drug_lower.split()[0] if drug_lower else drug_lower
    for drug_class, members in DRUG_CLASSES.items():
        if drug_base in members or drug_lower in members:
            return drug_class
    return None


def _check_deterministic_interactions(
    all_meds: list[str],
) -> list[dict[str, Any]]:
    """Check for known major interactions using the deterministic database."""
    interactions = []
    classified = [(med, _classify_drug(med)) for med in all_meds]

    for i, (med_a, class_a) in enumerate(classified):
        for j, (med_b, class_b) in enumerate(classified):
            if j <= i:
                continue
            # Check both drug names and classes against known interactions
            pairs_to_check = []
            med_a_base = med_a.lower().split()[0]
            med_b_base = med_b.lower().split()[0]
            pairs_to_check.append((med_a_base, med_b_base))
            if class_a:
                pairs_to_check.append((class_a, med_b_base))
            if class_b:
                pairs_to_check.append((med_a_base, class_b))
            if class_a and class_b:
                pairs_to_check.append((class_a, class_b))

            for pair in pairs_to_check:
                match = KNOWN_MAJOR_INTERACTIONS.get(pair) or KNOWN_MAJOR_INTERACTIONS.get((pair[1], pair[0]))
                if match:
                    interactions.append({
                        "drug_a": med_a,
                        "drug_b": med_b,
                        "severity": "major",
                        "mechanism": match["description"],
                        "clinical_effect": match["description"],
                        "recommendation": match["recommendation"],
                        "alternatives": [],
                        "source": "deterministic",
                    })
                    break  # Only report once per pair

    return interactions


SAFETY_CHECK_PROMPT = """You are a clinical pharmacist performing a comprehensive medication safety review.

PATIENT CONTEXT:
- Age: {age}, Sex: {sex}
- Conditions: {conditions}
- Allergies: {allergies}
- Relevant labs: {labs}

CURRENT MEDICATIONS: {current_meds}
NEW/PROPOSED MEDICATIONS: {new_meds}

KNOWN INTERACTIONS ALREADY IDENTIFIED:
{known_interactions}

Perform additional safety checks NOT covered by the known interactions above:

1. DRUG-DISEASE INTERACTIONS: Any medication contraindicated by the patient's conditions?
2. DOSING CONCERNS: Any dose too high/low for age, renal function, or hepatic function?
3. ALLERGY CROSS-REACTIVITY: Any new med cross-reactive with known allergies?
4. DUPLICATE THERAPY: Any therapeutic duplication?
5. ADDITIONAL DRUG-DRUG INTERACTIONS not already listed above

Return JSON:
{{
    "additional_interactions": [
        {{
            "drug_a": "medication name",
            "drug_b": "medication name or condition",
            "severity": "major|moderate|minor",
            "mechanism": "brief mechanism",
            "clinical_effect": "what could happen",
            "recommendation": "what to do",
            "alternatives": ["alternative medications if applicable"]
        }}
    ],
    "drug_disease_conflicts": [
        {{
            "drug": "medication name",
            "condition": "patient condition",
            "severity": "major|moderate|minor",
            "risk": "what could happen",
            "recommendation": "what to do"
        }}
    ],
    "dosing_concerns": [
        {{
            "drug": "medication name",
            "concern": "what the concern is",
            "recommendation": "dose adjustment or monitoring needed"
        }}
    ],
    "allergy_alerts": [
        {{
            "drug": "medication name",
            "allergy": "known allergy",
            "cross_reactivity_risk": "high|moderate|low",
            "recommendation": "what to do"
        }}
    ],
    "overall_safety": "safe|caution|unsafe",
    "summary": "1-2 sentence overall safety assessment"
}}

Output ONLY the JSON object. No preamble, no explanation. Start with {{ and end with }}."""


@dataclass
class MedicationSafetyResult:
    """Complete medication safety check result."""
    interactions: list[dict[str, Any]] = field(default_factory=list)
    drug_disease_conflicts: list[dict[str, Any]] = field(default_factory=list)
    dosing_concerns: list[dict[str, Any]] = field(default_factory=list)
    allergy_alerts: list[dict[str, Any]] = field(default_factory=list)
    overall_safety: str = "safe"  # safe, caution, unsafe
    summary: str = ""


async def check_medication_safety(
    current_medications: list[str],
    new_medications: list[str],
    patient_conditions: list[str],
    allergies: list[str],
    labs: list[str],
    age: str = "",
    sex: str = "",
) -> MedicationSafetyResult:
    """Check medication safety using hybrid deterministic + MedGemma approach.

    Args:
        current_medications: Patient's current medication list
        new_medications: Newly proposed medications
        patient_conditions: Patient's medical conditions
        allergies: Known drug allergies
        labs: Relevant lab values
        age: Patient age
        sex: Patient sex

    Returns:
        MedicationSafetyResult with all safety findings
    """
    # Step 1: Fast deterministic check for known major interactions
    all_meds = current_medications + new_medications
    deterministic_interactions = _check_deterministic_interactions(all_meds)

    # Step 2: MedGemma clinical reasoning for deeper analysis
    medgemma = get_medgemma_client()

    known_str = "None identified" if not deterministic_interactions else json.dumps(
        [{"drugs": f"{i['drug_a']} + {i['drug_b']}", "effect": i['clinical_effect']}
         for i in deterministic_interactions],
        indent=2,
    )

    prompt = SAFETY_CHECK_PROMPT.format(
        age=age or "unknown",
        sex=sex or "unknown",
        conditions=", ".join(patient_conditions) or "None listed",
        allergies=", ".join(allergies) or "NKDA",
        labs=", ".join(labs[:10]) or "None available",
        current_meds=", ".join(current_medications) or "None",
        new_meds=", ".join(new_medications) or "None",
        known_interactions=known_str,
    )

    try:
        response = await medgemma.generate(
            prompt=prompt,
            temperature=0.2,
            max_tokens=2000,
        )

        data = medgemma._parse_json_response(response)

        # Merge deterministic + AI-found interactions
        all_interactions = list(deterministic_interactions)
        for interaction in data.get("additional_interactions", []):
            interaction["source"] = "medgemma"
            all_interactions.append(interaction)

        # Determine overall safety from combined findings
        overall = data.get("overall_safety", "safe")
        if any(i.get("severity") == "major" for i in all_interactions):
            overall = "unsafe"
        elif any(i.get("severity") == "moderate" for i in all_interactions) and overall == "safe":
            overall = "caution"

        return MedicationSafetyResult(
            interactions=all_interactions,
            drug_disease_conflicts=data.get("drug_disease_conflicts", []),
            dosing_concerns=data.get("dosing_concerns", []),
            allergy_alerts=data.get("allergy_alerts", []),
            overall_safety=overall,
            summary=data.get("summary", ""),
        )

    except Exception as e:
        logger.error("Medication safety check failed", error=str(e))
        # Still return deterministic results even if MedGemma fails
        overall = "unsafe" if deterministic_interactions else "safe"
        return MedicationSafetyResult(
            interactions=deterministic_interactions,
            overall_safety=overall,
            summary=f"AI analysis unavailable ({str(e)[:60]}). Showing deterministic interaction checks only.",
        )


def safety_result_to_dict(result: MedicationSafetyResult) -> dict[str, Any]:
    """Convert MedicationSafetyResult to JSON-serializable dict."""
    return {
        "interactions": result.interactions,
        "drug_disease_conflicts": result.drug_disease_conflicts,
        "dosing_concerns": result.dosing_concerns,
        "allergy_alerts": result.allergy_alerts,
        "overall_safety": result.overall_safety,
        "summary": result.summary,
    }
