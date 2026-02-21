// Types for patient-facing visit summaries released by clinicians

import type { CompanionConfig } from './postvisit';

export interface PatientMedication {
  name: string;
  dose: string;
  frequency: string;
  action: 'continue' | 'new' | 'discontinue';
  plainLanguageInstructions: string;
}

export interface PatientFollowUp {
  timeframe: string;
  provider: string;
  reason: string;
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
