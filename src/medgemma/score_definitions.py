"""Clinical risk score definitions — pure data + deterministic calculation.

Each score defines:
- deterministic_variables: extracted via regex from vitals/labs/demographics
- subjective_variables: extracted via a single batched MedGemma call
- calculate(variables) → (total, max, risk_level, interpretation, recommendation)
- thresholds: published risk strata
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class VariableDefinition:
    """One variable needed by a scoring tool."""
    name: str
    label: str
    source: str  # "deterministic" | "subjective"
    criteria: str  # human-readable explanation
    max_points: int = 0
    # For subjective variables: the question to ask MedGemma
    prompt_question: str = ""


@dataclass
class Threshold:
    """A single risk stratum."""
    min_score: float
    max_score: float
    risk_level: str
    interpretation: str
    recommendation: str


@dataclass
class ScoreDefinition:
    """Complete definition of a clinical risk score."""
    id: str
    name: str
    applicable_categories: list[str]
    deterministic_variables: list[VariableDefinition]
    subjective_variables: list[VariableDefinition]
    thresholds: list[Threshold]
    max_score: int | float
    calculate: Callable[[dict[str, Any]], tuple[int | float, str]]
    # calculate returns (total_score, variable_points_detail)


def _clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


# ---------------------------------------------------------------------------
# 1. HEART Score (History, ECG, Age, Risk factors, Troponin)
# ---------------------------------------------------------------------------

def _calc_heart(v: dict[str, Any]) -> tuple[int, str]:
    total = 0
    total += int(v.get("history_suspicion", 0))   # 0/1/2
    total += int(v.get("ecg", 0))                 # 0/1/2
    age = v.get("age")
    if age is not None:
        if age < 45:
            total += 0
        elif age <= 64:
            total += 1
        else:
            total += 2
    total += int(v.get("risk_factor_count", 0))    # 0/1/2
    total += int(v.get("troponin_category", 0))    # 0/1/2
    return total, ""


HEART_SCORE = ScoreDefinition(
    id="heart",
    name="HEART Score",
    applicable_categories=["cardiology"],
    deterministic_variables=[
        VariableDefinition("age", "Age", "deterministic", "Age in years", max_points=2),
        VariableDefinition("troponin_category", "Troponin", "deterministic",
                           "0=normal, 1=1-3x ULN, 2=>3x ULN", max_points=2),
    ],
    subjective_variables=[
        VariableDefinition("history_suspicion", "History", "subjective",
                           "0=slightly suspicious, 1=moderately suspicious, 2=highly suspicious",
                           max_points=2,
                           prompt_question="Rate the history suspicion for ACS: 0=slightly suspicious (non-specific), 1=moderately suspicious (some typical features), 2=highly suspicious (classic chest pain). Return integer 0, 1, or 2."),
        VariableDefinition("ecg", "ECG", "subjective",
                           "0=normal, 1=non-specific repolarization, 2=significant ST deviation",
                           max_points=2,
                           prompt_question="Rate ECG findings: 0=normal, 1=non-specific repolarization abnormality, 2=significant ST deviation. Return integer 0, 1, or 2."),
        VariableDefinition("risk_factor_count", "Risk Factors", "subjective",
                           "0=no known risk factors, 1=1-2 risk factors, 2=≥3 or history of atherosclerotic disease",
                           max_points=2,
                           prompt_question="Count cardiovascular risk factors (HTN, DM, hyperlipidemia, smoking, obesity, family history of CAD, prior atherosclerotic disease): 0=none, 1=1-2, 2=≥3 or known atherosclerotic disease. Return integer 0, 1, or 2."),
    ],
    thresholds=[
        Threshold(0, 3, "low", "Low risk for MACE (1.7%)", "Consider early discharge with outpatient follow-up"),
        Threshold(4, 6, "moderate", "Moderate risk for MACE (12-16.6%)", "Admit for observation, serial troponins, cardiology consult"),
        Threshold(7, 10, "high", "High risk for MACE (50-65%)", "Aggressive intervention: early invasive strategy, cardiology consult"),
    ],
    max_score=10,
    calculate=_calc_heart,
)


# ---------------------------------------------------------------------------
# 2. CHA₂DS₂-VASc Score
# ---------------------------------------------------------------------------

def _calc_cha2ds2_vasc(v: dict[str, Any]) -> tuple[int, str]:
    total = 0
    total += int(v.get("chf", 0))                # 1
    total += int(v.get("hypertension", 0))        # 1
    age = v.get("age")
    if age is not None:
        if age >= 75:
            total += 2
        elif age >= 65:
            total += 1
    total += int(v.get("diabetes", 0))            # 1
    total += int(v.get("stroke_tia", 0)) * 2      # 2
    total += int(v.get("vascular_disease", 0))    # 1
    sex = v.get("sex", "").lower()
    if sex in ("female", "f"):
        total += 1
    return total, ""


CHA2DS2_VASC = ScoreDefinition(
    id="cha2ds2_vasc",
    name="CHA₂DS₂-VASc",
    applicable_categories=["cardiology"],
    deterministic_variables=[
        VariableDefinition("age", "Age", "deterministic", "65-74 → 1pt, ≥75 → 2pts", max_points=2),
        VariableDefinition("sex", "Sex", "deterministic", "Female → 1pt", max_points=1),
        VariableDefinition("hypertension", "Hypertension", "deterministic",
                           "HTN keyword in history → 1pt", max_points=1),
        VariableDefinition("diabetes", "Diabetes", "deterministic",
                           "DM keyword in history → 1pt", max_points=1),
    ],
    subjective_variables=[
        VariableDefinition("chf", "CHF", "subjective",
                           "Congestive heart failure or LV dysfunction → 1pt", max_points=1,
                           prompt_question="Does the patient have congestive heart failure or LV dysfunction? Return 0 or 1."),
        VariableDefinition("stroke_tia", "Stroke/TIA", "subjective",
                           "Prior stroke, TIA, or thromboembolism → 2pts", max_points=2,
                           prompt_question="Does the patient have prior stroke, TIA, or thromboembolism? Return 0 or 1."),
        VariableDefinition("vascular_disease", "Vascular Disease", "subjective",
                           "Prior MI, PAD, or aortic plaque → 1pt", max_points=1,
                           prompt_question="Does the patient have vascular disease (prior MI, PAD, aortic plaque)? Return 0 or 1."),
    ],
    thresholds=[
        Threshold(0, 0, "low", "Low risk (0 for males, 1 for females)", "No anticoagulation needed (or consider if female with score 1)"),
        Threshold(1, 1, "low-moderate", "Low-moderate risk", "Consider anticoagulation based on individual risk-benefit"),
        Threshold(2, 9, "moderate-high", "Moderate-high stroke risk", "Oral anticoagulation recommended"),
    ],
    max_score=9,
    calculate=_calc_cha2ds2_vasc,
)


# ---------------------------------------------------------------------------
# 3. TIMI Score (for UA/NSTEMI)
# ---------------------------------------------------------------------------

def _calc_timi(v: dict[str, Any]) -> tuple[int, str]:
    total = 0
    if v.get("age") is not None and v["age"] >= 65:
        total += 1
    total += int(v.get("cad_risk_factors_ge3", 0))
    total += int(v.get("known_cad", 0))
    total += int(v.get("asa_use", 0))
    total += int(v.get("severe_angina_ge2_events", 0))
    total += int(v.get("st_deviation", 0))
    total += int(v.get("elevated_troponin", 0))
    return total, ""


TIMI_SCORE = ScoreDefinition(
    id="timi",
    name="TIMI Risk Score (UA/NSTEMI)",
    applicable_categories=["cardiology"],
    deterministic_variables=[
        VariableDefinition("age", "Age ≥65", "deterministic", "Age ≥65 → 1pt", max_points=1),
        VariableDefinition("asa_use", "Aspirin use", "deterministic",
                           "ASA use in past 7 days → 1pt", max_points=1),
        VariableDefinition("elevated_troponin", "Elevated troponin", "deterministic",
                           "Elevated cardiac markers → 1pt", max_points=1),
    ],
    subjective_variables=[
        VariableDefinition("cad_risk_factors_ge3", "≥3 CAD risk factors", "subjective",
                           "≥3 of: HTN, DM, hyperlipidemia, family hx, smoking → 1pt",
                           max_points=1,
                           prompt_question="Does the patient have ≥3 traditional CAD risk factors (HTN, DM, hyperlipidemia, family history, active smoking)? Return 0 or 1."),
        VariableDefinition("known_cad", "Known CAD", "subjective",
                           "≥50% stenosis on prior cath → 1pt", max_points=1,
                           prompt_question="Does the patient have known CAD (≥50% stenosis documented)? Return 0 or 1."),
        VariableDefinition("severe_angina_ge2_events", "≥2 anginal events in 24h", "subjective",
                           "≥2 anginal episodes in past 24h → 1pt", max_points=1,
                           prompt_question="Did the patient have ≥2 anginal episodes in the past 24 hours? Return 0 or 1."),
        VariableDefinition("st_deviation", "ST deviation ≥0.5mm", "subjective",
                           "ST segment deviation on ECG → 1pt", max_points=1,
                           prompt_question="Is there ST segment deviation ≥0.5mm on ECG? Return 0 or 1."),
    ],
    thresholds=[
        Threshold(0, 2, "low", "Low risk (≤8.3% MACE at 14 days)", "Consider early discharge, outpatient stress test"),
        Threshold(3, 4, "moderate", "Moderate risk (13-20% MACE)", "Admit, serial troponins, consider invasive strategy"),
        Threshold(5, 7, "high", "High risk (26-41% MACE)", "Early invasive strategy recommended"),
    ],
    max_score=7,
    calculate=_calc_timi,
)


# ---------------------------------------------------------------------------
# 4. Wells PE Score (simplified)
# ---------------------------------------------------------------------------

def _calc_wells_pe(v: dict[str, Any]) -> tuple[float, str]:
    total = 0.0
    total += float(v.get("dvt_signs", 0)) * 3.0
    total += float(v.get("pe_most_likely", 0)) * 3.0
    hr = v.get("hr")
    if hr is not None and hr > 100:
        total += 1.5
    total += float(v.get("immobilization_surgery", 0)) * 1.5
    total += float(v.get("prior_dvt_pe", 0)) * 1.5
    total += float(v.get("hemoptysis", 0)) * 1.0
    total += float(v.get("active_cancer", 0)) * 1.0
    return total, ""


WELLS_PE = ScoreDefinition(
    id="wells_pe",
    name="Wells Score for PE",
    applicable_categories=["pulmonology"],
    deterministic_variables=[
        VariableDefinition("hr", "Heart rate >100", "deterministic",
                           "HR >100 → 1.5pts", max_points=2),
        VariableDefinition("prior_dvt_pe", "Prior DVT/PE", "deterministic",
                           "History keyword DVT or PE → 1.5pts", max_points=2),
        VariableDefinition("hemoptysis", "Hemoptysis", "deterministic",
                           "Hemoptysis keyword → 1pt", max_points=1),
    ],
    subjective_variables=[
        VariableDefinition("dvt_signs", "Clinical signs of DVT", "subjective",
                           "Leg swelling, pain with palpation → 3pts", max_points=3,
                           prompt_question="Are there clinical signs of DVT (leg swelling, pain with palpation of deep veins)? Return 0 or 1."),
        VariableDefinition("pe_most_likely", "PE is #1 diagnosis", "subjective",
                           "PE most likely or equally likely diagnosis → 3pts", max_points=3,
                           prompt_question="Is PE the most likely diagnosis or equally likely as an alternative? Return 0 or 1."),
        VariableDefinition("immobilization_surgery", "Immobilization/surgery", "subjective",
                           "Recent surgery or immobilization >3 days → 1.5pts", max_points=2,
                           prompt_question="Has the patient had recent surgery or immobilization/bedrest >3 days in last 4 weeks? Return 0 or 1."),
        VariableDefinition("active_cancer", "Active cancer", "subjective",
                           "Active cancer (treatment within 6 months or palliative) → 1pt", max_points=1,
                           prompt_question="Does the patient have active cancer (treatment within 6 months or palliative)? Return 0 or 1."),
    ],
    thresholds=[
        Threshold(0, 1.5, "low", "Low probability PE (1.3%)", "D-dimer; if negative, PE excluded"),
        Threshold(2, 6, "moderate", "Moderate probability PE (16.2%)", "D-dimer or CTPA"),
        Threshold(6.5, 12.5, "high", "High probability PE (37.5%)", "CTPA recommended, consider empiric anticoagulation"),
    ],
    max_score=12.5,
    calculate=_calc_wells_pe,
)


# ---------------------------------------------------------------------------
# 5. CURB-65
# ---------------------------------------------------------------------------

def _calc_curb65(v: dict[str, Any]) -> tuple[int, str]:
    total = 0
    total += int(v.get("confusion", 0))
    bun = v.get("bun")
    if bun is not None and bun > 19:
        total += 1
    rr = v.get("rr")
    if rr is not None and rr >= 30:
        total += 1
    sbp = v.get("sbp")
    dbp = v.get("dbp")
    if (sbp is not None and sbp < 90) or (dbp is not None and dbp <= 60):
        total += 1
    age = v.get("age")
    if age is not None and age >= 65:
        total += 1
    return total, ""


CURB65 = ScoreDefinition(
    id="curb65",
    name="CURB-65",
    applicable_categories=["pulmonology", "infectious_disease"],
    deterministic_variables=[
        VariableDefinition("bun", "BUN >19 mg/dL", "deterministic",
                           "BUN >19 (or Urea >7 mmol/L) → 1pt", max_points=1),
        VariableDefinition("rr", "RR ≥30", "deterministic", "Respiratory rate ≥30 → 1pt", max_points=1),
        VariableDefinition("sbp", "SBP <90", "deterministic", "SBP <90 → 1pt (part of BP criterion)", max_points=1),
        VariableDefinition("dbp", "DBP ≤60", "deterministic", "DBP ≤60 → 1pt (part of BP criterion)", max_points=1),
        VariableDefinition("age", "Age ≥65", "deterministic", "Age ≥65 → 1pt", max_points=1),
    ],
    subjective_variables=[
        VariableDefinition("confusion", "Confusion", "subjective",
                           "New mental confusion → 1pt", max_points=1,
                           prompt_question="Does the patient have new mental confusion (altered mental status, disorientation)? Return 0 or 1."),
    ],
    thresholds=[
        Threshold(0, 1, "low", "Low severity pneumonia (0.7-3.2% mortality)", "Consider outpatient treatment"),
        Threshold(2, 2, "moderate", "Moderate severity (13% mortality)", "Consider short inpatient stay or closely supervised outpatient"),
        Threshold(3, 5, "high", "Severe pneumonia (17-57% mortality)", "Hospitalize; consider ICU if score 4-5"),
    ],
    max_score=5,
    calculate=_calc_curb65,
)


# ---------------------------------------------------------------------------
# 6. qSOFA
# ---------------------------------------------------------------------------

def _calc_qsofa(v: dict[str, Any]) -> tuple[int, str]:
    total = 0
    total += int(v.get("altered_mentation", 0))
    rr = v.get("rr")
    if rr is not None and rr >= 22:
        total += 1
    sbp = v.get("sbp")
    if sbp is not None and sbp <= 100:
        total += 1
    return total, ""


QSOFA = ScoreDefinition(
    id="qsofa",
    name="qSOFA",
    applicable_categories=["infectious_disease", "critical_care"],
    deterministic_variables=[
        VariableDefinition("rr", "RR ≥22", "deterministic", "Respiratory rate ≥22 → 1pt", max_points=1),
        VariableDefinition("sbp", "SBP ≤100", "deterministic", "Systolic BP ≤100 → 1pt", max_points=1),
    ],
    subjective_variables=[
        VariableDefinition("altered_mentation", "Altered mentation", "subjective",
                           "GCS <15 or altered mental status → 1pt", max_points=1,
                           prompt_question="Does the patient have altered mentation (GCS <15, confusion, obtundation)? Return 0 or 1."),
    ],
    thresholds=[
        Threshold(0, 1, "low", "Low risk of poor outcome", "Continue monitoring; qSOFA <2 does not exclude sepsis"),
        Threshold(2, 3, "high", "High risk of poor outcome (3-14x mortality)", "Assess for organ dysfunction, consider ICU, initiate Sepsis-3 workup"),
    ],
    max_score=3,
    calculate=_calc_qsofa,
)


# ---------------------------------------------------------------------------
# 7. Glasgow Coma Scale (GCS)
# ---------------------------------------------------------------------------

def _calc_gcs(v: dict[str, Any]) -> tuple[int, str]:
    eye = int(v.get("gcs_eye", 4))        # 1-4
    verbal = int(v.get("gcs_verbal", 5))   # 1-5
    motor = int(v.get("gcs_motor", 6))     # 1-6
    eye = int(_clamp(eye, 1, 4))
    verbal = int(_clamp(verbal, 1, 5))
    motor = int(_clamp(motor, 1, 6))
    return eye + verbal + motor, ""


GCS = ScoreDefinition(
    id="gcs",
    name="Glasgow Coma Scale (GCS)",
    applicable_categories=["neurology", "critical_care"],
    deterministic_variables=[],
    subjective_variables=[
        VariableDefinition("gcs_eye", "Eye opening", "subjective",
                           "1=none, 2=to pain, 3=to voice, 4=spontaneous", max_points=4,
                           prompt_question="Rate eye opening response: 1=none, 2=to pain, 3=to voice, 4=spontaneous. Return integer 1-4."),
        VariableDefinition("gcs_verbal", "Verbal response", "subjective",
                           "1=none, 2=incomprehensible, 3=inappropriate, 4=confused, 5=oriented", max_points=5,
                           prompt_question="Rate verbal response: 1=none, 2=incomprehensible sounds, 3=inappropriate words, 4=confused speech, 5=oriented. Return integer 1-5."),
        VariableDefinition("gcs_motor", "Motor response", "subjective",
                           "1=none, 2=extension, 3=flexion, 4=withdrawal, 5=localizes, 6=obeys", max_points=6,
                           prompt_question="Rate motor response: 1=none, 2=extension (decerebrate), 3=abnormal flexion (decorticate), 4=withdrawal, 5=localizes pain, 6=obeys commands. Return integer 1-6."),
    ],
    thresholds=[
        Threshold(3, 8, "severe", "Severe brain injury (GCS 3-8)", "Intubation likely needed; neurosurgery consult"),
        Threshold(9, 12, "moderate", "Moderate brain injury (GCS 9-12)", "Close monitoring, consider ICU, repeat imaging"),
        Threshold(13, 15, "mild", "Mild injury or normal (GCS 13-15)", "Observation; discharge if stable"),
    ],
    max_score=15,
    calculate=_calc_gcs,
)


# ---------------------------------------------------------------------------
# 8. MELD Score (Model for End-Stage Liver Disease)
# ---------------------------------------------------------------------------

def _calc_meld(v: dict[str, Any]) -> tuple[float, str]:
    # MELD = 3.78 × ln(bilirubin) + 11.2 × ln(INR) + 9.57 × ln(creatinine) + 6.43
    bili = max(v.get("bilirubin", 1.0), 1.0)
    inr = max(v.get("inr", 1.0), 1.0)
    cr = max(v.get("creatinine", 1.0), 1.0)
    cr = min(cr, 4.0)  # cap at 4.0
    meld = 3.78 * math.log(bili) + 11.2 * math.log(inr) + 9.57 * math.log(cr) + 6.43
    meld = round(_clamp(meld, 6, 40))
    return meld, ""


MELD_SCORE = ScoreDefinition(
    id="meld",
    name="MELD Score",
    applicable_categories=["gastroenterology", "nephrology"],
    deterministic_variables=[
        VariableDefinition("bilirubin", "Bilirubin (mg/dL)", "deterministic",
                           "Total bilirubin; minimum 1.0", max_points=0),
        VariableDefinition("inr", "INR", "deterministic",
                           "International Normalized Ratio; minimum 1.0", max_points=0),
        VariableDefinition("creatinine", "Creatinine (mg/dL)", "deterministic",
                           "Serum creatinine; cap at 4.0", max_points=0),
    ],
    subjective_variables=[],
    thresholds=[
        Threshold(6, 9, "low", "Low 3-month mortality (<2%)", "Outpatient management"),
        Threshold(10, 19, "moderate", "Moderate 3-month mortality (6-20%)", "Consider hepatology referral, close follow-up"),
        Threshold(20, 29, "high", "High 3-month mortality (20-45%)", "Transplant evaluation, inpatient management"),
        Threshold(30, 40, "very_high", "Very high 3-month mortality (>70%)", "Urgent transplant evaluation, ICU care"),
    ],
    max_score=40,
    calculate=_calc_meld,
)


# ---------------------------------------------------------------------------
# 9. Glasgow-Blatchford Bleeding Score
# ---------------------------------------------------------------------------

def _calc_glasgow_blatchford(v: dict[str, Any]) -> tuple[int, str]:
    total = 0
    # BUN (mg/dL) — convert to mmol/L: divide by 2.8
    bun = v.get("bun")
    if bun is not None:
        bun_mmol = bun / 2.8
        if bun_mmol >= 6.5 and bun_mmol < 8:
            total += 2
        elif bun_mmol >= 8 and bun_mmol < 10:
            total += 3
        elif bun_mmol >= 10 and bun_mmol < 25:
            total += 4
        elif bun_mmol >= 25:
            total += 6

    # Hemoglobin (g/dL) — sex-specific
    hgb = v.get("hemoglobin")
    sex = v.get("sex", "").lower()
    if hgb is not None:
        if sex in ("male", "m"):
            if hgb >= 12 and hgb < 13:
                total += 1
            elif hgb >= 10 and hgb < 12:
                total += 3
            elif hgb < 10:
                total += 6
        else:
            if hgb >= 10 and hgb < 12:
                total += 1
            elif hgb < 10:
                total += 6

    # SBP
    sbp = v.get("sbp")
    if sbp is not None:
        if sbp >= 100 and sbp < 110:
            total += 1
        elif sbp >= 90 and sbp < 100:
            total += 2
        elif sbp < 90:
            total += 3

    # HR
    hr = v.get("hr")
    if hr is not None and hr >= 100:
        total += 1

    # Subjective
    total += int(v.get("melena", 0)) * 1
    total += int(v.get("syncope", 0)) * 2
    total += int(v.get("hepatic_disease", 0)) * 2
    total += int(v.get("cardiac_failure", 0)) * 2

    return total, ""


GLASGOW_BLATCHFORD = ScoreDefinition(
    id="glasgow_blatchford",
    name="Glasgow-Blatchford Bleeding Score",
    applicable_categories=["gastroenterology"],
    deterministic_variables=[
        VariableDefinition("bun", "BUN (mg/dL)", "deterministic", "Blood urea nitrogen → 0-6 pts", max_points=6),
        VariableDefinition("hemoglobin", "Hemoglobin (g/dL)", "deterministic", "Sex-adjusted → 0-6 pts", max_points=6),
        VariableDefinition("sbp", "SBP (mmHg)", "deterministic", "Systolic BP → 0-3 pts", max_points=3),
        VariableDefinition("hr", "HR ≥100", "deterministic", "Pulse ≥100 → 1pt", max_points=1),
        VariableDefinition("sex", "Sex", "deterministic", "Used for hemoglobin thresholds", max_points=0),
    ],
    subjective_variables=[
        VariableDefinition("melena", "Melena", "subjective", "Melena present → 1pt", max_points=1,
                           prompt_question="Is melena (black tarry stool) present? Return 0 or 1."),
        VariableDefinition("syncope", "Syncope", "subjective", "Syncope at presentation → 2pts", max_points=2,
                           prompt_question="Did the patient present with syncope? Return 0 or 1."),
        VariableDefinition("hepatic_disease", "Hepatic disease", "subjective",
                           "Known liver disease or failure → 2pts", max_points=2,
                           prompt_question="Does the patient have known hepatic disease or liver failure? Return 0 or 1."),
        VariableDefinition("cardiac_failure", "Cardiac failure", "subjective",
                           "Known cardiac failure → 2pts", max_points=2,
                           prompt_question="Does the patient have known cardiac failure? Return 0 or 1."),
    ],
    thresholds=[
        Threshold(0, 0, "low", "Very low risk — 0.5% need for intervention", "Outpatient management may be safe"),
        Threshold(1, 5, "moderate", "Moderate risk for GI bleed intervention", "Inpatient observation, consider endoscopy"),
        Threshold(6, 23, "high", "High risk — likely needs intervention", "Urgent endoscopy, resuscitation, consider ICU"),
    ],
    max_score=23,
    calculate=_calc_glasgow_blatchford,
)


# ---------------------------------------------------------------------------
# 10. Ranson's Criteria (at admission)
# ---------------------------------------------------------------------------

def _calc_ransons(v: dict[str, Any]) -> tuple[int, str]:
    total = 0
    age = v.get("age")
    if age is not None and age > 55:
        total += 1
    wbc = v.get("wbc")
    if wbc is not None and wbc > 16:
        total += 1
    glucose = v.get("glucose")
    if glucose is not None and glucose > 200:
        total += 1
    ast = v.get("ast")
    if ast is not None and ast > 250:
        total += 1
    # LDH: deterministic if available
    ldh = v.get("ldh")
    if ldh is not None and ldh > 350:
        total += 1
    return total, ""


RANSONS = ScoreDefinition(
    id="ransons",
    name="Ranson's Criteria (Admission)",
    applicable_categories=["gastroenterology"],
    deterministic_variables=[
        VariableDefinition("age", "Age >55", "deterministic", "Age >55 → 1pt", max_points=1),
        VariableDefinition("wbc", "WBC >16k", "deterministic", "WBC >16,000/μL → 1pt", max_points=1),
        VariableDefinition("glucose", "Glucose >200", "deterministic", "Blood glucose >200 mg/dL → 1pt", max_points=1),
        VariableDefinition("ast", "AST >250", "deterministic", "AST >250 IU/L → 1pt", max_points=1),
        VariableDefinition("ldh", "LDH >350", "deterministic", "LDH >350 IU/L → 1pt", max_points=1),
    ],
    subjective_variables=[],
    thresholds=[
        Threshold(0, 2, "low", "Mild pancreatitis (<5% mortality)", "Supportive care, likely short hospital stay"),
        Threshold(3, 4, "moderate", "Moderate pancreatitis (15-20% mortality)", "ICU monitoring, aggressive fluid resuscitation"),
        Threshold(5, 5, "high", "Severe pancreatitis (>40% mortality)", "ICU admission, consider early intervention"),
    ],
    max_score=5,
    calculate=_calc_ransons,
)


# ---------------------------------------------------------------------------
# 11. NIH Stroke Scale (NIHSS) — simplified
# ---------------------------------------------------------------------------

def _calc_nihss(v: dict[str, Any]) -> tuple[int, str]:
    domains = [
        "loc", "loc_questions", "loc_commands", "best_gaze",
        "visual_fields", "facial_palsy", "motor_arm",
        "motor_leg", "ataxia", "sensory", "language",
        "dysarthria", "extinction",
    ]
    total = 0
    for d in domains:
        val = v.get(d)
        if val is not None:
            total += int(val)
    return total, ""


NIHSS = ScoreDefinition(
    id="nihss",
    name="NIH Stroke Scale (NIHSS)",
    applicable_categories=["neurology"],
    deterministic_variables=[],
    subjective_variables=[
        VariableDefinition("loc", "Level of consciousness", "subjective",
                           "0=alert, 1=drowsy, 2=obtunded, 3=coma", max_points=3,
                           prompt_question="Rate level of consciousness: 0=alert, 1=not alert but arousable, 2=not alert, requires repeated stimulation, 3=unresponsive. Return integer 0-3."),
        VariableDefinition("loc_questions", "LOC questions", "subjective",
                           "0=both correct, 1=one correct, 2=neither correct", max_points=2,
                           prompt_question="Can the patient correctly state their age and current month? 0=both correct, 1=one correct, 2=neither. Return integer 0-2."),
        VariableDefinition("loc_commands", "LOC commands", "subjective",
                           "0=both correct, 1=one correct, 2=neither correct", max_points=2,
                           prompt_question="Can the patient perform both commands (open/close eyes, grip/release hand)? 0=both performed, 1=one performed, 2=neither. Return integer 0-2."),
        VariableDefinition("best_gaze", "Best gaze", "subjective",
                           "0=normal, 1=partial gaze palsy, 2=forced deviation", max_points=2,
                           prompt_question="Rate gaze: 0=normal, 1=partial gaze palsy, 2=forced deviation or total gaze paresis. Return integer 0-2."),
        VariableDefinition("visual_fields", "Visual fields", "subjective",
                           "0=no loss, 1=partial hemianopia, 2=complete hemianopia, 3=bilateral", max_points=3,
                           prompt_question="Rate visual fields: 0=no visual loss, 1=partial hemianopia, 2=complete hemianopia, 3=bilateral hemianopia. Return integer 0-3."),
        VariableDefinition("facial_palsy", "Facial palsy", "subjective",
                           "0=normal, 1=minor, 2=partial, 3=complete", max_points=3,
                           prompt_question="Rate facial palsy: 0=normal, 1=minor, 2=partial, 3=complete. Return integer 0-3."),
        VariableDefinition("motor_arm", "Motor arm (worst side)", "subjective",
                           "0=no drift, 1=drift, 2=some effort vs gravity, 3=no effort vs gravity, 4=no movement", max_points=4,
                           prompt_question="Rate worst arm motor: 0=no drift, 1=drift before 10 seconds, 2=some effort against gravity, 3=no effort against gravity, 4=no movement. Return integer 0-4."),
        VariableDefinition("motor_leg", "Motor leg (worst side)", "subjective",
                           "0=no drift, 1=drift, 2=some effort vs gravity, 3=no effort vs gravity, 4=no movement", max_points=4,
                           prompt_question="Rate worst leg motor: 0=no drift, 1=drift before 5 seconds, 2=some effort against gravity, 3=no effort against gravity, 4=no movement. Return integer 0-4."),
        VariableDefinition("ataxia", "Limb ataxia", "subjective",
                           "0=absent, 1=one limb, 2=two limbs", max_points=2,
                           prompt_question="Rate limb ataxia: 0=absent, 1=present in one limb, 2=present in two limbs. Return integer 0-2."),
        VariableDefinition("sensory", "Sensory", "subjective",
                           "0=normal, 1=mild-moderate loss, 2=severe-total loss", max_points=2,
                           prompt_question="Rate sensory: 0=normal, 1=mild-to-moderate sensory loss, 2=severe or total sensory loss. Return integer 0-2."),
        VariableDefinition("language", "Best language", "subjective",
                           "0=no aphasia, 1=mild-moderate, 2=severe, 3=mute/global", max_points=3,
                           prompt_question="Rate language/aphasia: 0=no aphasia, 1=mild-to-moderate, 2=severe aphasia, 3=mute or global aphasia. Return integer 0-3."),
        VariableDefinition("dysarthria", "Dysarthria", "subjective",
                           "0=normal, 1=mild-moderate, 2=severe/unintelligible", max_points=2,
                           prompt_question="Rate dysarthria: 0=normal articulation, 1=mild-to-moderate, 2=severe or unintelligible. Return integer 0-2."),
        VariableDefinition("extinction", "Extinction/inattention", "subjective",
                           "0=none, 1=partial, 2=profound", max_points=2,
                           prompt_question="Rate extinction/inattention: 0=none, 1=inattention to one modality, 2=profound hemi-inattention to more than one modality. Return integer 0-2."),
    ],
    thresholds=[
        Threshold(0, 4, "minor", "Minor stroke", "Consider IV tPA if within window; outpatient workup if stable"),
        Threshold(5, 15, "moderate", "Moderate stroke", "IV tPA + consider thrombectomy; admit to stroke unit"),
        Threshold(16, 20, "moderate-severe", "Moderate-to-severe stroke", "IV tPA + thrombectomy evaluation; ICU/neuro ICU"),
        Threshold(21, 42, "severe", "Severe stroke", "Aggressive intervention; neuro ICU; goals-of-care discussion"),
    ],
    max_score=42,
    calculate=_calc_nihss,
)


# ---------------------------------------------------------------------------
# 12. ABCD² Score (TIA risk stratification)
# ---------------------------------------------------------------------------

def _calc_abcd2(v: dict[str, Any]) -> tuple[int, str]:
    total = 0
    age = v.get("age")
    if age is not None and age >= 60:
        total += 1
    sbp = v.get("sbp")
    dbp = v.get("dbp")
    if (sbp is not None and sbp >= 140) or (dbp is not None and dbp >= 90):
        total += 1
    total += int(v.get("clinical_features", 0))  # 0=other, 1=speech impairment, 2=unilateral weakness
    total += int(v.get("duration", 0))            # 0=<10min, 1=10-59min, 2=≥60min
    total += int(v.get("diabetes_abcd2", 0))      # 0 or 1
    return total, ""


ABCD2 = ScoreDefinition(
    id="abcd2",
    name="ABCD² Score",
    applicable_categories=["neurology"],
    deterministic_variables=[
        VariableDefinition("age", "Age ≥60", "deterministic", "Age ≥60 → 1pt", max_points=1),
        VariableDefinition("sbp", "SBP ≥140", "deterministic", "SBP ≥140 → 1pt (part of BP criterion)", max_points=1),
        VariableDefinition("dbp", "DBP ≥90", "deterministic", "DBP ≥90 → 1pt (part of BP criterion)", max_points=1),
        VariableDefinition("diabetes_abcd2", "Diabetes", "deterministic",
                           "Diabetes keyword in history → 1pt", max_points=1),
    ],
    subjective_variables=[
        VariableDefinition("clinical_features", "Clinical features", "subjective",
                           "0=other, 1=speech impairment without weakness, 2=unilateral weakness", max_points=2,
                           prompt_question="Rate TIA clinical features: 0=other symptoms, 1=speech impairment without weakness, 2=unilateral weakness. Return integer 0, 1, or 2."),
        VariableDefinition("duration", "Symptom duration", "subjective",
                           "0=<10 minutes, 1=10-59 minutes, 2=≥60 minutes", max_points=2,
                           prompt_question="Rate TIA symptom duration: 0=less than 10 minutes, 1=10-59 minutes, 2=60 minutes or more. Return integer 0, 1, or 2."),
    ],
    thresholds=[
        Threshold(0, 3, "low", "Low 2-day stroke risk (1%)", "Consider outpatient workup within 24-48h"),
        Threshold(4, 5, "moderate", "Moderate 2-day stroke risk (4.1%)", "Urgent inpatient workup, consider admission"),
        Threshold(6, 7, "high", "High 2-day stroke risk (8.1%)", "Admit for urgent workup, dual antiplatelet, imaging"),
    ],
    max_score=7,
    calculate=_calc_abcd2,
)


# ---------------------------------------------------------------------------
# 13. SOFA Score (Sequential Organ Failure Assessment)
# ---------------------------------------------------------------------------

def _calc_sofa(v: dict[str, Any]) -> tuple[int, str]:
    total = 0

    # Respiration: PaO2/FiO2
    pf = v.get("pao2_fio2")
    if pf is not None:
        if pf < 100:
            total += 4
        elif pf < 200:
            total += 3
        elif pf < 300:
            total += 2
        elif pf < 400:
            total += 1

    # Coagulation: platelets
    plt = v.get("platelets")
    if plt is not None:
        if plt < 20:
            total += 4
        elif plt < 50:
            total += 3
        elif plt < 100:
            total += 2
        elif plt < 150:
            total += 1

    # Liver: bilirubin
    bili = v.get("bilirubin")
    if bili is not None:
        if bili >= 12:
            total += 4
        elif bili >= 6:
            total += 3
        elif bili >= 2:
            total += 2
        elif bili >= 1.2:
            total += 1

    # Cardiovascular: MAP or vasopressors (subjective)
    total += int(v.get("cardiovascular_sofa", 0))

    # CNS: GCS (subjective)
    gcs_val = v.get("gcs_sofa")
    if gcs_val is not None:
        gcs_val = int(gcs_val)
        if gcs_val < 6:
            total += 4
        elif gcs_val < 10:
            total += 3
        elif gcs_val < 13:
            total += 2
        elif gcs_val < 15:
            total += 1

    # Renal: creatinine
    cr = v.get("creatinine")
    if cr is not None:
        if cr >= 5.0:
            total += 4
        elif cr >= 3.5:
            total += 3
        elif cr >= 2.0:
            total += 2
        elif cr >= 1.2:
            total += 1

    return total, ""


SOFA = ScoreDefinition(
    id="sofa",
    name="SOFA Score",
    applicable_categories=["critical_care"],
    deterministic_variables=[
        VariableDefinition("pao2_fio2", "PaO2/FiO2 ratio", "deterministic",
                           "<400→1, <300→2, <200→3, <100→4", max_points=4),
        VariableDefinition("platelets", "Platelets (×10³/μL)", "deterministic",
                           "<150→1, <100→2, <50→3, <20→4", max_points=4),
        VariableDefinition("bilirubin", "Bilirubin (mg/dL)", "deterministic",
                           "≥1.2→1, ≥2→2, ≥6→3, ≥12→4", max_points=4),
        VariableDefinition("creatinine", "Creatinine (mg/dL)", "deterministic",
                           "≥1.2→1, ≥2→2, ≥3.5→3, ≥5→4", max_points=4),
    ],
    subjective_variables=[
        VariableDefinition("cardiovascular_sofa", "Cardiovascular", "subjective",
                           "0=MAP≥70, 1=MAP<70, 2=dopamine≤5, 3=dopamine>5/epi≤0.1, 4=dopamine>15/epi>0.1",
                           max_points=4,
                           prompt_question="Rate cardiovascular SOFA: 0=MAP≥70 no vasopressors, 1=MAP<70, 2=dopamine≤5 or dobutamine, 3=dopamine>5 or epinephrine≤0.1 or norepinephrine≤0.1, 4=dopamine>15 or epinephrine>0.1 or norepinephrine>0.1. Return integer 0-4."),
        VariableDefinition("gcs_sofa", "GCS (for SOFA)", "subjective",
                           "15→0, 13-14→1, 10-12→2, 6-9→3, <6→4", max_points=4,
                           prompt_question="What is the patient's GCS score? Return integer 3-15."),
    ],
    thresholds=[
        Threshold(0, 5, "low", "Low organ dysfunction", "Continue monitoring, reassess trending"),
        Threshold(6, 10, "moderate", "Moderate organ dysfunction (ICU mortality ~30%)", "ICU care, aggressive source control"),
        Threshold(11, 15, "high", "High organ dysfunction (ICU mortality ~50%)", "Maximize ICU interventions, consider goals-of-care"),
        Threshold(16, 24, "very_high", "Very high organ dysfunction (ICU mortality >80%)", "Maximal support, palliative care discussion"),
    ],
    max_score=24,
    calculate=_calc_sofa,
)


# ---------------------------------------------------------------------------
# Registry: all scores and category mapping
# ---------------------------------------------------------------------------

ALL_SCORES: list[ScoreDefinition] = [
    HEART_SCORE,
    CHA2DS2_VASC,
    TIMI_SCORE,
    WELLS_PE,
    CURB65,
    QSOFA,
    GCS,
    MELD_SCORE,
    GLASGOW_BLATCHFORD,
    RANSONS,
    NIHSS,
    ABCD2,
    SOFA,
]

SCORE_BY_ID: dict[str, ScoreDefinition] = {s.id: s for s in ALL_SCORES}

CATEGORY_SCORE_MAP: dict[str, list[str]] = {
    "cardiology": ["heart", "cha2ds2_vasc", "timi"],
    "pulmonology": ["wells_pe", "curb65"],
    "infectious_disease": ["qsofa", "curb65"],
    "neurology": ["nihss", "gcs", "abcd2"],
    "gastroenterology": ["meld", "glasgow_blatchford", "ransons"],
    "nephrology": ["meld"],
    "critical_care": ["sofa", "qsofa", "gcs"],
    "psychiatry": [],
    "dermatology": [],
    "musculoskeletal": [],
    "endocrinology": [],
    "hematology_oncology": [],
    "obstetrics_gynecology": [],
    "urology": [],
    "ent": [],
    "ophthalmology": [],
}

# Keywords that trigger qSOFA as fallback for any category
SEPSIS_KEYWORDS = frozenset({
    "sepsis", "septic", "fever", "febrile", "bacteremia",
    "infection", "infected", "SIRS",
})
