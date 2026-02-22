'use client';

import { useState, useCallback } from 'react';
import {
  Search,
  ChevronDown,
  Loader2,
  Database,
  Image as ImageIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { getApiUrl } from '@/lib/api-url';

interface SimilarCase {
  case_id: string;
  metadata: {
    diagnosis: string;
    description: string;
    source?: string;
  };
  similarity_score: number;
}

interface SimilarCasesSectionProps {
  imageB64: string;
  modality: 'cxr' | 'derm' | 'pathology';
  className?: string;
}

const MODALITY_LABELS: Record<string, string> = {
  cxr: 'Chest X-ray',
  derm: 'Dermoscopy',
  pathology: 'Pathology',
};

export function SimilarCasesSection({ imageB64, modality, className }: SimilarCasesSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cases, setCases] = useState<SimilarCase[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storeSize, setStoreSize] = useState(0);

  const fetchSimilar = useCallback(async () => {
    if (cases !== null) return; // Already fetched
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getApiUrl()}/api/case/image/similar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_b64: imageB64,
          modality,
          top_k: 3,
        }),
      });

      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setCases([]);
      } else {
        setCases(data.similar_cases || []);
        setStoreSize(data.store_size || 0);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setCases([]);
    } finally {
      setIsLoading(false);
    }
  }, [imageB64, modality, cases]);

  const handleOpen = useCallback((open: boolean) => {
    setIsOpen(open);
    if (open && cases === null) {
      fetchSimilar();
    }
  }, [cases, fetchSimilar]);

  return (
    <Collapsible open={isOpen} onOpenChange={handleOpen} className={className}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg hover:bg-accent/30 transition-colors text-sm">
          <Search className="w-3.5 h-3.5 text-purple-500" />
          <span className="font-medium">Similar Cases</span>
          {cases && cases.length > 0 && (
            <Badge variant="secondary" className="text-[10px] ml-1">
              {cases.length} matches
            </Badge>
          )}
          <ChevronDown className={cn(
            'w-3.5 h-3.5 text-muted-foreground ml-auto transition-transform',
            isOpen && 'rotate-180',
          )} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-2">
          {isLoading && (
            <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching {MODALITY_LABELS[modality]} database...
            </div>
          )}

          {error && (
            <p className="text-sm text-muted-foreground py-2">{error}</p>
          )}

          {cases && cases.length === 0 && !isLoading && !error && (
            <p className="text-sm text-muted-foreground py-2">
              No similar cases found in the {MODALITY_LABELS[modality]} database.
            </p>
          )}

          {cases && cases.map((c, i) => {
            const score = Math.round(c.similarity_score * 100);
            const scoreColor =
              score >= 85 ? 'text-green-600 bg-green-100' :
              score >= 70 ? 'text-amber-600 bg-amber-100' :
              'text-gray-600 bg-gray-100';

            return (
              <div
                key={c.case_id}
                className="flex items-start gap-3 p-2.5 rounded-lg border bg-card hover:bg-accent/20 transition-colors"
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 font-bold text-xs shrink-0">
                  #{i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{c.metadata.diagnosis}</p>
                    <Badge className={cn('text-[10px] px-1.5 py-0 shrink-0', scoreColor)}>
                      {score}% match
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {c.metadata.description}
                  </p>
                </div>
              </div>
            );
          })}

          {storeSize > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground pt-1">
              <Database className="w-3 h-3" />
              {storeSize} cases in {MODALITY_LABELS[modality]} database
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
