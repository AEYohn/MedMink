import type { ReleasedVisitSummary, PatientMedication, PatientFollowUp } from '@/types/visit-summary';
import type { CaseAnalysisData } from '@/types/case';
import type { ClinicianOverrides, DischargeMedOverride } from '@/lib/storage';
import type { CompanionConfig } from '@/types/postvisit';

export interface DischargePlanSnapshot {
  follow_up?: Array<{ timeframe: string; provider: string; reason: string }>;
  red_flags?: string[];
  restrictions?: Array<{ type: string; restriction: string; duration: string; reason: string }>;
}

interface BuildVisitSummaryParams {
  caseSessionId: string;
  patientId: string;
  analysisData: CaseAnalysisData;
  overrides: ClinicianOverrides;
  dischargePlan: DischargePlanSnapshot | null;
  visitDate: string;
  releasedBy?: string;
  companionConfig?: CompanionConfig;
}

function buildPlainLanguage(med: DischargeMedOverride): string {
  const actionLabel =
    med.action === 'new' ? 'New medication' :
    med.action === 'discontinue' ? 'STOP taking' :
    'Continue taking';

  const parts = [actionLabel, med.name];
  if (med.dose) parts.push(`- ${med.dose}`);
  if (med.frequency) parts.push(`- ${med.frequency}`);
  return parts.join(' ');
}

function mapMedications(meds: DischargeMedOverride[], nonMedNames: Set<string>): PatientMedication[] {
  return meds
    .filter(med => !nonMedNames.has(med.name))
    .map(med => ({
      name: med.name,
      dose: med.dose,
      frequency: med.frequency,
      action: med.action,
      plainLanguageInstructions: buildPlainLanguage(med),
      option_type: med.option_type ?? 'medication' as const,
    }));
}

function mapFollowUps(plan: DischargePlanSnapshot | null): PatientFollowUp[] {
  if (!plan?.follow_up?.length) return [];
  return plan.follow_up.map(fu => ({
    timeframe: fu.timeframe,
    provider: fu.provider,
    reason: fu.reason,
  }));
}

function mapRestrictions(plan: DischargePlanSnapshot | null): string[] {
  if (!plan?.restrictions?.length) return [];
  return plan.restrictions.map(r =>
    `${r.restriction}${r.duration ? ` (${r.duration})` : ''}${r.reason ? ` — ${r.reason}` : ''}`
  );
}

export function buildVisitSummary({
  caseSessionId,
  patientId,
  analysisData,
  overrides,
  dischargePlan,
  visitDate,
  releasedBy = 'Clinician',
  companionConfig,
}: BuildVisitSummaryParams): ReleasedVisitSummary {
  // Build set of treatment names that are NOT medications (procedures, diagnostics, etc.)
  // so we can filter them out of the patient-facing medication list
  const nonMedNames = new Set<string>(
    (analysisData.treatment_options || [])
      .filter(t => t.option_type && t.option_type !== 'medication')
      .map(t => t.name)
  );

  return {
    id: `vs-${Date.now()}`,
    caseSessionId,
    patientId,
    diagnosis: analysisData.top_recommendation,
    diagnosisExplanation: analysisData.recommendation_rationale,
    medications: mapMedications(overrides.dischargeMeds, nonMedNames),
    dischargeInstructions: overrides.dischargeInstructions,
    followUps: mapFollowUps(dischargePlan),
    redFlags: dischargePlan?.red_flags || [],
    restrictions: mapRestrictions(dischargePlan),
    releasedAt: new Date().toISOString(),
    releasedBy,
    visitDate,
    status: 'released',
    companionConfig,
  };
}
