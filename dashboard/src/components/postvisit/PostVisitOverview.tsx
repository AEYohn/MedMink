'use client';

import { useMemo } from 'react';
import {
  Stethoscope,
  Pill,
  Calendar,
  AlertTriangle,
  FileText,
  Clock,
  HelpCircle,
  ClipboardList,
} from 'lucide-react';
import { ExplainableText } from '@/components/patient/terms/ExplainableText';
import type { ReleasedVisitSummary } from '@/types/visit-summary';
import { filterActualMedications } from '@/types/visit-summary';
import { useTranslation } from '@/i18n';

const actionBadge: Record<string, string> = {
  continue: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  discontinue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};
const actionLabelKey: Record<string, string> = {
  continue: 'overview.actionContinue',
  new: 'overview.actionNew',
  discontinue: 'overview.actionStop',
};

export function PostVisitOverview({
  summary,
  onAskAI,
}: {
  summary: ReleasedVisitSummary;
  onAskAI: (question: string) => void;
}) {
  const { t, bcp47 } = useTranslation();
  const medications = useMemo(() => filterActualMedications(summary.medications || []), [summary.medications]);

  return (
    <div className="space-y-5">
      {/* Diagnosis */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="font-semibold text-sm text-foreground">{t('overview.yourDiagnosis')}</h3>
          </div>
          <button
            onClick={() => onAskAI(`What does ${summary.diagnosis} mean?`)}
            className="flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            <HelpCircle className="w-3 h-3" /> {t('overview.askAIAbout')}
          </button>
        </div>
        <div className="rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 p-4">
          <p className="font-semibold text-foreground">
            <ExplainableText text={summary.diagnosis} />
          </p>
          {summary.diagnosisExplanation && (
            <p className="text-sm text-muted-foreground mt-1.5">
              <ExplainableText text={summary.diagnosisExplanation} />
            </p>
          )}
        </div>
      </div>

      {/* Medications */}
      {medications.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Pill className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-sm text-foreground">{t('overview.yourMedications')}</h3>
          </div>
          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{t('overview.medication')}</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{t('overview.dose')}</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{t('overview.howOften')}</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">{t('overview.action')}</th>
                </tr>
              </thead>
              <tbody>
                {medications.map((med, i) => (
                  <tr key={i} className="border-b last:border-0 border-border">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <ExplainableText text={med.name} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{med.dose || '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{med.frequency || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${actionBadge[med.action] || ''}`}>
                        {t(actionLabelKey[med.action]) || med.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Plain language instructions */}
          <div className="mt-3 space-y-2">
            {medications.map((med, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs text-muted-foreground">
                  {med.plainLanguageInstructions}
                </span>
                <button
                  onClick={() => onAskAI(`Why was ${med.name} prescribed? How should I take it?`)}
                  className="flex-shrink-0 text-primary hover:underline"
                >
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medication timeline */}
      {medications.filter(m => m.action !== 'discontinue').length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-sm text-foreground">{t('overview.whenToTake')}</h3>
          </div>
          <div className="space-y-2">
            {medications
              .filter(m => m.action !== 'discontinue')
              .map((med, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/50 border border-border px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{med.name} {med.dose}</p>
                    <p className="text-xs text-muted-foreground">{med.frequency}</p>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${actionBadge[med.action]}`}>
                    {t(actionLabelKey[med.action]) || med.action}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Your Plan (orders) */}
      {(summary.orders?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardList className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-semibold text-sm text-foreground">{t('overview.yourPlan')}</h3>
          </div>
          <div className="space-y-2">
            {(summary.orders || []).map((order, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-muted/50 border border-border px-4 py-3">
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize shrink-0 mt-0.5 ${
                  order.type === 'referral' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400' :
                  order.type === 'procedure' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                  order.type === 'supportive_care' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
                }`}>
                  {order.type.replace('_', ' ')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-foreground">
                    <ExplainableText text={order.name} />
                  </p>
                  <p className="text-xs text-muted-foreground">{order.description}</p>
                  {order.scheduledDate && (
                    <p className="text-xs text-primary mt-1">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      Scheduled: {new Date(order.scheduledDate + 'T00:00:00').toLocaleDateString(bcp47, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follow-Up Appointments */}
      {(summary.followUps?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-sm text-foreground">{t('overview.followUpAppointments')}</h3>
          </div>
          <div className="space-y-2">
            {summary.followUps.map((fu, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-muted/50 border border-border px-4 py-3">
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 shrink-0 mt-0.5">
                  {fu.timeframe}
                </span>
                <div>
                  <p className="font-medium text-sm text-foreground">{fu.provider}</p>
                  <p className="text-xs text-muted-foreground">{fu.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning Signs */}
      {(summary.redFlags?.length ?? 0) > 0 && (
        <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-sm text-red-700 dark:text-red-400">{t('overview.warningSigns')}</h3>
          </div>
          <div className="space-y-2">
            {summary.redFlags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-red-500 shrink-0" />
                <p className="text-sm text-red-800 dark:text-red-300">
                  <ExplainableText text={flag} />
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discharge Instructions */}
      {summary.dischargeInstructions && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">{t('overview.whatToDoNext')}</h3>
          </div>
          <div className="rounded-lg bg-muted/50 border border-border p-4">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              <ExplainableText text={summary.dischargeInstructions} />
            </p>
          </div>
        </div>
      )}

      {/* Restrictions */}
      {(summary.restrictions?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm text-foreground mb-3">{t('overview.restrictions')}</h3>
          <ul className="space-y-1.5">
            {summary.restrictions.map((r, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <span className="text-muted-foreground mt-0.5">•</span> {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Approved info */}
      <div className="text-xs text-muted-foreground text-center">
        {t('overview.approvedBy', { name: summary.releasedBy, date: new Date(summary.releasedAt).toLocaleString(bcp47) })}
      </div>
    </div>
  );
}
