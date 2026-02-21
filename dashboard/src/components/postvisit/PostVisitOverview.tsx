'use client';

import {
  Stethoscope,
  Pill,
  Calendar,
  AlertTriangle,
  FileText,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { ExplainableText } from '@/components/patient/terms/ExplainableText';
import type { ReleasedVisitSummary } from '@/types/visit-summary';

const actionBadge: Record<string, string> = {
  continue: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  new: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  discontinue: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};
const actionLabel: Record<string, string> = {
  continue: 'Continue',
  new: 'New',
  discontinue: 'Stop',
};

export function PostVisitOverview({
  summary,
  onAskAI,
}: {
  summary: ReleasedVisitSummary;
  onAskAI: (question: string) => void;
}) {
  return (
    <div className="space-y-5">
      {/* Diagnosis */}
      <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h3 className="font-semibold text-sm text-surface-900 dark:text-white">Your Diagnosis</h3>
          </div>
          <button
            onClick={() => onAskAI(`What does ${summary.diagnosis} mean?`)}
            className="flex items-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 hover:underline"
          >
            <HelpCircle className="w-3 h-3" /> Ask AI about this
          </button>
        </div>
        <div className="rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800 p-4">
          <p className="font-semibold text-surface-900 dark:text-white">
            <ExplainableText text={summary.diagnosis} />
          </p>
          {summary.diagnosisExplanation && (
            <p className="text-sm text-surface-600 dark:text-surface-300 mt-1.5">
              <ExplainableText text={summary.diagnosisExplanation} />
            </p>
          )}
        </div>
      </div>

      {/* Medications */}
      {summary.medications.length > 0 && (
        <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Pill className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-semibold text-sm text-surface-900 dark:text-white">Your Medications</h3>
          </div>
          <div className="rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="bg-surface-50 dark:bg-surface-700/50 border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left px-4 py-2 text-xs font-medium text-surface-500">Medication</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-surface-500">Dose</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-surface-500">How Often</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-surface-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {summary.medications.map((med, i) => (
                  <tr key={i} className="border-b last:border-0 border-surface-100 dark:border-surface-700">
                    <td className="px-4 py-2.5 font-medium text-surface-900 dark:text-white">
                      <ExplainableText text={med.name} />
                    </td>
                    <td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">{med.dose || '—'}</td>
                    <td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">{med.frequency || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${actionBadge[med.action] || ''}`}>
                        {actionLabel[med.action] || med.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Plain language instructions */}
          <div className="mt-3 space-y-2">
            {summary.medications.map((med, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-xs text-surface-500 dark:text-surface-400">
                  {med.plainLanguageInstructions}
                </span>
                <button
                  onClick={() => onAskAI(`Why was ${med.name} prescribed? How should I take it?`)}
                  className="flex-shrink-0 text-rose-600 dark:text-rose-400 hover:underline"
                >
                  <HelpCircle className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medication timeline */}
      {summary.medications.filter(m => m.action !== 'discontinue').length > 0 && (
        <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-sm text-surface-900 dark:text-white">When to Take Your Medications</h3>
          </div>
          <div className="space-y-2">
            {summary.medications
              .filter(m => m.action !== 'discontinue')
              .map((med, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-surface-50 dark:bg-surface-700/30 border border-surface-200 dark:border-surface-700 px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{med.name} {med.dose}</p>
                    <p className="text-xs text-surface-500">{med.frequency}</p>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${actionBadge[med.action]}`}>
                    {actionLabel[med.action]}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Follow-Up Appointments */}
      {summary.followUps.length > 0 && (
        <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h3 className="font-semibold text-sm text-surface-900 dark:text-white">Follow-Up Appointments</h3>
          </div>
          <div className="space-y-2">
            {summary.followUps.map((fu, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-surface-50 dark:bg-surface-700/30 border border-surface-200 dark:border-surface-700 px-4 py-3">
                <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 shrink-0 mt-0.5">
                  {fu.timeframe}
                </span>
                <div>
                  <p className="font-medium text-sm text-surface-900 dark:text-white">{fu.provider}</p>
                  <p className="text-xs text-surface-500">{fu.reason}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warning Signs */}
      {summary.redFlags.length > 0 && (
        <div className="rounded-xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-sm text-red-700 dark:text-red-400">Warning Signs — Return Immediately</h3>
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
        <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <h3 className="font-semibold text-sm text-surface-900 dark:text-white">What To Do Next</h3>
          </div>
          <div className="rounded-lg bg-surface-50 dark:bg-surface-700/30 border border-surface-200 dark:border-surface-700 p-4">
            <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap">
              <ExplainableText text={summary.dischargeInstructions} />
            </p>
          </div>
        </div>
      )}

      {/* Restrictions */}
      {summary.restrictions.length > 0 && (
        <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
          <h3 className="font-semibold text-sm text-surface-900 dark:text-white mb-3">Restrictions</h3>
          <ul className="space-y-1.5">
            {summary.restrictions.map((r, i) => (
              <li key={i} className="text-sm text-surface-600 dark:text-surface-300 flex items-start gap-2">
                <span className="text-surface-400 mt-0.5">•</span> {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Approved info */}
      <div className="text-xs text-surface-500 dark:text-surface-400 text-center">
        Approved by {summary.releasedBy} on {new Date(summary.releasedAt).toLocaleString()}
      </div>
    </div>
  );
}
