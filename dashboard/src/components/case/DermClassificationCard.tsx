'use client';

import { useState } from 'react';
import { Loader2, ShieldAlert, ShieldCheck, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getApiUrl } from '@/lib/api-url';

const API_URL = getApiUrl() || '';

interface Classification {
  condition: string;
  probability: number;
  risk_level: string;
}

interface DermClassificationCardProps {
  imageB64?: string;
  initialResults?: {
    classifications: Classification[];
    top_diagnosis: string;
    overall_risk: string;
    malignancy_probability: number;
  };
}

export function DermClassificationCard({ imageB64, initialResults }: DermClassificationCardProps) {
  const [results, setResults] = useState(initialResults || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runClassification = async () => {
    if (!imageB64) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/case/image/derm-classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_b64: imageB64 }),
      });

      if (!res.ok) throw new Error(`Classification failed: ${res.status}`);
      setResults(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Classification failed');
    } finally {
      setLoading(false);
    }
  };

  const RiskGauge = ({ risk, malignancyProb }: { risk: string; malignancyProb: number }) => {
    const Icon = risk === 'high' ? ShieldAlert : risk === 'moderate' ? Shield : ShieldCheck;
    const color = risk === 'high' ? 'text-red-500' : risk === 'moderate' ? 'text-yellow-500' : 'text-green-500';
    const bgColor = risk === 'high' ? 'bg-red-500/10' : risk === 'moderate' ? 'bg-yellow-500/10' : 'bg-green-500/10';

    return (
      <div className={`rounded-xl p-4 ${bgColor} flex items-center gap-4`}>
        <Icon className={`w-8 h-8 ${color}`} />
        <div>
          <p className={`text-lg font-semibold ${color} capitalize`}>{risk} Risk</p>
          <p className="text-sm text-muted-foreground">
            Malignancy probability: {(malignancyProb * 100).toFixed(1)}%
          </p>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-500" />
            Derm Foundation — Skin Lesion Classification
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            google/derm-foundation
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!results && !loading && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Melanoma vs benign triage with quantitative confidence scores
            </p>
            {imageB64 && (
              <button
                onClick={runClassification}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Run Derm Classification
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing dermoscopy image...
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        {results && (
          <>
            <RiskGauge
              risk={results.overall_risk}
              malignancyProb={results.malignancy_probability}
            />

            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                Top Diagnosis: <span className="text-foreground capitalize">{results.top_diagnosis}</span>
              </p>
            </div>

            <div className="space-y-2">
              {results.classifications.map((c) => (
                <div key={c.condition} className="flex items-center gap-3">
                  <span className="text-sm w-44 truncate capitalize">{c.condition}</span>
                  <div className="flex-1">
                    <Progress value={c.probability * 100} className="h-2" />
                  </div>
                  <span className="text-xs w-12 text-right font-mono">
                    {(c.probability * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
