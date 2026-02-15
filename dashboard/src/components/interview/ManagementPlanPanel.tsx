'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList,
  Loader2,
  ChevronDown,
  AlertTriangle,
  Stethoscope,
  Beaker,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { getApiUrl } from '@/lib/api-url';

const API_URL = getApiUrl() || '';

interface ManagementPlanPanelProps {
  sessionId: string | null;
  currentPhase: string;
  autoRefresh?: boolean;
}

interface DDxEntry {
  diagnosis: string;
  likelihood: string;
  key_findings_for: string[];
  key_findings_against: string[];
}

interface Investigation {
  test: string;
  urgency: string;
  rationale: string;
}

interface ManagementPlan {
  differential_diagnosis: DDxEntry[];
  recommended_investigations: Investigation[];
  treatment_plan: {
    immediate: string[];
    short_term: string[];
    monitoring: string[];
  };
  disposition: {
    recommendation: string;
    level_of_care: string;
    rationale: string;
  };
  knowledge_gaps: string[];
  plan_confidence: number;
  plan_completeness: string;
}

export function ManagementPlanPanel({ sessionId, currentPhase, autoRefresh = true }: ManagementPlanPanelProps) {
  const [plan, setPlan] = useState<ManagementPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [ddxOpen, setDdxOpen] = useState(true);
  const [investOpen, setInvestOpen] = useState(true);
  const [treatOpen, setTreatOpen] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/interview/management-plan/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.error) setPlan(data);
      }
    } catch {
      // Silently fail — plan updates in background
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Auto-refresh when phase changes
  useEffect(() => {
    if (autoRefresh && sessionId && currentPhase !== 'greeting') {
      fetchPlan();
    }
  }, [sessionId, currentPhase, autoRefresh, fetchPlan]);

  const likelihoodColor = (l: string) => {
    if (l === 'high') return 'bg-red-500/10 text-red-700 dark:text-red-300';
    if (l === 'moderate') return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300';
    return 'bg-muted text-muted-foreground';
  };

  const urgencyBadge = (u: string) => {
    if (u === 'stat') return 'destructive' as const;
    if (u === 'routine') return 'secondary' as const;
    return 'outline' as const;
  };

  if (!sessionId || currentPhase === 'greeting') return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          Management Plan
          {plan && (
            <Badge variant="outline" className="text-xs capitalize">
              {plan.plan_completeness}
            </Badge>
          )}
        </h3>
        {loading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      </div>

      {!plan && !loading && (
        <p className="text-xs text-muted-foreground">
          Plan will appear as interview data is collected...
        </p>
      )}

      {plan && (
        <>
          {/* Confidence bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${plan.plan_confidence * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {Math.round(plan.plan_confidence * 100)}% confidence
            </span>
          </div>

          {/* DDx */}
          <Collapsible open={ddxOpen} onOpenChange={setDdxOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-xs font-semibold uppercase text-muted-foreground hover:text-foreground">
              <Stethoscope className="w-3 h-3" />
              Differential ({plan.differential_diagnosis.length})
              <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${ddxOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1.5">
              {plan.differential_diagnosis.map((dx, i) => (
                <div key={i} className={`rounded-lg p-2 ${likelihoodColor(dx.likelihood)}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{dx.diagnosis}</span>
                    <Badge variant="outline" className="text-xs capitalize">{dx.likelihood}</Badge>
                  </div>
                  {dx.key_findings_for.length > 0 && (
                    <p className="text-xs mt-1 opacity-80">
                      For: {dx.key_findings_for.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Investigations */}
          <Collapsible open={investOpen} onOpenChange={setInvestOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-xs font-semibold uppercase text-muted-foreground hover:text-foreground">
              <Beaker className="w-3 h-3" />
              Investigations ({plan.recommended_investigations.length})
              <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${investOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1">
              {plan.recommended_investigations.map((inv, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Badge variant={urgencyBadge(inv.urgency)} className="text-xs w-14 justify-center">
                    {inv.urgency}
                  </Badge>
                  <span>{inv.test}</span>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>

          {/* Treatment Plan */}
          <Collapsible open={treatOpen} onOpenChange={setTreatOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left text-xs font-semibold uppercase text-muted-foreground hover:text-foreground">
              <Activity className="w-3 h-3" />
              Treatment Plan
              <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${treatOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 text-sm">
              {plan.treatment_plan.immediate?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-500">Immediate</p>
                  <ul className="list-disc list-inside text-sm">
                    {plan.treatment_plan.immediate.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.treatment_plan.monitoring?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground">Monitoring</p>
                  <ul className="list-disc list-inside text-sm">
                    {plan.treatment_plan.monitoring.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Disposition */}
          {plan.disposition?.recommendation && (
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground">Disposition</p>
              <p className="text-sm font-medium capitalize">
                {plan.disposition.recommendation} — {plan.disposition.level_of_care}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{plan.disposition.rationale}</p>
            </div>
          )}

          {/* Knowledge gaps */}
          {plan.knowledge_gaps.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1">
              <AlertTriangle className="w-3 h-3 text-yellow-500 mt-0.5" />
              {plan.knowledge_gaps.map((gap, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {gap}
                </Badge>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
