'use client';

import { useState } from 'react';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  Pill,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/api-url';

interface SafetyInteraction {
  drug_a: string;
  drug_b: string;
  severity: 'major' | 'moderate' | 'minor';
  mechanism?: string;
  clinical_effect: string;
  recommendation: string;
  alternatives?: string[];
  source?: string;
}

interface DrugDiseaseConflict {
  drug: string;
  condition: string;
  severity: 'major' | 'moderate' | 'minor';
  risk: string;
  recommendation: string;
}

interface DosingConcern {
  drug: string;
  concern: string;
  recommendation: string;
}

interface AllergyAlert {
  drug: string;
  allergy: string;
  cross_reactivity_risk: 'high' | 'moderate' | 'low';
  recommendation: string;
}

interface SafetyResult {
  interactions: SafetyInteraction[];
  drug_disease_conflicts: DrugDiseaseConflict[];
  dosing_concerns: DosingConcern[];
  allergy_alerts: AllergyAlert[];
  overall_safety: 'safe' | 'caution' | 'unsafe';
  summary: string;
}

interface MedicationSafetyTabProps {
  currentMedications: string[];
  newMedications: string[];
  patientConditions: string[];
  allergies: string[];
  labs: string[];
  age: string;
  sex: string;
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

const safetyBanner = {
  safe: { icon: ShieldCheck, color: 'bg-green-50 border-green-200 text-green-800', label: 'Safe' },
  caution: { icon: Shield, color: 'bg-amber-50 border-amber-200 text-amber-800', label: 'Caution' },
  unsafe: { icon: ShieldAlert, color: 'bg-red-50 border-red-200 text-red-800', label: 'Unsafe' },
};

export function MedicationSafetyTab({
  currentMedications,
  newMedications,
  patientConditions,
  allergies,
  labs,
  age,
  sex,
}: MedicationSafetyTabProps) {
  const [result, setResult] = useState<SafetyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunCheck = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/case/medication-safety`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_medications: currentMedications,
          new_medications: newMedications,
          patient_conditions: patientConditions,
          allergies,
          labs,
          age,
          sex,
        }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Safety check failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (!result) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center space-y-3">
            <Pill className="w-8 h-8 mx-auto text-muted-foreground opacity-50" />
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Check for drug interactions, dosing concerns, and allergy cross-reactivity.
              </p>
              {currentMedications.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Current: {currentMedications.join(', ')}
                </p>
              )}
              {newMedications.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  New: {newMedications.join(', ')}
                </p>
              )}
            </div>
            <Button onClick={handleRunCheck} disabled={isLoading} size="sm">
              {isLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Shield className="w-4 h-4 mr-1" />}
              Run Safety Check
            </Button>
            {error && <p className="text-xs text-red-600">{error}</p>}
          </div>
        </CardContent>
      </Card>
    );
  }

  const banner = safetyBanner[result.overall_safety];
  const BannerIcon = banner.icon;

  // Sort interactions by severity
  const sortedInteractions = [...result.interactions].sort((a, b) => {
    const order = { major: 0, moderate: 1, minor: 2 };
    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
  });

  const totalAlerts =
    result.interactions.length +
    result.drug_disease_conflicts.length +
    result.dosing_concerns.length +
    result.allergy_alerts.length;

  return (
    <div className="space-y-4">
      {/* Overall Safety Banner */}
      <Card className={cn('border', banner.color)}>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2">
            <BannerIcon className="w-5 h-5" />
            <span className="font-semibold">{banner.label}</span>
            <span className="text-sm ml-2">{result.summary}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {totalAlerts} alert{totalAlerts !== 1 ? 's' : ''} found
          </p>
        </CardContent>
      </Card>

      {/* Re-run button */}
      <div className="flex justify-end">
        <Button onClick={handleRunCheck} disabled={isLoading} size="sm" variant="outline">
          {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Shield className="w-3.5 h-3.5 mr-1" />}
          Re-check
        </Button>
      </div>

      {/* Drug-Drug Interactions */}
      {sortedInteractions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1">
            <AlertTriangle className="w-4 h-4" /> Drug Interactions
          </h3>
          {sortedInteractions.map((interaction, i) => (
            <Card key={i} className={cn('border-l-4', severityBorder[interaction.severity])}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">
                    {interaction.drug_a} + {interaction.drug_b}
                  </span>
                  <Badge className={cn('text-xs', severityColor[interaction.severity])}>
                    {interaction.severity}
                  </Badge>
                </div>
                {interaction.mechanism && (
                  <p className="text-xs text-muted-foreground">{interaction.mechanism}</p>
                )}
                <p className="text-sm mt-1">{interaction.clinical_effect}</p>
                <p className="text-sm text-blue-700 mt-1">{interaction.recommendation}</p>
                {interaction.alternatives && interaction.alternatives.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="text-xs text-muted-foreground">Alternatives:</span>
                    {interaction.alternatives.map((alt, j) => (
                      <Badge key={j} variant="outline" className="text-xs">{alt}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Drug-Disease Conflicts */}
      {result.drug_disease_conflicts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Drug-Disease Conflicts</h3>
          {result.drug_disease_conflicts.map((conflict, i) => (
            <Card key={i} className={cn('border-l-4', severityBorder[conflict.severity])}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">
                    {conflict.drug} / {conflict.condition}
                  </span>
                  <Badge className={cn('text-xs', severityColor[conflict.severity])}>
                    {conflict.severity}
                  </Badge>
                </div>
                <p className="text-sm">{conflict.risk}</p>
                <p className="text-sm text-blue-700 mt-1">{conflict.recommendation}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dosing Concerns */}
      {result.dosing_concerns.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Dosing Concerns</h3>
          {result.dosing_concerns.map((concern, i) => (
            <Card key={i} className="border-l-4 border-l-amber-500">
              <CardContent className="pt-3 pb-3">
                <span className="font-medium text-sm">{concern.drug}</span>
                <p className="text-sm text-muted-foreground">{concern.concern}</p>
                <p className="text-sm text-blue-700 mt-1">{concern.recommendation}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Allergy Alerts */}
      {result.allergy_alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold flex items-center gap-1">
            <ShieldAlert className="w-4 h-4 text-red-600" /> Allergy Alerts
          </h3>
          {result.allergy_alerts.map((alert, i) => (
            <Card key={i} className="border-l-4 border-l-red-500">
              <CardContent className="pt-3 pb-3">
                <span className="font-medium text-sm">
                  {alert.drug} (allergy: {alert.allergy})
                </span>
                <Badge className="ml-2 text-xs" variant="destructive">
                  {alert.cross_reactivity_risk} risk
                </Badge>
                <p className="text-sm text-blue-700 mt-1">{alert.recommendation}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
