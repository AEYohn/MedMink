'use client';

import { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface Agreement {
  finding: string;
  models: string[];
  confidence: number;
}

interface Disagreement {
  finding: string;
  model_a: { name: string; position: string };
  model_b: { name: string; position: string };
  resolution: string;
}

export interface ConsensusData {
  agreements?: Agreement[];
  disagreements?: Disagreement[];
  integrated_assessment?: string;
  overall_confidence?: number;
  contributing_models?: string[];
  recommended_next_steps?: string[];
}

interface ConsensusPanelProps {
  consensus: ConsensusData;
  className?: string;
}

export function ConsensusPanel({ consensus, className }: ConsensusPanelProps) {
  const [showRawModels, setShowRawModels] = useState(false);
  const models = consensus.contributing_models || [];
  const agreements = consensus.agreements || [];
  const disagreements = consensus.disagreements || [];
  const confidence = consensus.overall_confidence ?? 0;

  const confidenceColor =
    confidence >= 0.8
      ? 'text-green-600 bg-green-100 border-green-300'
      : confidence >= 0.5
        ? 'text-amber-600 bg-amber-100 border-amber-300'
        : 'text-red-600 bg-red-100 border-red-300';

  return (
    <Card className={cn('border-purple-200 dark:border-purple-800', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            Cross-Modal Consensus
          </CardTitle>
          <Badge variant="outline" className={cn('font-mono', confidenceColor)}>
            {Math.round(confidence * 100)}%
          </Badge>
        </div>
        {models.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {models.map((model) => (
              <Badge key={model} variant="secondary" className="text-[10px]">
                {model}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Integrated Assessment */}
        {consensus.integrated_assessment && (
          <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
            <p className="text-sm">{consensus.integrated_assessment}</p>
          </div>
        )}

        {/* Agreements */}
        {agreements.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Agreements ({agreements.length})
            </h4>
            <div className="space-y-2">
              {agreements.map((a, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/20"
                >
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{a.finding}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex flex-wrap gap-1">
                        {a.models.map((m) => (
                          <Badge
                            key={m}
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 border-green-300 text-green-700"
                          >
                            {m}
                          </Badge>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {Math.round(a.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Disagreements */}
        {disagreements.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Disagreements ({disagreements.length})
            </h4>
            <div className="space-y-2">
              {disagreements.map((d, i) => (
                <Collapsible key={i}>
                  <CollapsibleTrigger asChild>
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/30">
                      <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{d.finding}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {d.model_a.name} vs {d.model_b.name}
                        </p>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-6 mt-2 space-y-1.5 text-sm">
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {d.model_a.name}
                        </Badge>
                        <span className="text-muted-foreground">{d.model_a.position}</span>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {d.model_b.name}
                        </Badge>
                        <span className="text-muted-foreground">{d.model_b.position}</span>
                      </div>
                      {d.resolution && (
                        <div className="flex gap-2 pt-1 border-t border-amber-200 dark:border-amber-800">
                          <HelpCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                          <span>{d.resolution}</span>
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </div>
        )}

        {/* Agreement Matrix (visual summary) */}
        {agreements.length > 0 && models.length > 1 && (
          <Collapsible open={showRawModels} onOpenChange={setShowRawModels}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ChevronDown className={cn('w-3 h-3 transition-transform', showRawModels && 'rotate-180')} />
                Agreement Matrix
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left p-1.5 border-b font-medium">Finding</th>
                      {models.map((m) => (
                        <th key={m} className="text-center p-1.5 border-b font-medium whitespace-nowrap">
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agreements.map((a, i) => (
                      <tr key={i} className="border-b border-dashed">
                        <td className="p-1.5 max-w-[200px] truncate">{a.finding}</td>
                        {models.map((m) => (
                          <td key={m} className="text-center p-1.5">
                            {a.models.includes(m) ? (
                              <span className="inline-block w-4 h-4 rounded-full bg-green-400" title="Agrees" />
                            ) : (
                              <span className="inline-block w-4 h-4 rounded-full bg-gray-200" title="N/A" />
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Recommended Next Steps */}
        {consensus.recommended_next_steps && consensus.recommended_next_steps.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Recommended Next Steps
            </h4>
            <ul className="space-y-1">
              {consensus.recommended_next_steps.map((step, i) => (
                <li key={i} className="text-sm flex items-start gap-1.5">
                  <span className="text-purple-500 font-medium">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
