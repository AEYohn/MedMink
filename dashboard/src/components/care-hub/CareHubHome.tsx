'use client';

import {
  Pill,
  Calendar,
  Activity,
  Clock,
  AlertTriangle,
  Send,
  Sparkles,
} from 'lucide-react';
import { ExplainableText } from '@/components/patient/terms/ExplainableText';
import type { ReleasedVisitSummary } from '@/types/visit-summary';

export function CareHubHome({
  summary,
  onAskAI,
  onNavigate,
}: {
  summary: ReleasedVisitSummary;
  onAskAI: (question: string) => void;
  onNavigate: (tab: string) => void;
}) {
  const activeMeds = summary.medications.filter(m => m.action !== 'discontinue');
  const nextFollowUp = summary.followUps[0];
  const visitDate = new Date(summary.visitDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-5">
      {/* Welcome */}
      <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-950/30 dark:to-orange-950/20 border border-rose-100 dark:border-rose-900/40 p-6">
        <h2 className="text-xl font-bold text-surface-900 dark:text-white">
          Welcome back
        </h2>
        <p className="text-sm text-surface-600 dark:text-surface-400 mt-1">
          Here&apos;s a snapshot of your recent visit on {visitDate}
        </p>
      </div>

      {/* Diagnosis Card */}
      <div className="rounded-2xl border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20 p-5">
        <p className="text-xs font-medium text-teal-600 dark:text-teal-400 uppercase tracking-wide mb-1">
          Diagnosis
        </p>
        <p className="text-lg font-semibold text-surface-900 dark:text-white">
          <ExplainableText text={summary.diagnosis} />
        </p>
        {summary.diagnosisExplanation && (
          <p className="text-sm text-surface-600 dark:text-surface-300 mt-1">
            <ExplainableText text={summary.diagnosisExplanation} />
          </p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate('medications')}
          className="rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-white dark:bg-surface-800 p-4 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/30">
              <Pill className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <span className="text-xs font-medium text-surface-500 dark:text-surface-400">Medications</span>
          </div>
          <p className="text-2xl font-bold text-surface-900 dark:text-white">{activeMeds.length}</p>
          <p className="text-xs text-surface-500 dark:text-surface-400">active prescriptions</p>
        </button>

        <button
          onClick={() => onNavigate('visit')}
          className="rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-white dark:bg-surface-800 p-4 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs font-medium text-surface-500 dark:text-surface-400">Next Follow-Up</span>
          </div>
          <p className="text-lg font-bold text-surface-900 dark:text-white">
            {nextFollowUp ? nextFollowUp.timeframe : 'None'}
          </p>
          <p className="text-xs text-surface-500 dark:text-surface-400">
            {nextFollowUp ? nextFollowUp.provider : 'scheduled'}
          </p>
        </button>

        <button
          onClick={() => onNavigate('labs')}
          className="rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-white dark:bg-surface-800 p-4 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-900/30">
              <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <span className="text-xs font-medium text-surface-500 dark:text-surface-400">Vitals</span>
          </div>
          <p className="text-lg font-bold text-surface-900 dark:text-white">View</p>
          <p className="text-xs text-surface-500 dark:text-surface-400">labs &amp; vitals</p>
        </button>

        <button
          onClick={() => onNavigate('visit')}
          className="rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-white dark:bg-surface-800 p-4 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <Clock className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <span className="text-xs font-medium text-surface-500 dark:text-surface-400">Visit Date</span>
          </div>
          <p className="text-lg font-bold text-surface-900 dark:text-white">{visitDate}</p>
          <p className="text-xs text-surface-500 dark:text-surface-400">with {summary.releasedBy}</p>
        </button>
      </div>

      {/* Warning Signs */}
      {summary.redFlags.length > 0 && (
        <div className="rounded-2xl border-2 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <h3 className="font-semibold text-red-700 dark:text-red-400">Warning Signs — Seek Care Immediately</h3>
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

      {/* Mini Chat Input */}
      <div className="rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-white dark:bg-surface-800 p-4">
        <button
          onClick={() => onNavigate('chat')}
          className="w-full flex items-center gap-3 px-4 py-3 bg-rose-50/50 dark:bg-surface-700/50 rounded-xl text-left hover:bg-rose-50 dark:hover:bg-surface-700 transition-colors"
        >
          <Sparkles className="w-5 h-5 text-rose-500" />
          <span className="text-sm text-surface-500 dark:text-surface-400">
            Ask me anything about your visit...
          </span>
          <Send className="w-4 h-4 text-surface-400 ml-auto" />
        </button>
      </div>
    </div>
  );
}
