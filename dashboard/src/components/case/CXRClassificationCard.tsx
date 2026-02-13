'use client';

import { useState } from 'react';
import { Activity, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Classification {
  condition: string;
  probability: number;
}

interface CXRClassificationCardProps {
  imageB64?: string;
  initialResults?: Classification[];
}

export function CXRClassificationCard({ imageB64, initialResults }: CXRClassificationCardProps) {
  const [results, setResults] = useState<Classification[]>(initialResults || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runClassification = async () => {
    if (!imageB64) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/case/image/cxr-classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_b64: imageB64 }),
      });

      if (!res.ok) throw new Error(`Classification failed: ${res.status}`);
      const data = await res.json();
      setResults(data.classifications || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Classification failed');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (prob: number) => {
    if (prob > 0.5) return 'text-red-600 dark:text-red-400';
    if (prob > 0.2) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-muted-foreground';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-500" />
            CXR Foundation — Chest X-ray Classification
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            google/cxr-foundation
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {results.length === 0 && !loading && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Zero-shot classification for 13+ CXR conditions
            </p>
            {imageB64 && (
              <button
                onClick={runClassification}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Run CXR Classification
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Classifying chest X-ray...
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500 py-2">{error}</p>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={r.condition} className="flex items-center gap-3">
                <span className={`text-sm w-40 truncate ${i < 3 ? 'font-medium' : ''} ${getSeverityColor(r.probability)}`}>
                  {r.condition}
                </span>
                <div className="flex-1">
                  <Progress
                    value={r.probability * 100}
                    className="h-2"
                  />
                </div>
                <span className={`text-xs w-12 text-right font-mono ${getSeverityColor(r.probability)}`}>
                  {(r.probability * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
