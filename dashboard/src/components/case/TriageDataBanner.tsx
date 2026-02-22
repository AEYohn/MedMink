'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRight, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getIntakeResultForPatient, getLatestIntakeResult } from '@/lib/storage';
import { triageToCaseText } from '@/lib/triage-to-case-text';

interface TriageDataBannerProps {
  patientId: string;
  onLoadIntoCase: (text: string) => void;
}

function esiColor(level: number): string {
  if (level <= 2) return 'bg-red-100 text-red-800 border-red-300';
  if (level === 3) return 'bg-amber-100 text-amber-800 border-amber-300';
  return 'bg-green-100 text-green-800 border-green-300';
}

export function TriageDataBanner({ patientId, onLoadIntoCase }: TriageDataBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Try patient-specific intake first, fall back to latest
  const intake = getIntakeResultForPatient(patientId) ?? getLatestIntakeResult();
  if (!intake || dismissed) return null;

  const { triageData } = intake;

  const handleLoad = () => {
    const text = triageToCaseText(triageData);
    onLoadIntoCase(text);
  };

  return (
    <Card className="mb-4 border-primary/30 bg-primary/5">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline" className={esiColor(triageData.esi_level)}>
                ESI {triageData.esi_level}
              </Badge>
              <span className="text-sm font-medium truncate">
                {triageData.chief_complaint}
              </span>
            </div>

            {triageData.red_flags?.length > 0 && (
              <div className="flex items-start gap-1.5 mb-3">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-600 dark:text-red-400">
                  {triageData.red_flags.join(' \u00b7 ')}
                </p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleLoad}>
                <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
                Load into case
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
                Dismiss
              </Button>
            </div>
          </div>

          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
