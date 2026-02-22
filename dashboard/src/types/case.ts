// Shared types for clinical case analysis

export interface StepUpdate {
  type: 'step';
  step: string;
  status: string;
  message: string;
  progress: number;
  data?: Record<string, unknown>;
}

export interface TreatmentOption {
  name: string;
  mechanism: string;
  verdict: 'recommended' | 'consider' | 'not_recommended';
  confidence: number;
  fda_approved: boolean;
  fda_indication: string;
  evidence_grade: string;
  pros: string[];
  cons: string[];
  key_evidence: Array<{ finding: string; pmid?: string; year?: string; title?: string }>;
  rationale: string;
  papers_used: Array<{
    pmid: string;
    title: string;
    match_type: 'keyword' | 'general';
    matched_words: string[];
  }>;
  reasoning?: {
    patient_factors_considered?: string[];
    supporting_evidence?: string;
    key_concern?: string;
    context_relevance?: string;
  };
  option_type?: 'medication' | 'procedure' | 'diagnostic' | 'supportive_care';
}

export interface ParsedCase {
  patient: {
    age: string;
    sex: string;
    relevant_history: string[];
  };
  findings: {
    presentation: string;
    timeline: string;
    physical_exam: string[];
    labs: string[];
    imaging: string[];
    precipitating_factors?: string;
    context_of_onset?: string;
    associated_symptoms?: string[];
  };
  management: {
    medications: string[];
    recent_changes: string;
    response_to_treatment: string;
  };
  clinical_question: string;
  case_category: string;
}

export interface AcuteManagement {
  risk_stratification?: string;
  immediate_actions?: string[];
  do_not_do?: string[];
  monitoring_plan?: string[];
  disposition?: string;
  consults?: string[];
  activity_restrictions?: string;
  key_counseling?: string[];
  metabolic_corrections?: string[];
}

export interface MedicationReview {
  renal_flags: Array<{
    drug: string;
    severity: 'critical' | 'warning';
    action: string;
    parameter: string;
    value: number;
  }>;
  interactions: Array<{
    drug_a: string;
    drug_b: string;
    severity: 'major' | 'moderate' | 'minor';
    effect: string;
    recommendation: string;
  }>;
  duplicate_therapy: Array<{
    drugs: string[];
    drug_class: string;
    recommendation: string;
  }>;
  renal_function: {
    egfr: number | null;
    creatinine: number | null;
  };
}

export interface CaseAnalysisResult {
  type: 'result';
  data: CaseAnalysisData;
}

export interface CaseAnalysisData {
  parsed_case: ParsedCase;
  treatment_options: TreatmentOption[];
  top_recommendation: string;
  recommendation_rationale: string;
  clinical_pearls: string[];
  papers_reviewed: Array<{
    pmid: string;
    title: string;
    year?: string;
  }>;
  search_terms_used: string[];
  acute_management?: AcuteManagement;
  suggested_followups?: string[];
  medication_review?: MedicationReview;
  differential_diagnosis?: {
    clinical_reasoning_summary: string;
    key_distinguishing_tests: string[];
    diagnoses: Array<{
      diagnosis: string;
      likelihood: 'high' | 'moderate' | 'low';
      must_rule_out: boolean;
      supporting_findings: string[];
      refuting_findings: string[];
      diagnostic_pathway: string[];
      distinguishing_feature: string;
    }>;
  };
  clinical_risk_scores?: {
    scores: Array<{
      score_id: string;
      score_name: string;
      total_score: number;
      max_score: number;
      risk_level: string;
      risk_interpretation: string;
      recommendation: string;
      variables: Array<{
        name: string;
        value: number | string | null;
        source: 'deterministic' | 'medgemma' | 'missing';
        points: number;
        label: string;
        criteria: string;
      }>;
      missing_variables: string[];
      applicable: boolean;
    }>;
    case_category: string;
    summary: string;
  };
}

export interface FollowUpMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export type SSEEvent = StepUpdate | CaseAnalysisResult | { type: 'done' } | { type: 'error'; message: string };

// Helper functions
export function hasMedicationReview(mr?: MedicationReview): boolean {
  if (!mr) return false;
  return (
    (mr.renal_flags && mr.renal_flags.length > 0) ||
    (mr.interactions && mr.interactions.length > 0) ||
    (mr.duplicate_therapy && mr.duplicate_therapy.length > 0)
  ) as boolean;
}

export function hasAcuteManagement(am?: AcuteManagement): boolean {
  if (!am) return false;
  return (
    !!am.risk_stratification ||
    (am.immediate_actions && am.immediate_actions.length > 0) ||
    (am.do_not_do && am.do_not_do.length > 0) ||
    (am.monitoring_plan && am.monitoring_plan.length > 0) ||
    (am.consults && am.consults.length > 0) ||
    !!am.disposition ||
    !!am.activity_restrictions ||
    (am.key_counseling && am.key_counseling.length > 0) ||
    (am.metabolic_corrections && am.metabolic_corrections.length > 0)
  ) as boolean;
}
