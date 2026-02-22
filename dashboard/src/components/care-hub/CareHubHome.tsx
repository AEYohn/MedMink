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
  ShieldAlert,
  Heart,
  Stethoscope,
} from 'lucide-react';
import { ExplainableText } from '@/components/patient/terms/ExplainableText';
import { CarePlanChecklist } from '@/components/care-hub/CarePlanChecklist';
import { useCarePlan } from '@/hooks/useCarePlan';
import type { ReleasedVisitSummary } from '@/types/visit-summary';
import type { Patient } from '@/lib/patient-storage';
import { getPatientAge } from '@/lib/patient-storage';

export function CareHubHome({
  summary,
  patient,
  onAskAI,
  onNavigate,
}: {
  summary: ReleasedVisitSummary;
  patient?: Patient | null;
  onAskAI: (question: string) => void;
  onNavigate: (tab: string) => void;
}) {
  const { items: carePlanItems, statuses: carePlanStatuses, updateStatus: updateCarePlanStatus } = useCarePlan(summary);
  const hasCarePlan = carePlanItems.length > 0;

  const activeMeds = summary.medications.filter(m => m.action !== 'discontinue');
  const nextFollowUp = summary.followUps[0];
  const visitDate = new Date(summary.visitDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const initials = patient
    ? `${patient.firstName[0] ?? ''}${patient.lastName[0] ?? ''}`.toUpperCase()
    : null;

  const age = patient ? getPatientAge(patient) : null;
  const sexLabel = patient
    ? patient.sex === 'male' ? 'M' : patient.sex === 'female' ? 'F' : ''
    : null;

  return (
    <div className="space-y-5">
      {/* Welcome / Patient Profile Header */}
      <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-border p-6">
        {patient ? (
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-primary">{initials}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">
                Welcome back, {patient.firstName}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {age !== null && <>{age}{sexLabel} &middot; </>}
                Visit on {visitDate}
              </p>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-foreground">
              Welcome back
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Here&apos;s a snapshot of your recent visit on {visitDate}
            </p>
          </>
        )}
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

      {/* Health Snapshot */}
      {patient && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Heart className="w-4 h-4 text-primary" />
            Your Health Snapshot
          </h3>

          {/* Allergies */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Allergies
            </p>
            {patient.allergies.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {patient.allergies.map((a, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                    {a}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">None reported</p>
            )}
          </div>

          {/* Conditions */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5" />
              Conditions
            </p>
            {patient.conditions.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {patient.conditions.map((c, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {c}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">None reported</p>
            )}
          </div>

          {/* Home Medications */}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
              <Pill className="w-3.5 h-3.5" />
              Home Medications
            </p>
            {patient.medications.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {patient.medications.map((m, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                    {m}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">None reported</p>
            )}
          </div>
        </div>
      )}

      {/* Care Plan or Quick Stats */}
      {hasCarePlan ? (
        <>
          <CarePlanChecklist
            items={carePlanItems}
            statuses={carePlanStatuses}
            onStatusChange={updateCarePlanStatus}
            onAskAI={onAskAI}
          />
          <div className="flex gap-2">
            <button
              onClick={() => onNavigate('medications')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:shadow-md transition-shadow"
            >
              <Pill className="w-4 h-4 text-primary" />
              {activeMeds.length} medication{activeMeds.length !== 1 ? 's' : ''}
            </button>
            <button
              onClick={() => onNavigate('labs')}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-border bg-card text-sm font-medium text-foreground hover:shadow-md transition-shadow"
            >
              <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              Labs &amp; Vitals
            </button>
          </div>
        </>
      ) : (
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
        </div>
      )}

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
