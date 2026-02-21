"""Comprehensive tests for SOAP note compliance engine.

Tests all 10 deterministic rules, helpers, and scoring logic.
"""

import json
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# Stub out the medgemma package __init__ to avoid importing client/config
# which triggers Settings() and fails without env vars.
# Set __path__ to the real directory so submodule resolution works.
_real_path = str(Path(__file__).resolve().parent.parent.parent / "src" / "medgemma")
_stub = types.ModuleType("src.medgemma")
_stub.__path__ = [_real_path]
sys.modules["src.medgemma"] = _stub

from src.medgemma.compliance_engine import (  # noqa: E402
    ADMISSION_TERMS,
    STAT_INDICATORS,
    ComplianceFlag,
    _check_assessment_plan_gap,
    _check_icd10_unspecified,
    _check_med_incomplete,
    _check_missing_med_necessity,
    _check_no_allergies_doc,
    _check_no_diff_dx,
    _check_no_followup,
    _check_no_pertinent_neg,
    _check_no_red_flags,
    _check_vitals_incomplete,
    _is_patient_admitted,
    compute_compliance_score,
    run_deterministic_validation,
)

# ---------- Fixtures ----------

FIXTURE_DIR = Path(__file__).resolve().parent.parent.parent / "demo" / "fixtures" / "charting"


def _load_stemi_fixture() -> dict:
    with open(FIXTURE_DIR / "stemi_soap.json") as f:
        return json.load(f)["soap"]


STEMI_SOAP = _load_stemi_fixture()

WELL_DOCUMENTED_SOAP = {
    "subjective": {
        "chief_complaint": "Acute onset substernal chest pressure radiating to left arm for 3 hours.",
        "history_of_present_illness": "62 year old male presents with acute onset substernal chest pressure. NKDA.",
        "review_of_systems": ["Denies fever, cough, abdominal pain", "No recent travel"],
        "patient_reported": ["Substernal chest pressure", "Diaphoresis", "NKDA"],
    },
    "objective": {
        "vital_signs": {"BP": "158/92", "HR": "104", "Temp": "98.6", "RR": "22", "SpO2": "94%"},
        "physical_exam": ["Lungs clear", "Heart regular rate"],
        "labs": ["Troponin I 0.82"],
        "imaging": ["ECG shows ST elevation V2-V5"],
    },
    "assessment": {
        "primary_diagnosis": "Anterior STEMI with ST elevation in leads V2-V5",
        "differential": ["Unstable angina", "Aortic dissection", "Pericarditis"],
        "clinical_impression": "ST elevation in V2-V5 with elevated troponin consistent with acute anterior STEMI requiring emergent revascularization.",
    },
    "plan": {
        "medications": [
            {"drug": "Aspirin", "dose": "325 mg chewed", "frequency": "stat"},
            {"drug": "Heparin", "dose": "60 units/kg bolus", "frequency": "then 12 units/kg/hr"},
            {"drug": "Ticagrelor", "dose": "180 mg loading dose", "frequency": "stat"},
        ],
        "procedures": ["Emergent PCI", "Cath lab activated"],
        "referrals": ["Interventional cardiology"],
        "follow_up": "Cardiology follow-up in 1 week post-PCI",
        "patient_education": [
            "Heart attack warning signs",
            "Return if chest pain worsens or recurs",
        ],
    },
}

MINIMAL_SOAP = {
    "subjective": {
        "chief_complaint": None,
        "history_of_present_illness": None,
        "review_of_systems": [],
        "patient_reported": [],
    },
    "objective": {
        "vital_signs": {"BP": None, "HR": None, "Temp": None, "RR": None, "SpO2": None},
        "physical_exam": [],
        "labs": [],
        "imaging": [],
    },
    "assessment": {
        "primary_diagnosis": None,
        "differential": [],
        "clinical_impression": None,
    },
    "plan": {
        "medications": [],
        "procedures": [],
        "referrals": [],
        "follow_up": None,
        "patient_education": [],
    },
}

DISCHARGE_HIGH_ACUITY = {
    "subjective": {
        "chief_complaint": "Chest pain",
        "history_of_present_illness": "45F with chest pain, ruled out for MI. NKDA.",
        "review_of_systems": ["Denies shortness of breath"],
        "patient_reported": ["Chest pain resolved", "NKDA"],
    },
    "objective": {
        "vital_signs": {"BP": "120/80", "HR": "72", "Temp": "98.6", "RR": "16", "SpO2": "99%"},
        "physical_exam": ["Lungs clear", "Heart regular"],
        "labs": ["Troponin negative x2"],
        "imaging": ["ECG normal sinus rhythm"],
    },
    "assessment": {
        "primary_diagnosis": "Chest pain, ruled out MI",
        "differential": ["GERD", "Musculoskeletal"],
        "clinical_impression": "Low-risk chest pain with negative troponins and normal ECG, likely non-cardiac etiology.",
    },
    "plan": {
        "medications": [{"drug": "Omeprazole", "dose": "20 mg", "frequency": "daily"}],
        "procedures": [],
        "referrals": ["PCP follow-up"],
        "follow_up": "Follow up with PCP in 3 days",
        "patient_education": [],  # Missing return precautions!
    },
}


# ---------- TestIsPatientAdmitted ----------


class TestIsPatientAdmitted:
    def test_ccu_in_procedures(self):
        soap = {**STEMI_SOAP}
        # STEMI has "Cath lab activated" and "Emergent PCI" — "cath lab" contains "lab" not admission
        # Let's make a direct test
        soap_admit = _deep_copy_soap(STEMI_SOAP)
        soap_admit["plan"]["procedures"] = ["Admit to CCU"]
        assert _is_patient_admitted(soap_admit) is True

    def test_icu_in_referrals(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["referrals"] = ["Transfer to ICU"]
        assert _is_patient_admitted(soap) is True

    def test_admission_in_follow_up(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["follow_up"] = "Admission to telemetry floor"
        assert _is_patient_admitted(soap) is True

    def test_outpatient_not_admitted(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["follow_up"] = "Follow up in clinic in 3 days"
        assert _is_patient_admitted(soap) is False

    def test_empty_plan_not_admitted(self):
        assert _is_patient_admitted(MINIMAL_SOAP) is False

    def test_observation_admitted(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["procedures"] = ["Place in observation"]
        assert _is_patient_admitted(soap) is True


# ---------- TestCheckAssessmentPlanGap ----------


class TestCheckAssessmentPlanGap:
    def test_no_diagnosis_passes(self):
        assert _check_assessment_plan_gap(MINIMAL_SOAP) is None

    def test_direct_keyword_match(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["assessment"]["primary_diagnosis"] = "Pneumonia"
        soap["plan"]["medications"] = [{"drug": "Pneumonia treatment antibiotics"}]
        assert _check_assessment_plan_gap(soap) is None

    def test_stemi_concept_mapping(self):
        """STEMI fixture: 'stemi' not in plan text, but aspirin/heparin/PCI are."""
        result = _check_assessment_plan_gap(STEMI_SOAP)
        assert result is None, f"STEMI should pass via concept mapping, got: {result}"

    def test_concept_mapping_sepsis(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["assessment"]["primary_diagnosis"] = "Sepsis"
        # Vancomycin doesn't match mapping terms directly — add a mapped term
        soap["plan"]["medications"] = [{"drug": "Vancomycin", "dose": "1g", "frequency": "q12h"}]
        soap["plan"]["procedures"] = ["IV fluid resuscitation", "Blood culture"]
        assert _check_assessment_plan_gap(soap) is None

    def test_concept_mapping_stroke(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["assessment"]["primary_diagnosis"] = "Acute ischemic stroke"
        soap["plan"]["medications"] = [
            {"drug": "Alteplase", "dose": "0.9 mg/kg", "frequency": "once"}
        ]
        assert _check_assessment_plan_gap(soap) is None

    def test_substantive_plan_fallback(self):
        """High-acuity dx with 2+ meds and 1+ procedure should pass."""
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["assessment"]["primary_diagnosis"] = "STEMI"
        soap["plan"]["medications"] = [
            {"drug": "DrugA", "dose": "10mg"},
            {"drug": "DrugB", "dose": "20mg"},
        ]
        soap["plan"]["procedures"] = ["Procedure X"]
        assert _check_assessment_plan_gap(soap) is None

    def test_unaddressed_diagnosis_fails(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["assessment"]["primary_diagnosis"] = "Hypothyroidism"
        soap["plan"]["medications"] = [
            {"drug": "Acetaminophen", "dose": "500mg", "frequency": "q6h"}
        ]
        result = _check_assessment_plan_gap(soap)
        assert result is not None
        assert result.rule_id == "ASSESSMENT_PLAN_GAP"

    def test_clinical_impression_searched(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["assessment"]["primary_diagnosis"] = "Cellulitis"
        soap["assessment"][
            "clinical_impression"
        ] = "Cellulitis of left lower extremity requiring antibiotics"
        assert _check_assessment_plan_gap(soap) is None


# ---------- TestCheckNoRedFlags ----------


class TestCheckNoRedFlags:
    def test_non_acuity_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["assessment"]["primary_diagnosis"] = "Common cold"
        assert _check_no_red_flags(soap) is None

    def test_admitted_patient_passes(self):
        soap = _deep_copy_soap(STEMI_SOAP)
        # Add admission term to procedures
        soap_admit = _deep_copy_soap(soap)
        soap_admit["plan"]["procedures"] = ["Emergent PCI", "Admit to CCU"]
        assert _check_no_red_flags(soap_admit) is None

    def test_discharge_without_precautions_fails(self):
        result = _check_no_red_flags(DISCHARGE_HIGH_ACUITY)
        # DISCHARGE_HIGH_ACUITY has MI in the dx but no return precautions
        # Actually "ruled out MI" still has "mi" keyword
        # patient_education is empty so no return terms
        # But it has PCP follow-up in referrals — check if admitted
        # referrals: ["PCP follow-up"] — "pcp" is not in ADMISSION_TERMS
        # So it should fail
        assert result is not None
        assert result.rule_id == "NO_RED_FLAGS"

    def test_return_precautions_present_passes(self):
        soap = _deep_copy_soap(DISCHARGE_HIGH_ACUITY)
        soap["plan"]["patient_education"] = ["Return to ER if chest pain worsens"]
        assert _check_no_red_flags(soap) is None

    def test_stemi_with_cath_lab_not_admitted(self):
        """STEMI fixture has 'Cath lab activated' — 'lab' is not an admission term."""
        result = _check_no_red_flags(STEMI_SOAP)
        # Without explicit admission, this should fire (no patient_education)
        # patient_education is null in the fixture
        assert result is not None

    def test_stemi_with_admission_passes(self):
        soap = _deep_copy_soap(STEMI_SOAP)
        soap["plan"]["procedures"].append("Admit to CCU")
        assert _check_no_red_flags(soap) is None


# ---------- TestCheckNoFollowup ----------


class TestCheckNoFollowup:
    def test_explicit_follow_up_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["follow_up"] = "Return in 2 weeks"
        assert _check_no_followup(soap) is None

    def test_null_follow_up_no_disposition_fails(self):
        result = _check_no_followup(MINIMAL_SOAP)
        assert result is not None
        assert result.rule_id == "NO_FOLLOWUP"

    def test_admission_in_procedures_passes(self):
        """'Cath lab activated' contains 'cath lab' which is a disposition term."""
        result = _check_no_followup(STEMI_SOAP)
        assert result is None, "STEMI with 'Cath lab activated' should pass via disposition terms"

    def test_pcp_in_referrals_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["referrals"] = ["PCP follow-up in 3 days"]
        assert _check_no_followup(soap) is None

    def test_icu_in_procedures_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["procedures"] = ["Transfer to ICU"]
        assert _check_no_followup(soap) is None

    def test_discharge_in_procedures_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["procedures"] = ["Discharge home"]
        assert _check_no_followup(soap) is None


# ---------- TestCheckMissingMedNecessity ----------


class TestCheckMissingMedNecessity:
    def test_full_impression_passes(self):
        assert _check_missing_med_necessity(WELL_DOCUMENTED_SOAP) is None

    def test_no_diagnosis_passes(self):
        assert _check_missing_med_necessity(MINIMAL_SOAP) is None

    def test_descriptive_diagnosis_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["assessment"][
            "primary_diagnosis"
        ] = "Anterior STEMI with ST elevation in leads V2-V5 and troponin elevation"
        assert _check_missing_med_necessity(soap) is None

    def test_short_dx_no_impression_no_plan_errors(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["assessment"]["primary_diagnosis"] = "STEMI"
        result = _check_missing_med_necessity(soap)
        assert result is not None
        assert result.severity == "error"

    def test_short_dx_no_impression_with_plan_warns(self):
        """STEMI fixture: short dx, no impression, but has meds + procedures → warning."""
        result = _check_missing_med_necessity(STEMI_SOAP)
        assert result is not None
        assert result.severity == "warning"
        assert result.rule_id == "MISSING_MED_NECESSITY"

    def test_adequate_impression_passes(self):
        soap = _deep_copy_soap(STEMI_SOAP)
        soap["assessment"][
            "clinical_impression"
        ] = "ST elevation in V2-V5 with elevated troponin consistent with acute anterior STEMI."
        assert _check_missing_med_necessity(soap) is None


# ---------- TestCheckMedIncomplete ----------


class TestCheckMedIncomplete:
    def test_complete_meds_pass(self):
        assert _check_med_incomplete(WELL_DOCUMENTED_SOAP) == []

    def test_no_meds_pass(self):
        assert _check_med_incomplete(MINIMAL_SOAP) == []

    def test_missing_drug_name_fails(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["medications"] = [{"drug": "", "dose": "10mg", "frequency": "daily"}]
        flags = _check_med_incomplete(soap)
        assert len(flags) == 1
        assert "drug name" in flags[0].message

    def test_missing_dose_fails(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["medications"] = [{"drug": "Aspirin", "dose": "", "frequency": "daily"}]
        flags = _check_med_incomplete(soap)
        assert len(flags) == 1
        assert "dose" in flags[0].message

    def test_missing_frequency_fails(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["medications"] = [{"drug": "Aspirin", "dose": "81mg", "frequency": ""}]
        flags = _check_med_incomplete(soap)
        assert len(flags) == 1
        assert "frequency" in flags[0].message

    def test_bolus_dose_no_frequency_passes(self):
        """Heparin bolus — stat dose doesn't need frequency."""
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["medications"] = [{"drug": "Heparin", "dose": "bolus", "frequency": None}]
        flags = _check_med_incomplete(soap)
        assert flags == []

    def test_loading_dose_no_frequency_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["medications"] = [
            {"drug": "Ticagrelor", "dose": "180 loading dose", "frequency": None}
        ]
        flags = _check_med_incomplete(soap)
        assert flags == []

    def test_stat_dose_no_frequency_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["medications"] = [{"drug": "Aspirin", "dose": "325 stat", "frequency": ""}]
        flags = _check_med_incomplete(soap)
        assert flags == []

    def test_chewed_dose_no_frequency_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["medications"] = [
            {"drug": "Aspirin", "dose": "325 mg chewed", "frequency": ""}
        ]
        flags = _check_med_incomplete(soap)
        assert flags == []

    def test_stemi_fixture_only_one_flag(self):
        """STEMI fixture: Aspirin 325 (no indicator), Heparin bolus, Ticagrelor 180 loading dose.
        Only Aspirin should flag for missing frequency (dose is just '325')."""
        flags = _check_med_incomplete(STEMI_SOAP)
        assert len(flags) == 1
        assert "frequency" in flags[0].message
        assert "#1" in flags[0].message  # Aspirin is medication #1

    def test_multiple_missing_fields(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["medications"] = [{"drug": "", "dose": "", "frequency": ""}]
        flags = _check_med_incomplete(soap)
        assert len(flags) == 1
        assert "drug name" in flags[0].message
        assert "dose" in flags[0].message
        assert "frequency" in flags[0].message

    def test_prn_dose_no_frequency_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["medications"] = [
            {"drug": "Morphine", "dose": "4mg IV push prn", "frequency": ""}
        ]
        flags = _check_med_incomplete(soap)
        assert flags == []


# ---------- TestCheckNoAllergiesDoc ----------


class TestCheckNoAllergiesDoc:
    def test_nkda_in_patient_reported_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["subjective"]["patient_reported"] = ["NKDA"]
        assert _check_no_allergies_doc(soap) is None

    def test_allergy_in_hpi_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["subjective"][
            "history_of_present_illness"
        ] = "Patient reports no known drug allergies."
        assert _check_no_allergies_doc(soap) is None

    def test_allergic_mention_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["subjective"]["patient_reported"] = ["Allergic to penicillin"]
        assert _check_no_allergies_doc(soap) is None

    def test_no_allergy_docs_fails(self):
        result = _check_no_allergies_doc(MINIMAL_SOAP)
        assert result is not None
        assert result.rule_id == "NO_ALLERGIES_DOC"

    def test_stemi_fixture_fails(self):
        """STEMI fixture has no allergy documentation."""
        result = _check_no_allergies_doc(STEMI_SOAP)
        assert result is not None

    def test_well_documented_passes(self):
        assert _check_no_allergies_doc(WELL_DOCUMENTED_SOAP) is None


# ---------- TestCheckVitalsIncomplete ----------


class TestCheckVitalsIncomplete:
    def test_all_five_vitals_passes(self):
        assert _check_vitals_incomplete(WELL_DOCUMENTED_SOAP) is None

    def test_four_vitals_passes(self):
        """STEMI fixture: BP, HR, RR, SpO2 (4/5) — should pass."""
        assert _check_vitals_incomplete(STEMI_SOAP) is None

    def test_two_vitals_fails(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["objective"]["vital_signs"] = {
            "BP": "120/80",
            "HR": "72",
            "Temp": None,
            "RR": None,
            "SpO2": None,
        }
        result = _check_vitals_incomplete(soap)
        assert result is not None
        assert "2/5" in result.message

    def test_zero_vitals_fails(self):
        result = _check_vitals_incomplete(MINIMAL_SOAP)
        assert result is not None
        assert "0/5" in result.message

    def test_three_vitals_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["objective"]["vital_signs"] = {
            "BP": "120/80",
            "HR": "72",
            "Temp": "98.6",
            "RR": None,
            "SpO2": None,
        }
        assert _check_vitals_incomplete(soap) is None


# ---------- TestCheckNoDiffDx ----------


class TestCheckNoDiffDx:
    def test_with_differentials_passes(self):
        assert _check_no_diff_dx(WELL_DOCUMENTED_SOAP) is None

    def test_no_primary_dx_passes(self):
        assert _check_no_diff_dx(MINIMAL_SOAP) is None

    def test_primary_dx_no_diff_fails(self):
        result = _check_no_diff_dx(STEMI_SOAP)
        assert result is not None
        assert result.rule_id == "NO_DIFF_DX"

    def test_empty_string_differentials_fail(self):
        soap = _deep_copy_soap(STEMI_SOAP)
        soap["assessment"]["differential"] = ["", "  "]
        result = _check_no_diff_dx(soap)
        assert result is not None


# ---------- TestCheckNoPertinentNeg ----------


class TestCheckNoPertinentNeg:
    def test_low_acuity_cc_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["subjective"]["chief_complaint"] = "Sore throat"
        assert _check_no_pertinent_neg(soap) is None

    def test_high_acuity_with_negatives_passes(self):
        assert _check_no_pertinent_neg(WELL_DOCUMENTED_SOAP) is None

    def test_high_acuity_no_ros_fails(self):
        # STEMI fixture CC is "chest pressure" not "chest pain", so build a direct case
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["subjective"]["chief_complaint"] = "Chest pain for 3 hours"
        soap["subjective"]["review_of_systems"] = []
        result = _check_no_pertinent_neg(soap)
        assert result is not None
        assert result.rule_id == "NO_PERTINENT_NEG"

    def test_chest_pain_with_denies_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["subjective"]["chief_complaint"] = "Chest pain"
        soap["subjective"]["review_of_systems"] = ["Denies shortness of breath"]
        assert _check_no_pertinent_neg(soap) is None


# ---------- TestCheckIcd10Unspecified ----------


class TestCheckIcd10Unspecified:
    def test_no_unspecified_passes(self):
        assert _check_icd10_unspecified(STEMI_SOAP) is None

    def test_unspecified_with_laterality_warns(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["assessment"]["primary_diagnosis"] = "Knee pain, unspecified"
        soap["objective"]["physical_exam"] = ["Right knee swelling"]
        result = _check_icd10_unspecified(soap)
        assert result is not None
        assert result.severity == "warning"

    def test_unspecified_without_laterality_passes(self):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["assessment"]["primary_diagnosis"] = "Headache, unspecified"
        soap["objective"]["physical_exam"] = ["No focal deficits"]
        assert _check_icd10_unspecified(soap) is None


# ---------- TestComputeComplianceScore ----------


class TestComputeComplianceScore:
    def test_no_flags_perfect_score(self):
        result = compute_compliance_score([], 10)
        assert result.score == 100.0
        assert result.grade == "A"
        assert result.rules_passed == 10

    def test_one_error_claim_denial(self):
        flags = [
            ComplianceFlag(
                severity="error",
                domain="claim_denial",
                section="plan",
                field="plan.medications.0",
                rule_id="MED_INCOMPLETE",
                message="test",
            )
        ]
        result = compute_compliance_score(flags, 10)
        assert result.score == 85.0
        assert result.claim_denial_score == 85.0
        assert result.malpractice_score == 100.0

    def test_one_warning_malpractice(self):
        flags = [
            ComplianceFlag(
                severity="warning",
                domain="malpractice",
                section="plan",
                field="plan.follow_up",
                rule_id="NO_FOLLOWUP",
                message="test",
            )
        ]
        result = compute_compliance_score(flags, 10)
        assert result.score == 95.0

    def test_grade_boundaries(self):
        assert compute_compliance_score([], 10).grade == "A"
        # 1 error claim_denial = -15 → 85 = B
        flags_b = [
            ComplianceFlag(
                severity="error",
                domain="claim_denial",
                section="plan",
                field="x",
                rule_id="X",
                message="x",
            )
        ]
        assert compute_compliance_score(flags_b, 10).grade == "B"
        # 2 errors claim_denial = -30 → 70 = C
        flags_c = flags_b * 2
        assert compute_compliance_score(flags_c, 10).grade == "C"
        # 3 errors = -45 → 55 = F
        flags_f = flags_b * 3
        assert compute_compliance_score(flags_f, 10).grade == "F"

    def test_score_floor_at_zero(self):
        flags = [
            ComplianceFlag(
                severity="error",
                domain="claim_denial",
                section="plan",
                field="x",
                rule_id="X",
                message="x",
            )
        ] * 10
        result = compute_compliance_score(flags, 10)
        assert result.score == 0.0


# ---------- TestRunDeterministicValidation ----------


class TestRunDeterministicValidation:
    def test_stemi_fixture_score(self):
        """STEMI fixture after rule fixes: ASSESSMENT_PLAN_GAP and NO_FOLLOWUP eliminated.
        Remaining: NO_ALLERGIES_DOC (-15), NO_DIFF_DX (-12), NO_RED_FLAGS (-12),
        MISSING_MED_NECESSITY warning (-7), MED_INCOMPLETE x1 (-15) = 100-61 = 39.
        NO_RED_FLAGS still fires because fixture doesn't have explicit admission."""
        flags = run_deterministic_validation(STEMI_SOAP)
        result = compute_compliance_score(flags, 10)
        assert (
            result.score >= 39
        ), f"STEMI score {result.score}, flags: {[f.rule_id for f in flags]}"

    def test_stemi_no_false_positives(self):
        """STEMI fixture should NOT have ASSESSMENT_PLAN_GAP or NO_FOLLOWUP false positives."""
        flags = run_deterministic_validation(STEMI_SOAP)
        rule_ids = [f.rule_id for f in flags]
        assert "ASSESSMENT_PLAN_GAP" not in rule_ids, "STEMI should pass via concept mapping"
        assert "NO_FOLLOWUP" not in rule_ids, "STEMI 'Cath lab' should count as disposition"

    def test_stemi_with_admission_score(self):
        """STEMI with explicit admission eliminates NO_RED_FLAGS too."""
        soap = _deep_copy_soap(STEMI_SOAP)
        soap["plan"]["procedures"].append("Admit to CCU")
        flags = run_deterministic_validation(soap)
        result = compute_compliance_score(flags, 10)
        rule_ids = [f.rule_id for f in flags]
        assert "NO_RED_FLAGS" not in rule_ids
        # Score: 100 - 15 - 12 - 7 - 15 = 51
        assert result.score >= 46, f"Score {result.score}, flags: {rule_ids}"

    def test_stemi_expected_failures(self):
        """STEMI fixture should still correctly flag real gaps."""
        flags = run_deterministic_validation(STEMI_SOAP)
        rule_ids = [f.rule_id for f in flags]
        assert "NO_ALLERGIES_DOC" in rule_ids, "No allergy doc is a real gap"
        assert "NO_DIFF_DX" in rule_ids, "No differentials is a real gap"

    def test_well_documented_high_score(self):
        """Well-documented SOAP should score >= 88."""
        flags = run_deterministic_validation(WELL_DOCUMENTED_SOAP)
        result = compute_compliance_score(flags, 10)
        assert (
            result.score >= 88
        ), f"Well-documented score {result.score}, flags: {[f.rule_id for f in flags]}"

    def test_minimal_soap_low_score(self):
        """Minimal/empty SOAP should have a low score."""
        flags = run_deterministic_validation(MINIMAL_SOAP)
        result = compute_compliance_score(flags, 10)
        # Empty SOAP: no dx → many rules don't fire, but vitals, allergies fail
        assert result.score < 100

    def test_discharge_high_acuity_red_flags(self):
        """Discharge patient with high-acuity dx missing precautions should flag."""
        flags = run_deterministic_validation(DISCHARGE_HIGH_ACUITY)
        rule_ids = [f.rule_id for f in flags]
        assert "NO_RED_FLAGS" in rule_ids


# ---------- TestSTEMIWellDocumented ----------


class TestSTEMIWellDocumented:
    def test_well_structured_stemi_scores_high(self):
        """Well-documented STEMI with all fields should score >= 88."""
        flags = run_deterministic_validation(WELL_DOCUMENTED_SOAP)
        result = compute_compliance_score(flags, 10)
        assert (
            result.score >= 88
        ), f"Score: {result.score}, flags: {[(f.rule_id, f.severity) for f in flags]}"

    def test_well_structured_stemi_no_errors(self):
        """Well-documented STEMI should have no errors."""
        flags = run_deterministic_validation(WELL_DOCUMENTED_SOAP)
        errors = [f for f in flags if f.severity == "error"]
        assert len(errors) == 0, f"Unexpected errors: {[(f.rule_id, f.message) for f in errors]}"


# ---------- Test stat indicator constants ----------


class TestStatIndicators:
    @pytest.mark.parametrize("indicator", STAT_INDICATORS)
    def test_all_stat_indicators_recognized(self, indicator):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["medications"] = [
            {"drug": "TestDrug", "dose": f"10mg {indicator}", "frequency": ""}
        ]
        flags = _check_med_incomplete(soap)
        assert flags == [], f"Stat indicator '{indicator}' should prevent frequency flag"


class TestAdmissionTerms:
    @pytest.mark.parametrize("term", ADMISSION_TERMS)
    def test_all_admission_terms_recognized(self, term):
        soap = _deep_copy_soap(MINIMAL_SOAP)
        soap["plan"]["procedures"] = [f"Patient to {term}"]
        assert _is_patient_admitted(soap) is True, f"Admission term '{term}' not recognized"


# ---------- Helpers ----------


def _deep_copy_soap(soap: dict) -> dict:
    """Deep copy a SOAP dict for mutation in tests."""
    return json.loads(json.dumps(soap))
