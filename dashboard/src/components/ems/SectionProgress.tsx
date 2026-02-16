'use client';

import { EMS_PHASES, EMS_PHASE_LABELS } from '@/types/ems';
import { Check } from 'lucide-react';

interface SectionProgressProps {
  currentPhase: string;
  sectionCompleteness: Record<string, number>;
}

export function SectionProgress({ currentPhase, sectionCompleteness }: SectionProgressProps) {
  const displayPhases = EMS_PHASES.filter(p => p !== 'complete');
  const currentIdx = displayPhases.indexOf(currentPhase as typeof displayPhases[number]);
  const completedCount = displayPhases.filter((_, i) => i < currentIdx).length;
  const total = displayPhases.length;

  return (
    <div className="space-y-2">
      {/* Progress bar */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / total) * 100}%` }}
          />
        </div>
        <span className="font-mono tabular-nums whitespace-nowrap">{completedCount}/{total}</span>
      </div>

      {/* Phase chips */}
      <div className="flex flex-wrap gap-1">
        {displayPhases.map((phase, i) => {
          const isComplete = i < currentIdx;
          const isCurrent = phase === currentPhase;
          const completeness = sectionCompleteness[phase] ?? 0;

          return (
            <span
              key={phase}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                isComplete
                  ? 'bg-primary/15 text-primary'
                  : isCurrent
                    ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30'
                    : 'bg-muted text-muted-foreground/60'
              }`}
            >
              {isComplete && <Check className="w-3 h-3" />}
              {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
              {EMS_PHASE_LABELS[phase] || phase}
              {completeness > 0 && completeness < 1 && !isComplete && (
                <span className="text-[9px] opacity-60">{Math.round(completeness * 100)}%</span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
