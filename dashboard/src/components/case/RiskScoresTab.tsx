'use client';

import { useState, useCallback } from 'react';
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  RefreshCw,
  Loader2,
  Info,
  Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ClinicianOverrides } from '@/lib/storage';

interface ScoreVariable {
  name: string;
  value: number | string | null;
  source: 'deterministic' | 'medgemma' | 'missing';
  points: number;
  label: string;
  criteria: string;
}

interface ScoreResult {
  score_id: string;
  score_name: string;
  total_score: number;
  max_score: number;
  risk_level: string;
  risk_interpretation: string;
  recommendation: string;
  variables: ScoreVariable[];
  missing_variables: string[];
  applicable: boolean;
}

interface RiskScoreData {
  scores: ScoreResult[];
  case_category: string;
  summary: string;
}

interface RiskScoresTabProps {
  riskScores: RiskScoreData | null;
  caseText: string;
  parsedCase: Record<string, unknown>;
  overrides?: ClinicianOverrides;
  onOverridesChange?: (overrides: ClinicianOverrides) => void;
}

const riskLevelColor: Record<string, string> = {
  low: 'bg-green-100 text-green-800 border-green-300',
  'low-moderate': 'bg-green-100 text-green-700 border-green-300',
  moderate: 'bg-amber-100 text-amber-800 border-amber-300',
  'moderate-high': 'bg-orange-100 text-orange-800 border-orange-300',
  high: 'bg-red-100 text-red-800 border-red-300',
  very_high: 'bg-red-200 text-red-900 border-red-400',
  severe: 'bg-red-200 text-red-900 border-red-400',
  'moderate-severe': 'bg-orange-100 text-orange-800 border-orange-300',
  minor: 'bg-green-100 text-green-700 border-green-300',
  mild: 'bg-green-100 text-green-800 border-green-300',
  unknown: 'bg-gray-100 text-gray-700 border-gray-300',
};

const riskLevelBg: Record<string, string> = {
  low: 'bg-green-50 border-green-200',
  'low-moderate': 'bg-green-50 border-green-200',
  moderate: 'bg-amber-50 border-amber-200',
  'moderate-high': 'bg-orange-50 border-orange-200',
  high: 'bg-red-50 border-red-200',
  very_high: 'bg-red-50 border-red-300',
  severe: 'bg-red-50 border-red-300',
  'moderate-severe': 'bg-orange-50 border-orange-200',
  minor: 'bg-green-50 border-green-200',
  mild: 'bg-green-50 border-green-200',
  unknown: 'bg-gray-50 border-gray-200',
};

const riskLevelBorder: Record<string, string> = {
  low: 'border-l-green-500',
  'low-moderate': 'border-l-green-400',
  moderate: 'border-l-amber-500',
  'moderate-high': 'border-l-orange-500',
  high: 'border-l-red-500',
  very_high: 'border-l-red-600',
  severe: 'border-l-red-600',
  'moderate-severe': 'border-l-orange-500',
  minor: 'border-l-green-400',
  mild: 'border-l-green-500',
  unknown: 'border-l-gray-400',
};

const sourceBadge: Record<string, { label: string; className: string }> = {
  deterministic: { label: 'Auto', className: 'bg-blue-100 text-blue-700 border-blue-300' },
  medgemma: { label: 'AI', className: 'bg-purple-100 text-purple-700 border-purple-300' },
  missing: { label: 'Missing', className: 'bg-gray-100 text-gray-500 border-gray-300' },
  clinician: { label: 'Clinician', className: 'bg-teal-100 text-teal-700 border-teal-300' },
};

function ScoreBar({ total, max, riskLevel }: { total: number; max: number; riskLevel: string }) {
  const pct = max > 0 ? Math.min((total / max) * 100, 100) : 0;
  const isHighRisk = ['high', 'very_high', 'severe', 'moderate-severe'].includes(riskLevel);
  const isMod = ['moderate', 'moderate-high'].includes(riskLevel);

  return (
    <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden relative">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          isHighRisk ? 'bg-red-500' : isMod ? 'bg-amber-500' : 'bg-green-500'
        )}
        style={{ width: `${pct}%` }}
      />
      <div
        className="absolute top-0 h-full w-0.5 bg-gray-800"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

function ScoreCard({
  score,
  clinicianInputs,
  onVariableChange,
}: {
  score: ScoreResult;
  clinicianInputs: Record<string, number | boolean>;
  onVariableChange?: (varName: string, value: number | boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const borderClass = riskLevelBorder[score.risk_level] || riskLevelBorder.unknown;

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card className={cn('border-l-4', borderClass, !score.applicable && 'opacity-60')}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-base">{score.score_name}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-sm font-bold">
                  {typeof score.total_score === 'number'
                    ? Number.isInteger(score.total_score)
                      ? score.total_score
                      : score.total_score.toFixed(1)
                    : score.total_score}
                  /{score.max_score}
                </Badge>
                <Badge className={cn('text-xs', riskLevelColor[score.risk_level] || riskLevelColor.unknown)}>
                  {score.risk_level.replace(/_/g, ' ')}
                </Badge>
                <ChevronDown className={cn('w-4 h-4 transition-transform', expanded && 'rotate-180')} />
              </div>
            </div>
            <div className="mt-2">
              <ScoreBar total={score.total_score} max={score.max_score} riskLevel={score.risk_level} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            <p className="text-sm text-muted-foreground">{score.risk_interpretation}</p>

            {score.recommendation && (
              <div className={cn('rounded-md border p-3', riskLevelBg[score.risk_level] || riskLevelBg.unknown)}>
                <p className="text-sm font-medium">{score.recommendation}</p>
              </div>
            )}

            {/* Variable breakdown table with editable inputs */}
            {score.variables.length > 0 && (
              <div className="border rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-3 py-1.5 font-medium">Variable</th>
                      <th className="text-left px-3 py-1.5 font-medium">Value</th>
                      <th className="text-left px-3 py-1.5 font-medium">Criteria</th>
                      <th className="text-right px-3 py-1.5 font-medium">Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {score.variables.map((v, i) => {
                      const hasClinicianInput = v.name in clinicianInputs;
                      const displaySource = hasClinicianInput ? 'clinician' : v.source;
                      const src = sourceBadge[displaySource] || sourceBadge.missing;
                      const displayValue = hasClinicianInput
                        ? String(clinicianInputs[v.name])
                        : (v.value !== null && v.value !== undefined ? String(v.value) : '—');

                      return (
                        <tr key={i} className={cn('border-t', v.source === 'missing' && !hasClinicianInput && 'opacity-50')}>
                          <td className="px-3 py-1.5 font-medium">{v.label}</td>
                          <td className="px-3 py-1.5">
                            {(v.source === 'missing' || v.source === 'medgemma') && onVariableChange ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={hasClinicianInput ? String(clinicianInputs[v.name]) : (v.value !== null && v.value !== undefined ? String(v.value) : '')}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (val === '' || val === 'true' || val === 'false') {
                                      onVariableChange(v.name, val === 'true');
                                    } else {
                                      const num = Number(val);
                                      if (!isNaN(num)) onVariableChange(v.name, num);
                                    }
                                  }}
                                  placeholder={v.source === 'missing' ? 'Enter value' : String(v.value)}
                                  className="w-20 h-6 rounded border border-input bg-background px-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                />
                                <Pencil className="w-3 h-3 text-muted-foreground" />
                              </div>
                            ) : (
                              displayValue
                            )}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground text-xs">{v.criteria}</td>
                          <td className="px-3 py-1.5 text-right">
                            <Badge variant="outline" className={cn('text-xs', src.className)}>
                              {src.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {score.missing_variables.length > 0 && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-medium text-amber-800">Missing data — enter values above to improve accuracy</p>
                  <p className="text-xs text-amber-700">{score.missing_variables.join(', ')}</p>
                </div>
              </div>
            )}

            {!score.applicable && (
              <div className="flex items-start gap-2 rounded-md bg-gray-50 border border-gray-200 p-2.5">
                <Info className="w-4 h-4 text-gray-500 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-600">
                  More than 50% of variables are missing. Score may not be reliable.
                </p>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export function RiskScoresTab({
  riskScores,
  caseText,
  parsedCase,
  overrides,
  onOverridesChange,
}: RiskScoresTabProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [localResult, setLocalResult] = useState<RiskScoreData | null>(null);

  const data = localResult || riskScores;

  const handleVariableChange = useCallback((scoreId: string, varName: string, value: number | boolean) => {
    if (!overrides || !onOverridesChange) return;
    const scoreInputs = overrides.riskScoreInputs[scoreId] || {};
    onOverridesChange({
      ...overrides,
      riskScoreInputs: {
        ...overrides.riskScoreInputs,
        [scoreId]: { ...scoreInputs, [varName]: value },
      },
      lastModified: new Date().toISOString(),
    });
  }, [overrides, onOverridesChange]);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const response = await fetch(`${apiUrl}/api/case/risk-scores`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_text: caseText, parsed_case: parsedCase }),
      });
      if (response.ok) {
        const result = await response.json();
        setLocalResult(result);
      }
    } catch (err) {
      console.error('Risk score regeneration failed:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!data || !data.scores?.length) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-xs">No risk scores available.</p>
          <Button onClick={handleRegenerate} disabled={isRegenerating} className="mt-3" size="sm">
            {isRegenerating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Calculate Scores
          </Button>
        </CardContent>
      </Card>
    );
  }

  const applicableScores = data.scores.filter((s) => s.applicable);
  const inapplicableScores = data.scores.filter((s) => !s.applicable);

  return (
    <div className="space-y-3">
      {/* Summary banner */}
      {data.summary && (
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="pt-3 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600">Risk Summary</span>
            </div>
            <p className="text-xs text-blue-900">{data.summary}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleRegenerate} disabled={isRegenerating} size="sm" variant="outline" className="h-7 text-xs">
          {isRegenerating ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
          Recalculate
        </Button>
      </div>

      {applicableScores.map((score) => (
        <ScoreCard
          key={score.score_id}
          score={score}
          clinicianInputs={overrides?.riskScoreInputs[score.score_id] || {}}
          onVariableChange={onOverridesChange ? (varName, value) => handleVariableChange(score.score_id, varName, value) : undefined}
        />
      ))}

      {inapplicableScores.length > 0 && (
        <>
          <div className="flex items-center gap-2 pt-2">
            <AlertTriangle className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Insufficient Data
            </span>
          </div>
          {inapplicableScores.map((score) => (
            <ScoreCard
              key={score.score_id}
              score={score}
              clinicianInputs={overrides?.riskScoreInputs[score.score_id] || {}}
              onVariableChange={onOverridesChange ? (varName, value) => handleVariableChange(score.score_id, varName, value) : undefined}
            />
          ))}
        </>
      )}
    </div>
  );
}
