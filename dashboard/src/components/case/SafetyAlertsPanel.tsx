'use client';

import { useState, useCallback } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  AlertTriangle,
  Pill,
  Check,
  Loader2,
  ChevronDown,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/api-url';
import type { MedicationReview } from '@/types/case';
import type { ClinicianOverrides, SafetyAcknowledgment } from '@/lib/storage';

interface TreatmentAlertSource {
  name: string;
  verdict: string;
  cons?: string[];
}

interface SafetyAlertsPanelProps {
  medicationReview?: MedicationReview;
  currentMedications: string[];
  newMedications: string[];
  patientConditions: string[];
  allergies: string[];
  labs: string[];
  age: string;
  sex: string;
  overrides: ClinicianOverrides;
  onOverridesChange: (overrides: ClinicianOverrides) => void;
  treatmentOptions?: TreatmentAlertSource[];
}

interface SafetyResult {
  interactions: Array<{
    drug_a: string;
    drug_b: string;
    severity: 'major' | 'moderate' | 'minor';
    mechanism?: string;
    clinical_effect: string;
    recommendation: string;
    alternatives?: string[];
  }>;
  drug_disease_conflicts: Array<{
    drug: string;
    condition: string;
    severity: 'major' | 'moderate' | 'minor';
    risk: string;
    recommendation: string;
  }>;
  dosing_concerns: Array<{
    drug: string;
    concern: string;
    recommendation: string;
  }>;
  allergy_alerts: Array<{
    drug: string;
    allergy: string;
    cross_reactivity_risk: 'high' | 'moderate' | 'low';
    recommendation: string;
  }>;
  overall_safety: 'safe' | 'caution' | 'unsafe';
  summary: string;
}

const severityColor = {
  major: 'bg-red-100 text-red-800 border-red-300',
  moderate: 'bg-amber-100 text-amber-800 border-amber-300',
  minor: 'bg-green-100 text-green-800 border-green-300',
};

const severityBorder = {
  major: 'border-l-red-500',
  moderate: 'border-l-amber-500',
  minor: 'border-l-green-500',
};

export function SafetyAlertsPanel({
  medicationReview,
  currentMedications,
  newMedications,
  patientConditions,
  allergies,
  labs,
  age,
  sex,
  overrides,
  onOverridesChange,
  treatmentOptions,
}: SafetyAlertsPanelProps) {
  const [safetyResult, setSafetyResult] = useState<SafetyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getAck = useCallback((key: string): SafetyAcknowledgment | undefined => {
    return overrides.safetyAcknowledgments[key];
  }, [overrides]);

  const setAck = useCallback((key: string, ack: SafetyAcknowledgment) => {
    onOverridesChange({
      ...overrides,
      safetyAcknowledgments: {
        ...overrides.safetyAcknowledgments,
        [key]: ack,
      },
      lastModified: new Date().toISOString(),
    });
  }, [overrides, onOverridesChange]);

  const handleRunCheck = async () => {
    setIsLoading(true);
    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) return;
      const response = await fetch(`${apiUrl}/api/case/medication-safety`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_medications: currentMedications,
          new_medications: newMedications,
          patient_conditions: patientConditions,
          allergies, labs, age, sex,
        }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      setSafetyResult(await response.json());
    } catch (err) {
      console.error('Safety check failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Build alert items from both medication review and safety check
  const alerts: Array<{ key: string; severity: 'major' | 'moderate' | 'minor'; title: string; detail: string; recommendation: string; type: string }> = [];

  // From medication review (inline)
  if (medicationReview) {
    medicationReview.renal_flags?.forEach((f, i) => {
      alerts.push({
        key: `renal-${i}`,
        severity: f.severity === 'critical' ? 'major' : 'moderate',
        title: `Renal: ${f.drug}`,
        detail: `${f.parameter}: ${f.value} — ${f.action}`,
        recommendation: f.action,
        type: 'Renal Dosing',
      });
    });
    medicationReview.interactions?.forEach((ix, i) => {
      alerts.push({
        key: `ix-${i}`,
        severity: ix.severity,
        title: `${ix.drug_a} + ${ix.drug_b}`,
        detail: ix.effect,
        recommendation: ix.recommendation,
        type: 'Drug Interaction',
      });
    });
    medicationReview.duplicate_therapy?.forEach((dup, i) => {
      alerts.push({
        key: `dup-${i}`,
        severity: 'moderate',
        title: `Duplicate: ${dup.drugs.join(' + ')}`,
        detail: dup.drug_class,
        recommendation: dup.recommendation,
        type: 'Duplicate Therapy',
      });
    });
  }

  // From safety check
  if (safetyResult) {
    safetyResult.interactions?.forEach((ix, i) => {
      alerts.push({
        key: `safety-ix-${i}`,
        severity: ix.severity,
        title: `${ix.drug_a} + ${ix.drug_b}`,
        detail: ix.clinical_effect,
        recommendation: ix.recommendation,
        type: 'Drug Interaction',
      });
    });
    safetyResult.drug_disease_conflicts?.forEach((c, i) => {
      alerts.push({
        key: `safety-ddc-${i}`,
        severity: c.severity,
        title: `${c.drug} / ${c.condition}`,
        detail: c.risk,
        recommendation: c.recommendation,
        type: 'Drug-Disease',
      });
    });
    safetyResult.dosing_concerns?.forEach((d, i) => {
      alerts.push({
        key: `safety-dose-${i}`,
        severity: 'moderate',
        title: d.drug,
        detail: d.concern,
        recommendation: d.recommendation,
        type: 'Dosing',
      });
    });
    safetyResult.allergy_alerts?.forEach((a, i) => {
      alerts.push({
        key: `safety-allergy-${i}`,
        severity: 'major',
        title: `${a.drug} (allergy: ${a.allergy})`,
        detail: `Cross-reactivity: ${a.cross_reactivity_risk}`,
        recommendation: a.recommendation,
        type: 'Allergy',
      });
    });
  }

  // From treatment options (not_recommended → warnings, recommended with serious cons → minor alerts)
  const SERIOUS_KEYWORDS = /contraindicated|avoid|risk|caution|dangerous|toxic|fatal|severe/i;
  if (treatmentOptions) {
    treatmentOptions.forEach((t, i) => {
      if (t.verdict === 'not_recommended' && t.cons?.length) {
        alerts.push({
          key: `tx-nr-${i}`,
          severity: 'moderate',
          title: t.name,
          detail: t.cons.join('; '),
          recommendation: `Not recommended — consider alternatives`,
          type: 'Treatment Warning',
        });
      } else if (t.verdict === 'recommended' && t.cons?.length) {
        const serious = t.cons.filter(c => SERIOUS_KEYWORDS.test(c));
        serious.forEach((con, j) => {
          alerts.push({
            key: `tx-con-${i}-${j}`,
            severity: 'minor',
            title: t.name,
            detail: con,
            recommendation: 'Monitor closely',
            type: 'Treatment Caution',
          });
        });
      }
    });
  }

  // Sort: unacknowledged first, then by severity
  const severityOrder = { major: 0, moderate: 1, minor: 2 };
  const unacknowledged = alerts.filter(a => !getAck(a.key)?.acknowledged);
  const acknowledged = alerts.filter(a => getAck(a.key)?.acknowledged);
  unacknowledged.sort((a, b) => (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2));

  const hasUnacked = unacknowledged.length > 0;
  const totalAlerts = alerts.length;

  return (
    <Card className={cn(
      'border',
      hasUnacked && totalAlerts > 0 ? 'border-red-300 bg-red-50/30' : 'border-green-300 bg-green-50/30',
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasUnacked ? (
              <ShieldAlert className="w-5 h-5 text-red-600" />
            ) : totalAlerts > 0 ? (
              <ShieldCheck className="w-5 h-5 text-green-600" />
            ) : (
              <Shield className="w-5 h-5 text-muted-foreground" />
            )}
            <CardTitle className="text-sm">Safety Alerts</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {totalAlerts > 0 && (
              <Badge variant="outline" className={cn(
                'text-xs',
                hasUnacked ? 'bg-red-100 text-red-700 border-red-300' : 'bg-green-100 text-green-700 border-green-300'
              )}>
                {hasUnacked ? `${unacknowledged.length} unacked` : 'All acknowledged'}
              </Badge>
            )}
            <Button onClick={handleRunCheck} disabled={isLoading} size="sm" variant="outline" className="h-7 text-xs">
              {isLoading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Shield className="w-3 h-3 mr-1" />}
              {safetyResult ? 'Re-check' : 'Run Check'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {totalAlerts === 0 && !safetyResult && (
          <p className="text-xs text-muted-foreground text-center py-2">
            {medicationReview ? 'No safety alerts from initial review.' : 'Run a safety check to scan for interactions.'}
          </p>
        )}

        {/* Unacknowledged alerts */}
        {unacknowledged.map(alert => (
          <AlertCard
            key={alert.key}
            alert={alert}
            ack={getAck(alert.key)}
            onAcknowledge={(note) => setAck(alert.key, { acknowledged: true, note, by: 'Clinician' })}
          />
        ))}

        {/* Acknowledged alerts (collapsed) */}
        {acknowledged.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full py-1">
                <ChevronDown className="w-3 h-3" />
                {acknowledged.length} acknowledged alert{acknowledged.length !== 1 ? 's' : ''}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 pt-1">
              {acknowledged.map(alert => {
                const ack = getAck(alert.key);
                return (
                  <div key={alert.key} className="p-2 bg-muted/30 rounded-md border border-border/50 opacity-60">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className={cn('text-[10px]', severityColor[alert.severity])}>
                          {alert.severity}
                        </Badge>
                        <span className="text-xs font-medium">{alert.title}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700">
                        <Check className="w-2.5 h-2.5 mr-0.5" /> Acked by {ack?.by || 'Clinician'}
                      </Badge>
                    </div>
                    {ack?.note && <p className="text-[10px] text-muted-foreground mt-1 italic">{ack.note}</p>}
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

function AlertCard({
  alert,
  ack,
  onAcknowledge,
}: {
  alert: { key: string; severity: 'major' | 'moderate' | 'minor'; title: string; detail: string; recommendation: string; type: string };
  ack: SafetyAcknowledgment | undefined;
  onAcknowledge: (note?: string) => void;
}) {
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');

  return (
    <Card className={cn('border-l-4', severityBorder[alert.severity])}>
      <CardContent className="pt-3 pb-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn('text-[10px]', severityColor[alert.severity])}>
              {alert.severity}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{alert.type}</Badge>
            <span className="text-sm font-medium">{alert.title}</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{alert.detail}</p>
        {alert.recommendation && (
          <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">{alert.recommendation}</p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] gap-1"
            onClick={() => onAcknowledge(note || undefined)}
          >
            <Check className="w-3 h-3" /> Acknowledge
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-[10px] gap-1"
            onClick={() => setShowNote(!showNote)}
          >
            <MessageSquare className="w-3 h-3" /> Note
          </Button>
        </div>

        {showNote && (
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g., Aware, benefit outweighs risk"
            className="min-h-[40px] text-xs"
          />
        )}
      </CardContent>
    </Card>
  );
}
