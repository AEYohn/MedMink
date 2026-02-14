'use client';

import { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Loader2,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  Pill,
  Download,
  ClipboardList,
  Plus,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ClinicianOverrides, DischargeMedOverride } from '@/lib/storage';

interface MedReconciliation {
  medication: string;
  action: 'continue' | 'stop' | 'new' | 'dose_change';
  instructions: string;
  reason: string;
}

interface FollowUp {
  timeframe: string;
  provider: string;
  reason: string;
}

interface Restriction {
  type: string;
  restriction: string;
  duration: string;
  reason: string;
}

interface ReadmissionRisk {
  level: 'high' | 'moderate' | 'low';
  factors: string[];
  mitigation: string[];
}

interface DischargePlanData {
  patient_instructions: string;
  medication_reconciliation: MedReconciliation[];
  follow_up: FollowUp[];
  red_flags: string[];
  restrictions: Restriction[];
  readmission_risk: ReadmissionRisk;
}

interface DischargeEditorProps {
  parsedCase: Record<string, unknown>;
  treatmentOptions: Array<Record<string, unknown>>;
  acuteManagement: Record<string, unknown>;
  topRecommendation: string;
  overrides: ClinicianOverrides;
  onOverridesChange: (overrides: ClinicianOverrides) => void;
}

const actionColor: Record<string, string> = {
  continue: 'bg-green-100 text-green-800',
  stop: 'bg-red-100 text-red-800',
  new: 'bg-blue-100 text-blue-800',
  dose_change: 'bg-amber-100 text-amber-800',
  discontinue: 'bg-red-100 text-red-800',
};

const riskColor: Record<string, string> = {
  high: 'bg-red-100 text-red-800 border-red-300',
  moderate: 'bg-amber-100 text-amber-800 border-amber-300',
  low: 'bg-green-100 text-green-800 border-green-300',
};

export function DischargeEditor({
  parsedCase,
  treatmentOptions,
  acuteManagement,
  topRecommendation,
  overrides,
  onOverridesChange,
}: DischargeEditorProps) {
  const [plan, setPlan] = useState<DischargePlanData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Clinician discharge meds
  const dischargeMeds = overrides.dischargeMeds;
  const instructions = overrides.dischargeInstructions;

  // Auto-populate from accepted treatments when discharge meds are empty
  const hasPopulatedRef = useRef(false);
  useEffect(() => {
    if (hasPopulatedRef.current || dischargeMeds.length > 0) return;
    const acceptedMeds: DischargeMedOverride[] = [];
    for (const t of treatmentOptions) {
      const name = (t.name as string) || '';
      const treatmentOverride = overrides.treatments[name];
      if (treatmentOverride?.verdict === 'accepted') {
        acceptedMeds.push({
          name,
          dose: treatmentOverride.modifiedDose || '',
          frequency: '',
          source: 'ai',
          action: 'new',
        });
      }
    }
    if (acceptedMeds.length > 0) {
      hasPopulatedRef.current = true;
      onOverridesChange({
        ...overrides,
        dischargeMeds: acceptedMeds,
        lastModified: new Date().toISOString(),
      });
    }
  }, [treatmentOptions, overrides, dischargeMeds.length, onOverridesChange]);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const response = await fetch(`${apiUrl}/api/case/discharge-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parsed_case: parsedCase,
          treatment_options: treatmentOptions,
          acute_management: acuteManagement,
          top_recommendation: topRecommendation,
        }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      setPlan(data);

      // Pre-populate overrides from AI plan
      if (data.medication_reconciliation?.length > 0 && dischargeMeds.length === 0) {
        const aiMeds: DischargeMedOverride[] = data.medication_reconciliation.map((med: MedReconciliation) => ({
          name: med.medication,
          dose: med.instructions,
          frequency: '',
          source: 'ai' as const,
          action: med.action === 'stop' ? 'discontinue' as const : med.action === 'dose_change' ? 'continue' as const : med.action === 'new' ? 'new' as const : 'continue' as const,
        }));
        onOverridesChange({
          ...overrides,
          dischargeMeds: aiMeds,
          dischargeInstructions: data.patient_instructions || '',
          lastModified: new Date().toISOString(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate plan');
    } finally {
      setIsLoading(false);
    }
  };

  const updateMed = (index: number, update: Partial<DischargeMedOverride>) => {
    const updated = [...dischargeMeds];
    updated[index] = { ...updated[index], ...update };
    onOverridesChange({
      ...overrides,
      dischargeMeds: updated,
      lastModified: new Date().toISOString(),
    });
  };

  const addMed = () => {
    onOverridesChange({
      ...overrides,
      dischargeMeds: [
        ...dischargeMeds,
        { name: '', dose: '', frequency: '', source: 'clinician', action: 'new' },
      ],
      lastModified: new Date().toISOString(),
    });
  };

  const removeMed = (index: number) => {
    onOverridesChange({
      ...overrides,
      dischargeMeds: dischargeMeds.filter((_, i) => i !== index),
      lastModified: new Date().toISOString(),
    });
  };

  const updateInstructions = (text: string) => {
    onOverridesChange({
      ...overrides,
      dischargeInstructions: text,
      lastModified: new Date().toISOString(),
    });
  };

  const handleCopy = () => {
    let text = '=== DISCHARGE PLAN ===\n\n';
    if (instructions) text += 'INSTRUCTIONS:\n' + instructions + '\n\n';
    if (dischargeMeds.length > 0) {
      text += 'MEDICATIONS:\n';
      dischargeMeds.forEach(med => {
        text += `- ${med.name} ${med.dose} ${med.frequency} [${med.action.toUpperCase()}]\n`;
      });
      text += '\n';
    }
    if (plan?.follow_up?.length) {
      text += 'FOLLOW-UP:\n';
      plan.follow_up.forEach(fu => { text += `- ${fu.timeframe}: ${fu.provider} — ${fu.reason}\n`; });
      text += '\n';
    }
    if (plan?.red_flags?.length) {
      text += 'RED FLAGS:\n';
      plan.red_flags.forEach(f => { text += `- ${f}\n`; });
    }
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(contentRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save('discharge-plan.pdf');
    } catch (err) {
      console.error('PDF export failed:', err);
    }
  };

  if (!plan && dischargeMeds.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-3">
          <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            Generate a discharge plan with medication reconciliation and follow-up schedule.
          </p>
          <Button onClick={handleGenerate} disabled={isLoading} size="sm">
            {isLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileText className="w-4 h-4 mr-1" />}
            Generate Discharge Plan
          </Button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" ref={contentRef}>
      {/* Action bar */}
      <div className="flex justify-end gap-2">
        <Button onClick={handleCopy} size="sm" variant="outline">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button onClick={handleExportPDF} size="sm" variant="outline">
          <Download className="w-3.5 h-3.5 mr-1" /> PDF
        </Button>
        <Button onClick={handleGenerate} disabled={isLoading} size="sm" variant="outline">
          {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
          Regenerate
        </Button>
      </div>

      {/* Readmission Risk */}
      {plan?.readmission_risk?.level && (
        <Card className={cn('border', riskColor[plan.readmission_risk.level])}>
          <CardContent className="pt-3 pb-3">
            <Badge className={cn(riskColor[plan.readmission_risk.level])}>
              {plan.readmission_risk.level.toUpperCase()} Readmission Risk
            </Badge>
            {plan.readmission_risk.factors?.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Factors: {plan.readmission_risk.factors.join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Editable Medication Reconciliation Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-1">
              <Pill className="w-4 h-4" /> Medication Reconciliation
            </CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addMed}>
              <Plus className="w-3 h-3" /> Add Med
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-2 text-xs font-medium">Medication</th>
                  <th className="text-left py-2 pr-2 text-xs font-medium">Dose/Instructions</th>
                  <th className="text-left py-2 pr-2 text-xs font-medium">Frequency</th>
                  <th className="text-left py-2 pr-2 text-xs font-medium">Action</th>
                  <th className="text-left py-2 pr-2 text-xs font-medium">Source</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {dischargeMeds.map((med, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-1.5 pr-2">
                      <input
                        type="text"
                        value={med.name}
                        onChange={(e) => updateMed(i, { name: e.target.value })}
                        placeholder="Medication name"
                        className="w-full h-7 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="text"
                        value={med.dose}
                        onChange={(e) => updateMed(i, { dose: e.target.value })}
                        placeholder="Dose"
                        className="w-full h-7 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input
                        type="text"
                        value={med.frequency}
                        onChange={(e) => updateMed(i, { frequency: e.target.value })}
                        placeholder="Frequency"
                        className="w-full h-7 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <button
                        onClick={() => {
                          const actions: DischargeMedOverride['action'][] = ['continue', 'new', 'discontinue'];
                          const idx = actions.indexOf(med.action);
                          updateMed(i, { action: actions[(idx + 1) % actions.length] });
                        }}
                      >
                        <Badge className={cn('text-xs cursor-pointer', actionColor[med.action])}>
                          {med.action}
                        </Badge>
                      </button>
                    </td>
                    <td className="py-1.5 pr-2">
                      <Badge variant="outline" className={cn('text-[10px]', med.source === 'ai' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700')}>
                        {med.source === 'ai' ? 'AI' : 'You'}
                      </Badge>
                    </td>
                    <td className="py-1.5">
                      <button onClick={() => removeMed(i)} className="text-muted-foreground hover:text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Editable Patient Instructions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1">
            <FileText className="w-4 h-4" /> Patient Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={instructions}
            onChange={(e) => updateInstructions(e.target.value)}
            placeholder="Enter patient discharge instructions..."
            className="min-h-[120px] text-sm"
          />
        </CardContent>
      </Card>

      {/* Follow-Up Timeline (read-only from AI) */}
      {(plan?.follow_up?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1">
              <Calendar className="w-4 h-4" /> Follow-Up Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {plan!.follow_up.map((fu, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Badge variant="outline" className="shrink-0 mt-0.5">{fu.timeframe}</Badge>
                  <div>
                    <span className="font-medium">{fu.provider}</span>
                    <span className="text-muted-foreground ml-1">&mdash; {fu.reason}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Red Flags */}
      {(plan?.red_flags?.length ?? 0) > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1 text-red-700">
              <AlertTriangle className="w-4 h-4" /> Return to ED If You Experience
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {plan!.red_flags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {flag}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
