'use client';

import { cn } from '@/lib/utils';
import type { ComplianceFlag } from '@/types/compliance';

interface InlineComplianceMarkerProps {
  flags: ComplianceFlag[];
  onClick?: (flag: ComplianceFlag) => void;
}

function dotColor(severity: string) {
  switch (severity) {
    case 'error':
      return 'bg-red-500';
    case 'warning':
      return 'bg-amber-500';
    default:
      return 'bg-blue-500';
  }
}

export function InlineComplianceMarker({ flags, onClick }: InlineComplianceMarkerProps) {
  if (flags.length === 0) return null;

  // Show the highest severity
  const sorted = [...flags].sort((a, b) => {
    const order: Record<string, number> = { error: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });
  const primary = sorted[0];

  return (
    <span className="relative inline-flex items-center ml-1.5 group">
      <button
        onClick={() => onClick?.(primary)}
        className={cn(
          'w-2.5 h-2.5 rounded-full ring-2 ring-background animate-pulse cursor-pointer',
          dotColor(primary.severity),
        )}
        aria-label={`Compliance issue: ${primary.message}`}
      />
      {/* Tooltip */}
      <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 z-50 hidden group-hover:block">
        <div className="bg-popover border rounded-md shadow-md px-3 py-2 text-xs max-w-[250px] whitespace-normal">
          {sorted.map((f, i) => (
            <div key={`${f.rule_id}-${i}`} className={cn(i > 0 && 'mt-1.5 pt-1.5 border-t')}>
              <span className={cn(
                'font-medium',
                f.severity === 'error' && 'text-red-600 dark:text-red-400',
                f.severity === 'warning' && 'text-amber-600 dark:text-amber-400',
                f.severity === 'info' && 'text-blue-600 dark:text-blue-400',
              )}>
                {f.rule_id}
              </span>
              <p className="text-muted-foreground mt-0.5">{f.message}</p>
            </div>
          ))}
        </div>
      </div>
    </span>
  );
}
