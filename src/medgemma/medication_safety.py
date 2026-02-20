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

# Static interaction data — kept here to avoid importing the dspy-dependent
# medication_manager module in lightweight deployments (e.g., Modal).
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

DRUG_CLASSES = {
    "ssri": [
        "sertraline",
        "fluoxetine",
        "paroxetine",
        "citalopram",
        "escitalopram",
        "prozac",
        "zoloft",
        "paxil",
        "lexapro",
    ],
    "maoi": ["phenelzine", "tranylcypromine", "selegiline", "isocarboxazid", "nardil", "parnate"],
    "statin": [
        "atorvastatin",
        "simvastatin",
        "rosuvastatin",
        "pravastatin",
        "lovastatin",
        "lipitor",
        "crestor",
        "zocor",
    ],
    "ace inhibitor": [
        "lisinopril",
        "enalapril",
        "ramipril",
        "benazepril",
        "captopril",
        "prinivil",
        "vasotec",
    ],
    "blood thinner": ["warfarin", "coumadin", "eliquis", "xarelto", "apixaban", "rivaroxaban"],
    "nsaid": ["ibuprofen", "naproxen", "aspirin", "advil", "motrin", "aleve"],
    "opioid": [
        "hydrocodone",
        "oxycodone",
        "morphine",
        "codeine",
        "tramadol",
        "vicodin",
        "percocet",
    ],
    "benzodiazepine": [
        "alprazolam",
        "lorazepam",
        "diazepam",
        "clonazepam",
        "xanax",
        "ativan",
        "valium",
        "klonopin",
    ],
}


def _get_medication_data():
    """Return the interaction and drug class data."""
    return KNOWN_MAJOR_INTERACTIONS, DRUG_CLASSES


def _classify_drug(drug_name: str) -> str | None:
    """Map a drug name to its drug class using DRUG_CLASSES dict."""
    _, drug_classes = _get_medication_data()
    drug_lower = drug_name.lower().strip()
    # Strip dosage info (e.g., "aspirin 325mg" → "aspirin")
    drug_base = drug_lower.split()[0] if drug_lower else drug_lower
    for drug_class, members in drug_classes.items():
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
                known_interactions, _ = _get_medication_data()
                match = known_interactions.get(pair) or known_interactions.get((pair[1], pair[0]))
                if match:
                    interactions.append(
                        {
                            "drug_a": med_a,
                            "drug_b": med_b,
                            "severity": "major",
                            "mechanism": match["description"],
                            "clinical_effect": match["description"],
                            "recommendation": match["recommendation"],
                            "alternatives": [],
                            "source": "deterministic",
                        }
                    )
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
    toxicity_profiles: dict[str, Any] = field(default_factory=dict)  # TxGemma drug toxicity data


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

    # Step 1.5: TxGemma AI-predicted interactions/toxicity (if available)
    txgemma_interactions = []
    txgemma_toxicity = {}
    try:
        from src.medgemma.txgemma import get_txgemma_client

        txgemma = get_txgemma_client()
        if txgemma.is_available and new_medications:
            import asyncio

            # Check interactions between new meds and all existing meds
            interaction_tasks = []
            for new_med in new_medications:
                for existing_med in current_medications:
                    interaction_tasks.append(txgemma.predict_interaction(new_med, existing_med))

            # Get toxicity profiles for new medications
            toxicity_tasks = [txgemma.predict_toxicity(med) for med in new_medications]

            # Run in parallel
            all_results = await asyncio.gather(
                *interaction_tasks, *toxicity_tasks, return_exceptions=True
            )

            # Parse interaction results
            n_interactions = len(interaction_tasks)
            for result in all_results[:n_interactions]:
                if isinstance(result, dict) and result.get("interaction_exists"):
                    txgemma_interactions.append(
                        {
                            "drug_a": result.get("drug_a", ""),
                            "drug_b": result.get("drug_b", ""),
                            "severity": result.get("severity", "moderate"),
                            "mechanism": result.get("mechanism", ""),
                            "clinical_effect": result.get("clinical_effect", ""),
                            "recommendation": result.get("recommendation", ""),
                            "alternatives": [],
                            "source": "txgemma",
                            "confidence": result.get("confidence", 0.5),
                        }
                    )

            # Parse toxicity results
            for i, result in enumerate(all_results[n_interactions:]):
                if isinstance(result, dict) and "error" not in result:
                    med_name = new_medications[i] if i < len(new_medications) else "unknown"
                    txgemma_toxicity[med_name] = result

            logger.info(
                "TxGemma analysis complete",
                interactions_found=len(txgemma_interactions),
                toxicity_profiles=len(txgemma_toxicity),
            )
    except ImportError:
        pass
    except Exception as e:
        logger.warning("TxGemma analysis failed (non-critical)", error=str(e))

    # Step 2: MedGemma clinical reasoning for deeper analysis
    medgemma = get_medgemma_client()

    known_str = (
        "None identified"
        if not deterministic_interactions
        else json.dumps(
            [
                {"drugs": f"{i['drug_a']} + {i['drug_b']}", "effect": i["clinical_effect"]}
                for i in deterministic_interactions
            ],
            indent=2,
        )
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

        # Merge deterministic + TxGemma + MedGemma interactions
        all_interactions = list(deterministic_interactions)
        all_interactions.extend(txgemma_interactions)
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
            toxicity_profiles=txgemma_toxicity,
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
        "toxicity_profiles": result.toxicity_profiles,
    }
