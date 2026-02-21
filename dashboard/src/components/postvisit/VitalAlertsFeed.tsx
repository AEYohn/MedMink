'use client';

import { AlertTriangle, Info, AlertOctagon, Activity, User } from 'lucide-react';
import type { VitalAlert } from '@/types/postvisit';

const severityStyles: Record<string, { bg: string; icon: typeof Info; iconColor: string }> = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800',
    icon: Info,
    iconColor: 'text-blue-500',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
  },
  critical: {
    bg: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
    icon: AlertOctagon,
    iconColor: 'text-red-500',
  },
};

interface VitalAlertsFeedProps {
  alerts: Array<VitalAlert & { patientName?: string; patientId?: string }>;
}

export function VitalAlertsFeed({ alerts }: VitalAlertsFeedProps) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-sm text-surface-900 dark:text-white">Patient Vital Alerts</h3>
          </div>
        </div>
        <div className="px-5 py-8 text-center">
          <Activity className="w-8 h-8 text-surface-300 mx-auto mb-2" />
          <p className="text-sm text-surface-500">No vital alerts</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-500" />
            <h3 className="font-semibold text-sm text-surface-900 dark:text-white">Patient Vital Alerts</h3>
          </div>
          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-full">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="divide-y divide-surface-100 dark:divide-surface-700 max-h-80 overflow-y-auto">
        {alerts.map((alert, i) => {
          const style = severityStyles[alert.severity] || severityStyles.info;
          const Icon = style.icon;
          return (
            <div key={alert.id || i} className={`px-5 py-3 ${style.bg} border-l-4`}>
              <div className="flex items-start gap-3">
                <Icon className={`w-4 h-4 ${style.iconColor} shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  {alert.patientName && (
                    <div className="flex items-center gap-1 text-[10px] text-surface-500 mb-0.5">
                      <User className="w-3 h-3" />
                      {alert.patientName}
                    </div>
                  )}
                  <p className="text-sm font-medium text-surface-900 dark:text-white">
                    {alert.message}
                  </p>
                  <p className="text-xs text-surface-500 mt-0.5">
                    {alert.recommendation}
                  </p>
                  <p className="text-[10px] text-surface-400 mt-1">
                    {new Date(alert.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
