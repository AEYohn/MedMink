'use client';

import {
  X,
  Send,
  Pill,
  Calendar,
  AlertTriangle,
  Stethoscope,
  FileText,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ReleasedVisitSummary } from '@/types/visit-summary';

interface PatientSummaryPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onRelease: () => void;
  summary: ReleasedVisitSummary | null;
  isReleasing?: boolean;
  hasDischargePlan: boolean;
}

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

export function PatientSummaryPreview({
  isOpen,
  onClose,
  onRelease,
  summary,
  isReleasing,
  hasDischargePlan,
}: PatientSummaryPreviewProps) {
  if (!isOpen || !summary) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl mx-4 my-8 animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-t-xl px-6 py-4">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" />
            <div>
              <h2 className="font-semibold text-lg">Patient Visit Summary Preview</h2>
              <p className="text-teal-100 text-xs">This is what the patient will see</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-background rounded-b-xl border border-t-0 space-y-4 p-6">
          {/* Discharge plan warning */}
          {!hasDischargePlan && (
            <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
              <CardContent className="pt-3 pb-3 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  No follow-up schedule or warning signs generated yet. Consider generating a
                  discharge plan first.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Diagnosis */}
          <Card className="border-teal-200 bg-teal-50/50 dark:bg-teal-950/20 dark:border-teal-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <Stethoscope className="w-4 h-4" />
                Your Diagnosis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-semibold text-base">{summary.diagnosis}</p>
              {summary.diagnosisExplanation && (
                <p className="text-sm text-muted-foreground mt-1.5">
                  {summary.diagnosisExplanation}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Medications */}
          {summary.medications.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Pill className="w-4 h-4 text-blue-600" />
                  Your Medications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-3 text-xs font-medium text-muted-foreground">Medication</th>
                        <th className="py-2 pr-3 text-xs font-medium text-muted-foreground">Dose</th>
                        <th className="py-2 pr-3 text-xs font-medium text-muted-foreground">How Often</th>
                        <th className="py-2 text-xs font-medium text-muted-foreground">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.medications.map((med, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-2 pr-3 font-medium">{med.name}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{med.dose || '—'}</td>
                          <td className="py-2 pr-3 text-muted-foreground">{med.frequency || '—'}</td>
                          <td className="py-2">
                            <Badge className={cn('text-xs', actionBadge[med.action])}>
                              {actionLabel[med.action] || med.action}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 space-y-1">
                  {summary.medications.map((med, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      {med.plainLanguageInstructions}
                    </p>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Discharge Instructions */}
          {summary.dischargeInstructions && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  What To Do Next
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{summary.dischargeInstructions}</p>
              </CardContent>
            </Card>
          )}

          {/* Follow-Up Schedule */}
          {summary.followUps.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  Follow-Up Appointments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2.5">
                  {summary.followUps.map((fu, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Badge variant="outline" className="shrink-0 mt-0.5">
                        {fu.timeframe}
                      </Badge>
                      <div>
                        <span className="font-medium text-sm">{fu.provider}</span>
                        <span className="text-sm text-muted-foreground ml-1">
                          &mdash; {fu.reason}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Warning Signs */}
          {summary.redFlags.length > 0 && (
            <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  Warning Signs — Return to ED Immediately
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {summary.redFlags.map((flag, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-red-800 dark:text-red-300"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Restrictions */}
          {summary.restrictions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Restrictions</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {summary.restrictions.map((r, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="text-foreground">•</span> {r}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={onRelease}
              disabled={isReleasing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Send className="w-4 h-4 mr-1.5" />
              Release to Patient
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
