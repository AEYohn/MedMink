"""Structured clinical test cases for evaluating the case analysis pipeline.

Each test case defines a clinical vignette and expected elements that a
high-quality analysis should produce. Used by the scorer to generate
automated scorecards.
"""

TEST_CASES = [
    {
        "id": "pancreatitis_htg",
        "name": "Hypertriglyceridemia-induced Acute Pancreatitis",
        "case_text": (
            "A 38-year-old male with poorly controlled type 2 diabetes and a history of "
            "hypertriglyceridemia presents to the ED with severe epigastric pain radiating "
            "to the back for 8 hours. He has been vomiting and unable to tolerate PO. "
            "Vitals: BP 95/60, HR 118, RR 22, T 38.3°C, SpO2 94% on RA. "
            "Exam: diffuse abdominal tenderness with guarding, positive Cullen's sign. "
            "Labs: lipase 2,400 U/L (normal <60), triglycerides 1,850 mg/dL, "
            "WBC 18,200, glucose 320 mg/dL, calcium 7.2 mg/dL, "
            "bilirubin 3.2 mg/dL, AST 180, ALT 95, BUN 32, Cr 1.8, "
            "pH 7.28, HCO3 16 mEq/L, lactate 4.1 mmol/L."
        ),
        "expected": {
            "category_contains": ["gastroenterology"],
            "risk_stratification_contains": ["severe", "high"],
            "disposition_contains": ["ICU", "intensive"],
            "must_recommend": [
                "IV fluid",
                "NPO",
            ],
            "must_not_recommend_as_harmful": [
                "IV fluid",
            ],
            "should_address_etiology": ["triglyceride", "insulin"],
            "should_correct_labs": ["calcium", "glucose"],
            "expected_consults": ["GI", "ICU"],
            "do_not_do_should_include": ["oral feeding", "morphine"],
            "home_med_exceptions": [],
            "timing_keywords_in_rationale": [],
        },
    },
    {
        "id": "stemi_inferior",
        "name": "Inferior STEMI",
        "case_text": (
            "A 62-year-old female with history of hypertension and hyperlipidemia presents "
            "with substernal chest pressure radiating to her left jaw for the past 45 minutes. "
            "She is diaphoretic and nauseated. Vitals: BP 165/95, HR 102, SpO2 96% on room air. "
            "ECG shows ST-segment elevation in leads II, III, and aVF. "
            "Troponin I is 2.4 ng/mL (normal <0.04)."
        ),
        "expected": {
            "category_contains": ["cardiology"],
            "risk_stratification_contains": ["high", "STEMI"],
            "disposition_contains": ["ICU", "CCU", "cath"],
            "must_recommend": [
                "aspirin",
                "heparin",
                "PCI",
            ],
            "must_not_recommend_as_harmful": [
                "aspirin",
                "heparin",
            ],
            "should_address_etiology": [],
            "should_correct_labs": [],
            "expected_consults": ["cardiology", "interventional"],
            "do_not_do_should_include": [],
            "home_med_exceptions": [],
            "timing_keywords_in_rationale": [],
        },
    },
    {
        "id": "pe_submassive",
        "name": "Submassive Pulmonary Embolism",
        "case_text": (
            "A 55-year-old female, 10 days post right knee replacement, presents with "
            "acute-onset dyspnea, pleuritic chest pain, and heart rate of 115. "
            "Vitals: BP 105/70, HR 115, RR 24, SpO2 89% on RA. "
            "CT-PA shows bilateral pulmonary emboli with RV dilation (RV/LV ratio 1.3). "
            "Troponin I 0.12 ng/mL, BNP 450 pg/mL. D-dimer >5,000 ng/mL. "
            "She is hemodynamically stable but tachycardic."
        ),
        "expected": {
            "category_contains": ["pulmonology", "cardiology"],
            "risk_stratification_contains": ["submassive", "intermediate", "high"],
            "disposition_contains": ["ICU", "step-down", "telemetry"],
            "must_recommend": [
                "anticoagul",
                "heparin",
            ],
            "must_not_recommend_as_harmful": [
                "heparin",
                "anticoagul",
            ],
            "should_address_etiology": ["DVT", "VTE", "post-operative"],
            "should_correct_labs": [],
            "expected_consults": ["pulmonology", "hematology"],
            "do_not_do_should_include": [],
            "home_med_exceptions": [],
            "timing_keywords_in_rationale": [],
        },
    },
    {
        "id": "mono_splenomegaly",
        "name": "Infectious Mononucleosis with Splenomegaly",
        "case_text": (
            "A 19-year-old male college freshman presents with 10 days of sore throat, "
            "fever, and fatigue. He was prescribed amoxicillin 5 days ago without improvement "
            "and developed a diffuse maculopapular rash. Exam: bilateral posterior cervical "
            "lymphadenopathy, exudative pharyngitis, palpable spleen tip 3 cm below costal "
            "margin. Labs: WBC 12,500 with 60% lymphocytes and 15% atypical lymphocytes, "
            "AST 120, ALT 95, positive heterophile antibody (monospot). "
            "Platelet count 135,000."
        ),
        "expected": {
            "category_contains": ["infectious"],
            "risk_stratification_contains": ["moderate", "low"],
            "disposition_contains": ["discharge", "outpatient", "home"],
            "must_recommend": [
                "supportive",
            ],
            "must_not_recommend_as_harmful": [
                "supportive",
            ],
            "should_address_etiology": ["EBV", "Epstein-Barr"],
            "should_correct_labs": [],
            "expected_consults": [],
            "do_not_do_should_include": ["amoxicillin", "ampicillin", "contact sport"],
            "home_med_exceptions": [],
            "timing_keywords_in_rationale": [],
        },
    },
    {
        "id": "oa_ckd",
        "name": "Osteoarthritis in CKD Patient",
        "case_text": (
            "A 72-year-old female with stage 3b CKD (eGFR 38 mL/min), hypertension on "
            "lisinopril 20 mg, and type 2 diabetes on metformin presents with worsening "
            "bilateral knee pain for 6 months. Pain is worse with weight-bearing and "
            "stair climbing, improved with rest. Morning stiffness lasts <30 minutes. "
            "Exam: bilateral knee crepitus, mild effusion on the right, no warmth or "
            "erythema. X-rays show joint space narrowing and osteophytes. "
            "Labs: Cr 1.6, eGFR 38, K+ 4.8."
        ),
        "expected": {
            "category_contains": ["musculoskeletal", "rheumatology"],
            "risk_stratification_contains": ["low", "moderate"],
            "disposition_contains": ["discharge", "outpatient", "home"],
            "must_recommend": [
                "acetaminophen",
            ],
            "must_not_recommend_as_harmful": [
                "acetaminophen",
                "physical therapy",
            ],
            "should_address_etiology": [],
            "should_correct_labs": [],
            "expected_consults": ["orthopedic"],
            "do_not_do_should_include": ["NSAID"],
            "home_med_exceptions": [],
            "timing_keywords_in_rationale": [],
        },
    },
    {
        "id": "lithium_toxicity",
        "name": "Lithium Toxicity",
        "case_text": (
            "A 45-year-old female with bipolar disorder on lithium 900 mg BID and "
            "hydrochlorothiazide 25 mg daily presents with 3 days of progressive confusion, "
            "coarse tremor, nausea, and diarrhea. She started the thiazide 2 weeks ago for "
            "hypertension. Vitals: BP 140/88, HR 68, T 37.1°C. "
            "Exam: coarse bilateral hand tremor, hyperreflexia, ataxic gait, disoriented "
            "to time and place. Labs: lithium level 3.2 mEq/L (therapeutic 0.6-1.2), "
            "Na 131, K 3.1, Cr 2.1 (baseline 0.9), BUN 38, glucose 95."
        ),
        "expected": {
            "category_contains": ["psychiatry", "toxicology", "nephrology"],
            "risk_stratification_contains": ["severe", "high"],
            "disposition_contains": ["ICU", "intensive"],
            "must_recommend": [
                "IV fluid",
                "lithium",  # stop lithium
            ],
            "must_not_recommend_as_harmful": [
                "IV fluid",
            ],
            "should_address_etiology": ["thiazide", "HCTZ", "hydrochlorothiazide"],
            "should_correct_labs": ["potassium", "sodium", "K+"],
            "expected_consults": ["nephrology", "toxicology"],
            "do_not_do_should_include": ["lithium", "thiazide"],
            "home_med_exceptions": ["lithium", "thiazide", "hctz"],
            "timing_keywords_in_rationale": [],
        },
    },
    {
        "id": "stroke_mca_m1",
        "name": "Acute Ischemic Stroke — MCA M1 Occlusion",
        "case_text": (
            "A 62-year-old right-handed female is brought to the emergency department by EMS "
            "at 2:15 PM after her husband witnessed sudden onset of left-sided weakness and "
            "slurred speech beginning at 1:30 PM while she was gardening. She has a history of "
            "atrial fibrillation (not on anticoagulation due to prior patient refusal), "
            "hypertension on lisinopril 10 mg daily, type 2 diabetes on metformin 500 mg twice "
            "daily, and hyperlipidemia on atorvastatin 20 mg daily.\n\n"
            "En route, EMS documented: GCS 13 (E4V4M5), right gaze preference, left facial "
            "droop, left arm 1/5 strength, left leg 2/5 strength. Blood glucose by EMS: "
            "142 mg/dL.\n\n"
            "On ED arrival at 2:15 PM: BP 186/102 mmHg, HR 92 bpm irregularly irregular, "
            "RR 16/min, SpO2 96% on room air, Temp 37.0°C. Patient is awake but dysarthric. "
            "NIHSS score: 16. Right gaze deviation, left homonymous hemianopia, left facial "
            "droop (upper and lower), left arm plegic (0/5), left leg severely weak (1/5), "
            "left-sided neglect, dysarthria. No hemorrhagic signs on examination.\n\n"
            "Labs (drawn at 2:20 PM): Glucose 148 mg/dL, INR 1.0, PT 12.2 sec, PTT 28 sec, "
            "Platelets 210,000/μL, Creatinine 0.9 mg/dL. CT head without contrast (completed "
            "at 2:28 PM): No hemorrhage, no early ischemic changes, no mass effect. "
            "CT angiography: Complete occlusion of the right middle cerebral artery "
            "(M1 segment)."
        ),
        "expected": {
            "category_contains": ["neurology"],
            "risk_stratification_contains": ["severe", "high", "large vessel"],
            "disposition_contains": ["ICU", "neuro", "stroke"],
            "must_recommend": [
                ["alteplase", "tPA", "tenecteplase"],
                "thrombectomy",
            ],
            "must_not_recommend_as_harmful": [
                ["alteplase", "tPA", "tenecteplase"],
                "thrombectomy",
            ],
            "should_address_etiology": ["atrial fibrillation", "afib", "cardioembolic"],
            "should_correct_labs": [],
            "expected_consults": ["neurology", "interventional"],
            "do_not_do_should_include": [
                "aspirin", "anticoagul", "oral", "NPO", "PO", "swallow",
            ],
            "home_med_exceptions": [],
            "timing_keywords_in_rationale": [
                "24h", "4.5", "before", "prior to", "after",
            ],
        },
    },
]


def get_test_case(case_id: str) -> dict | None:
    """Get a single test case by ID."""
    for tc in TEST_CASES:
        if tc["id"] == case_id:
            return tc
    return None


def get_all_test_case_ids() -> list[str]:
    """Get all test case IDs."""
    return [tc["id"] for tc in TEST_CASES]
