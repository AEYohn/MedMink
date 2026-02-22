// Types for patient-facing visit summaries released by clinicians

import type { CompanionConfig } from './postvisit';

export interface PatientMedication {
  name: string;
  dose: string;
  frequency: string;
  action: 'continue' | 'new' | 'discontinue';
  plainLanguageInstructions: string;
  option_type?: 'medication' | 'procedure' | 'diagnostic' | 'supportive_care';
}

export interface PatientFollowUp {
  timeframe: string;
  provider: string;
  reason: string;
}

/**
 * Filter patient medications to only include actual pharmaceutical drugs.
 * Uses option_type when available (new data), falls back to name-based
 * heuristic for legacy stored summaries that lack the field.
 */
export function filterActualMedications(meds: PatientMedication[]): PatientMedication[] {
  const NON_DRUG_PATTERNS = [
    /^observat/i, /\breassurance\b/i, /^evaluat/i, /^assess\b/i,
    /^monitor\b/i, /\bx[\s-]?ray\b/i, /\bCT\s+scan/i, /\bMRI\b/i,
    /\bultrasound/i, /\bimaging\b/i, /^refer/i, /\bfollow[\s-]?up\b/i,
    /^watchful/i, /\bphysical therapy/i, /\boccupational therapy/i,
    /\bspeech therapy/i, /^lifestyle/i, /^counseling/i, /\bsurgery\b/i,
    /\bbiopsy\b/i, /\bendoscop/i, /\bcolonoscop/i, /\bbronchoscop/i,
  ];
  return meds.filter(med => {
    if (med.option_type) return med.option_type === 'medication';
    return !NON_DRUG_PATTERNS.some(p => p.test(med.name));
  });
}

export interface ReleasedVisitSummary {
  id: string;
  caseSessionId: string;
  patientId: string;
  diagnosis: string;
  diagnosisExplanation: string;
  medications: PatientMedication[];
  dischargeInstructions: string;
  followUps: PatientFollowUp[];
  redFlags: string[];
  restrictions: string[];
  releasedAt: string;
  releasedBy: string;
  visitDate: string;
  status: 'released' | 'revoked';
  companionConfig?: CompanionConfig;
}
