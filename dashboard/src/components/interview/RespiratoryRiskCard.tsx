'use client';

import { ShieldAlert, ShieldCheck, Shield, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface RespiratoryResult {
  classifications: Array<{ condition: string; probability: number }>;
  risk_level: string;
  audio_duration: number;
  model?: string;
}

interface RespiratoryRiskCardProps {
  results: RespiratoryResult;
}

export function RespiratoryRiskCard({ results }: RespiratoryRiskCardProps) {
  const Icon = results.risk_level === 'high' ? ShieldAlert :
               results.risk_level === 'moderate' ? Shield : ShieldCheck;

  const riskColor = results.risk_level === 'high' ? 'text-red-500 bg-red-500/10 border-red-500/20' :
                    results.risk_level === 'moderate' ? 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' :
                    'text-green-500 bg-green-500/10 border-green-500/20';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-500" />
            Respiratory Screening Results
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {results.model || 'HeAR'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Risk Level */}
        <div className={`rounded-xl p-4 border flex items-center gap-4 ${riskColor}`}>
          <Icon className="w-8 h-8" />
          <div>
            <p className="text-lg font-semibold capitalize">{results.risk_level} Risk</p>
            <p className="text-sm opacity-80">
              Audio duration: {results.audio_duration.toFixed(1)}s
            </p>
          </div>
        </div>

        {/* Condition Probabilities */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">
            Condition Probabilities
          </p>
          {results.classifications.map((c) => (
            <div key={c.condition} className="flex items-center gap-3">
              <span className="text-sm w-28 truncate capitalize">{c.condition}</span>
              <div className="flex-1">
                <Progress value={c.probability * 100} className="h-2" />
              </div>
              <span className="text-xs w-12 text-right font-mono">
                {(c.probability * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          This is an AI screening tool trained on 300M+ audio clips.
          Results should be confirmed by clinical evaluation.
        </p>
      </CardContent>
    </Card>
  );
}
