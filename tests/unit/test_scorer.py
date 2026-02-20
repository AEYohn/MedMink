"""Unit tests for scorer check functions.

Tests the extracted pure functions from scorer.py without requiring
MedGemma or any LLM calls.
"""

import pytest

from src.evaluation.scorer import (
    CheckResult,
    CaseScore,
    _text_contains_any,
    _list_contains_any,
    _check_text_keywords,
    _check_list_keywords,
    check_must_recommend,
    check_not_falsely_harmful,
    check_self_contradictions,
    check_home_med_contamination,
    check_acute_management_present,
    check_timing_in_rationale,
    check_cross_field_consistency,
    check_ddx_includes_primary,
    check_dosing_plausibility,
    check_txgemma_safety_alignment,
    check_compliance_grade,
)


# ---------------------------------------------------------------------------
# _text_contains_any
# ---------------------------------------------------------------------------


class TestTextContainsAny:
    def test_exact_match(self):
        found, matched = _text_contains_any("cardiology", ["cardiology"])
        assert found is True
        assert matched == ["cardiology"]

    def test_case_insensitive(self):
        found, matched = _text_contains_any("Cardiology", ["cardiology"])
        assert found is True
        assert "cardiology" in matched

    def test_substring_match(self):
        found, matched = _text_contains_any("neurology department", ["neuro"])
        assert found is True

    def test_no_match(self):
        found, matched = _text_contains_any("cardiology", ["neurology"])
        assert found is False
        assert matched == []

    def test_empty_keywords(self):
        found, matched = _text_contains_any("anything", [])
        assert found is False

    def test_empty_text(self):
        found, matched = _text_contains_any("", ["cardiology"])
        assert found is False

    def test_multiple_matches(self):
        found, matched = _text_contains_any("severe high-risk case", ["severe", "high", "moderate"])
        assert found is True
        assert "severe" in matched
        assert "high" in matched
        assert "moderate" not in matched


# ---------------------------------------------------------------------------
# _list_contains_any
# ---------------------------------------------------------------------------


class TestListContainsAny:
    def test_keyword_in_item(self):
        found, matched = _list_contains_any(
            ["Neurology — emergent", "Cardiology — urgent"],
            ["neurology"],
        )
        assert found is True

    def test_no_match(self):
        found, matched = _list_contains_any(
            ["Neurology — emergent"],
            ["orthopedic"],
        )
        assert found is False

    def test_empty_list(self):
        found, matched = _list_contains_any([], ["anything"])
        assert found is False

    def test_empty_keywords(self):
        found, matched = _list_contains_any(["item"], [])
        assert found is False


# ---------------------------------------------------------------------------
# _check_text_keywords / _check_list_keywords
# ---------------------------------------------------------------------------


class TestCheckTextKeywords:
    def test_appends_passing_check(self):
        score = CaseScore(case_id="test", case_name="Test")
        _check_text_keywords(score, "Category", "cardiology", ["cardiology"])
        assert len(score.checks) == 1
        assert score.checks[0].passed is True
        assert score.checks[0].name == "Category"

    def test_appends_failing_check(self):
        score = CaseScore(case_id="test", case_name="Test")
        _check_text_keywords(score, "Category", "neurology", ["cardiology"])
        assert len(score.checks) == 1
        assert score.checks[0].passed is False

    def test_skips_empty_keywords(self):
        score = CaseScore(case_id="test", case_name="Test")
        _check_text_keywords(score, "Category", "anything", [])
        assert len(score.checks) == 0

    def test_truncates_long_text_in_details(self):
        score = CaseScore(case_id="test", case_name="Test")
        long_text = "a" * 200
        _check_text_keywords(score, "Test", long_text, ["aaaa"], truncate=80)
        assert len(score.checks[0].details) < 200


class TestCheckListKeywords:
    def test_appends_passing_check(self):
        score = CaseScore(case_id="test", case_name="Test")
        _check_list_keywords(score, "Consults", ["Neurology — emergent"], ["neurology"])
        assert len(score.checks) == 1
        assert score.checks[0].passed is True

    def test_skips_empty_keywords(self):
        score = CaseScore(case_id="test", case_name="Test")
        _check_list_keywords(score, "Consults", ["item"], [])
        assert len(score.checks) == 0


# ---------------------------------------------------------------------------
# check_must_recommend (OR-group semantics)
# ---------------------------------------------------------------------------


class TestMustRecommend:
    def test_flat_keyword_found(self):
        results = check_must_recommend(
            "aspirin 325 mg thrombectomy", ["aspirin"], ["Aspirin 325 mg", "Thrombectomy"]
        )
        assert len(results) == 1
        assert results[0].passed is True

    def test_flat_keyword_not_found(self):
        results = check_must_recommend("aspirin 325 mg", ["heparin"], ["Aspirin 325 mg"])
        assert len(results) == 1
        assert results[0].passed is False

    def test_or_group_first_matches(self):
        results = check_must_recommend(
            "alteplase 0.9 mg/kg iv",
            [["alteplase", "tPA", "tenecteplase"]],
            ["Alteplase 0.9 mg/kg IV"],
        )
        assert len(results) == 1
        assert results[0].passed is True

    def test_or_group_second_matches(self):
        results = check_must_recommend(
            "iv tpa bolus + infusion",
            [["alteplase", "tPA", "tenecteplase"]],
            ["IV tPA bolus + infusion"],
        )
        assert len(results) == 1
        assert results[0].passed is True

    def test_or_group_third_matches(self):
        results = check_must_recommend(
            "tenecteplase 0.25 mg/kg iv",
            [["alteplase", "tPA", "tenecteplase"]],
            ["Tenecteplase 0.25 mg/kg IV"],
        )
        assert len(results) == 1
        assert results[0].passed is True

    def test_or_group_none_matches(self):
        results = check_must_recommend(
            "aspirin 325 mg",
            [["alteplase", "tPA", "tenecteplase"]],
            ["Aspirin 325 mg"],
        )
        assert len(results) == 1
        assert results[0].passed is False

    def test_or_group_label_shows_alternatives(self):
        results = check_must_recommend(
            "alteplase",
            [["alteplase", "tPA", "tenecteplase"]],
            ["Alteplase"],
        )
        assert "alteplase | tPA | tenecteplase" in results[0].name

    def test_mixed_flat_and_group(self):
        results = check_must_recommend(
            "tenecteplase 0.25 mg/kg mechanical thrombectomy",
            [["alteplase", "tPA", "tenecteplase"], "thrombectomy"],
            ["Tenecteplase 0.25 mg/kg", "Mechanical thrombectomy"],
        )
        assert len(results) == 2
        assert all(r.passed for r in results)

    def test_empty_list(self):
        results = check_must_recommend("anything", [], ["Anything"])
        assert results == []

    def test_single_element_group(self):
        results = check_must_recommend("aspirin 325 mg", [["aspirin"]], ["Aspirin 325 mg"])
        assert len(results) == 1
        assert results[0].passed is True


# ---------------------------------------------------------------------------
# check_not_falsely_harmful (OR-group semantics)
# ---------------------------------------------------------------------------


class TestNotFalselyHarmful:
    def test_correctly_recommended(self):
        verdicts = {"Aspirin 325 mg": "recommended"}
        results = check_not_falsely_harmful(verdicts, ["aspirin"])
        assert len(results) == 1
        assert results[0].passed is True

    def test_falsely_harmful(self):
        verdicts = {"Aspirin 325 mg": "not_recommended"}
        results = check_not_falsely_harmful(verdicts, ["aspirin"])
        assert len(results) == 1
        assert results[0].passed is False

    def test_or_group_none_harmful(self):
        verdicts = {"Tenecteplase 0.25 mg/kg": "recommended"}
        results = check_not_falsely_harmful(verdicts, [["alteplase", "tPA", "tenecteplase"]])
        assert len(results) == 1
        assert results[0].passed is True

    def test_or_group_one_harmful(self):
        verdicts = {"Alteplase 0.9 mg/kg": "not_recommended"}
        results = check_not_falsely_harmful(verdicts, [["alteplase", "tPA", "tenecteplase"]])
        assert len(results) == 1
        assert results[0].passed is False

    def test_consider_verdict_not_flagged(self):
        verdicts = {"Aspirin 325 mg": "consider"}
        results = check_not_falsely_harmful(verdicts, ["aspirin"])
        assert results[0].passed is True

    def test_empty_list(self):
        results = check_not_falsely_harmful({}, [])
        assert results == []


# ---------------------------------------------------------------------------
# check_self_contradictions
# ---------------------------------------------------------------------------


class TestSelfContradictions:
    def test_no_contradiction(self):
        options = [{"name": "Aspirin 325 mg", "verdict": "recommended"}]
        dnd = ["Do not give morphine"]
        result = check_self_contradictions(options, dnd)
        assert result.passed is True

    def test_contradiction_detected(self):
        options = [{"name": "Aspirin 325 mg PO", "verdict": "recommended"}]
        dnd = ["Do not give aspirin within 24h of tPA"]
        result = check_self_contradictions(options, dnd)
        assert result.passed is False

    def test_not_recommended_not_flagged(self):
        options = [{"name": "Aspirin 325 mg", "verdict": "not_recommended"}]
        dnd = ["Do not give aspirin"]
        result = check_self_contradictions(options, dnd)
        assert result.passed is True

    def test_stopwords_ignored(self):
        """Words like 'oral', 'dose', 'daily' shouldn't trigger contradictions."""
        options = [{"name": "Oral atorvastatin 80 mg daily", "verdict": "recommended"}]
        dnd = ["Avoid oral medications until swallow eval"]
        result = check_self_contradictions(options, dnd)
        # "oral" and "daily" are stopwords, should not trigger
        # But "atorvastatin" (8 chars) is NOT in the DND text, so no contradiction
        assert result.passed is True

    def test_empty_dnd(self):
        options = [{"name": "Aspirin", "verdict": "recommended"}]
        result = check_self_contradictions(options, [])
        assert result.passed is True

    def test_empty_options(self):
        result = check_self_contradictions([], ["Do not give aspirin"])
        assert result.passed is True


# ---------------------------------------------------------------------------
# check_home_med_contamination
# ---------------------------------------------------------------------------


class TestHomeMedContamination:
    def test_no_contamination(self):
        options = [
            {"name": "Alteplase 0.9 mg/kg IV", "rationale": "thrombolysis"},
            {"name": "Mechanical thrombectomy", "rationale": "M1 occlusion"},
        ]
        result = check_home_med_contamination(options, ["lisinopril 10 mg", "metformin 500 mg"], [])
        assert result.passed is True

    def test_contamination_detected(self):
        options = [
            {"name": "Lisinopril 10 mg daily", "rationale": "continue BP control"},
            {"name": "Alteplase 0.9 mg/kg IV", "rationale": "thrombolysis"},
        ]
        result = check_home_med_contamination(options, ["lisinopril 10 mg"], [])
        assert result.passed is False
        assert "lisinopril" in result.details.lower()

    def test_modify_keyword_in_name_allows(self):
        options = [
            {"name": "Hold lisinopril", "rationale": "acute stroke"},
        ]
        result = check_home_med_contamination(options, ["lisinopril 10 mg"], [])
        assert result.passed is True

    def test_modify_keyword_in_rationale_allows(self):
        options = [
            {"name": "Lisinopril management", "rationale": "discontinue during acute phase"},
        ]
        result = check_home_med_contamination(options, ["lisinopril 10 mg"], [])
        assert result.passed is True

    def test_taper_keyword_allows(self):
        options = [
            {"name": "Metformin dose", "rationale": "taper and reassess renal function"},
        ]
        result = check_home_med_contamination(options, ["metformin 500 mg"], [])
        assert result.passed is True

    def test_exception_list_skips_med(self):
        options = [
            {"name": "Lithium level monitoring", "rationale": "track clearance"},
        ]
        result = check_home_med_contamination(options, ["lithium 900 mg BID"], ["lithium"])
        assert result.passed is True

    def test_exception_substring_match(self):
        """Exception 'thiazide' should match home med 'hydrochlorothiazide'."""
        options = [
            {"name": "Hydrochlorothiazide cessation", "rationale": "contributing to toxicity"},
        ]
        result = check_home_med_contamination(options, ["hydrochlorothiazide 25 mg"], ["thiazide"])
        assert result.passed is True

    def test_empty_home_meds_returns_none(self):
        options = [{"name": "Aspirin 325 mg", "rationale": "antiplatelet"}]
        result = check_home_med_contamination(options, [], [])
        assert result is None

    def test_short_med_name_skipped(self):
        """Med names < 3 chars should be skipped."""
        options = [{"name": "K+ replacement", "rationale": "hypokalemia"}]
        result = check_home_med_contamination(options, ["K 20 mEq"], [])
        # "K" is 1 char, too short to match
        assert result.passed is True

    def test_word_boundary_prevents_false_match(self):
        """A home med name shouldn't match a different drug by substring."""
        options = [
            {"name": "Aspirin 325 mg PO", "rationale": "antiplatelet"},
        ]
        # Hypothetical drug "aspirinol" should NOT match "aspirin" with word boundary
        result = check_home_med_contamination(options, ["aspirinol 100 mg"], [])
        assert result.passed is True

    def test_multiple_home_meds_one_contaminated(self):
        options = [
            {"name": "Alteplase 0.9 mg/kg IV", "rationale": "thrombolysis"},
            {"name": "Atorvastatin 80 mg PO", "rationale": "lipid control"},
        ]
        result = check_home_med_contamination(
            options,
            ["lisinopril 10 mg", "atorvastatin 20 mg"],
            [],
        )
        assert result.passed is False
        assert "atorvastatin" in result.details.lower()


# ---------------------------------------------------------------------------
# check_acute_management_present
# ---------------------------------------------------------------------------


class TestAcuteManagementPresent:
    def test_both_present(self):
        result = check_acute_management_present(
            {
                "risk_stratification": "HIGH — large vessel occlusion",
                "immediate_actions": ["activate stroke team", "prep tPA"],
            }
        )
        assert result.passed is True

    def test_risk_missing(self):
        result = check_acute_management_present(
            {
                "immediate_actions": ["call stroke team"],
            }
        )
        assert result.passed is False
        assert "MISSING" in result.details

    def test_actions_missing(self):
        result = check_acute_management_present(
            {
                "risk_stratification": "HIGH",
            }
        )
        assert result.passed is False

    def test_empty_dict(self):
        result = check_acute_management_present({})
        assert result.passed is False

    def test_empty_string_risk(self):
        result = check_acute_management_present(
            {
                "risk_stratification": "",
                "immediate_actions": ["do something"],
            }
        )
        assert result.passed is False

    def test_empty_list_actions(self):
        result = check_acute_management_present(
            {
                "risk_stratification": "HIGH",
                "immediate_actions": [],
            }
        )
        assert result.passed is False


# ---------------------------------------------------------------------------
# check_timing_in_rationale
# ---------------------------------------------------------------------------


class TestTimingInRationale:
    def test_timing_found(self):
        options = [
            {"name": "Aspirin 325 mg", "rationale": "give 24h AFTER tPA, confirm no hemorrhage"},
        ]
        result = check_timing_in_rationale(options, ["after", "before", "within"])
        assert result.passed is True
        assert "after" in result.details.lower()

    def test_timing_not_found(self):
        options = [
            {
                "name": "Aspirin 325 mg",
                "rationale": "antiplatelet therapy for secondary prevention",
            },
        ]
        result = check_timing_in_rationale(options, ["24h", "before", "within"])
        assert result.passed is False

    def test_empty_keywords_returns_none(self):
        result = check_timing_in_rationale([], [])
        assert result is None

    def test_multiple_options_any_match(self):
        options = [
            {"name": "BP management", "rationale": "target SBP < 140"},
            {"name": "Alteplase", "rationale": "administer within 4.5 hours of onset"},
        ]
        result = check_timing_in_rationale(options, ["within", "4.5"])
        assert result.passed is True

    def test_missing_rationale_field(self):
        """Options without rationale should not crash."""
        options = [{"name": "Some treatment"}]
        result = check_timing_in_rationale(options, ["before"])
        assert result.passed is False


# ---------------------------------------------------------------------------
# check_cross_field_consistency (Check 15)
# ---------------------------------------------------------------------------


class TestCrossFieldConsistency:
    def test_high_risk_icu_passes(self):
        result = check_cross_field_consistency("HIGH — large vessel occlusion", "ICU admission")
        assert result.passed is True

    def test_high_risk_discharge_fails(self):
        result = check_cross_field_consistency("SEVERE — septic shock", "discharge with follow-up")
        assert result.passed is False

    def test_low_risk_discharge_passes(self):
        result = check_cross_field_consistency(
            "LOW — stable outpatient condition", "discharge home"
        )
        assert result.passed is True

    def test_low_risk_icu_fails(self):
        result = check_cross_field_consistency("LOW — stable condition", "ICU admission")
        assert result.passed is False

    def test_moderate_risk_any_disposition_passes(self):
        result = check_cross_field_consistency("MODERATE — needs monitoring", "telemetry floor")
        assert result.passed is True

    def test_empty_strings_pass(self):
        result = check_cross_field_consistency("", "")
        assert result.passed is True

    def test_critical_risk_outpatient_fails(self):
        result = check_cross_field_consistency(
            "CRITICAL — hemodynamic instability", "outpatient follow-up"
        )
        assert result.passed is False


# ---------------------------------------------------------------------------
# check_ddx_includes_primary (Check 16)
# ---------------------------------------------------------------------------


class TestDdxIncludesPrimary:
    def test_primary_found_in_diagnoses(self):
        ddx = {
            "diagnoses": [
                {"diagnosis": "Acute pancreatitis", "rationale": "Lipase elevated"},
                {"diagnosis": "Cholecystitis", "rationale": "RUQ pain"},
            ]
        }
        result = check_ddx_includes_primary(ddx, ["pancreatitis"])
        assert result.passed is True

    def test_primary_not_found(self):
        ddx = {
            "diagnoses": [
                {"diagnosis": "Cholecystitis", "rationale": "RUQ pain"},
            ]
        }
        result = check_ddx_includes_primary(ddx, ["pancreatitis"])
        assert result.passed is False

    def test_empty_expected_returns_none(self):
        result = check_ddx_includes_primary({}, [])
        assert result is None

    def test_empty_diagnoses(self):
        ddx = {"diagnoses": []}
        result = check_ddx_includes_primary(ddx, ["stroke"])
        assert result.passed is False

    def test_string_format_diagnoses(self):
        ddx = {"diagnoses": ["Acute ischemic stroke", "TIA"]}
        result = check_ddx_includes_primary(ddx, ["stroke", "CVA"])
        assert result.passed is True

    def test_or_semantics_any_keyword(self):
        ddx = {
            "diagnoses": [
                {"diagnosis": "STEMI", "rationale": "ST elevation"},
            ]
        }
        result = check_ddx_includes_primary(ddx, ["STEMI", "myocardial infarction"])
        assert result.passed is True

    def test_case_insensitive(self):
        ddx = {
            "diagnoses": [
                {"diagnosis": "Diabetic Ketoacidosis", "rationale": "AG elevated"},
            ]
        }
        result = check_ddx_includes_primary(ddx, ["dka", "ketoacidosis"])
        assert result.passed is True


# ---------------------------------------------------------------------------
# check_dosing_plausibility (Check 17)
# ---------------------------------------------------------------------------


class TestDosingPlausibility:
    def test_normal_aspirin_dose(self):
        options = [{"name": "Aspirin 325 mg PO"}]
        result = check_dosing_plausibility(options)
        assert result.passed is True

    def test_implausible_aspirin_dose(self):
        options = [{"name": "Aspirin 5000 mg PO"}]
        result = check_dosing_plausibility(options)
        assert result.passed is False

    def test_no_dose_extractable_passes(self):
        options = [{"name": "Mechanical thrombectomy"}]
        result = check_dosing_plausibility(options)
        assert result.passed is True

    def test_normal_heparin_dose(self):
        options = [{"name": "Heparin 5000 units IV bolus"}]
        result = check_dosing_plausibility(options)
        assert result.passed is True

    def test_implausible_heparin_dose(self):
        options = [{"name": "Heparin 500000 units IV"}]
        result = check_dosing_plausibility(options)
        assert result.passed is False

    def test_alteplase_normal(self):
        options = [{"name": "Alteplase 0.9 mg/kg IV (max 90 mg)"}]
        # The regex will pick up 0.9 mg — within range
        result = check_dosing_plausibility(options)
        assert result.passed is True

    def test_empty_options(self):
        result = check_dosing_plausibility([])
        assert result.passed is True

    def test_multiple_options_one_bad(self):
        options = [
            {"name": "Aspirin 325 mg PO"},
            {"name": "Heparin 999999 units IV"},
        ]
        result = check_dosing_plausibility(options)
        assert result.passed is False

    def test_borderline_2x_tolerance(self):
        # Aspirin max is 650, 2x = 1300. 1200 should pass.
        options = [{"name": "Aspirin 1200 mg PO"}]
        result = check_dosing_plausibility(options)
        assert result.passed is True

    def test_beyond_2x_tolerance(self):
        # Aspirin max is 650, 2x = 1300. 1400 should fail.
        options = [{"name": "Aspirin 1400 mg PO"}]
        result = check_dosing_plausibility(options)
        assert result.passed is False


# ---------------------------------------------------------------------------
# check_txgemma_safety_alignment (Check 18)
# ---------------------------------------------------------------------------


class TestTxGemmaSafetyAlignment:
    def test_no_enrichment_returns_none(self):
        options = [{"name": "Aspirin 325 mg", "verdict": "recommended"}]
        result = check_txgemma_safety_alignment(options)
        assert result is None

    def test_safe_enrichment_passes(self):
        options = [
            {
                "name": "Aspirin 325 mg",
                "verdict": "recommended",
                "cons": ["GI bleeding risk"],
                "txgemma_enrichment": {"hERG": "inactive", "ClinTox": "inactive"},
            }
        ]
        result = check_txgemma_safety_alignment(options)
        assert result.passed is True

    def test_cardiotoxic_without_warning_fails(self):
        options = [
            {
                "name": "Drug X 100 mg",
                "verdict": "recommended",
                "cons": ["nausea"],
                "txgemma_enrichment": {"hERG": "active", "ClinTox": "inactive"},
            }
        ]
        result = check_txgemma_safety_alignment(options)
        assert result.passed is False

    def test_cardiotoxic_with_warning_passes(self):
        options = [
            {
                "name": "Drug X 100 mg",
                "verdict": "recommended",
                "cons": ["cardiotoxic risk — monitor QTc"],
                "txgemma_enrichment": {"hERG": "active", "ClinTox": "inactive"},
            }
        ]
        result = check_txgemma_safety_alignment(options)
        assert result.passed is True

    def test_clintox_active_consider_passes(self):
        """'consider' verdict doesn't trigger the check."""
        options = [
            {
                "name": "Drug Y 50 mg",
                "verdict": "consider",
                "cons": [],
                "txgemma_enrichment": {"hERG": "inactive", "ClinTox": "active"},
            }
        ]
        result = check_txgemma_safety_alignment(options)
        assert result.passed is True

    def test_mixed_enriched_and_not(self):
        options = [
            {"name": "Aspirin 325 mg", "verdict": "recommended"},
            {
                "name": "Drug Z 200 mg",
                "verdict": "recommended",
                "cons": ["toxicity risk noted"],
                "txgemma_enrichment": {"hERG": "active", "ClinTox": "active"},
            },
        ]
        result = check_txgemma_safety_alignment(options)
        assert result.passed is True


# ---------------------------------------------------------------------------
# check_compliance_grade (Check 19)
# ---------------------------------------------------------------------------


class TestComplianceGrade:
    def test_minimal_valid_result(self):
        """A result with reasonable data should pass compliance."""
        result_data = {
            "parsed_case": {
                "findings": {
                    "presentation": "Chest pain for 2 hours",
                    "vitals": ["BP 120/80", "HR 90", "Temp 37.0", "RR 16", "SpO2 98%"],
                    "physical_exam": ["Normal heart sounds", "Clear lungs"],
                    "labs": ["Troponin 0.04"],
                    "imaging": [],
                    "associated_symptoms": ["Denies shortness of breath", "No fever"],
                },
                "management": {
                    "medications": ["Aspirin 81 mg daily — NKDA (no known drug allergies)"],
                },
                "clinical_question": "Aspirin and coronary angiography for acute coronary syndrome",
                "case_category": "cardiology",
            },
            "treatment_options": [
                {
                    "name": "Aspirin 325 mg PO once",
                    "verdict": "recommended",
                    "option_type": "medication",
                },
                {
                    "name": "Coronary angiography",
                    "verdict": "recommended",
                    "option_type": "procedure",
                },
            ],
            "acute_management": {
                "risk_stratification": "HIGH — elevated troponin with chest pain suggesting acute coronary syndrome",
                "disposition": "CCU admission for continuous monitoring and serial troponin",
                "consults": ["Cardiology — emergent"],
                "key_counseling": [
                    "Return to ER immediately if chest pain worsens or recurs",
                    "Call 911 for any new shortness of breath or syncope",
                ],
                "do_not_do": [],
            },
            "differential_diagnosis": {
                "diagnoses": [
                    {"diagnosis": "STEMI"},
                    {"diagnosis": "NSTEMI"},
                    {"diagnosis": "Unstable angina"},
                ]
            },
            "clinical_risk_scores": {},
            "top_recommendation": "Aspirin 325 mg",
        }
        result = check_compliance_grade(result_data)
        assert result.passed is True

    def test_empty_result_still_returns(self):
        """Even a mostly empty result should not crash."""
        result = check_compliance_grade({})
        # Should return a result (pass or fail), not crash
        assert isinstance(result.passed, bool)
