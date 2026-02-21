'use client';

import { useState } from 'react';
import {
  User,
  Activity,
  Beaker,
  Pill,
  Clock,
  AlertTriangle,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useActivePatient } from '@/contexts/ActivePatientContext';
import type { ParsedCase } from '@/types/case';

function detectMismatch(
  parsedCase: ParsedCase,
  activeAge: number | null,
  activeSex: string | undefined,
) {
  const mismatches: string[] = [];

  // Age: extract leading number from e.g. "32 years"
  if (activeAge != null && parsedCase.patient?.age) {
    const m = parsedCase.patient.age.match(/(\d+)/);
    if (m) {
      const parsedAge = parseInt(m[1], 10);
      if (Math.abs(parsedAge - activeAge) > 1) {
        mismatches.push('age');
      }
    }
  }

  // Sex: normalize to first char lowercase
  if (activeSex && parsedCase.patient?.sex) {
    const activeNorm = activeSex[0].toLowerCase();
    const parsedNorm = parsedCase.patient.sex.trim()[0]?.toLowerCase();
    if (parsedNorm && activeNorm !== parsedNorm) {
      mismatches.push('sex');
    }
  }

  return mismatches;
}

interface CaseSummaryCardProps {
  parsedCase: ParsedCase;
}

export function CaseSummaryCard({ parsedCase }: CaseSummaryCardProps) {
  const { patient, displayName, age } = useActivePatient();
  const [dismissed, setDismissed] = useState(false);

  const mismatches = patient ? detectMismatch(parsedCase, age, patient.sex) : [];
  const showWarning = !dismissed && mismatches.length > 0;

  // Build active patient summary (e.g. "22y M")
  const activeAgeSex = patient
    ? `${age ?? '?'}y ${patient.sex === 'female' ? 'F' : patient.sex === 'male' ? 'M' : patient.sex}`
    : '';

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        {showWarning && (
          <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="flex-1 text-xs text-amber-800 dark:text-amber-200">
              <p className="font-medium">
                Demographics don&apos;t match active patient ({displayName}: {activeAgeSex}).
              </p>
              <p className="mt-0.5">
                The case describes a {parsedCase.patient?.age ?? '?'} {parsedCase.patient?.sex ?? '?'}.
              </p>
            </div>
            <button
              onClick={() => setDismissed(true)}
              className="shrink-0 rounded p-0.5 text-amber-600 hover:bg-amber-200/60 dark:text-amber-400 dark:hover:bg-amber-800/60"
              aria-label="Dismiss warning"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold">Case Summary</span>
          {parsedCase.case_category && (
            <Badge variant="secondary" className="text-xs">{parsedCase.case_category}</Badge>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Patient */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <User className="w-3.5 h-3.5 text-blue-500" />
              Patient
            </div>
            <div className="text-sm">
              <p className="font-medium">{parsedCase.patient?.age} {parsedCase.patient?.sex}</p>
              {parsedCase.patient?.relevant_history?.length > 0 && (
                <ul className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                  {parsedCase.patient.relevant_history.slice(0, 3).map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                  {parsedCase.patient.relevant_history.length > 3 && (
                    <li className="italic">+{parsedCase.patient.relevant_history.length - 3} more</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {/* Presentation */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Activity className="w-3.5 h-3.5 text-purple-500" />
              Presentation
            </div>
            <div className="text-xs text-muted-foreground">
              <p>{parsedCase.findings?.presentation}</p>
              {parsedCase.findings?.timeline && (
                <p className="flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {parsedCase.findings.timeline}
                </p>
              )}
            </div>
          </div>

          {/* Key Findings */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Beaker className="w-3.5 h-3.5 text-green-500" />
              Key Findings
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {parsedCase.findings?.labs?.slice(0, 3).map((lab, i) => (
                <p key={i}>{lab}</p>
              ))}
              {parsedCase.findings?.imaging?.slice(0, 2).map((img, i) => (
                <p key={`img-${i}`}>{img}</p>
              ))}
            </div>
          </div>

          {/* Current Management */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Pill className="w-3.5 h-3.5 text-amber-500" />
              Current Meds
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {parsedCase.management?.medications?.slice(0, 4).map((med, i) => (
                <p key={i}>{med}</p>
              ))}
              {parsedCase.management?.recent_changes && (
                <p className="italic">{parsedCase.management.recent_changes}</p>
              )}
            </div>
          </div>
        </div>

        {/* Clinical Question */}
        {parsedCase.clinical_question && (
          <div className="mt-3 p-2 bg-primary/5 rounded-md border border-primary/20">
            <p className="text-xs font-medium text-primary">
              Q: {parsedCase.clinical_question}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
