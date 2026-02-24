'use client';

import { useMemo } from 'react';
import {
  ImageIcon,
  Pill,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Mic,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AgentToolResult } from '@/types/case';

interface FoundationModelFindingsProps {
  toolResults: AgentToolResult[];
  className?: string;
}

const TOOL_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  analyze_chest_xray: { label: 'CXR Foundation', icon: <ImageIcon className="w-4 h-4" />, color: 'blue' },
  analyze_skin_lesion: { label: 'Derm Foundation', icon: <ImageIcon className="w-4 h-4" />, color: 'pink' },
  analyze_pathology: { label: 'Path Foundation', icon: <ImageIcon className="w-4 h-4" />, color: 'violet' },
  check_drug_interactions: { label: 'Medication Safety', icon: <Shield className="w-4 h-4" />, color: 'amber' },
  predict_drug_toxicity: { label: 'TxGemma Toxicity', icon: <Pill className="w-4 h-4" />, color: 'red' },
  screen_respiratory: { label: 'HeAR Respiratory', icon: <Mic className="w-4 h-4" />, color: 'teal' },
  compute_risk_scores: { label: 'Risk Scores', icon: <Activity className="w-4 h-4" />, color: 'indigo' },
};

const RELEVANT_TOOLS = new Set(Object.keys(TOOL_META));

function CXRFindingsCard({ result }: { result: Record<string, unknown> }) {
  const probs = result.probabilities as Record<string, number> | undefined;
  const conditions = result.conditions as string[] | undefined;

  if (!probs) return <p className="text-xs text-muted-foreground">No classification data available</p>;

  const sorted = Object.entries(probs).sort(([, a], [, b]) => b - a);

  return (
    <div className="space-y-2">
      {sorted.map(([condition, probability]) => {
        const pct = Math.round(probability * 100);
        const barColor = pct > 60 ? 'bg-red-500' : pct > 30 ? 'bg-amber-500' : 'bg-emerald-500';
        return (
          <div key={condition} className="flex items-center gap-3">
            <span className="text-xs w-32 truncate">{condition}</span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all', barColor)}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span className={cn('text-xs font-mono w-10 text-right', pct > 60 && 'text-red-600 font-semibold')}>
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

function DrugSafetyCard({ result, tool }: { result: Record<string, unknown>; tool: string }) {
  const interactions = result.interactions as Array<{
    drug_a: string;
    drug_b: string;
    severity: string;
    effect: string;
  }> | undefined;

  const toxicity = result.toxicity_profile as Record<string, unknown> | undefined;
  const prediction = result.prediction as string | undefined;

  if (tool === 'predict_drug_toxicity') {
    return (
      <div className="space-y-2">
        {prediction && (
          <div className="flex items-center gap-2">
            <Badge variant={prediction === 'toxic' ? 'destructive' : 'secondary'} className="text-xs">
              {prediction}
            </Badge>
            {'drug' in result && result.drug != null && <span className="text-xs text-muted-foreground">{String(result.drug)}</span>}
          </div>
        )}
        {result.confidence != null && (
          <p className="text-xs text-muted-foreground">
            Confidence: {Math.round(Number(result.confidence) * 100)}%
          </p>
        )}
      </div>
    );
  }

  if (!interactions || interactions.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-600">
        <CheckCircle2 className="w-3.5 h-3.5" />
        No significant drug interactions detected
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {interactions.map((ix, i) => (
        <div
          key={i}
          className={cn(
            'p-2 rounded-lg text-xs border',
            ix.severity === 'major'
              ? 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
              : ix.severity === 'moderate'
                ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                : 'bg-slate-50 border-slate-200 dark:bg-slate-950/30 dark:border-slate-800',
          )}
        >
          <div className="flex items-center gap-2 mb-0.5">
            {ix.severity === 'major' && <AlertTriangle className="w-3 h-3 text-red-500" />}
            <span className="font-medium">{ix.drug_a} + {ix.drug_b}</span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 ml-auto">
              {ix.severity}
            </Badge>
          </div>
          <p className="text-muted-foreground">{ix.effect}</p>
        </div>
      ))}
    </div>
  );
}

function RespiratoryCard({ result }: { result: Record<string, unknown> }) {
  const risk = result.risk_level as string | undefined;
  const conditions = result.conditions_detected as string[] | undefined;

  return (
    <div className="space-y-2">
      {risk && (
        <div className="flex items-center gap-2">
          <Badge variant={risk === 'high' ? 'destructive' : risk === 'moderate' ? 'secondary' : 'outline'}>
            {risk} risk
          </Badge>
        </div>
      )}
      {conditions && conditions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {conditions.map(c => (
            <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function GenericResultCard({ result }: { result: Record<string, unknown> }) {
  // Show a compact summary of keys
  const entries = Object.entries(result).filter(([k]) => k !== 'error' && k !== 'model');
  if (entries.length === 0) return null;

  return (
    <div className="space-y-1">
      {entries.slice(0, 4).map(([key, val]) => (
        <div key={key} className="flex items-start gap-2 text-xs">
          <span className="text-muted-foreground font-medium min-w-[80px]">{key.replace(/_/g, ' ')}:</span>
          <span className="truncate">
            {typeof val === 'string' ? val : typeof val === 'number' ? val : JSON.stringify(val).slice(0, 80)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function FoundationModelFindings({ toolResults, className }: FoundationModelFindingsProps) {
  const relevantResults = useMemo(
    () => toolResults.filter(r => RELEVANT_TOOLS.has(r.tool) && !('error' in (r.result || {}))),
    [toolResults],
  );

  if (relevantResults.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-indigo-600" />
        <h3 className="text-sm font-semibold">Foundation Model Findings</h3>
        <Badge variant="secondary" className="text-[10px]">
          {relevantResults.length} model{relevantResults.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {relevantResults.map((tr, i) => {
          const meta = TOOL_META[tr.tool];
          if (!meta) return null;

          const colorClasses: Record<string, string> = {
            blue: 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20',
            pink: 'border-pink-200 dark:border-pink-800 bg-pink-50/50 dark:bg-pink-950/20',
            violet: 'border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20',
            amber: 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20',
            red: 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20',
            teal: 'border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20',
            indigo: 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20',
          };

          return (
            <Card key={`${tr.tool}-${i}`} className={cn('overflow-hidden', colorClasses[meta.color])}>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  {meta.icon}
                  {meta.label}
                  {tr.model && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-auto font-mono">
                      {tr.model}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {tr.tool === 'analyze_chest_xray' ? (
                  <CXRFindingsCard result={tr.result} />
                ) : tr.tool === 'check_drug_interactions' || tr.tool === 'predict_drug_toxicity' ? (
                  <DrugSafetyCard result={tr.result} tool={tr.tool} />
                ) : tr.tool === 'screen_respiratory' ? (
                  <RespiratoryCard result={tr.result} />
                ) : (
                  <GenericResultCard result={tr.result} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
