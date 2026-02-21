"""SOAP Note Compliance Engine.

Hybrid deterministic + AI validation following the ems_validation.py pattern.
Scans clinical documentation for claim-denial risks and malpractice liability gaps.
"""

import json
import re
from dataclasses import dataclass, field
from typing import Any

import structlog

logger = structlog.get_logger()


# ---------- Data Models ----------


@dataclass
class ComplianceFlag:
    severity: str  # error, warning, info
    domain: str  # claim_denial, malpractice
    section: str  # subjective, objective, assessment, plan
    field: str  # specific field path (e.g., "plan.follow_up")
    rule_id: str  # e.g., MISSING_MED_NECESSITY
    message: str  # human-readable description
    auto_fixable: bool = False
    suggested_fix: str = ""
    reference: str = ""


@dataclass
class ComplianceScanResult:
    score: float
    grade: str
    flags: list[ComplianceFlag] = field(default_factory=list)
    claim_denial_score: float = 100.0
    malpractice_score: float = 100.0
    rules_checked: int = 0
    rules_passed: int = 0


# ---------- Score Calculation ----------

DEDUCTIONS: dict[tuple[str, str], int] = {
    ("error", "claim_denial"): 15,
    ("error", "malpractice"): 12,
    ("warning", "claim_denial"): 7,
    ("warning", "malpractice"): 5,
    ("info", "claim_denial"): 2,
    ("info", "malpractice"): 2,
}


def _compute_grade(score: float) -> str:
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


def compute_compliance_score(
    flags: list[ComplianceFlag], rules_checked: int
) -> ComplianceScanResult:
    """Compute overall and domain-specific scores from flags."""
    overall = 100.0
    claim_score = 100.0
    malpractice_score = 100.0

    for f in flags:
        deduction = DEDUCTIONS.get((f.severity, f.domain), 2)
        overall -= deduction
        if f.domain == "claim_denial":
            claim_score -= deduction
        elif f.domain == "malpractice":
            malpractice_score -= deduction

    overall = max(0.0, overall)
    claim_score = max(0.0, claim_score)
    malpractice_score = max(0.0, malpractice_score)

    return ComplianceScanResult(
        score=overall,
        grade=_compute_grade(overall),
        flags=flags,
        claim_denial_score=claim_score,
        malpractice_score=malpractice_score,
        rules_checked=rules_checked,
        rules_passed=rules_checked - len(flags),
    )


# ---------- Helper Accessors ----------


def _get(soap: dict, path: str, default: Any = None) -> Any:
    """Safely traverse nested dict by dot-separated path."""
    parts = path.split(".")
    current = soap
    for part in parts:
        if isinstance(current, dict):
            current = current.get(part, default)
        else:
            return default
    return current


def _text(soap: dict, path: str) -> str:
    """Get a string field, defaulting to empty string."""
    val = _get(soap, path)
    if val is None:
        return ""
    return str(val).strip()


def _list_field(soap: dict, path: str) -> list:
    """Get a list field, defaulting to empty list."""
    val = _get(soap, path)
    if isinstance(val, list):
        return val
    return []


# ---------- Deterministic Rules ----------

HIGH_ACUITY_KEYWORDS = [
    "mi",
    "myocardial infarction",
    "stemi",
    "nstemi",
    "stroke",
    "cva",
    "cerebrovascular",
    "pe",
    "pulmonary embolism",
    "sepsis",
    "septic shock",
    "aortic dissection",
    "hemorrhage",
]

DX_PLAN_MAPPINGS: dict[str, list[str]] = {
    "stemi": [
        "aspirin",
        "heparin",
        "cath",
        "pci",
        "catheterization",
        "anticoagul",
        "antiplatelet",
        "ticagrelor",
        "clopidogrel",
        "thrombo",
        "nitro",
        "morphine",
    ],
    "nstemi": [
        "aspirin",
        "heparin",
        "anticoagul",
        "antiplatelet",
        "ticagrelor",
        "clopidogrel",
        "cath",
        "pci",
        "cardiology",
    ],
    "myocardial infarction": [
        "aspirin",
        "heparin",
        "cath",
        "pci",
        "anticoagul",
        "antiplatelet",
        "thrombo",
        "cardiology",
    ],
    "stroke": ["tpa", "alteplase", "tenecteplase", "thrombectomy", "neurology", "ct", "mri"],
    "cva": ["tpa", "alteplase", "tenecteplase", "thrombectomy", "neurology"],
    "pulmonary embolism": ["heparin", "anticoagul", "enoxaparin", "tpa", "ct angio"],
    "sepsis": ["antibiotic", "fluid", "culture", "vasopressor", "lactate"],
    "septic shock": [
        "antibiotic",
        "fluid",
        "vasopressor",
        "norepinephrine",
        "culture",
    ],
    "aortic dissection": [
        "labetalol",
        "esmolol",
        "nitroprusside",
        "surgery",
        "ct angio",
        "cardiothoracic",
    ],
    "hemorrhage": ["transfusion", "prbc", "blood", "fluid", "surgery", "endoscopy"],
}

ADMISSION_TERMS = [
    "admit",
    "admission",
    "admitted",
    "ccu",
    "icu",
    "micu",
    "sicu",
    "inpatient",
    "observation",
    "telemetry",
    "step-down",
    "floor",
    "ward",
]

STAT_INDICATORS = [
    "loading",
    "bolus",
    "stat",
    "once",
    "single dose",
    "push",
    "chewed",
    "one-time",
    "prn",
    "as needed",
    "now",
]


def _is_patient_admitted(soap: dict) -> bool:
    """Check if patient is being admitted (procedures, referrals, or follow_up mention admission)."""
    text_pool = []
    text_pool.extend(str(p) for p in _list_field(soap, "plan.procedures"))
    text_pool.extend(str(r) for r in _list_field(soap, "plan.referrals"))
    text_pool.append(_text(soap, "plan.follow_up"))
    combined = " ".join(text_pool).lower()
    return any(term in combined for term in ADMISSION_TERMS)


HIGH_ACUITY_CC_KEYWORDS = [
    "chest pain",
    "shortness of breath",
    "dyspnea",
    "altered mental status",
    "syncope",
    "seizure",
    "severe headache",
    "worst headache",
    "thunderclap",
    "hematemesis",
    "melena",
    "hematochezia",
    "acute abdomen",
    "abdominal pain",
    "trauma",
]


def _check_missing_med_necessity(soap: dict) -> ComplianceFlag | None:
    """MISSING_MED_NECESSITY: Assessment has diagnosis but clinical_impression is empty/short."""
    dx = _text(soap, "assessment.primary_diagnosis")
    impression = _text(soap, "assessment.clinical_impression")
    if not dx or len(impression) >= 20:
        return None
    # Descriptive diagnosis is self-explanatory (e.g., "Anterior STEMI with ST elevation V2-V5")
    if len(dx) >= 30:
        return None
    # If impression is empty but plan is substantive, downgrade to warning
    meds = _list_field(soap, "plan.medications")
    med_count = sum(1 for m in meds if isinstance(m, dict) and (m.get("drug") or "").strip())
    procs = _list_field(soap, "plan.procedures")
    proc_count = sum(1 for p in procs if str(p).strip())
    if med_count >= 1 and proc_count >= 1:
        return ComplianceFlag(
            severity="warning",
            domain="claim_denial",
            section="assessment",
            field="assessment.clinical_impression",
            rule_id="MISSING_MED_NECESSITY",
            message="Clinical impression is missing or too brief — add reasoning supporting the diagnosis for medical necessity",
            auto_fixable=True,
            suggested_fix="",
            reference="CMS LCD: Medical necessity documentation requirement",
        )
    return ComplianceFlag(
        severity="error",
        domain="claim_denial",
        section="assessment",
        field="assessment.clinical_impression",
        rule_id="MISSING_MED_NECESSITY",
        message="Clinical impression is missing or too brief — add reasoning supporting the diagnosis for medical necessity",
        auto_fixable=True,
        suggested_fix="",
        reference="CMS LCD: Medical necessity documentation requirement",
    )


def _check_icd10_unspecified(soap: dict) -> ComplianceFlag | None:
    """ICD10_UNSPECIFIED: Diagnosis contains 'unspecified' when laterality/type info exists."""
    dx = _text(soap, "assessment.primary_diagnosis").lower()
    if "unspecified" not in dx:
        return None
    # Check if objective has laterality hints
    exam_text = " ".join(_list_field(soap, "objective.physical_exam")).lower()
    laterality_hints = [
        "left",
        "right",
        "bilateral",
        "unilateral",
        "type 1",
        "type 2",
        "type i",
        "type ii",
    ]
    if any(hint in exam_text for hint in laterality_hints):
        return ComplianceFlag(
            severity="warning",
            domain="claim_denial",
            section="assessment",
            field="assessment.primary_diagnosis",
            rule_id="ICD10_UNSPECIFIED",
            message="Diagnosis says 'unspecified' but objective findings contain laterality/type information — specify for accurate ICD-10 coding",
            auto_fixable=True,
            reference="CMS: Highest level of specificity for ICD-10 coding",
        )
    return None


def _check_med_incomplete(soap: dict) -> list[ComplianceFlag]:
    """MED_INCOMPLETE: Any medication in plan missing drug, dose, or frequency."""
    flags = []
    meds = _list_field(soap, "plan.medications")
    for i, med in enumerate(meds):
        if not isinstance(med, dict):
            continue
        missing = []
        if not (med.get("drug") or "").strip():
            missing.append("drug name")
        if not (med.get("dose") or "").strip():
            missing.append("dose")
        if not (med.get("frequency") or "").strip():
            # Check if dose field contains stat/bolus indicators (one-time dose)
            dose_text = (med.get("dose") or "").lower()
            is_stat = any(ind in dose_text for ind in STAT_INDICATORS)
            if not is_stat:
                missing.append("frequency")
        if missing:
            flags.append(
                ComplianceFlag(
                    severity="error",
                    domain="claim_denial",
                    section="plan",
                    field=f"plan.medications.{i}",
                    rule_id="MED_INCOMPLETE",
                    message=f"Medication #{i+1} missing: {', '.join(missing)}",
                    auto_fixable=False,
                    reference="Prescription completeness standard",
                )
            )
    return flags


def _check_no_allergies_doc(soap: dict) -> ComplianceFlag | None:
    """NO_ALLERGIES_DOC: No allergy documentation anywhere in the note."""
    patient_reported = " ".join(_list_field(soap, "subjective.patient_reported")).lower()
    hpi = _text(soap, "subjective.history_of_present_illness").lower()
    full_text = patient_reported + " " + hpi
    allergy_terms = ["allergy", "allergies", "allergic", "nkda", "nka", "no known"]
    if any(term in full_text for term in allergy_terms):
        return None
    return ComplianceFlag(
        severity="error",
        domain="claim_denial",
        section="subjective",
        field="subjective.patient_reported",
        rule_id="NO_ALLERGIES_DOC",
        message="No allergy documentation found — document allergies or state NKDA",
        auto_fixable=True,
        suggested_fix="NKDA (No Known Drug Allergies)",
        reference="Joint Commission medication safety standard",
    )


def _check_vitals_incomplete(soap: dict) -> ComplianceFlag | None:
    """VITALS_INCOMPLETE: Fewer than 3 of 5 vital signs filled."""
    vitals = _get(soap, "objective.vital_signs", {})
    if not isinstance(vitals, dict):
        return None
    filled = sum(1 for k in ("BP", "HR", "Temp", "RR", "SpO2") if (vitals.get(k) or "").strip())
    if filled < 3:
        return ComplianceFlag(
            severity="warning",
            domain="claim_denial",
            section="objective",
            field="objective.vital_signs",
            rule_id="VITALS_INCOMPLETE",
            message=f"Only {filled}/5 vital signs documented — at least 3 required for billing compliance",
            auto_fixable=False,
            reference="E/M documentation guidelines",
        )
    return None


def _check_no_diff_dx(soap: dict) -> ComplianceFlag | None:
    """NO_DIFF_DX: Has primary diagnosis but no differential diagnoses."""
    dx = _text(soap, "assessment.primary_diagnosis")
    diff = _list_field(soap, "assessment.differential")
    non_empty_diff = [d for d in diff if isinstance(d, str) and d.strip()]
    if dx and not non_empty_diff:
        return ComplianceFlag(
            severity="error",
            domain="malpractice",
            section="assessment",
            field="assessment.differential",
            rule_id="NO_DIFF_DX",
            message="Primary diagnosis documented but no differential diagnoses — document alternatives considered",
            auto_fixable=True,
            reference="Standard of care: differential diagnosis documentation",
        )
    return None


def _check_no_pertinent_neg(soap: dict) -> ComplianceFlag | None:
    """NO_PERTINENT_NEG: High-acuity chief complaint but no negative findings in ROS."""
    cc = _text(soap, "subjective.chief_complaint").lower()
    if not any(kw in cc for kw in HIGH_ACUITY_CC_KEYWORDS):
        return None
    ros = _list_field(soap, "subjective.review_of_systems")
    ros_text = " ".join(str(r) for r in ros).lower()
    neg_indicators = ["no ", "denies", "negative", "absent", "without", "none"]
    if any(ind in ros_text for ind in neg_indicators):
        return None
    return ComplianceFlag(
        severity="warning",
        domain="malpractice",
        section="subjective",
        field="subjective.review_of_systems",
        rule_id="NO_PERTINENT_NEG",
        message="High-acuity chief complaint — document pertinent negatives in review of systems",
        auto_fixable=True,
        reference="Malpractice risk: pertinent negatives demonstrate clinical thoroughness",
    )


def _check_assessment_plan_gap(soap: dict) -> ComplianceFlag | None:
    """ASSESSMENT_PLAN_GAP: Diagnosis keyword in assessment not addressed in plan."""
    dx = _text(soap, "assessment.primary_diagnosis").lower()
    if not dx:
        return None
    # Build plan text (include dose fields and clinical_impression)
    plan_parts = []
    for med in _list_field(soap, "plan.medications"):
        if isinstance(med, dict):
            plan_parts.append(med.get("drug", "") or "")
            plan_parts.append(med.get("dose", "") or "")
    plan_parts.extend(str(p) for p in _list_field(soap, "plan.procedures"))
    plan_parts.extend(str(r) for r in _list_field(soap, "plan.referrals"))
    plan_parts.append(_text(soap, "plan.follow_up"))
    plan_parts.extend(str(e) for e in _list_field(soap, "plan.patient_education"))
    plan_parts.append(_text(soap, "assessment.clinical_impression"))
    plan_text = " ".join(plan_parts).lower()

    # Extract key diagnosis words (>3 chars, not common words)
    stop_words = {
        "the",
        "and",
        "with",
        "from",
        "that",
        "this",
        "for",
        "are",
        "was",
        "were",
        "has",
        "have",
        "had",
        "not",
        "but",
        "can",
        "will",
        "may",
        "due",
        "acute",
        "chronic",
        "left",
        "right",
        "upper",
        "lower",
        "mild",
        "moderate",
        "severe",
    }
    dx_words = [w for w in re.findall(r"\b\w+\b", dx) if len(w) > 3 and w not in stop_words]

    if not dx_words:
        return None

    # Pass 1: Direct keyword match
    if any(w in plan_text for w in dx_words):
        return None

    # Pass 2: Concept mapping — check if plan contains expected treatments for this dx
    for key, treatments in DX_PLAN_MAPPINGS.items():
        if key in dx:
            if any(t in plan_text for t in treatments):
                return None

    # Pass 3: Substantive plan — high-acuity dx with multiple meds + procedure
    if any(kw in dx for kw in HIGH_ACUITY_KEYWORDS):
        meds = _list_field(soap, "plan.medications")
        med_count = sum(1 for m in meds if isinstance(m, dict) and (m.get("drug") or "").strip())
        procs = _list_field(soap, "plan.procedures")
        proc_count = sum(1 for p in procs if str(p).strip())
        if med_count >= 2 and proc_count >= 1:
            return None

    return ComplianceFlag(
        severity="error",
        domain="malpractice",
        section="plan",
        field="plan",
        rule_id="ASSESSMENT_PLAN_GAP",
        message=f"Diagnosis '{_text(soap, 'assessment.primary_diagnosis')}' is not addressed in the plan",
        auto_fixable=True,
        reference="Standard of care: every diagnosis must have a corresponding plan",
    )


def _check_no_followup(soap: dict) -> ComplianceFlag | None:
    """NO_FOLLOWUP: plan.follow_up is null/empty and no disposition in procedures/referrals."""
    fu = _text(soap, "plan.follow_up")
    if fu:
        return None

    # Check procedures and referrals for disposition terms (admission = implicit follow-up)
    disposition_terms = [
        "admit",
        "admission",
        "discharge",
        "follow-up",
        "follow up",
        "appointment",
        "outpatient",
        "clinic",
        "pcp",
        "ccu",
        "icu",
        "observation",
        "transfer",
        "post-procedure",
        "cath lab",
    ]
    text_pool = []
    text_pool.extend(str(p) for p in _list_field(soap, "plan.procedures"))
    text_pool.extend(str(r) for r in _list_field(soap, "plan.referrals"))
    combined = " ".join(text_pool).lower()
    if any(term in combined for term in disposition_terms):
        return None

    return ComplianceFlag(
        severity="warning",
        domain="malpractice",
        section="plan",
        field="plan.follow_up",
        rule_id="NO_FOLLOWUP",
        message="No follow-up plan documented — specify follow-up timing and provider",
        auto_fixable=True,
        reference="Continuity of care documentation standard",
    )


def _check_no_red_flags(soap: dict) -> ComplianceFlag | None:
    """NO_RED_FLAGS: High-acuity diagnosis but no return precautions in patient education."""
    dx = _text(soap, "assessment.primary_diagnosis").lower()
    diff = [str(d).lower() for d in _list_field(soap, "assessment.differential")]
    all_dx = dx + " " + " ".join(diff)

    if not any(kw in all_dx for kw in HIGH_ACUITY_KEYWORDS):
        return None

    # Return precautions are for discharge patients — admitted patients don't need them
    if _is_patient_admitted(soap):
        return None

    education = [str(e).lower() for e in _list_field(soap, "plan.patient_education")]
    edu_text = " ".join(education)
    return_terms = [
        "return",
        "come back",
        "emergency",
        "er",
        "911",
        "worsen",
        "red flag",
        "seek immediate",
        "precaution",
    ]
    if any(term in edu_text for term in return_terms):
        return None

    return ComplianceFlag(
        severity="error",
        domain="malpractice",
        section="plan",
        field="plan.patient_education",
        rule_id="NO_RED_FLAGS",
        message="High-acuity diagnosis — document return precautions and red flag warnings in patient education",
        auto_fixable=True,
        reference="Discharge instruction safety standard",
    )


# Registry of all deterministic checks
DETERMINISTIC_CHECKS = [
    _check_missing_med_necessity,
    _check_icd10_unspecified,
    _check_no_allergies_doc,
    _check_vitals_incomplete,
    _check_no_diff_dx,
    _check_no_pertinent_neg,
    _check_assessment_plan_gap,
    _check_no_followup,
    _check_no_red_flags,
]

TOTAL_RULES = len(DETERMINISTIC_CHECKS) + 1  # +1 for MED_INCOMPLETE (always checked)


def run_deterministic_validation(soap: dict) -> list[ComplianceFlag]:
    """Run all deterministic validation rules against a SOAP note."""
    flags = []
    for check in DETERMINISTIC_CHECKS:
        result = check(soap)
        if isinstance(result, list):
            flags.extend(result)
        elif result is not None:
            flags.append(result)
    # MED_INCOMPLETE returns a list
    flags.extend(_check_med_incomplete(soap))
    return flags


# ---------- AI Validation Layer ----------

AI_VALIDATION_PROMPT = """You are a medical documentation compliance reviewer checking a SOAP note for claim-denial risks and malpractice liability gaps.

SOAP NOTE:
{soap_json}

Check for:
1. Clinical reasoning gaps — does the assessment logically follow from subjective + objective?
2. Internal inconsistencies between sections (e.g., vital signs contradict physical exam)
3. Copy-forward/template language patterns (overly generic text not specific to this patient)
4. Missing time-critical documentation (onset times for stroke, MI, sepsis)
5. Missing patient education for complex diagnoses

Already flagged (do NOT repeat):
{existing_flags}

Return JSON:
{{
    "flags": [
        {{
            "severity": "error|warning|info",
            "domain": "claim_denial|malpractice",
            "section": "subjective|objective|assessment|plan",
            "field": "dot.path.to.field",
            "rule_id": "AI_CHECK",
            "message": "clear description of the issue",
            "auto_fixable": true,
            "reference": "brief citation or best practice"
        }}
    ]
}}

Only report genuine issues. Be specific and actionable.
Output ONLY the JSON object."""


AI_FIX_PROMPT = """You are a medical documentation assistant. Given a SOAP note and a compliance issue, generate corrected text for the specified field.

SOAP NOTE:
{soap_json}

COMPLIANCE ISSUE:
- Rule: {rule_id}
- Section: {section}
- Field: {field}
- Issue: {message}

Generate the corrected text for the field "{field}".
Be concise, medically accurate, and match the existing documentation style.
Output ONLY the replacement text, nothing else."""


async def run_ai_validation(
    soap: dict, existing_flags: list[ComplianceFlag]
) -> list[ComplianceFlag]:
    """Run MedGemma AI validation for clinical consistency and documentation gaps."""
    try:
        from src.medgemma.client import get_medgemma_client

        client = get_medgemma_client()

        existing_str = json.dumps(
            [{"rule_id": f.rule_id, "message": f.message} for f in existing_flags]
        )

        prompt = AI_VALIDATION_PROMPT.format(
            soap_json=json.dumps(soap, indent=2, default=str),
            existing_flags=existing_str,
        )

        response = await client.generate(
            prompt=prompt,
            system_prompt="You are a medical documentation compliance reviewer. Output ONLY valid JSON.",
            temperature=0.2,
            max_tokens=2000,
        )

        data = client._parse_json_response(response)
        ai_flags = []
        for flag_data in data.get("flags", []):
            ai_flags.append(
                ComplianceFlag(
                    severity=flag_data.get("severity", "info"),
                    domain=flag_data.get("domain", "malpractice"),
                    section=flag_data.get("section", ""),
                    field=flag_data.get("field", ""),
                    rule_id=flag_data.get("rule_id", "AI_CHECK"),
                    message=flag_data.get("message", ""),
                    auto_fixable=flag_data.get("auto_fixable", True),
                    reference=flag_data.get("reference", ""),
                )
            )
        return ai_flags

    except Exception as e:
        logger.warning("AI compliance validation failed (non-critical)", error=str(e))
        return []


async def generate_ai_fix(soap: dict, flag: ComplianceFlag) -> str:
    """Generate an AI-powered fix for a specific compliance flag."""
    try:
        from src.medgemma.client import get_medgemma_client

        client = get_medgemma_client()

        prompt = AI_FIX_PROMPT.format(
            soap_json=json.dumps(soap, indent=2, default=str),
            rule_id=flag.rule_id,
            section=flag.section,
            field=flag.field,
            message=flag.message,
        )

        response = await client.generate(
            prompt=prompt,
            system_prompt="You are a medical documentation assistant. Output ONLY the replacement text.",
            temperature=0.3,
            max_tokens=500,
        )

        # Strip any wrapping quotes or markdown
        fix_text = response.strip().strip('"').strip("'").strip("`")
        return fix_text

    except Exception as e:
        logger.warning("AI fix generation failed", error=str(e))
        return ""


# ---------- Main API ----------


async def scan_compliance(soap: dict, include_ai: bool = True) -> ComplianceScanResult:
    """Run full compliance scan: deterministic first, then AI."""
    flags = run_deterministic_validation(soap)
    rules_checked = TOTAL_RULES

    if include_ai:
        ai_flags = await run_ai_validation(soap, flags)
        flags.extend(ai_flags)
        rules_checked += len(ai_flags)  # AI checks are dynamic

    return compute_compliance_score(flags, rules_checked)


# ---------- Singleton ----------

_engine_instance = None


def get_compliance_engine():
    """Get or create singleton compliance engine reference."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = {
            "scan": scan_compliance,
            "scan_quick": lambda soap: compute_compliance_score(
                run_deterministic_validation(soap), TOTAL_RULES
            ),
            "fix": generate_ai_fix,
        }
    return _engine_instance
