'use client';

import { AlertTriangle, Info, AlertOctagon, Send } from 'lucide-react';
import type { VitalAlert, VitalAnalysis } from '@/types/postvisit';

const severityStyles: Record<string, { bg: string; border: string; icon: typeof Info; iconColor: string }> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/20',
    border: 'border-blue-200 dark:border-blue-800',
    icon: Info,
    iconColor: 'text-blue-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
  },
  critical: {
    bg: 'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    icon: AlertOctagon,
    iconColor: 'text-red-500',
  },
};

export function VitalAlerts({
  analysis,
  onSendToDoctor,
}: {
  analysis: VitalAnalysis | null;
  onSendToDoctor?: (alert: VitalAlert) => void;
}) {
  if (!analysis) return null;

  return (
    <div className="space-y-4">
      {/* AI Summary */}
      {analysis.summary && (
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
          <h3 className="font-semibold text-sm text-surface-900 dark:text-white mb-2">AI Summary</h3>
          <p className="text-sm text-surface-600 dark:text-surface-300 leading-relaxed">
            {analysis.summary}
          </p>
        </div>
      )}

      {/* Alerts */}
      {analysis.alerts.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-surface-900 dark:text-white">
            Alerts ({analysis.alerts.length})
          </h3>
          {analysis.alerts.map((alert, i) => {
            const style = severityStyles[alert.severity] || severityStyles.info;
            const Icon = style.icon;
            return (
              <div
                key={alert.id || i}
                className={`rounded-lg border ${style.border} ${style.bg} p-4`}
              >
                <div className="flex items-start gap-3">
                  <Icon className={`w-5 h-5 ${style.iconColor} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold uppercase ${style.iconColor}`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs text-surface-500">
                        {alert.vitalType?.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-surface-900 dark:text-white">
                      {alert.message}
                    </p>
                    <p className="text-xs text-surface-600 dark:text-surface-400 mt-1">
                      {alert.recommendation}
                    </p>
                  </div>
                  {onSendToDoctor && (
                    <button
                      onClick={() => onSendToDoctor(alert)}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-amber-600 hover:text-amber-700 bg-amber-100 dark:bg-amber-900/20 rounded-lg transition-colors shrink-0"
                    >
                      <Send className="w-3 h-3" />
                      Send
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {analysis.alerts.length === 0 && analysis.summary && (
        <div className="text-center py-4">
          <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">
            No alerts — your vitals look good!
          </p>
        </div>
      )}
    </div>
  );
}
