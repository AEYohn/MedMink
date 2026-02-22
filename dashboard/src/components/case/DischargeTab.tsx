'use client';

import { useState, useRef } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/api-url';

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

interface DischargeTabProps {
  parsedCase: Record<string, unknown>;
  treatmentOptions: Array<Record<string, unknown>>;
  acuteManagement: Record<string, unknown>;
  topRecommendation: string;
}

const actionColor: Record<string, string> = {
  continue: 'bg-green-100 text-green-800',
  stop: 'bg-red-100 text-red-800',
  new: 'bg-blue-100 text-blue-800',
  dose_change: 'bg-amber-100 text-amber-800',
};

const riskColor: Record<string, string> = {
  high: 'bg-red-100 text-red-800 border-red-300',
  moderate: 'bg-amber-100 text-amber-800 border-amber-300',
  low: 'bg-green-100 text-green-800 border-green-300',
};

export function DischargeTab({
  parsedCase,
  treatmentOptions,
  acuteManagement,
  topRecommendation,
}: DischargeTabProps) {
  const [plan, setPlan] = useState<DischargePlanData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const apiUrl = getApiUrl();
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate plan');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (!plan) return;
    const text = formatPlanText(plan);
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

      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= 277;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight + 10;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        heightLeft -= 277;
      }

      pdf.save('discharge-plan.pdf');
    } catch (err) {
      console.error('PDF export failed:', err);
    }
  };

  if (!plan) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-3">
          <ClipboardList className="w-8 h-8 mx-auto text-muted-foreground opacity-50" />
          <p className="text-sm text-muted-foreground">
            Generate a patient-friendly discharge plan with medication reconciliation, follow-up schedule, and red flags.
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
      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button onClick={handleCopy} size="sm" variant="outline">
          {copied ? <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-600" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button onClick={handleExportPDF} size="sm" variant="outline">
          <Download className="w-3.5 h-3.5 mr-1" /> Export PDF
        </Button>
        <Button onClick={handleGenerate} disabled={isLoading} size="sm" variant="outline">
          {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
          Regenerate
        </Button>
      </div>

      {/* Readmission Risk */}
      {plan.readmission_risk?.level && (
        <Card className={cn('border', riskColor[plan.readmission_risk.level])}>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn(riskColor[plan.readmission_risk.level])}>
                {plan.readmission_risk.level.toUpperCase()} Readmission Risk
              </Badge>
            </div>
            {plan.readmission_risk.factors?.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Factors: {plan.readmission_risk.factors.join(', ')}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Patient Instructions */}
      {plan.patient_instructions && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1">
              <FileText className="w-4 h-4" /> Patient Instructions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-base leading-relaxed whitespace-pre-wrap bg-blue-50/50 p-4 rounded-lg">
              {plan.patient_instructions}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Medication Reconciliation */}
      {plan.medication_reconciliation?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1">
              <Pill className="w-4 h-4" /> Medication Reconciliation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Medication</th>
                    <th className="text-left py-2 pr-4">Action</th>
                    <th className="text-left py-2 pr-4">Instructions</th>
                    <th className="text-left py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.medication_reconciliation.map((med, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{med.medication}</td>
                      <td className="py-2 pr-4">
                        <Badge className={cn('text-xs', actionColor[med.action] || 'bg-gray-100')}>
                          {med.action}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{med.instructions}</td>
                      <td className="py-2 text-muted-foreground">{med.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Follow-Up Timeline */}
      {plan.follow_up?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1">
              <Calendar className="w-4 h-4" /> Follow-Up Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {plan.follow_up.map((fu, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Badge variant="outline" className="shrink-0 mt-0.5">{fu.timeframe}</Badge>
                  <div>
                    <span className="font-medium">{fu.provider}</span>
                    <span className="text-muted-foreground ml-1">— {fu.reason}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Red Flags */}
      {plan.red_flags?.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1 text-red-700">
              <AlertTriangle className="w-4 h-4" /> Return to ED If You Experience
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {plan.red_flags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {flag}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Restrictions */}
      {plan.restrictions?.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Restrictions</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {plan.restrictions.map((r, i) => (
                <li key={i} className="text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{r.type}</Badge>
                    <span className="font-medium">{r.restriction}</span>
                  </div>
                  <p className="text-xs text-muted-foreground ml-0 mt-0.5">
                    Duration: {r.duration} — {r.reason}
                  </p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatPlanText(plan: DischargePlanData): string {
  let text = '=== DISCHARGE PLAN ===\n\n';

  if (plan.patient_instructions) {
    text += 'PATIENT INSTRUCTIONS:\n' + plan.patient_instructions + '\n\n';
  }

  if (plan.medication_reconciliation?.length) {
    text += 'MEDICATION RECONCILIATION:\n';
    plan.medication_reconciliation.forEach((med) => {
      text += `- ${med.medication} [${med.action.toUpperCase()}]: ${med.instructions} (${med.reason})\n`;
    });
    text += '\n';
  }

  if (plan.follow_up?.length) {
    text += 'FOLLOW-UP:\n';
    plan.follow_up.forEach((fu) => {
      text += `- ${fu.timeframe}: ${fu.provider} — ${fu.reason}\n`;
    });
    text += '\n';
  }

  if (plan.red_flags?.length) {
    text += 'RED FLAGS (Return to ED):\n';
    plan.red_flags.forEach((flag) => {
      text += `- ${flag}\n`;
    });
    text += '\n';
  }

  if (plan.restrictions?.length) {
    text += 'RESTRICTIONS:\n';
    plan.restrictions.forEach((r) => {
      text += `- [${r.type}] ${r.restriction} (${r.duration}) — ${r.reason}\n`;
    });
    text += '\n';
  }

  if (plan.readmission_risk?.level) {
    text += `READMISSION RISK: ${plan.readmission_risk.level.toUpperCase()}\n`;
    if (plan.readmission_risk.factors?.length) {
      text += `Factors: ${plan.readmission_risk.factors.join(', ')}\n`;
    }
  }

  return text;
}
