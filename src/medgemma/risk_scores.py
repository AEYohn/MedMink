"""Clinical risk scoring engine — hybrid deterministic + MedGemma.

Deterministic extraction of vitals/labs/demographics via regex,
single batched MedGemma call for subjective variables,
then deterministic formula calculation. Zero hallucination risk on math.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

import structlog

from src.medgemma.client import get_medgemma_client
from src.medgemma.score_definitions import (
    CATEGORY_SCORE_MAP,
    SCORE_BY_ID,
    SEPSIS_KEYWORDS,
    ScoreDefinition,
    Threshold,
)

logger = structlog.get_logger()


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class ScoreVariable:
    name: str
    value: Any
    source: str  # "deterministic" | "medgemma" | "missing"
    points: int
    label: str
    criteria: str


@dataclass
class ScoreResult:
    score_id: str
    score_name: str
    total_score: int | float
    max_score: int | float
    risk_level: str
    risk_interpretation: str
    recommendation: str
    variables: list[ScoreVariable]
    missing_variables: list[str]
    applicable: bool  # False if >50% of variables missing


@dataclass
class RiskScoreReport:
    scores: list[ScoreResult]
    case_category: str
    summary: str


# ---------------------------------------------------------------------------
# Deterministic extractors
# ---------------------------------------------------------------------------

# Vital sign patterns
_VITAL_PATTERNS: dict[str, list[re.Pattern]] = {
    "hr": [
        re.compile(r"(?:HR|heart\s*rate|pulse)[:\s]*(\d{2,3})", re.IGNORECASE),
        re.compile(r"(\d{2,3})\s*(?:bpm|beats?\s*/?\s*min)", re.IGNORECASE),
    ],
    "sbp": [
        re.compile(r"(?:SBP|systolic)[:\s]*(\d{2,3})", re.IGNORECASE),
        re.compile(r"(?:BP|blood\s*pressure)[:\s]*(\d{2,3})\s*/\s*\d{2,3}", re.IGNORECASE),
        re.compile(r"(\d{2,3})\s*/\s*\d{2,3}\s*(?:mmHg)?", re.IGNORECASE),
    ],
    "dbp": [
        re.compile(r"(?:DBP|diastolic)[:\s]*(\d{2,3})", re.IGNORECASE),
        re.compile(r"(?:BP|blood\s*pressure)[:\s]*\d{2,3}\s*/\s*(\d{2,3})", re.IGNORECASE),
        re.compile(r"\d{2,3}\s*/\s*(\d{2,3})\s*(?:mmHg)?", re.IGNORECASE),
    ],
    "rr": [
        re.compile(r"(?:RR|resp(?:iratory)?\s*rate)[:\s]*(\d{1,2})", re.IGNORECASE),
        re.compile(r"(\d{1,2})\s*(?:breaths?\s*/?\s*min)", re.IGNORECASE),
    ],
    "spo2": [
        re.compile(r"(?:SpO2|O2\s*sat|oxygen\s*sat(?:uration)?)[:\s]*(\d{2,3})%?", re.IGNORECASE),
    ],
    "temp": [
        re.compile(
            r"(?:temp(?:erature)?|T)[:\s]*(\d{2,3}(?:\.\d{1,2})?)\s*°?(?:F|C)?", re.IGNORECASE
        ),
    ],
}

# Lab patterns  —  value followed by optional units
_LAB_PATTERNS: dict[str, list[re.Pattern]] = {
    "troponin": [
        re.compile(
            r"(?:troponin\s*[IT]?|TnI|TnT)[\s:=]*(?:is\s+|of\s+)?(\d+\.?\d*)\s*(?:ng/[mL]|μg/L)?",
            re.IGNORECASE,
        ),
    ],
    "creatinine": [
        re.compile(r"(?:creatinine|Cr|SCr)[:\s]*(\d+\.?\d*)\s*(?:mg/dL)?", re.IGNORECASE),
    ],
    "bun": [
        re.compile(r"(?:BUN|blood\s*urea\s*nitrogen)[:\s]*(\d+\.?\d*)\s*(?:mg/dL)?", re.IGNORECASE),
    ],
    "bilirubin": [
        re.compile(
            r"(?:bilirubin|bili|total\s*bilirubin|T\.?\s*bili)[:\s]*(\d+\.?\d*)\s*(?:mg/dL)?",
            re.IGNORECASE,
        ),
    ],
    "inr": [
        re.compile(r"(?:INR)[:\s]*(\d+\.?\d*)", re.IGNORECASE),
    ],
    "wbc": [
        re.compile(
            r"(?:WBC|white\s*(?:blood\s*)?(?:cell\s*)?count)[:\s]*(\d+\.?\d*)\s*(?:[×xX]\s*10[³3]|k|K|thousand)?(?:/[μu]?L)?",
            re.IGNORECASE,
        ),
    ],
    "platelets": [
        re.compile(
            r"(?:platelets?|PLT|plt)[:\s]*(\d+\.?\d*)\s*(?:[×xX]\s*10[³3]|k|K|thousand)?(?:/[μu]?L)?",
            re.IGNORECASE,
        ),
    ],
    "hemoglobin": [
        re.compile(r"(?:hemoglobin|Hgb|Hb)[:\s]*(\d+\.?\d*)\s*(?:g/dL)?", re.IGNORECASE),
    ],
    "glucose": [
        re.compile(
            r"(?:glucose|blood\s*sugar|fasting\s*glucose)[:\s]*(\d+\.?\d*)\s*(?:mg/dL)?",
            re.IGNORECASE,
        ),
    ],
    "ast": [
        re.compile(r"(?:AST|SGOT|aspartate)[:\s]*(\d+\.?\d*)\s*(?:IU/L|U/L)?", re.IGNORECASE),
    ],
    "alt": [
        re.compile(r"(?:ALT|SGPT|alanine)[:\s]*(\d+\.?\d*)\s*(?:IU/L|U/L)?", re.IGNORECASE),
    ],
    "lactate": [
        re.compile(
            r"(?:lactate|lactic\s*acid)[:\s]*(\d+\.?\d*)\s*(?:mmol/L|mg/dL)?", re.IGNORECASE
        ),
    ],
    "ldh": [
        re.compile(
            r"(?:LDH|lactate\s*dehydrogenase)[:\s]*(\d+\.?\d*)\s*(?:IU/L|U/L)?", re.IGNORECASE
        ),
    ],
    "pao2_fio2": [
        re.compile(r"(?:P/F|PaO2/FiO2|PF\s*ratio)[:\s]*(\d+\.?\d*)", re.IGNORECASE),
    ],
    "albumin": [
        re.compile(r"(?:albumin|Alb)[:\s]*(\d+\.?\d*)\s*(?:g/dL)?", re.IGNORECASE),
    ],
}

_AGE_PATTERN = re.compile(r"(\d{1,3})\s*[-–]?\s*(?:year|yr|y/?o|y\.o\.)", re.IGNORECASE)


def _extract_vitals(vitals_list: list[str]) -> dict[str, float]:
    """Extract numeric vitals from a list of vital sign strings."""
    text = " ".join(vitals_list) if vitals_list else ""
    result: dict[str, float] = {}
    for name, patterns in _VITAL_PATTERNS.items():
        for pat in patterns:
            m = pat.search(text)
            if m:
                try:
                    result[name] = float(m.group(1))
                except (ValueError, IndexError):
                    pass
                break
    return result


def _extract_labs(labs_list: list[str]) -> dict[str, float]:
    """Extract numeric lab values from a list of lab strings."""
    text = " ".join(labs_list) if labs_list else ""
    result: dict[str, float] = {}
    for name, patterns in _LAB_PATTERNS.items():
        for pat in patterns:
            m = pat.search(text)
            if m:
                try:
                    result[name] = float(m.group(1))
                except (ValueError, IndexError):
                    pass
                break
    return result


def _extract_age_years(age_str: str | None) -> int | None:
    """Extract age in years from a string like '62 years' or '62 y/o'."""
    if not age_str:
        return None
    m = _AGE_PATTERN.search(age_str)
    if m:
        return int(m.group(1))
    # Fallback: try to extract just a number
    m = re.search(r"(\d{1,3})", age_str)
    if m:
        val = int(m.group(1))
        if 0 < val < 120:
            return val
    return None


def _has_keyword(texts: list[str], keywords: set[str]) -> bool:
    """Check if any keyword appears in the combined text."""
    combined = " ".join(texts).lower()
    return any(kw in combined for kw in keywords)


def _extract_deterministic_variables(
    score: ScoreDefinition,
    vitals: dict[str, float],
    labs: dict[str, float],
    age: int | None,
    sex: str,
    history: list[str],
    medications: list[str],
) -> dict[str, Any]:
    """Extract deterministic variables for a score from parsed data."""
    result: dict[str, Any] = {}
    all_text = history + medications

    for vdef in score.deterministic_variables:
        name = vdef.name

        if name == "age":
            result["age"] = age
        elif name == "sex":
            result["sex"] = sex
        elif name == "hr":
            result["hr"] = vitals.get("hr")
        elif name == "sbp":
            result["sbp"] = vitals.get("sbp")
        elif name == "dbp":
            result["dbp"] = vitals.get("dbp")
        elif name == "rr":
            result["rr"] = vitals.get("rr")
        elif name in labs:
            result[name] = labs.get(name)
        elif name == "hypertension":
            result["hypertension"] = (
                1 if _has_keyword(all_text, {"hypertension", "htn", "high blood pressure"}) else 0
            )
        elif name == "diabetes" or name == "diabetes_abcd2":
            result[name] = (
                1
                if _has_keyword(
                    all_text,
                    {
                        "diabetes",
                        "dm",
                        "dm2",
                        "dm1",
                        "diabetic",
                        "type 2 diabetes",
                        "type 1 diabetes",
                    },
                )
                else 0
            )
        elif name == "prior_dvt_pe":
            result["prior_dvt_pe"] = (
                1
                if _has_keyword(
                    all_text, {"dvt", "deep vein thrombosis", "pulmonary embolism", "pe history"}
                )
                else 0
            )
        elif name == "hemoptysis":
            result["hemoptysis"] = (
                1
                if _has_keyword(
                    all_text + list(vitals.keys()),
                    {"hemoptysis", "coughing blood", "blood-tinged sputum"},
                )
                else 0
            )
        elif name == "asa_use":
            result["asa_use"] = (
                1 if _has_keyword(medications, {"aspirin", "asa", "acetylsalicylic"}) else 0
            )
        elif name == "troponin_category":
            trop = labs.get("troponin")
            if trop is not None:
                if trop <= 0.04:
                    result["troponin_category"] = 0
                elif trop <= 0.12:
                    result["troponin_category"] = 1
                else:
                    result["troponin_category"] = 2
            else:
                result["troponin_category"] = None
        elif name == "elevated_troponin":
            trop = labs.get("troponin")
            if trop is not None:
                result["elevated_troponin"] = 1 if trop > 0.04 else 0
            else:
                result["elevated_troponin"] = None
        else:
            # Try labs as fallback
            result[name] = labs.get(name)

    return result


# ---------------------------------------------------------------------------
# MedGemma subjective extraction
# ---------------------------------------------------------------------------


def _build_subjective_prompt(
    applicable_scores: list[ScoreDefinition],
    parsed_case: dict,
    case_text: str,
) -> tuple[str, list[tuple[str, str]]]:
    """Build a single batched prompt for all subjective variables.

    Returns (prompt_text, list of (score_id, variable_name) keys).
    """
    # Build compact context
    patient = parsed_case.get("patient", {})
    findings = parsed_case.get("findings", {})
    management = parsed_case.get("management", {})

    context_parts = [
        f"Patient: {patient.get('age', 'unknown age')} {patient.get('sex', 'unknown sex')}",
        f"History: {', '.join(patient.get('relevant_history', []))}",
        f"Presentation: {findings.get('presentation', '')}",
        f"Vitals/Exam: {', '.join(findings.get('physical_exam', []))}",
        f"Labs: {', '.join(findings.get('labs', []))}",
        f"Imaging: {', '.join(findings.get('imaging', []))}",
        f"Medications: {', '.join(management.get('medications', []))}",
    ]
    compact_context = "\n".join(context_parts)

    questions: list[str] = []
    keys: list[tuple[str, str]] = []
    q_num = 1

    for score in applicable_scores:
        for vdef in score.subjective_variables:
            questions.append(f'  "{score.id}__{vdef.name}": {vdef.prompt_question}')
            keys.append((score.id, vdef.name))
            q_num += 1

    if not questions:
        return "", keys

    prompt = f"""Given this clinical case, extract ONLY the clinical assessments below.

CASE:
{compact_context}

ORIGINAL CASE TEXT:
{case_text[:2000]}

For each key below, return the appropriate integer value based on the instructions.
If information is not available in the case, return null.

Return JSON with these exact keys:
{{
{chr(10).join(questions)}
}}

Output ONLY JSON. Start with {{ end with }}."""

    return prompt, keys


async def _extract_subjective_variables(
    applicable_scores: list[ScoreDefinition],
    parsed_case: dict,
    case_text: str,
) -> dict[str, dict[str, Any]]:
    """Extract subjective variables via a single MedGemma call.

    Returns {score_id: {variable_name: value}}.
    """
    prompt, keys = _build_subjective_prompt(applicable_scores, parsed_case, case_text)

    if not prompt or not keys:
        return {}

    client = get_medgemma_client()
    raw = await client.generate(
        prompt=prompt,
        system_prompt="You are a clinical assessment tool. Extract clinical variables from case data. Output ONLY valid JSON.",
        temperature=0.2,
        max_tokens=1500,
    )

    # Parse JSON from response
    result: dict[str, dict[str, Any]] = {}
    try:
        # Strip thinking tokens if present
        text = raw
        if "<unused94>" in text:
            parts = text.split("</unused94>")
            text = parts[-1] if len(parts) > 1 else text

        # Find JSON
        json_match = re.search(r"\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}", text, re.DOTALL)
        if json_match:
            parsed = json.loads(json_match.group())
        else:
            parsed = json.loads(text.strip())

        for score_id, var_name in keys:
            key = f"{score_id}__{var_name}"
            val = parsed.get(key)
            if score_id not in result:
                result[score_id] = {}
            result[score_id][var_name] = val

    except (json.JSONDecodeError, AttributeError) as e:
        logger.warning("Failed to parse MedGemma subjective response", error=str(e), raw=raw[:200])
        # Return empty — scores will mark variables as missing
        for score_id, var_name in keys:
            if score_id not in result:
                result[score_id] = {}
            result[score_id][var_name] = None

    return result


# ---------------------------------------------------------------------------
# Score calculation
# ---------------------------------------------------------------------------


def _get_risk_stratum(score_def: ScoreDefinition, total: int | float) -> Threshold | None:
    """Find the matching threshold for a total score."""
    for t in score_def.thresholds:
        if t.min_score <= total <= t.max_score:
            return t
    # Fallback: return highest threshold if above max
    if score_def.thresholds:
        return score_def.thresholds[-1]
    return None


def _determine_applicable_scores(
    case_category: str,
    case_text: str,
    history: list[str],
) -> list[ScoreDefinition]:
    """Determine which scores to calculate for this case."""
    score_ids: set[str] = set()

    # Primary scores for the category
    category_scores = CATEGORY_SCORE_MAP.get(case_category, [])
    score_ids.update(category_scores)

    # qSOFA fallback for any category with sepsis keywords
    all_text = case_text.lower() + " " + " ".join(history).lower()
    if any(kw in all_text for kw in SEPSIS_KEYWORDS):
        score_ids.add("qsofa")

    return [SCORE_BY_ID[sid] for sid in score_ids if sid in SCORE_BY_ID]


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------


async def calculate_risk_scores(
    parsed_case: dict,
    case_text: str,
) -> RiskScoreReport:
    """Calculate all applicable clinical risk scores for a case.

    Main orchestrator:
    1. Detect applicable scores from case category
    2. Extract deterministic variables (vitals/labs/demographics)
    3. Single batched MedGemma call for subjective variables
    4. Calculate all scores deterministically
    5. Return structured report
    """
    patient = parsed_case.get("patient", {})
    findings = parsed_case.get("findings", {})
    management = parsed_case.get("management", {})
    case_category = parsed_case.get("case_category", "")

    # Determine applicable scores
    applicable_scores = _determine_applicable_scores(
        case_category,
        case_text,
        patient.get("relevant_history", []),
    )

    if not applicable_scores:
        return RiskScoreReport(
            scores=[],
            case_category=case_category,
            summary="No standard risk scores applicable for this case category.",
        )

    # Extract deterministic variables
    # Combine physical exam + labs for vitals extraction
    vitals_sources = findings.get("physical_exam", [])
    vitals = _extract_vitals(vitals_sources)
    # Also try extracting vitals from the raw case text
    raw_vitals = _extract_vitals([case_text])
    for k, v in raw_vitals.items():
        if k not in vitals:
            vitals[k] = v

    labs_sources = findings.get("labs", [])
    labs = _extract_labs(labs_sources)
    # Also try from raw case text
    raw_labs = _extract_labs([case_text])
    for k, v in raw_labs.items():
        if k not in labs:
            labs[k] = v

    age = _extract_age_years(patient.get("age"))
    sex = patient.get("sex", "")
    history = patient.get("relevant_history", [])
    medications = management.get("medications", [])

    # Extract deterministic vars per score
    det_vars: dict[str, dict[str, Any]] = {}
    for score in applicable_scores:
        det_vars[score.id] = _extract_deterministic_variables(
            score,
            vitals,
            labs,
            age,
            sex,
            history,
            medications,
        )

    # Extract subjective variables via MedGemma (single call)
    subj_vars: dict[str, dict[str, Any]] = {}
    has_subjective = any(s.subjective_variables for s in applicable_scores)
    if has_subjective:
        try:
            subj_vars = await _extract_subjective_variables(
                applicable_scores,
                parsed_case,
                case_text,
            )
        except Exception as e:
            logger.warning("Subjective variable extraction failed", error=str(e))

    # Calculate each score
    results: list[ScoreResult] = []
    for score in applicable_scores:
        # Merge deterministic + subjective variables
        merged: dict[str, Any] = {}
        merged.update(det_vars.get(score.id, {}))
        merged.update(subj_vars.get(score.id, {}))

        # Track variables and missing data
        variables: list[ScoreVariable] = []
        missing: list[str] = []

        all_var_defs = score.deterministic_variables + score.subjective_variables
        for vdef in all_var_defs:
            val = merged.get(vdef.name)
            if val is None:
                missing.append(vdef.label)
                variables.append(
                    ScoreVariable(
                        name=vdef.name,
                        value=None,
                        source="missing",
                        points=0,
                        label=vdef.label,
                        criteria=vdef.criteria,
                    )
                )
            else:
                source = vdef.source
                if source == "subjective" and vdef.name in subj_vars.get(score.id, {}):
                    source = "medgemma"
                elif source == "deterministic":
                    source = "deterministic"
                variables.append(
                    ScoreVariable(
                        name=vdef.name,
                        value=val,
                        source=source,
                        points=0,  # updated below
                        label=vdef.label,
                        criteria=vdef.criteria,
                    )
                )

        # Check applicability — >50% missing means not applicable
        total_vars = len(all_var_defs)
        applicable = total_vars == 0 or (len(missing) / total_vars) <= 0.5

        # Calculate
        total_score, _ = score.calculate(merged)
        stratum = _get_risk_stratum(score, total_score)

        results.append(
            ScoreResult(
                score_id=score.id,
                score_name=score.name,
                total_score=total_score,
                max_score=score.max_score,
                risk_level=stratum.risk_level if stratum else "unknown",
                risk_interpretation=stratum.interpretation if stratum else "",
                recommendation=stratum.recommendation if stratum else "",
                variables=variables,
                missing_variables=missing,
                applicable=applicable,
            )
        )

    # Summary
    applicable_results = [r for r in results if r.applicable]
    if applicable_results:
        high_risk = [
            r
            for r in applicable_results
            if r.risk_level in ("high", "very_high", "severe", "moderate-severe")
        ]
        if high_risk:
            names = ", ".join(f"{r.score_name} ({r.risk_level})" for r in high_risk)
            summary = f"High-risk scores identified: {names}. Consider aggressive intervention."
        else:
            summary = f"Calculated {len(applicable_results)} risk score(s). No high-risk scores identified."
    else:
        summary = "Insufficient data to calculate applicable risk scores."

    return RiskScoreReport(
        scores=results,
        case_category=case_category,
        summary=summary,
    )


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------


def risk_score_report_to_dict(report: RiskScoreReport) -> dict:
    """Convert RiskScoreReport to JSON-serializable dict."""
    return {
        "scores": [
            {
                "score_id": s.score_id,
                "score_name": s.score_name,
                "total_score": s.total_score,
                "max_score": s.max_score,
                "risk_level": s.risk_level,
                "risk_interpretation": s.risk_interpretation,
                "recommendation": s.recommendation,
                "variables": [
                    {
                        "name": v.name,
                        "value": v.value,
                        "source": v.source,
                        "points": v.points,
                        "label": v.label,
                        "criteria": v.criteria,
                    }
                    for v in s.variables
                ],
                "missing_variables": s.missing_variables,
                "applicable": s.applicable,
            }
            for s in report.scores
        ],
        "case_category": report.case_category,
        "summary": report.summary,
    }
