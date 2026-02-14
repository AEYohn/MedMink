"""DSPy signatures for medical literature analysis.

These signatures implement clinical evidence synthesis workflows including:
- PICO-based query understanding
- Evidence synthesis with GRADE methodology
- Drug interaction detection
- Treatment comparison
"""

from typing import Literal

import dspy
from pydantic import BaseModel, Field, field_validator

# ============================================================================
# Pydantic models for medical structured outputs
# ============================================================================


class PICOElements(BaseModel):
    """PICO elements extracted from a clinical question."""

    population: str = Field(
        description="Patient population characteristics (age, sex, disease stage, comorbidities)"
    )
    intervention: str = Field(
        description="Treatment, drug, procedure, or diagnostic test being studied"
    )
    comparison: str = Field(
        default="standard of care",
        description="Comparator (alternative treatment, placebo, standard of care)"
    )
    outcome: str = Field(
        description="Primary outcomes of interest (mortality, efficacy, adverse events)"
    )
    question_type: Literal["therapy", "diagnosis", "prognosis", "etiology", "harm"] = Field(
        default="therapy",
        description="Type of clinical question"
    )

    @field_validator('question_type', mode='before')
    @classmethod
    def normalize_question_type(cls, v):
        """Normalize question_type to lowercase to handle MedGemma capitalization."""
        if isinstance(v, str):
            return v.lower()
        return v


class EvidenceGrade(BaseModel):
    """GRADE evidence assessment for a single study."""

    pmid: str = Field(description="PubMed ID or DOI")
    study_design: Literal[
        "systematic_review", "rct", "cohort", "case_control",
        "case_series", "case_report", "expert_opinion"
    ] = Field(description="Study design type")
    sample_size: int = Field(default=0, description="Number of participants")
    risk_of_bias: Literal["low", "moderate", "high", "critical"] = Field(
        description="Risk of bias assessment"
    )
    grade: Literal["high", "moderate", "low", "very_low"] = Field(
        description="GRADE evidence level"
    )
    rationale: str = Field(description="Brief explanation of the grade")


class ClinicalFinding(BaseModel):
    """A key finding from medical literature."""

    finding: str = Field(description="The clinical finding statement")
    effect_size: str | None = Field(
        default=None,
        description="Quantitative effect (OR, RR, HR, NNT with CI)"
    )
    citation: str = Field(description="PMID or author (year)")
    confidence: float = Field(ge=0, le=1, description="Confidence in finding")


class Contradiction(BaseModel):
    """A contradiction between medical studies."""

    topic: str = Field(description="Area of disagreement")
    position_a: str = Field(description="First position with citation")
    position_b: str = Field(description="Opposing position with citation")
    possible_explanation: str = Field(
        description="Possible reasons for contradiction (methodological, population, etc.)"
    )
    clinical_significance: Literal["high", "moderate", "low"] = Field(
        description="Impact on clinical decision-making"
    )


class DrugInteraction(BaseModel):
    """A potential drug-drug interaction."""

    drug_a: str = Field(description="First drug name")
    drug_b: str = Field(description="Second drug name")
    severity: Literal["major", "moderate", "minor"] = Field(
        description="Interaction severity"
    )
    mechanism: str = Field(description="PK/PD mechanism of interaction")
    effect: str = Field(description="Clinical effect of interaction")
    management: str = Field(description="Recommended clinical action")
    evidence_quality: Literal["high", "moderate", "low"] = Field(
        description="Quality of supporting evidence"
    )
    pmids: list[str] = Field(default_factory=list, description="Supporting citations")


class EvidenceSynthesisResult(BaseModel):
    """Complete evidence synthesis for a clinical question."""

    summary: str = Field(description="2-3 sentence evidence summary")
    key_findings: list[ClinicalFinding] = Field(default_factory=list)
    contradictions: list[Contradiction] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    clinical_recommendation: str = Field(description="Evidence-based recommendation")
    recommendation_strength: Literal["strong", "conditional", "none"] = Field(
        description="Strength of recommendation"
    )
    evidence_grade: Literal["high", "moderate", "low", "very_low"] = Field(
        description="Overall GRADE evidence level"
    )


class TreatmentComparison(BaseModel):
    """Comparison of treatments for a condition."""

    condition: str = Field(description="Medical condition")
    treatments: list[str] = Field(description="Treatments being compared")
    efficacy_winner: str | None = Field(
        default=None,
        description="Treatment with better efficacy (if determinable)"
    )
    safety_winner: str | None = Field(
        default=None,
        description="Treatment with better safety profile (if determinable)"
    )
    key_differences: list[str] = Field(
        default_factory=list,
        description="Key differences between treatments"
    )
    context_factors: list[str] = Field(
        default_factory=list,
        description="Patient factors influencing treatment choice"
    )


# ============================================================================
# DSPy Signatures for Medical Analysis
# ============================================================================


class ClinicalQueryUnderstanding(dspy.Signature):
    """Parse a clinician's question into structured PICO elements.

    The PICO framework structures clinical questions:
    - P (Population): Who are the patients?
    - I (Intervention): What treatment/test is being considered?
    - C (Comparison): What is the alternative?
    - O (Outcome): What outcomes matter?

    Also identify the question type (therapy, diagnosis, prognosis, etiology, harm).
    """

    question: str = dspy.InputField(desc="Clinical question in natural language")

    pico: PICOElements = dspy.OutputField(
        desc="Structured PICO elements extracted from the question"
    )
    search_terms: list[str] = dspy.OutputField(
        desc="Suggested MeSH terms and keywords for literature search"
    )


class EvidenceSynthesis(dspy.Signature):
    """Synthesize evidence from multiple medical papers for a clinical question.

    Apply GRADE methodology to assess evidence quality:
    - HIGH: Further research very unlikely to change confidence
    - MODERATE: Further research likely to impact confidence
    - LOW: Further research very likely to impact confidence
    - VERY LOW: Estimate very uncertain

    Identify contradictions between studies and provide possible explanations.
    Generate a clinical recommendation with strength rating.
    """

    question: str = dspy.InputField(desc="Clinical question (preferably in PICO format)")
    papers: list[dict] = dspy.InputField(
        desc="List of paper dictionaries with pmid, title, abstract, year"
    )

    synthesis: EvidenceSynthesisResult = dspy.OutputField(
        desc="Complete evidence synthesis with findings, contradictions, and recommendation"
    )
    paper_grades: list[EvidenceGrade] = dspy.OutputField(
        desc="Individual GRADE assessments for each paper"
    )


class DrugInteractionCheck(dspy.Signature):
    """Check for potential drug interactions mentioned in literature.

    For each drug pair, identify:
    - Interaction severity (major/moderate/minor)
    - Mechanism (CYP450, protein binding, renal clearance, etc.)
    - Clinical effect and management recommendations
    - Quality of supporting evidence

    Only flag interactions with literature support.
    """

    drug_list: list[str] = dspy.InputField(desc="List of drug names to check")
    papers: list[dict] = dspy.InputField(
        desc="Papers containing drug interaction information"
    )

    interactions: list[DrugInteraction] = dspy.OutputField(
        desc="Identified drug interactions with severity and evidence"
    )
    no_known_interaction: list[str] = dspy.OutputField(
        desc="Drug pairs with no interaction found in literature"
    )


class TreatmentComparisonAnalysis(dspy.Signature):
    """Compare treatments for a medical condition based on literature.

    Analyze head-to-head comparisons when available.
    Consider:
    - Efficacy outcomes (response rate, survival, symptom control)
    - Safety profile (adverse events, tolerability)
    - Patient factors affecting treatment choice
    - Guideline recommendations
    """

    condition: str = dspy.InputField(desc="Medical condition being treated")
    treatments: list[str] = dspy.InputField(desc="Treatments to compare")
    papers: list[dict] = dspy.InputField(desc="Papers with comparative data")

    comparison: TreatmentComparison = dspy.OutputField(
        desc="Structured treatment comparison"
    )
    evidence_summary: str = dspy.OutputField(
        desc="Narrative summary of comparison evidence"
    )


class AdverseEventExtraction(dspy.Signature):
    """Extract adverse event information from medical papers.

    For each adverse event, capture:
    - Event name (preferring MedDRA terms)
    - Frequency/incidence rate
    - Severity classification
    - Risk factors
    - Time to onset

    Flag serious safety signals that warrant clinical attention.
    """

    papers: list[dict] = dspy.InputField(desc="Papers to analyze for adverse events")
    drug_or_intervention: str = dspy.InputField(desc="Drug or intervention of interest")

    adverse_events: list[dict] = dspy.OutputField(
        desc="Extracted adverse events with frequency, severity, and risk factors"
    )
    safety_signals: list[str] = dspy.OutputField(
        desc="Important safety signals requiring monitoring"
    )
    black_box_warnings: list[str] = dspy.OutputField(
        desc="Serious warnings if mentioned in literature"
    )


class ClinicalGuidelineAlignment(dspy.Signature):
    """Assess alignment between literature evidence and clinical guidelines.

    Compare the evidence from papers to major guideline recommendations.
    Identify:
    - Areas of agreement between evidence and guidelines
    - Areas where new evidence may update guideline recommendations
    - Gaps where guidelines don't address the clinical question
    """

    question: str = dspy.InputField(desc="Clinical question")
    papers: list[dict] = dspy.InputField(desc="Recent literature evidence")
    guideline_summary: str = dspy.InputField(
        desc="Summary of relevant guideline recommendations"
    )

    alignment_assessment: str = dspy.OutputField(
        desc="Assessment of evidence-guideline alignment"
    )
    potential_updates: list[str] = dspy.OutputField(
        desc="Areas where evidence may warrant guideline updates"
    )
    practice_recommendations: str = dspy.OutputField(
        desc="Practical recommendations considering both evidence and guidelines"
    )


class PopulationApplicability(dspy.Signature):
    """Assess whether study evidence applies to a specific patient population.

    Compare study populations to the target patient profile.
    Consider:
    - Demographics (age, sex, race/ethnicity)
    - Comorbidities
    - Disease severity/stage
    - Prior treatments

    Provide an applicability score and caveats.
    """

    patient_profile: str = dspy.InputField(
        desc="Description of target patient characteristics"
    )
    papers: list[dict] = dspy.InputField(
        desc="Papers with their inclusion/exclusion criteria"
    )

    applicability_scores: list[dict] = dspy.OutputField(
        desc="Per-paper applicability scores with rationale"
    )
    best_matching_papers: list[str] = dspy.OutputField(
        desc="PMIDs of most applicable studies"
    )
    generalizability_caveats: list[str] = dspy.OutputField(
        desc="Important caveats when applying evidence to target population"
    )
