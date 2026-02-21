"""Deterministic post-processing layer between model output and final result.

Repairs common model output deficiencies without requiring additional LLM calls.
All functions are pure — no side effects, no model calls.
"""

from __future__ import annotations

import re

import structlog

logger = structlog.get_logger()


# Time-critical categories and their standard timing notes
_TIME_CRITICAL_TIMING = {
    "neurology": "tPA must be administered within 4.5 hours of symptom onset; thrombectomy within 24h for large vessel occlusion",
    "cardiology": "Door-to-balloon target <90 minutes for STEMI; PCI activation within 10 minutes of ECG diagnosis",
    "infectious_disease": "Antibiotics must be administered within 1 hour of sepsis recognition per Surviving Sepsis Campaign guidelines",
}

# High-risk dispositions
_HIGH_RISK_DISPOSITIONS = {"icu", "intensive", "ccu", "neuro-icu", "micu", "sicu", "critical"}
_LOW_RISK_DISPOSITIONS = {"discharge", "outpatient", "home", "follow-up", "clinic"}


def validate_and_repair(result_data: dict, case_category: str) -> dict:
    """Run all repair passes on analyzer output. Returns modified result_data."""
    result_data = ensure_acute_management_complete(result_data, case_category)
    result_data = resolve_self_contradictions(result_data)
    result_data = inject_timing_keywords(result_data, case_category)
    result_data = enforce_disposition_risk_coherence(result_data)
    return result_data


def ensure_acute_management_complete(result_data: dict, case_category: str) -> dict:
    """If risk_stratification or immediate_actions empty, populate from category defaults."""
    from src.medgemma.case_analyzer import MEDICAL_CATEGORIES

    acute = result_data.get("acute_management", {})
    if not acute:
        acute = {}
        result_data["acute_management"] = acute

    category_data = MEDICAL_CATEGORIES.get(case_category, {})

    if not acute.get("risk_stratification"):
        acute["risk_stratification"] = "MODERATE — requires clinical assessment (auto-populated)"
        logger.info("Validator: populated missing risk_stratification", category=case_category)

    if not acute.get("immediate_actions"):
        interventions = category_data.get("acute_interventions", [])
        if interventions:
            acute["immediate_actions"] = interventions[:3]
            logger.info(
                "Validator: populated immediate_actions from category defaults",
                category=case_category,
                count=len(acute["immediate_actions"]),
            )

    return result_data


def resolve_self_contradictions(result_data: dict) -> dict:
    """Remove do_not_do entries that contradict high-confidence recommended treatments."""
    treatments = result_data.get("treatment_options", [])
    acute = result_data.get("acute_management", {})
    dnd_items = acute.get("do_not_do", [])

    if not dnd_items or not treatments:
        return result_data

    # Collect high-confidence recommended treatment keywords
    recommended_keywords = set()
    for opt in treatments:
        if opt.get("verdict") == "recommended" and opt.get("confidence", 0) > 0.8:
            words = re.findall(r"[a-zA-Z]{4,}", opt["name"].lower())
            recommended_keywords.update(words)

    # Filter out do_not_do entries that directly match recommended treatments
    stopwords = {
        "with",
        "this",
        "that",
        "from",
        "have",
        "been",
        "dose",
        "oral",
        "daily",
        "management",
        "avoid",
        "give",
        "until",
        "before",
        "after",
        "within",
        "delay",
        "premature",
    }

    cleaned_dnd = []
    for entry in dnd_items:
        entry_words = set(re.findall(r"[a-zA-Z]{4,}", entry.lower()))
        significant_overlap = entry_words & recommended_keywords - stopwords
        if len(significant_overlap) >= 2:
            logger.info(
                "Validator: removed contradictory do_not_do entry",
                entry=entry,
                overlap=significant_overlap,
            )
        else:
            cleaned_dnd.append(entry)

    acute["do_not_do"] = cleaned_dnd
    return result_data


def inject_timing_keywords(result_data: dict, case_category: str) -> dict:
    """For time-critical categories, inject timing note if none found in rationales."""
    timing_note = _TIME_CRITICAL_TIMING.get(case_category)
    if not timing_note:
        return result_data

    treatments = result_data.get("treatment_options", [])
    if not treatments:
        return result_data

    # Check if any rationale already has timing keywords
    timing_keywords = [
        "hour",
        "minute",
        "within",
        "before",
        "after",
        "window",
        "onset",
        "door-to",
        "4.5",
        "90min",
        "1h",
    ]
    all_rationales = " ".join(opt.get("rationale", "") for opt in treatments).lower()
    if any(kw in all_rationales for kw in timing_keywords):
        return result_data

    # Inject timing note into top-ranked treatment's rationale
    for opt in treatments:
        if opt.get("verdict") in ("recommended", "consider"):
            opt["rationale"] = f"{opt.get('rationale', '')} [{timing_note}]"
            logger.info("Validator: injected timing keywords", treatment=opt.get("name"))
            break

    return result_data


def enforce_disposition_risk_coherence(result_data: dict) -> dict:
    """Ensure disposition matches risk level."""
    acute = result_data.get("acute_management", {})
    risk = (acute.get("risk_stratification") or "").lower()
    disposition = (acute.get("disposition") or "").lower()

    if not risk or not disposition:
        return result_data

    is_high_risk = any(kw in risk for kw in ("high", "severe", "critical", "emergent"))
    is_low_disposition = any(kw in disposition for kw in _LOW_RISK_DISPOSITIONS)
    is_low_risk = "low" in risk and not is_high_risk
    is_high_disposition = any(kw in disposition for kw in _HIGH_RISK_DISPOSITIONS)

    if is_high_risk and is_low_disposition:
        original = acute["disposition"]
        acute["disposition"] = (
            f"ICU admission recommended — {original} inappropriate for risk level"
        )
        logger.info("Validator: overrode low disposition for high risk", original=original)
    elif is_low_risk and is_high_disposition:
        original = acute["disposition"]
        acute["disposition"] = f"Floor/observation — {original} likely excessive for risk level"
        logger.info("Validator: downgraded high disposition for low risk", original=original)

    return result_data
