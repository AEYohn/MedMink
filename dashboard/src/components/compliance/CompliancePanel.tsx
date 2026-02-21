'use client';

import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Info,
  Sparkles,
  X,
  ChevronDown,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { ComplianceFlag } from '@/types/compliance';

type FilterTab = 'all' | 'claim_denial' | 'malpractice';

interface CompliancePanelProps {
  flags: ComplianceFlag[];
  score: number;
  grade: string;
  claimDenialScore: number;
  malpracticeScore: number;
  rulesChecked: number;
  rulesPassed: number;
  isScanning: boolean;
  onFix: (flag: ComplianceFlag) => Promise<void>;
  onDismiss: (ruleId: string, field: string) => void;
  dismissedRules: Set<string>;
}

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 };

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case 'error':
      return <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
    case 'warning':
      return <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />;
    default:
      return <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />;
  }
}

function severityBadgeVariant(severity: string) {
  switch (severity) {
    case 'error':
      return 'destructive' as const;
    case 'warning':
      return 'secondary' as const;
    default:
      return 'outline' as const;
  }
}

function gradeColor(grade: string) {
  switch (grade) {
    case 'A':
    case 'B':
      return 'text-green-600 dark:text-green-400';
    case 'C':
      return 'text-amber-600 dark:text-amber-400';
    case 'D':
      return 'text-yellow-600 dark:text-yellow-400';
    default:
      return 'text-red-600 dark:text-red-400';
  }
}

export function CompliancePanel({
  flags,
  score,
  grade,
  claimDenialScore,
  malpracticeScore,
  rulesChecked,
  rulesPassed,
  isScanning,
  onFix,
  onDismiss,
  dismissedRules,
}: CompliancePanelProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [fixingRule, setFixingRule] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  const filteredFlags = (flags || []).filter(f => {
    if (activeTab === 'all') return true;
    return f.domain === activeTab;
  }).sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3));

  // Count dismissed flags matching current filter
  const dismissedCount = dismissedRules.size;

  const handleFix = async (flag: ComplianceFlag) => {
    const key = `${flag.rule_id}::${flag.field}`;
    setFixingRule(key);
    try {
      await onFix(flag);
    } finally {
      setFixingRule(null);
    }
  };

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'claim_denial', label: 'Claims' },
    { key: 'malpractice', label: 'Legal' },
  ];

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Compliance Score</CardTitle>
          <div className="flex items-center gap-2">
            <span className={cn('text-2xl font-bold tabular-nums', gradeColor(grade))}>
              {Math.round(score)}
            </span>
            <span className={cn('text-lg font-bold', gradeColor(grade))}>
              {grade}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <Progress value={score} className="h-2" />
          {isScanning && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              AI scanning...
            </p>
          )}
        </div>

        {/* Domain scores */}
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Claims: </span>
            <span className="font-medium tabular-nums">{Math.round(claimDenialScore)}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Legal: </span>
            <span className="font-medium tabular-nums">{Math.round(malpracticeScore)}</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Filter tabs */}
        <div className="flex gap-1 p-0.5 bg-muted rounded-lg">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                activeTab === tab.key
                  ? 'bg-background shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Flag cards */}
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {filteredFlags.length === 0 && (
            <div className="flex flex-col items-center py-6 text-muted-foreground">
              <ShieldCheck className="w-8 h-8 mb-2 text-green-500" />
              <p className="text-sm font-medium">All checks passed</p>
            </div>
          )}

          {filteredFlags.map((flag) => {
            const flagKey = `${flag.rule_id}::${flag.field}`;
            const isFixing = fixingRule === flagKey;

            return (
              <div
                key={flagKey}
                className={cn(
                  'rounded-lg border p-3 space-y-1.5',
                  flag.severity === 'error' && 'border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20',
                  flag.severity === 'warning' && 'border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20',
                  flag.severity === 'info' && 'border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20',
                )}
              >
                <div className="flex items-start gap-2">
                  <SeverityIcon severity={flag.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant={severityBadgeVariant(flag.severity)} className="text-[10px] px-1.5 py-0">
                        {flag.rule_id}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {flag.section} &gt; {flag.field.split('.').pop()}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{flag.message}</p>
                    {flag.reference && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{flag.reference}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 pl-6">
                  {flag.auto_fixable && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => handleFix(flag)}
                      disabled={isFixing}
                    >
                      {isFixing ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Fix
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-muted-foreground"
                    onClick={() => onDismiss(flag.rule_id, flag.field)}
                  >
                    <X className="w-3 h-3" />
                    Dismiss
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dismissed section */}
        {dismissedCount > 0 && (
          <Collapsible open={showDismissed} onOpenChange={setShowDismissed}>
            <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground w-full">
              <ChevronDown className={cn('w-3 h-3 transition-transform', showDismissed && 'rotate-180')} />
              {dismissedCount} dismissed
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="text-xs text-muted-foreground mt-1">
                Dismissed issues still affect the score but are hidden from view.
              </p>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Summary */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            {rulesPassed} of {rulesChecked} checks passed
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
