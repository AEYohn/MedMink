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
            "expected_primary_ddx": ["pancreatitis"],
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
            "expected_primary_ddx": ["STEMI", "myocardial infarction", "MI"],
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
            "expected_primary_ddx": ["pulmonary embolism", "PE"],
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
            "expected_primary_ddx": ["mononucleosis", "EBV"],
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
            "expected_primary_ddx": ["osteoarthritis"],
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
            "expected_primary_ddx": ["lithium toxicity", "lithium intoxication"],
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
                "aspirin",
                "anticoagul",
                "oral",
                "NPO",
                "PO",
                "swallow",
            ],
            "home_med_exceptions": [],
            "timing_keywords_in_rationale": [
                "24h",
                "4.5",
                "before",
                "prior to",
                "after",
            ],
            "expected_primary_ddx": ["ischemic stroke", "MCA", "CVA"],
        },
    },
    # --- New cases (Phase 4) ---
    {
        "id": "dka_new_onset",
        "name": "New-Onset DKA — Endocrinology",
        "case_text": (
            "A 28-year-old male with no significant past medical history presents with 2 weeks "
            "of polyuria, polydipsia, and 15-lb weight loss. He developed nausea, vomiting, "
            "and diffuse abdominal pain over the past 24 hours. "
            "Vitals: BP 100/62, HR 124, RR 28 (Kussmaul), T 37.0°C, SpO2 98% on RA. "
            "Exam: dry mucous membranes, fruity breath odor, diffuse abdominal tenderness "
            "without rebound. "
            "Labs: glucose 485 mg/dL, pH 7.18, pCO2 18, HCO3 8 mEq/L, anion gap 28, "
            "K+ 5.2 (corrected ~3.8 for pH), Na 131, BUN 28, Cr 1.4, "
            "beta-hydroxybutyrate 6.2 mmol/L, urinalysis with ketones 4+, glucose 4+. "
            "HbA1c 13.2%."
        ),
        "expected": {
            "category_contains": ["endocrinology"],
            "risk_stratification_contains": ["severe", "high"],
            "disposition_contains": ["ICU", "intensive"],
            "must_recommend": [
                "insulin",
                "IV fluid",
                "potassium",
            ],
            "must_not_recommend_as_harmful": [
                "insulin",
                "IV fluid",
            ],
            "should_address_etiology": [],
            "should_correct_labs": ["glucose", "potassium", "pH", "anion gap"],
            "expected_consults": ["endocrinology", "ICU"],
            "do_not_do_should_include": ["oral hypoglycemic", "bicarbonate"],
            "home_med_exceptions": [],
            "timing_keywords_in_rationale": ["1h", "2h", "gap closure", "before transition"],
            "expected_primary_ddx": ["diabetic ketoacidosis", "DKA"],
        },
    },
    {
        "id": "sepsis_urosource",
        "name": "Urosepsis — Infectious Disease / Critical Care",
        "case_text": (
            "A 75-year-old female with diabetes mellitus, recurrent UTIs, and an indwelling "
            "Foley catheter removed 3 days ago presents with fever, rigors, and confusion "
            "for 12 hours. She was found by her daughter, disoriented and unable to stand. "
            "Vitals: BP 82/50, HR 118, RR 24, T 39.8°C, SpO2 93% on RA. "
            "Exam: lethargic but arousable, suprapubic tenderness, CVAT on the right. "
            "Labs: WBC 22,400 with 15% bands, lactate 4.8 mmol/L, Cr 2.3 (baseline 1.0), "
            "BUN 42, glucose 210, procalcitonin 12.5 ng/mL. "
            "UA: positive nitrites, large leukocyte esterase, >100 WBC/hpf, bacteria 3+. "
            "Blood cultures drawn x2. CT abdomen/pelvis: right-sided hydronephrosis with "
            "perinephric stranding."
        ),
        "expected": {
            "category_contains": ["infectious", "critical"],
            "risk_stratification_contains": ["severe", "high", "septic shock"],
            "disposition_contains": ["ICU", "intensive"],
            "must_recommend": [
                "antibiotic",
                "IV fluid",
                "blood culture",
            ],
            "must_not_recommend_as_harmful": [
                "antibiotic",
                "IV fluid",
            ],
            "should_address_etiology": ["urinary", "UTI", "urosepsis", "obstructive"],
            "should_correct_labs": ["lactate", "glucose"],
            "expected_consults": ["ICU", "infectious disease"],
            "do_not_do_should_include": ["delay antibiotic", "oral antibiotic"],
            "home_med_exceptions": [],
            "timing_keywords_in_rationale": ["1 hour", "3-hour bundle", "within"],
            "expected_primary_ddx": ["urosepsis", "sepsis", "pyelonephritis"],
        },
    },
    {
        "id": "sah_thunderclap",
        "name": "SAH with AComA Aneurysm — Neurosurgery",
        "case_text": (
            "A 48-year-old male with history of smoking and untreated hypertension presents "
            "with sudden-onset 'worst headache of my life' that began 2 hours ago while "
            "straining at the gym. He had a brief loss of consciousness witnessed by his "
            "training partner, followed by nausea, vomiting, and neck stiffness. "
            "Vitals: BP 195/110, HR 56 (Cushing reflex), RR 14, T 37.2°C, SpO2 97% on RA. "
            "Exam: GCS 12 (E3V4M5), photophobia, nuchal rigidity, bilateral papilledema. "
            "Hunt-Hess grade 3, WFNS grade III. "
            "CT head: diffuse subarachnoid hemorrhage, modified Fisher grade 3, early "
            "hydrocephalus. CTA: 7mm saccular aneurysm of the anterior communicating artery "
            "(AComA). No intraparenchymal hemorrhage."
        ),
        "expected": {
            "category_contains": ["neurology", "neurosurgery"],
            "risk_stratification_contains": ["severe", "high", "critical"],
            "disposition_contains": ["ICU", "neuro"],
            "must_recommend": [
                "nimodipine",
                ["clip", "coil", "secure"],
            ],
            "must_not_recommend_as_harmful": [
                "nimodipine",
            ],
            "should_address_etiology": ["aneurysm", "AComA"],
            "should_correct_labs": [],
            "expected_consults": ["neurosurgery", "neuro-ICU"],
            "do_not_do_should_include": ["anticoagul", "lumbar puncture"],
            "home_med_exceptions": [],
            "timing_keywords_in_rationale": ["24h", "72h", "within"],
            "expected_primary_ddx": ["subarachnoid hemorrhage", "SAH"],
        },
    },
    {
        "id": "afib_rvr",
        "name": "New-Onset Atrial Fibrillation with RVR — Cardiology",
        "case_text": (
            "A 68-year-old male with hypertension, type 2 diabetes, prior stroke 2 years ago "
            "(with residual mild left-sided weakness), and heart failure with preserved EF (55%) "
            "presents with palpitations, lightheadedness, and exertional dyspnea for 3 days. "
            "He has no prior history of atrial fibrillation. Duration of symptoms unclear — "
            "possibly >48 hours. "
            "Vitals: BP 95/60, HR 155 (irregularly irregular), RR 22, SpO2 94% on RA. "
            "Exam: irregular tachycardia, no murmurs, mild bibasilar crackles, 1+ bilateral "
            "ankle edema. ECG confirms atrial fibrillation with rapid ventricular response, "
            "no acute ST changes. "
            "Labs: troponin I 0.06 ng/mL (normal <0.04), BNP 680 pg/mL, TSH 0.8, "
            "Cr 1.1, K+ 4.2, Mg 1.7. CHA₂DS₂-VASc score: 4 (HTN, DM, age ≥65, prior stroke)."
        ),
        "expected": {
            "category_contains": ["cardiology"],
            "risk_stratification_contains": ["high", "moderate"],
            "disposition_contains": ["telemetry", "step-down", "ICU", "CCU"],
            "must_recommend": [
                ["diltiazem", "amiodarone", "beta-blocker", "metoprolol"],
                "anticoagul",
            ],
            "must_not_recommend_as_harmful": [
                "anticoagul",
            ],
            "should_address_etiology": [],
            "should_correct_labs": [],
            "expected_consults": ["cardiology"],
            "do_not_do_should_include": ["cardioversion"],
            "home_med_exceptions": [],
            "timing_keywords_in_rationale": [],
            "expected_primary_ddx": ["atrial fibrillation", "AFib", "AF"],
        },
    },
    {
        "id": "eclampsia",
        "name": "Eclampsia — OB/GYN Emergency",
        "case_text": (
            "A 32-year-old G2P1 female at 34 weeks gestation is brought to the ED after "
            "a witnessed generalized tonic-clonic seizure at home lasting approximately "
            "90 seconds. She has no prior seizure history. Her pregnancy has been complicated "
            "by gestational hypertension diagnosed at 28 weeks. She reports severe headache "
            "and visual changes ('seeing spots') for the past 6 hours. "
            "Vitals: BP 185/110, HR 108, RR 20, T 37.3°C, SpO2 96% on RA. "
            "Exam: postictal but responsive, 3+ bilateral lower extremity edema, "
            "hyperreflexia with clonus (3 beats), RUQ tenderness. Fetal heart rate 140 with "
            "minimal variability. "
            "Labs: platelet count 88,000, AST 245, ALT 198, LDH 620, Cr 1.3, "
            "uric acid 7.8, proteinuria 4+ on dipstick, protein/creatinine ratio 5.2. "
            "Peripheral smear: schistocytes present."
        ),
        "expected": {
            "category_contains": ["obstetrics", "gynecology", "OB"],
            "risk_stratification_contains": ["severe", "high", "critical"],
            "disposition_contains": ["ICU", "L&D", "labor"],
            "must_recommend": [
                "magnesium",
                ["labetalol", "hydralazine"],
                "delivery",
            ],
            "must_not_recommend_as_harmful": [
                "magnesium",
            ],
            "should_address_etiology": ["preeclampsia", "eclampsia", "HELLP"],
            "should_correct_labs": [],
            "expected_consults": ["OB", "neonatology", "anesthesia"],
            "do_not_do_should_include": ["ACE inhibitor", "NSAID"],
            "home_med_exceptions": [],
            "timing_keywords_in_rationale": [],
            "expected_primary_ddx": ["eclampsia", "preeclampsia", "HELLP"],
        },
    },
    {
        "id": "sickle_cell_crisis",
        "name": "Acute Chest Syndrome in Sickle Cell Disease — Hematology",
        "case_text": (
            "A 22-year-old female with known HbSS sickle cell disease (baseline Hb 7.5 g/dL) "
            "presents with acute-onset chest pain, fever, and progressive dyspnea for 18 hours. "
            "She was admitted 3 days ago for a vaso-occlusive crisis with rib and hip pain, "
            "managed with IV morphine PCA and IV fluids. Over the past 12 hours, she developed "
            "a productive cough with rust-colored sputum. "
            "Vitals: BP 100/65, HR 112, RR 26, T 38.9°C, SpO2 88% on 4L NC. "
            "Exam: bilateral crackles more prominent on the right, decreased breath sounds "
            "right base, hepatomegaly, no leg swelling. "
            "Labs: Hb 5.8 g/dL (baseline 7.5), reticulocyte count 12%, WBC 18,500, "
            "platelet 95,000, LDH 890, total bilirubin 4.2, Cr 0.9. "
            "ABG: pH 7.35, pO2 58, pCO2 32 (compensated respiratory alkalosis). "
            "CXR: bilateral pulmonary infiltrates, right greater than left, "
            "new since admission. Blood cultures drawn x2."
        ),
        "expected": {
            "category_contains": ["hematology"],
            "risk_stratification_contains": ["severe", "high", "critical"],
            "disposition_contains": ["ICU", "intensive", "step-down"],
            "must_recommend": [
                "transfusion",
                "IV fluid",
                "oxygen",
                "antibiotic",
            ],
            "must_not_recommend_as_harmful": [
                "transfusion",
                "antibiotic",
            ],
            "should_address_etiology": ["sickle", "acute chest syndrome", "ACS"],
            "should_correct_labs": [],
            "expected_consults": ["hematology", "pulmonology"],
            "do_not_do_should_include": ["excessive fluid"],
            "home_med_exceptions": [],
            "timing_keywords_in_rationale": ["exchange transfusion", "within"],
            "expected_primary_ddx": ["acute chest syndrome", "ACS", "sickle cell"],
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
