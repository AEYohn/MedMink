"""EMS Run Report Validation Engine.

Hybrid deterministic + AI validation following the medication_safety.py pattern.
Deterministic rules run first (fast, reliable), then MedGemma checks for
clinical inconsistencies and documentation gaps.
"""

import json
from dataclasses import asdict
from typing import Any

import structlog

from src.medgemma.ems_models import EMSRunReport, ValidationFlag

logger = structlog.get_logger()


# ---------- Deterministic Validation Rules ----------

def _check_ams_bgl(report: EMSRunReport) -> ValidationFlag | None:
    """AMS_BGL: Altered mental status requires blood glucose check."""
    pa = report.primary_assessment
    if pa.avpu and pa.avpu.lower() in ("verbal", "pain", "unresponsive"):
        vitals = report.secondary_assessment.vitals
        has_bgl = any(v.blood_glucose is not None for v in vitals)
        if not has_bgl:
            return ValidationFlag(
                severity="error", section="vitals", field="blood_glucose",
                rule_id="AMS_BGL",
                message="Altered mental status documented — blood glucose check required",
            )
    return None


def _check_chest_pain_12lead(report: EMSRunReport) -> ValidationFlag | None:
    """CHEST_PAIN_12LEAD: Chest pain should have 12-lead ECG."""
    cc = (report.patient.chief_complaint or "").lower()
    if "chest pain" in cc or "chest tightness" in cc:
        sa = report.secondary_assessment
        if not sa.twelve_lead:
            return ValidationFlag(
                severity="warning", section="secondary_assessment", field="twelve_lead",
                rule_id="CHEST_PAIN_12LEAD",
                message="Chest pain documented — 12-lead ECG recommended",
            )
    return None


def _check_stroke_screen(report: EMSRunReport) -> ValidationFlag | None:
    """STROKE_SCREEN: Stroke symptoms require stroke screening."""
    cc = (report.patient.chief_complaint or "").lower()
    stroke_keywords = ["stroke", "facial droop", "arm weakness", "slurred speech",
                       "aphasia", "hemiparesis", "hemiplegia"]
    if any(kw in cc for kw in stroke_keywords):
        sa = report.secondary_assessment
        if not sa.stroke_screen:
            return ValidationFlag(
                severity="error", section="secondary_assessment", field="stroke_screen",
                rule_id="STROKE_SCREEN",
                message="Stroke symptoms documented — stroke screening (Cincinnati/FAST) required",
            )
    return None


def _check_trauma_cspine(report: EMSRunReport) -> ValidationFlag | None:
    """TRAUMA_CSPINE: Significant MOI should have C-spine precautions."""
    moi = (report.scene.mechanism_of_injury or "").lower()
    significant_moi = ["mva", "mvc", "fall", "ejection", "rollover", "pedestrian",
                       "assault", "diving", "axial load"]
    if any(kw in moi for kw in significant_moi):
        interventions = [i.procedure.lower() for i in report.interventions]
        has_cspine = any("c-spine" in p or "collar" in p or "cervical" in p for p in interventions)
        if not has_cspine:
            return ValidationFlag(
                severity="warning", section="interventions", field="procedure",
                rule_id="TRAUMA_CSPINE",
                message="Significant mechanism of injury — C-spine precautions recommended",
            )
    return None


def _check_narcan_opioid(report: EMSRunReport) -> ValidationFlag | None:
    """NARCAN_OPIOID: Opioid OD signs should have naloxone consideration."""
    cc = (report.patient.chief_complaint or "").lower()
    opioid_keywords = ["overdose", "od", "opioid", "heroin", "fentanyl",
                       "pinpoint pupils", "respiratory depression"]
    if any(kw in cc for kw in opioid_keywords):
        meds = [m.medication.lower() for m in report.medications]
        has_narcan = any("naloxone" in m or "narcan" in m for m in meds)
        if not has_narcan:
            return ValidationFlag(
                severity="warning", section="medications", field="medication",
                rule_id="NARCAN_OPIOID",
                message="Opioid overdose signs — naloxone administration should be documented",
            )
    return None


def _check_epi_anaphylaxis(report: EMSRunReport) -> ValidationFlag | None:
    """EPI_ANAPHYLAXIS: Anaphylaxis requires epinephrine."""
    cc = (report.patient.chief_complaint or "").lower()
    if "anaphylaxis" in cc or "anaphylactic" in cc:
        meds = [m.medication.lower() for m in report.medications]
        has_epi = any("epinephrine" in m or "epi" == m.strip() for m in meds)
        if not has_epi:
            return ValidationFlag(
                severity="error", section="medications", field="medication",
                rule_id="EPI_ANAPHYLAXIS",
                message="Anaphylaxis documented — epinephrine administration required",
            )
    return None


def _check_gcs_inconsistency(report: EMSRunReport) -> ValidationFlag | None:
    """GCS_INCONSISTENCY: GCS 15 contradicts unresponsive documentation."""
    pa = report.primary_assessment
    vitals = report.secondary_assessment.vitals
    for v in vitals:
        if v.gcs_total == 15 and pa.avpu and pa.avpu.lower() == "unresponsive":
            return ValidationFlag(
                severity="error", section="primary_assessment", field="avpu",
                rule_id="GCS_INCONSISTENCY",
                message="GCS 15 is inconsistent with AVPU 'Unresponsive' — please verify",
            )
    return None


def _check_spo2_cyanosis(report: EMSRunReport) -> ValidationFlag | None:
    """SPO2_CYANOSIS: High SpO2 contradicts cyanosis documentation."""
    skin = (report.primary_assessment.skin or "").lower()
    if "cyanotic" in skin or "cyanosis" in skin:
        vitals = report.secondary_assessment.vitals
        for v in vitals:
            if v.spo2 is not None and v.spo2 > 95:
                return ValidationFlag(
                    severity="warning", section="primary_assessment", field="skin",
                    rule_id="SPO2_CYANOSIS",
                    message=f"SpO2 {v.spo2}% is inconsistent with cyanosis — please verify",
                )
    return None


def _check_time_sequence(report: EMSRunReport) -> ValidationFlag | None:
    """TIME_SEQUENCE: Timestamps must be in chronological order."""
    d = report.dispatch
    times = [
        ("dispatched", d.time_dispatched),
        ("enroute", d.time_enroute),
        ("on_scene", d.time_on_scene),
        ("at_patient", d.time_at_patient),
        ("left_scene", d.time_left_scene),
        ("at_destination", d.time_at_destination),
        ("in_service", d.time_in_service),
    ]
    filled = [(name, t) for name, t in times if t]
    for i in range(len(filled) - 1):
        if filled[i][1] > filled[i + 1][1]:
            return ValidationFlag(
                severity="error", section="dispatch", field="timestamps",
                rule_id="TIME_SEQUENCE",
                message=f"Time '{filled[i][0]}' ({filled[i][1]}) is after '{filled[i + 1][0]}' ({filled[i + 1][1]})",
            )
    return None


def _check_med_missing_fields(report: EMSRunReport) -> list[ValidationFlag]:
    """MED_MISSING_FIELDS: Medications must have time, dose, route, response."""
    flags = []
    for med in report.medications:
        missing = []
        if not med.time:
            missing.append("time")
        if not med.dose:
            missing.append("dose")
        if not med.route:
            missing.append("route")
        if not med.response:
            missing.append("response")
        if missing:
            flags.append(ValidationFlag(
                severity="error", section="medications", field=",".join(missing),
                rule_id="MED_MISSING_FIELDS",
                message=f"Medication '{med.medication}' missing: {', '.join(missing)}",
            ))
    return flags


def _check_iv_med_no_access(report: EMSRunReport) -> ValidationFlag | None:
    """IV_MED_NO_ACCESS: IV medication without IV access documented."""
    iv_meds = [m for m in report.medications if m.route and m.route.upper() in ("IV", "IO")]
    if iv_meds:
        interventions = [i.procedure.lower() for i in report.interventions]
        has_access = any(kw in p for p in interventions for kw in ("iv", "io", "line", "access", "saline lock"))
        if not has_access:
            return ValidationFlag(
                severity="warning", section="interventions", field="procedure",
                rule_id="IV_MED_NO_ACCESS",
                message="IV/IO medication given but no vascular access documented",
            )
    return None


def _check_scene_time_long(report: EMSRunReport) -> ValidationFlag | None:
    """SCENE_TIME_LONG: On-scene >20 min needs justification."""
    d = report.dispatch
    if d.time_on_scene and d.time_left_scene:
        try:
            from datetime import datetime
            on_scene = datetime.fromisoformat(d.time_on_scene)
            left = datetime.fromisoformat(d.time_left_scene)
            minutes = (left - on_scene).total_seconds() / 60
            if minutes > 20:
                return ValidationFlag(
                    severity="warning", section="dispatch", field="scene_time",
                    rule_id="SCENE_TIME_LONG",
                    message=f"On-scene time is {int(minutes)} minutes — document justification for extended scene time",
                )
        except (ValueError, TypeError):
            pass
    return None


# Registry of all deterministic checks
DETERMINISTIC_CHECKS = [
    _check_ams_bgl,
    _check_chest_pain_12lead,
    _check_stroke_screen,
    _check_trauma_cspine,
    _check_narcan_opioid,
    _check_epi_anaphylaxis,
    _check_gcs_inconsistency,
    _check_spo2_cyanosis,
    _check_time_sequence,
    _check_iv_med_no_access,
    _check_scene_time_long,
]


def run_deterministic_validation(report: EMSRunReport) -> list[ValidationFlag]:
    """Run all deterministic validation rules against a report."""
    flags = []
    for check in DETERMINISTIC_CHECKS:
        result = check(report)
        if isinstance(result, list):
            flags.extend(result)
        elif result is not None:
            flags.append(result)
    # Med missing fields returns a list
    flags.extend(_check_med_missing_fields(report))
    return flags


# ---------- AI Validation Layer ----------

AI_VALIDATION_PROMPT = """You are an EMS quality assurance reviewer checking an ePCR run report.

REPORT DATA:
{report_json}

Check for:
1. Clinical inconsistencies (findings that contradict each other)
2. Missing pertinent negatives for the chief complaint
3. Documentation gaps that commonly cause insurance claim denials
4. Protocol deviations based on the chief complaint and interventions
5. Missing required documentation elements

Return JSON:
{{
    "flags": [
        {{
            "severity": "error|warning|info",
            "section": "which section",
            "field": "which field",
            "rule_id": "AI_CHECK",
            "message": "clear description of the issue"
        }}
    ]
}}

Only report genuine issues. Do NOT repeat issues already flagged below:
{existing_flags}

Output ONLY the JSON object."""


async def run_ai_validation(report: EMSRunReport, existing_flags: list[ValidationFlag]) -> list[ValidationFlag]:
    """Run MedGemma AI validation for clinical consistency checks."""
    try:
        from src.medgemma.client import get_medgemma_client

        client = get_medgemma_client()

        # Compact report representation for prompt
        report_dict = asdict(report)
        # Remove empty sections to save tokens
        compact = {k: v for k, v in report_dict.items()
                   if v and k not in ("validation_flags", "section_completeness", "narrative",
                                       "icd10_codes", "medical_necessity")}

        existing_str = json.dumps([{"rule_id": f.rule_id, "message": f.message} for f in existing_flags])

        prompt = AI_VALIDATION_PROMPT.format(
            report_json=json.dumps(compact, indent=2, default=str),
            existing_flags=existing_str,
        )

        response = await client.generate(
            prompt=prompt,
            system_prompt="You are an EMS quality assurance reviewer. Output ONLY valid JSON.",
            temperature=0.2,
            max_tokens=1500,
        )

        data = client._parse_json_response(response)
        ai_flags = []
        for flag_data in data.get("flags", []):
            ai_flags.append(ValidationFlag(
                severity=flag_data.get("severity", "info"),
                section=flag_data.get("section", ""),
                field=flag_data.get("field", ""),
                rule_id=flag_data.get("rule_id", "AI_CHECK"),
                message=flag_data.get("message", ""),
            ))
        return ai_flags

    except Exception as e:
        logger.warning("AI validation failed (non-critical)", error=str(e))
        return []


async def validate_report(report: EMSRunReport, include_ai: bool = True) -> list[ValidationFlag]:
    """Run full validation: deterministic first, then AI."""
    flags = run_deterministic_validation(report)

    if include_ai:
        ai_flags = await run_ai_validation(report, flags)
        flags.extend(ai_flags)

    return flags
