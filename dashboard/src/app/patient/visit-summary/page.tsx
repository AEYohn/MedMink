'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  Stethoscope,
  Pill,
  Calendar,
  AlertTriangle,
  ChevronDown,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { getReleasedSummaries } from '@/lib/storage';
import { cn } from '@/lib/utils';
import type { ReleasedVisitSummary } from '@/types/visit-summary';
import { ExplainableText } from '@/components/patient/terms/ExplainableText';

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

function SummaryCard({
  summary,
  defaultExpanded,
}: {
  summary: ReleasedVisitSummary;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const visitDate = new Date(summary.visitDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
      {/* Collapsed header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
            <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-surface-900 dark:text-white truncate">
              {summary.diagnosis}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400 flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> {visitDate}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" /> Approved
          </span>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-surface-400 transition-transform',
              expanded && 'rotate-180'
            )}
          />
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-surface-100 dark:border-surface-700">
          {/* Diagnosis */}
          <div className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="font-semibold text-sm text-surface-900 dark:text-white">
                Your Diagnosis
              </h3>
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
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Pill className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-sm text-surface-900 dark:text-white">
                  Your Medications
                </h3>
              </div>
              <div className="rounded-lg border border-surface-200 dark:border-surface-700 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm min-w-[480px]">
                  <thead>
                    <tr className="bg-surface-50 dark:bg-surface-700/50 border-b border-surface-200 dark:border-surface-700">
                      <th className="text-left px-4 py-2 text-xs font-medium text-surface-500 dark:text-surface-400">
                        Medication
                      </th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-surface-500 dark:text-surface-400">
                        Dose
                      </th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-surface-500 dark:text-surface-400">
                        How Often
                      </th>
                      <th className="text-left px-4 py-2 text-xs font-medium text-surface-500 dark:text-surface-400">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.medications.map((med, i) => (
                      <tr
                        key={i}
                        className="border-b last:border-0 border-surface-100 dark:border-surface-700"
                      >
                        <td className="px-4 py-2.5 font-medium text-surface-900 dark:text-white">
                          <ExplainableText text={med.name} />
                        </td>
                        <td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">
                          {med.dose || '—'}
                        </td>
                        <td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">
                          {med.frequency || '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={cn(
                              'inline-flex px-2 py-0.5 rounded-full text-xs font-medium',
                              actionBadge[med.action]
                            )}
                          >
                            {actionLabel[med.action] || med.action}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 space-y-1">
                {summary.medications.map((med, i) => (
                  <p
                    key={i}
                    className="text-xs text-surface-500 dark:text-surface-400 pl-1"
                  >
                    {med.plainLanguageInstructions}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Discharge Instructions */}
          {summary.dischargeInstructions && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3 className="font-semibold text-sm text-surface-900 dark:text-white">
                  What To Do Next
                </h3>
              </div>
              <div className="rounded-lg bg-surface-50 dark:bg-surface-700/30 border border-surface-200 dark:border-surface-700 p-4">
                <p className="text-sm text-surface-700 dark:text-surface-300 whitespace-pre-wrap">
                  <ExplainableText text={summary.dischargeInstructions} />
                </p>
              </div>
            </div>
          )}

          {/* Follow-Up Appointments */}
          {summary.followUps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <h3 className="font-semibold text-sm text-surface-900 dark:text-white">
                  Follow-Up Appointments
                </h3>
              </div>
              <div className="space-y-2">
                {summary.followUps.map((fu, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg bg-surface-50 dark:bg-surface-700/30 border border-surface-200 dark:border-surface-700 px-4 py-3"
                  >
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 shrink-0 mt-0.5">
                      {fu.timeframe}
                    </span>
                    <div>
                      <p className="font-medium text-sm text-surface-900 dark:text-white">
                        {fu.provider}
                      </p>
                      <p className="text-xs text-surface-500 dark:text-surface-400">
                        {fu.reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning Signs */}
          {summary.redFlags.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                <h3 className="font-semibold text-sm text-red-700 dark:text-red-400">
                  Warning Signs — Return to ED Immediately
                </h3>
              </div>
              <div className="rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 p-4 space-y-2">
                {summary.redFlags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-red-500 shrink-0" />
                    <p className="text-sm text-red-800 dark:text-red-300"><ExplainableText text={flag} /></p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Restrictions */}
          {summary.restrictions.length > 0 && (
            <div>
              <h3 className="font-semibold text-sm text-surface-900 dark:text-white mb-2">
                Restrictions
              </h3>
              <ul className="space-y-1 pl-1">
                {summary.restrictions.map((r, i) => (
                  <li
                    key={i}
                    className="text-sm text-surface-600 dark:text-surface-300 flex items-start gap-2"
                  >
                    <span className="text-surface-400">•</span> {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Approved by */}
          <div className="pt-2 border-t border-surface-100 dark:border-surface-700">
            <p className="text-xs text-surface-500 dark:text-surface-400">
              Approved by {summary.releasedBy} on{' '}
              {new Date(summary.releasedAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PatientVisitSummaryPage() {
  const [summaries, setSummaries] = useState<ReleasedVisitSummary[]>([]);

  useEffect(() => {
    const all = getReleasedSummaries().filter(s => s.status === 'released');
    setSummaries(all);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
              Visit Summaries
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CheckCircle2 className="w-3 h-3" /> Doctor Approved
            </span>
          </div>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Review your doctor-approved visit notes and instructions
          </p>
        </div>
      </div>

      {/* Summary List */}
      {summaries.length > 0 ? (
        <div className="space-y-3">
          {summaries.map((summary, i) => (
            <SummaryCard
              key={summary.id}
              summary={summary}
              defaultExpanded={i === 0}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-surface-400" />
          </div>
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-1">
            No visit summaries yet
          </h2>
          <p className="text-sm text-surface-500 dark:text-surface-400 max-w-sm mx-auto">
            Your doctor will share visit summaries here after your appointments.
          </p>
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Important Notice
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              This summary is for informational purposes only. If you have questions about your
              diagnosis, medications, or instructions, please contact your healthcare provider
              directly. In case of emergency, call 911 or go to the nearest emergency room.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
