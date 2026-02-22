"""Medical-specific prompts for MedGemma clinical reasoning.

These prompts implement medical best practices including:
- PICO framework for clinical questions
- GRADE methodology for evidence grading
- Structured citation formatting for medical literature
- SOAP note structuring for clinical charting
"""

# System prompt for clinical reasoning
CLINICAL_REASONING_SYSTEM = """You are a clinical evidence synthesis assistant powered by MedGemma.
Your role is to help clinicians find, understand, and apply evidence from medical research.

Key principles:
1. Always cite sources with PMID or DOI
2. Distinguish between evidence quality levels (RCT > observational > case report)
3. Highlight contradictions and limitations
4. Never provide direct medical advice - synthesize evidence for clinician interpretation
5. Use GRADE methodology for evidence assessment
6. Present information in PICO format when applicable

You analyze medical literature to provide:
- Evidence summaries with quality ratings
- Treatment comparisons with NNT/NNH when available
- Safety signals and adverse event profiles
- Contradictions between studies with possible explanations
"""

# Prompt for extracting PICO elements from clinical questions
PICO_EXTRACTION_PROMPT = """Extract PICO elements from this clinical question.

PICO framework:
- P (Population): Patient characteristics, age, sex, disease stage, comorbidities
- I (Intervention): Treatment, drug, procedure, diagnostic test
- C (Comparison): Alternative treatment, placebo, standard of care
- O (Outcome): Primary endpoint, mortality, quality of life, adverse events

Clinical Question: {question}

Respond in JSON format:
{{
    "population": "description of patient population",
    "intervention": "primary intervention being studied",
    "comparison": "comparator if any (or 'none' if not specified)",
    "outcome": "outcomes of interest",
    "question_type": "therapy|diagnosis|prognosis|etiology|harm",
    "mesh_terms": ["suggested MeSH terms for search"]
}}
"""

# Prompt for GRADE evidence grading
EVIDENCE_GRADING_PROMPT = """Assess the quality of evidence using GRADE methodology.

GRADE levels:
- HIGH: Further research very unlikely to change confidence in effect estimate
  (Well-designed RCTs, large effect sizes, dose-response gradient)
- MODERATE: Further research likely to have important impact on confidence
  (RCTs with limitations, strong observational studies)
- LOW: Further research very likely to have important impact
  (Observational studies, RCTs with serious limitations)
- VERY LOW: Estimate very uncertain
  (Case reports, expert opinion, studies with critical limitations)

Factors that lower quality:
- Risk of bias (randomization, blinding, attrition)
- Inconsistency (heterogeneous results across studies)
- Indirectness (different populations, interventions, outcomes)
- Imprecision (wide confidence intervals, small sample sizes)
- Publication bias (missing studies, industry funding)

Factors that raise quality:
- Large magnitude of effect (RR > 2 or < 0.5)
- Dose-response gradient
- All plausible confounders would reduce effect

Papers to assess:
{papers}

For each paper and overall synthesis, provide:
{{
    "paper_grades": [
        {{
            "pmid": "paper identifier",
            "study_design": "RCT|cohort|case-control|case-series|case-report",
            "sample_size": number,
            "risk_of_bias": "low|moderate|high|critical",
            "grade": "high|moderate|low|very_low",
            "rationale": "brief explanation of grade"
        }}
    ],
    "overall_grade": "high|moderate|low|very_low",
    "grade_rationale": "summary of evidence quality assessment",
    "key_limitations": ["limitation 1", "limitation 2"]
}}
"""

# Prompt for evidence synthesis
EVIDENCE_SYNTHESIS_PROMPT = """Synthesize evidence from multiple medical papers to answer a clinical question.

Clinical Question: {question}

Papers:
{papers}

Provide a synthesis that includes:
1. **Summary**: 2-3 sentence overview of the evidence
2. **Key Findings**: Bullet points of main findings with citations
3. **Effect Sizes**: Quantitative results (OR, RR, HR, NNT) when available
4. **Contradictions**: Studies that disagree and possible explanations
5. **Limitations**: Important caveats for clinical application
6. **Clinical Recommendation**: Evidence-based guidance with strength rating

Format your response as:
{{
    "summary": "Brief synthesis",
    "key_findings": [
        {{"finding": "finding text", "citation": "PMID or author (year)"}}
    ],
    "effect_sizes": [
        {{"outcome": "outcome name", "effect": "effect size with CI", "source": "citation"}}
    ],
    "contradictions": [
        {{"topic": "area of disagreement", "position_a": "view A", "position_b": "view B", "explanation": "possible reason"}}
    ],
    "limitations": ["limitation 1", "limitation 2"],
    "recommendation": "clinical recommendation",
    "recommendation_strength": "strong|conditional|none",
    "evidence_grade": "high|moderate|low|very_low"
}}
"""

# Prompt for drug interaction checking
DRUG_INTERACTION_PROMPT = """Check for potential drug interactions based on medical literature evidence.

Drug List: {drugs}

Evidence from Papers:
{papers}

Identify:
1. Known drug-drug interactions with severity
2. Mechanism of interaction when known
3. Clinical significance and management recommendations
4. Evidence quality for each interaction

Response format:
{{
    "interactions": [
        {{
            "drug_a": "first drug",
            "drug_b": "second drug",
            "severity": "major|moderate|minor",
            "mechanism": "PK/PD mechanism",
            "effect": "clinical effect",
            "management": "recommended action",
            "evidence_pmids": ["supporting paper identifiers"]
        }}
    ],
    "no_interaction_found": ["drug pairs with no known interaction"],
    "insufficient_evidence": ["drug pairs needing more research"]
}}
"""

# Prompt for adverse event extraction
ADVERSE_EVENT_PROMPT = """Extract adverse event information from medical papers.

Papers:
{papers}

For each adverse event mentioned, extract:
{{
    "adverse_events": [
        {{
            "event": "adverse event name (MedDRA preferred term if possible)",
            "drug_intervention": "associated drug or intervention",
            "frequency": "incidence rate or frequency category",
            "severity": "mild|moderate|severe|life-threatening",
            "time_to_onset": "timing if reported",
            "risk_factors": ["patient factors increasing risk"],
            "pmid": "source paper identifier",
            "evidence_quality": "high|moderate|low"
        }}
    ],
    "safety_signals": ["emerging concerns requiring monitoring"],
    "black_box_warnings": ["serious warnings if mentioned"]
}}
"""

# Prompt for treatment comparison
TREATMENT_COMPARISON_PROMPT = """Compare treatments for a condition based on medical literature.

Condition: {condition}
Treatments to Compare: {treatments}

Evidence from Papers:
{papers}

Provide a structured comparison:
{{
    "condition": "condition being treated",
    "treatments_compared": ["treatment A", "treatment B"],
    "efficacy_comparison": [
        {{
            "outcome": "primary outcome",
            "treatment_a_effect": "effect size",
            "treatment_b_effect": "effect size",
            "difference": "comparison with p-value/CI",
            "favors": "which treatment is superior for this outcome"
        }}
    ],
    "safety_comparison": {{
        "treatment_a_aes": ["common adverse events"],
        "treatment_b_aes": ["common adverse events"],
        "safer_option": "which treatment has better safety profile"
    }},
    "cost_effectiveness": "comparison if data available",
    "guideline_recommendations": ["relevant guideline positions"],
    "clinical_context": "factors influencing treatment choice",
    "evidence_grade": "high|moderate|low|very_low"
}}
"""

# Prompt for patient population matching
POPULATION_MATCHING_PROMPT = """Assess whether study populations match a specific patient profile.

Target Patient:
{patient_profile}

Study Populations:
{papers}

For each study, assess:
{{
    "population_matches": [
        {{
            "pmid": "paper identifier",
            "study_population": "brief description",
            "inclusion_criteria": ["key criteria"],
            "exclusion_criteria": ["key criteria"],
            "match_score": 0.0 to 1.0,
            "match_rationale": "why this does/doesn't match target patient",
            "generalizability_concerns": ["potential issues applying to target"]
        }}
    ],
    "best_matches": ["PMIDs of most applicable studies"],
    "applicability_caveats": ["overall concerns about applying evidence to this patient"]
}}
"""

# SOAP note structuring prompt for clinical charting
SOAP_STRUCTURING_PROMPT = """Structure this clinical dictation into SOAP format.

Dictation:
{dictation_text}

First, correct any misheard medical terminology:
- Drug names: "met form in" → "metformin", "lip itor" → "Lipitor"
- Conditions: "high per tension" → "hypertension", "die a beat ease" → "diabetes"
- Abbreviations: expand when unclear (BP = blood pressure, HR = heart rate)
- Medical terms: "car dee ack" → "cardiac", "ab dom in al" → "abdominal"

Then structure into JSON:
{{
  "corrections": [
    {{"original": "misheard term", "corrected": "correct term"}}
  ],
  "soap": {{
    "subjective": {{
      "chief_complaint": "patient's main reason for visit in their words",
      "history_of_present_illness": "detailed narrative of current illness",
      "review_of_systems": ["relevant positive and negative findings"],
      "patient_reported": ["symptoms, concerns, or information reported by patient"]
    }},
    "objective": {{
      "vital_signs": {{
        "BP": "blood pressure if mentioned",
        "HR": "heart rate if mentioned",
        "Temp": "temperature if mentioned",
        "RR": "respiratory rate if mentioned",
        "SpO2": "oxygen saturation if mentioned"
      }},
      "physical_exam": ["exam findings organized by system"],
      "labs": ["laboratory results if mentioned"],
      "imaging": ["imaging findings if mentioned"]
    }},
    "assessment": {{
      "primary_diagnosis": "main diagnosis or working diagnosis",
      "differential": ["other diagnoses being considered"],
      "clinical_impression": "1-2 sentence clinical reasoning: why this diagnosis was reached based on findings (e.g., 'ST elevation in V2-V5 with elevated troponin consistent with acute anterior STEMI')"
    }},
    "plan": {{
      "medications": [
        {{"drug": "medication name", "dose": "dosage", "frequency": "how often"}}
      ],
      "procedures": ["any procedures ordered or performed"],
      "referrals": ["specialist referrals"],
      "follow_up": "follow-up plan",
      "patient_education": ["education provided to patient"]
    }}
  }}
}}

Important:
- Use null for missing information
- Preserve exact medical terminology after corrections
- Keep patient quotes in subjective section
- Be concise but complete
- Extract only what is explicitly mentioned in the dictation
- ALWAYS extract allergy information into patient_reported (e.g., "NKDA", "No known drug allergies", or specific allergies)
- ALWAYS generate 2-3 differential diagnoses even if primary diagnosis is clear
- For medications, include frequency or "stat"/"loading dose"/"bolus" — never leave frequency null"""


# Prompt for medication reconciliation — drug interactions and safety
MEDICATION_RECONCILIATION_PROMPT = """Review this patient's medication list for CLINICALLY SIGNIFICANT drug-drug interactions.

PATIENT CONTEXT:
- Age/Sex: {patient_summary}
- Renal Function: {renal_function}
- Key Conditions: {conditions}

CURRENT MEDICATIONS:
{current_medications}

RECOMMENDED TREATMENTS (from analysis):
{recommended_treatments}

WHAT TO REPORT — only include interactions that require clinical action:
1. MAJOR interactions that could cause serious harm (e.g., bleeding, nephrotoxicity, hyperkalemia, serotonin syndrome)
2. DANGEROUS COMBINATIONS (e.g., "triple whammy": NSAID + ACE inhibitor/ARB + diuretic or anticoagulant)
3. MODERATE interactions that need monitoring or dose adjustment
4. DUPLICATE THERAPY — IMPORTANT DEFINITION: Two drugs from the SAME pharmacologic class (e.g., two NSAIDs like ibuprofen + naproxen, two SSRIs like fluoxetine + sertraline, two ACE inhibitors like lisinopril + enalapril). Drugs from DIFFERENT classes are NOT duplicates even if used for the same condition. Examples of what is NOT duplicate therapy: a thiazide diuretic + an NSAID, a beta-blocker + a calcium channel blocker, an anticoagulant + an antiplatelet.

WHAT TO SKIP — do NOT report:
- Safe combinations (e.g., statin + antihypertensive, metformin + amlodipine)
- Minor theoretical interactions with no clinical significance
- Each drug pair should appear AT MOST ONCE
- Maximum 8 interactions total — prioritize by severity

Respond in JSON:
{{
    "interactions": [
        {{
            "drug_a": "first drug (generic name only)",
            "drug_b": "second drug (generic name only)",
            "severity": "major|moderate",
            "effect": "clinical effect in 1 sentence",
            "recommendation": "what to do about it"
        }}
    ],
    "duplicate_therapy": [
        {{
            "drugs": ["drug1", "drug2"],
            "drug_class": "class name",
            "recommendation": "action"
        }}
    ]
}}

Output ONLY the JSON. No preamble. Start with {{ end with }}."""
