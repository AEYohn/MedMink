'use client';

import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { ValidationFlag } from '@/types/ems';

interface ValidationPanelProps {
  flags: ValidationFlag[];
}

const SEVERITY_CONFIG = {
  error: {
    icon: AlertCircle,
    bg: 'bg-red-500/10',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-500/20',
    dot: 'bg-red-500',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-500/20',
    dot: 'bg-amber-500',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-500/20',
    dot: 'bg-blue-500',
  },
};

export function ValidationPanel({ flags }: ValidationPanelProps) {
  if (flags.length === 0) return null;

  // Sort: errors first, then warnings, then info
  const sorted = [...flags].sort((a, b) => {
    const order = { error: 0, warning: 1, info: 2 };
    return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
  });

  const errorCount = flags.filter(f => f.severity === 'error').length;
  const warningCount = flags.filter(f => f.severity === 'warning').length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <span>Validation Flags</span>
        {errorCount > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500/15 text-red-600">
            {errorCount} error{errorCount > 1 ? 's' : ''}
          </span>
        )}
        {warningCount > 0 && (
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/15 text-amber-600">
            {warningCount} warning{warningCount > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="space-y-1.5">
        {sorted.map((flag, i) => {
          const config = SEVERITY_CONFIG[flag.severity] || SEVERITY_CONFIG.info;
          const Icon = config.icon;
          return (
            <div
              key={`${flag.rule_id}-${i}`}
              className={`flex items-start gap-2 px-3 py-2 rounded-lg ${config.bg} border ${config.border}`}
            >
              <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.text}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${config.text}`}>{flag.message}</p>
                {flag.suggested_fix && (
                  <p className="text-xs text-muted-foreground mt-0.5">Fix: {flag.suggested_fix}</p>
                )}
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/50 whitespace-nowrap">
                {flag.rule_id}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
