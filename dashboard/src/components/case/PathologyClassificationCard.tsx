'use client';

import { useState } from 'react';
import { Microscope, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getApiUrl } from '@/lib/api-url';

const API_URL = getApiUrl() || '';

interface TissueClassification {
  tissue_type: string;
  probability: number;
}

interface PathologyClassificationCardProps {
  imageB64?: string;
  initialResults?: {
    classifications: TissueClassification[];
    tumor_probability: number;
    grade: string;
    tiles_analyzed: number;
  };
}

export function PathologyClassificationCard({ imageB64, initialResults }: PathologyClassificationCardProps) {
  const [results, setResults] = useState(initialResults || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runClassification = async () => {
    if (!imageB64) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/api/case/image/pathology-classify`, {
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

  const gradeColor = (grade: string) => {
    if (grade === 'high') return 'text-red-500 bg-red-500/10';
    if (grade === 'moderate') return 'text-yellow-500 bg-yellow-500/10';
    return 'text-green-500 bg-green-500/10';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Microscope className="w-4 h-4 text-indigo-500" />
            Path Foundation — Tissue Classification
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            google/path-foundation
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!results && !loading && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Tile-based tissue classification for pathology slides
            </p>
            {imageB64 && (
              <button
                onClick={runClassification}
                className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Run Pathology Classification
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Analyzing pathology image (tile-based processing)...
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        {results && (
          <>
            <div className="flex items-center gap-4">
              <div className={`rounded-xl px-4 py-2 ${gradeColor(results.grade)}`}>
                <p className="text-xs uppercase font-semibold">Tumor Grade</p>
                <p className="text-lg font-bold capitalize">{results.grade}</p>
              </div>
              <div className="text-sm">
                <p>
                  Tumor probability:{' '}
                  <span className="font-mono font-medium">
                    {(results.tumor_probability * 100).toFixed(1)}%
                  </span>
                </p>
                <p className="text-muted-foreground">
                  {results.tiles_analyzed} tiles analyzed
                </p>
              </div>
            </div>

            <div className="space-y-2">
              {results.classifications.map((c) => (
                <div key={c.tissue_type} className="flex items-center gap-3">
                  <span className="text-sm w-40 truncate capitalize">{c.tissue_type}</span>
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
