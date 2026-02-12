'use client';

import { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ChevronDown,
  RefreshCw,
  Loader2,
  Stethoscope,
  Beaker,
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

interface DDxDiagnosis {
  diagnosis: string;
  likelihood: 'high' | 'moderate' | 'low';
  must_rule_out: boolean;
  supporting_findings: string[];
  refuting_findings: string[];
  diagnostic_pathway: string[];
  distinguishing_feature: string;
}

interface DDxResult {
  clinical_reasoning_summary: string;
  key_distinguishing_tests: string[];
  diagnoses: DDxDiagnosis[];
}

interface DifferentialDiagnosisTabProps {
  ddxResult: DDxResult | null;
  caseText: string;
  parsedCase: Record<string, unknown>;
}

const likelihoodColor = {
  high: 'bg-green-100 text-green-800 border-green-300',
  moderate: 'bg-amber-100 text-amber-800 border-amber-300',
  low: 'bg-gray-100 text-gray-700 border-gray-300',
};

const likelihoodBorder = {
  high: 'border-l-green-500',
  moderate: 'border-l-amber-500',
  low: 'border-l-gray-400',
};

export function DifferentialDiagnosisTab({
  ddxResult,
  caseText,
  parsedCase,
}: DifferentialDiagnosisTabProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [localResult, setLocalResult] = useState<DDxResult | null>(null);

  const result = localResult || ddxResult;

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const response = await fetch(`${apiUrl}/api/case/ddx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_text: caseText, parsed_case: parsedCase }),
      });
      if (response.ok) {
        const data = await response.json();
        setLocalResult(data);
      }
    } catch (err) {
      console.error('DDx regeneration failed:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!result || !result.diagnoses?.length) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-muted-foreground">
          <Stethoscope className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No differential diagnosis available.</p>
          <Button onClick={handleRegenerate} disabled={isRegenerating} className="mt-3" size="sm">
            {isRegenerating ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Generate DDx
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Clinical Reasoning Summary */}
      {result.clinical_reasoning_summary && (
        <Card className="bg-blue-50/50 border-blue-200">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-1">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Clinical Reasoning</span>
            </div>
            <p className="text-sm text-blue-900">{result.clinical_reasoning_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Key Distinguishing Tests */}
      {result.key_distinguishing_tests?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Beaker className="w-4 h-4 text-muted-foreground mt-0.5" />
          <span className="text-xs font-medium text-muted-foreground mt-0.5">Key Tests:</span>
          {result.key_distinguishing_tests.map((test, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {test}
            </Badge>
          ))}
        </div>
      )}

      {/* Regenerate Button */}
      <div className="flex justify-end">
        <Button onClick={handleRegenerate} disabled={isRegenerating} size="sm" variant="outline">
          {isRegenerating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
          Regenerate DDx
        </Button>
      </div>

      {/* Diagnosis Cards */}
      {result.diagnoses.map((dx, i) => (
        <Collapsible
          key={i}
          open={expanded[i] || false}
          onOpenChange={(open) => setExpanded((prev) => ({ ...prev, [i]: open }))}
        >
          <Card className={cn('border-l-4', likelihoodBorder[dx.likelihood])}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-muted-foreground w-6">#{i + 1}</span>
                    <CardTitle className="text-base">{dx.diagnosis}</CardTitle>
                    {dx.must_rule_out && (
                      <Badge variant="destructive" className="gap-1 text-xs">
                        <ShieldAlert className="w-3 h-3" />
                        Must Rule Out
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn('text-xs', likelihoodColor[dx.likelihood])}>
                      {dx.likelihood}
                    </Badge>
                    <ChevronDown className={cn('w-4 h-4 transition-transform', expanded[i] && 'rotate-180')} />
                  </div>
                </div>
                {dx.distinguishing_feature && (
                  <p className="text-xs text-muted-foreground mt-1 ml-8">
                    Key differentiator: {dx.distinguishing_feature}
                  </p>
                )}
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                {/* Supporting Findings */}
                {dx.supporting_findings?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-1">Supporting Findings</h4>
                    <ul className="space-y-1">
                      {dx.supporting_findings.map((f, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-600 mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Refuting Findings */}
                {dx.refuting_findings?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-1">Refuting Findings</h4>
                    <ul className="space-y-1">
                      {dx.refuting_findings.map((f, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm">
                          <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Diagnostic Pathway */}
                {dx.diagnostic_pathway?.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1">Diagnostic Pathway</h4>
                    <ol className="list-decimal list-inside space-y-1">
                      {dx.diagnostic_pathway.map((step, j) => (
                        <li key={j} className="text-sm text-muted-foreground">{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}
