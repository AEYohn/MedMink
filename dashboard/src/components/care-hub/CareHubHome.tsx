'use client';

import {
  Pill,
  Calendar,
  Activity,
  Clock,
  AlertTriangle,
  Send,
  Sparkles,
  ClipboardList,
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
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-border p-6">
        <h2 className="text-xl font-bold text-foreground">
          Welcome back
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Here&apos;s a snapshot of your recent visit on {visitDate}
        </p>
      </div>

      {/* Diagnosis Card */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
        <p className="text-xs font-medium text-primary uppercase tracking-wide mb-1">
          Diagnosis
        </p>
        <p className="text-lg font-semibold text-foreground">
          <ExplainableText text={summary.diagnosis} />
        </p>
        {summary.diagnosisExplanation && (
          <p className="text-sm text-muted-foreground mt-1">
            <ExplainableText text={summary.diagnosisExplanation} />
          </p>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onNavigate('medications')}
          className="rounded-2xl border border-border bg-card p-4 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <Pill className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Medications</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{activeMeds.length}</p>
          <p className="text-xs text-muted-foreground">active prescriptions</p>
        </button>

        <button
          onClick={() => onNavigate('visit')}
          className="rounded-2xl border border-border bg-card p-4 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Next Follow-Up</span>
          </div>
          <p className="text-lg font-bold text-foreground">
            {nextFollowUp ? nextFollowUp.timeframe : 'None'}
          </p>
          <p className="text-xs text-muted-foreground">
            {nextFollowUp ? nextFollowUp.provider : 'scheduled'}
          </p>
        </button>

        <button
          onClick={() => onNavigate('labs')}
          className="rounded-2xl border border-border bg-card p-4 text-left hover:shadow-md transition-shadow"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-teal-100 dark:bg-teal-900/30">
              <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Vitals</span>
          </div>
          <p className="text-lg font-bold text-foreground">View</p>
          <p className="text-xs text-muted-foreground">labs &amp; vitals</p>
        </button>

        {(summary.orders?.length ?? 0) > 0 ? (
          <button
            onClick={() => onNavigate('visit')}
            className="rounded-2xl border border-border bg-card p-4 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <ClipboardList className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Plan Items</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{summary.orders!.length}</p>
            <p className="text-xs text-muted-foreground">tests &amp; referrals</p>
          </button>
        ) : (
          <button
            onClick={() => onNavigate('visit')}
            className="rounded-2xl border border-border bg-card p-4 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-accent/15">
                <Clock className="w-4 h-4 text-accent" />
              </div>
              <span className="text-xs font-medium text-muted-foreground">Visit Date</span>
            </div>
            <p className="text-lg font-bold text-foreground">{visitDate}</p>
            <p className="text-xs text-muted-foreground">with {summary.releasedBy}</p>
          </button>
        )}
      </div>

      {/* Warning Signs */}
      {summary.redFlags.length > 0 && (
        <div className="rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h3 className="font-semibold text-destructive">Warning Signs — Seek Care Immediately</h3>
          </div>
          <div className="space-y-2">
            {summary.redFlags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 text-destructive/70 shrink-0" />
                <p className="text-sm text-destructive">
                  <ExplainableText text={flag} />
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini Chat Input */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <button
          onClick={() => onNavigate('chat')}
          className="w-full flex items-center gap-3 px-4 py-3 bg-muted/50 rounded-xl text-left hover:bg-muted transition-colors"
        >
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="text-sm text-muted-foreground">
            Ask me anything about your visit...
          </span>
          <Send className="w-4 h-4 text-muted-foreground ml-auto" />
        </button>
      </div>
    </div>
  );
}
