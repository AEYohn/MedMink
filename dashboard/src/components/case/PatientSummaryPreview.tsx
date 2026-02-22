'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Send,
  Pill,
  Calendar,
  AlertTriangle,
  Stethoscope,
  FileText,
  Info,
  Sparkles,
  Shield,
  ClipboardList,
  Trash2,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ReleasedVisitSummary, PatientMedication, PatientFollowUp, PatientOrder } from '@/types/visit-summary';
import type { CompanionConfig } from '@/types/postvisit';

interface PatientSummaryPreviewProps {
  isOpen: boolean;
  onClose: () => void;
  onRelease: (editedSummary: ReleasedVisitSummary, companionConfig?: CompanionConfig) => void;
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

const ACTION_CYCLE: PatientMedication['action'][] = ['continue', 'new', 'discontinue'];

const orderTypeBadge: Record<string, string> = {
  procedure: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  diagnostic: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400',
  supportive_care: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  referral: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400',
};

const ORDER_TYPE_CYCLE: PatientOrder['type'][] = ['diagnostic', 'procedure', 'referral', 'supportive_care'];

// Borderless editable input that looks like display text until focused
const editInput = 'bg-transparent border-0 border-b border-transparent hover:border-muted-foreground/30 focus:border-primary focus:ring-0 focus:outline-none px-0 py-0.5 text-sm transition-colors w-full';

function EditableStringList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-foreground shrink-0">•</span>
          <input
            value={item}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            className={cn(editInput, 'flex-1')}
            placeholder={placeholder}
          />
          <button
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="text-muted-foreground hover:text-destructive shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...items, ''])}
        className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
      >
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  );
}

export function PatientSummaryPreview({
  isOpen,
  onClose,
  onRelease,
  summary,
  isReleasing,
  hasDischargePlan,
}: PatientSummaryPreviewProps) {
  const [draft, setDraft] = useState<ReleasedVisitSummary | null>(null);
  const [blockedTopics, setBlockedTopics] = useState('');
  const [clinicianNotes, setClinicianNotes] = useState('');
  const [evidenceEnabled, setEvidenceEnabled] = useState(true);

  useEffect(() => {
    if (summary) setDraft(structuredClone(summary));
  }, [summary]);

  const updateDraft = useCallback(<K extends keyof ReleasedVisitSummary>(
    field: K,
    value: ReleasedVisitSummary[K],
  ) => {
    setDraft(prev => prev ? { ...prev, [field]: value } : prev);
  }, []);

  if (!isOpen || !draft) return null;

  const updateMed = (index: number, patch: Partial<PatientMedication>) => {
    const next = [...draft.medications];
    next[index] = { ...next[index], ...patch };
    updateDraft('medications', next);
  };

  const removeMed = (index: number) => {
    updateDraft('medications', draft.medications.filter((_, i) => i !== index));
  };

  const addMed = () => {
    updateDraft('medications', [
      ...draft.medications,
      { name: '', dose: '', frequency: '', action: 'new' as const, plainLanguageInstructions: '' },
    ]);
  };

  const updateOrder = (index: number, patch: Partial<PatientOrder>) => {
    const next = [...(draft.orders || [])];
    next[index] = { ...next[index], ...patch };
    updateDraft('orders', next);
  };

  const removeOrder = (index: number) => {
    updateDraft('orders', (draft.orders || []).filter((_, i) => i !== index));
  };

  const addOrder = () => {
    updateDraft('orders', [
      ...(draft.orders || []),
      { name: '', description: '', type: 'diagnostic' as const },
    ]);
  };

  const updateFollowUp = (index: number, patch: Partial<PatientFollowUp>) => {
    const next = [...draft.followUps];
    next[index] = { ...next[index], ...patch };
    updateDraft('followUps', next);
  };

  const removeFollowUp = (index: number) => {
    updateDraft('followUps', draft.followUps.filter((_, i) => i !== index));
  };

  const addFollowUp = () => {
    updateDraft('followUps', [
      ...draft.followUps,
      { timeframe: '', provider: '', reason: '' },
    ]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="w-full max-w-2xl mx-4 my-8 animate-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-t-xl px-6 py-4">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" />
            <div>
              <h2 className="font-semibold text-lg">Patient Visit Summary Preview</h2>
              <p className="text-teal-100 text-xs">Click any field to edit before releasing</p>
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

          {/* Diagnosis (editable) */}
          <Card className="border-teal-200 bg-teal-50/50 dark:bg-teal-950/20 dark:border-teal-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-teal-700 dark:text-teal-400">
                <Stethoscope className="w-4 h-4" />
                Your Diagnosis
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <input
                value={draft.diagnosis}
                onChange={(e) => updateDraft('diagnosis', e.target.value)}
                className={cn(editInput, 'font-semibold text-base')}
              />
              <textarea
                value={draft.diagnosisExplanation}
                onChange={(e) => updateDraft('diagnosisExplanation', e.target.value)}
                rows={2}
                className={cn(editInput, 'text-muted-foreground resize-none')}
                placeholder="Explanation for patient..."
              />
            </CardContent>
          </Card>

          {/* Medications (editable) */}
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
                      <th className="py-2 pr-1 text-xs font-medium text-muted-foreground">Action</th>
                      <th className="py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {draft.medications.map((med, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1.5 pr-2">
                          <input
                            value={med.name}
                            onChange={(e) => updateMed(i, { name: e.target.value })}
                            className={cn(editInput, 'font-medium')}
                            placeholder="Medication name"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            value={med.dose}
                            onChange={(e) => updateMed(i, { dose: e.target.value })}
                            className={cn(editInput, 'text-muted-foreground')}
                            placeholder="Dose"
                          />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input
                            value={med.frequency}
                            onChange={(e) => updateMed(i, { frequency: e.target.value })}
                            className={cn(editInput, 'text-muted-foreground')}
                            placeholder="Frequency"
                          />
                        </td>
                        <td className="py-1.5 pr-1">
                          <button
                            onClick={() => {
                              const idx = ACTION_CYCLE.indexOf(med.action);
                              updateMed(i, { action: ACTION_CYCLE[(idx + 1) % ACTION_CYCLE.length] });
                            }}
                          >
                            <Badge className={cn('text-xs cursor-pointer', actionBadge[med.action])}>
                              {actionLabel[med.action] || med.action}
                            </Badge>
                          </button>
                        </td>
                        <td className="py-1.5">
                          <button
                            onClick={() => removeMed(i)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={addMed}
                className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
              >
                <Plus className="w-3 h-3" /> Add Medication
              </button>
            </CardContent>
          </Card>

          {/* Orders / Your Plan (editable) */}
          {((draft.orders?.length ?? 0) > 0 || true) && (
            <Card className="border-indigo-200 dark:border-indigo-800">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                  <ClipboardList className="w-4 h-4" />
                  Your Plan
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(draft.orders || []).length > 0 ? (
                  <div className="space-y-2.5">
                    {(draft.orders || []).map((order, i) => (
                      <div key={i} className="flex items-start gap-2 group">
                        <button
                          onClick={() => {
                            const idx = ORDER_TYPE_CYCLE.indexOf(order.type);
                            updateOrder(i, { type: ORDER_TYPE_CYCLE[(idx + 1) % ORDER_TYPE_CYCLE.length] });
                          }}
                          className="shrink-0 mt-0.5"
                        >
                          <Badge className={cn('text-xs cursor-pointer capitalize', orderTypeBadge[order.type])}>
                            {order.type.replace('_', ' ')}
                          </Badge>
                        </button>
                        <div className="flex-1 min-w-0 space-y-1">
                          <input
                            value={order.name}
                            onChange={(e) => updateOrder(i, { name: e.target.value })}
                            className={cn(editInput, 'font-medium')}
                            placeholder="Order name"
                          />
                          <input
                            value={order.description}
                            onChange={(e) => updateOrder(i, { description: e.target.value })}
                            className={cn(editInput, 'text-xs text-muted-foreground')}
                            placeholder="Description for patient"
                          />
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                            <input
                              type="date"
                              value={order.scheduledDate || ''}
                              onChange={(e) => updateOrder(i, { scheduledDate: e.target.value || undefined })}
                              className={cn(editInput, 'text-xs text-muted-foreground max-w-[160px]')}
                            />
                          </div>
                        </div>
                        <button
                          onClick={() => removeOrder(i)}
                          className="text-muted-foreground hover:text-destructive shrink-0 mt-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No orders yet.</p>
                )}
                <button
                  onClick={addOrder}
                  className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                >
                  <Plus className="w-3 h-3" /> Add Order
                </button>
              </CardContent>
            </Card>
          )}

          {/* Discharge Instructions (editable) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-600" />
                What To Do Next
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={draft.dischargeInstructions}
                onChange={(e) => updateDraft('dischargeInstructions', e.target.value)}
                rows={4}
                className="text-sm resize-y"
              />
            </CardContent>
          </Card>

          {/* Follow-Up Schedule (editable) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-purple-600" />
                Follow-Up Appointments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {draft.followUps.map((fu, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <input
                      value={fu.timeframe}
                      onChange={(e) => updateFollowUp(i, { timeframe: e.target.value })}
                      className={cn(editInput, 'w-24 shrink-0 text-xs font-medium')}
                      placeholder="When"
                    />
                    <input
                      value={fu.provider}
                      onChange={(e) => updateFollowUp(i, { provider: e.target.value })}
                      className={cn(editInput, 'w-32 shrink-0 font-medium')}
                      placeholder="Provider"
                    />
                    <input
                      value={fu.reason}
                      onChange={(e) => updateFollowUp(i, { reason: e.target.value })}
                      className={cn(editInput, 'flex-1 text-muted-foreground')}
                      placeholder="Reason"
                    />
                    <button
                      onClick={() => removeFollowUp(i)}
                      className="text-muted-foreground hover:text-destructive shrink-0 mt-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addFollowUp}
                className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
              >
                <Plus className="w-3 h-3" /> Add Follow-Up
              </button>
            </CardContent>
          </Card>

          {/* Warning Signs (editable) */}
          <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4" />
                Warning Signs — Return to ED Immediately
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EditableStringList
                items={draft.redFlags}
                onChange={(items) => updateDraft('redFlags', items)}
                placeholder="Warning sign..."
              />
            </CardContent>
          </Card>

          {/* Restrictions (editable) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Restrictions</CardTitle>
            </CardHeader>
            <CardContent>
              <EditableStringList
                items={draft.restrictions}
                onChange={(items) => updateDraft('restrictions', items)}
                placeholder="Restriction..."
              />
            </CardContent>
          </Card>

          {/* PostVisit AI Companion Config */}
          <Card className="border-indigo-200 dark:border-indigo-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
                <Sparkles className="w-4 h-4" />
                PostVisit AI Companion Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Blocked Topics (comma-separated)
                </label>
                <input
                  type="text"
                  value={blockedTopics}
                  onChange={(e) => setBlockedTopics(e.target.value)}
                  placeholder="e.g., prognosis, surgery options"
                  className="w-full px-3 py-1.5 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  AI will redirect patients to discuss these topics with you directly
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  <Shield className="w-3 h-3 inline mr-1" />
                  Private Notes to AI
                </label>
                <textarea
                  value={clinicianNotes}
                  onChange={(e) => setClinicianNotes(e.target.value)}
                  placeholder="e.g., Patient is anxious about diagnosis, be extra reassuring"
                  rows={2}
                  className="w-full px-3 py-1.5 bg-background border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Only the AI sees these — helps it tailor responses (never shown to patient)
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={evidenceEnabled}
                  onChange={(e) => setEvidenceEnabled(e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Enable PubMed evidence search in companion responses
              </label>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => onRelease(draft, {
                blockedTopics: blockedTopics ? blockedTopics.split(',').map(t => t.trim()).filter(Boolean) : undefined,
                clinicianNotesToAi: clinicianNotes || undefined,
                evidenceSearchEnabled: evidenceEnabled,
              })}
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
