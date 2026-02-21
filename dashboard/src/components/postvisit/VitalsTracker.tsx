'use client';

import { Activity, Brain, Loader2 } from 'lucide-react';
import { VitalEntryForm } from './VitalEntryForm';
import { VitalCSVImport } from './VitalCSVImport';
import { VitalTrendChart } from './VitalTrendChart';
import { VitalAlerts } from './VitalAlerts';
import type { VitalReading, VitalTrend, VitalAnalysis } from '@/types/postvisit';

export function VitalsTracker({
  patientId,
  vitals,
  trends,
  analysis,
  onLogVital,
  onImport,
  onAnalyze,
  loading,
}: {
  patientId: string;
  vitals: VitalReading[];
  trends: Record<string, VitalTrend>;
  analysis: VitalAnalysis | null;
  onLogVital: (reading: Omit<VitalReading, 'id'>) => Promise<void>;
  onImport: (file: File) => Promise<number>;
  onAnalyze: () => Promise<void>;
  loading: boolean;
}) {
  const hasReadings = vitals.length > 0;

  return (
    <div className="space-y-4">
      {/* Top row: Entry form + Import */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <VitalEntryForm patientId={patientId} onSubmit={onLogVital} />
        <VitalCSVImport onImport={onImport} />
      </div>

      {/* Trend chart */}
      {hasReadings && Object.keys(trends).length > 0 && (
        <VitalTrendChart trends={trends} />
      )}

      {/* AI Analysis section */}
      {hasReadings && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-surface-900 dark:text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-purple-500" />
              AI Vital Analysis
            </h3>
            <button
              onClick={onAnalyze}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 disabled:bg-surface-300 dark:disabled:bg-surface-700 text-white rounded-lg text-xs font-medium transition-colors"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Brain className="w-3.5 h-3.5" />
              )}
              {analysis ? 'Re-analyze' : 'Analyze Vitals'}
            </button>
          </div>

          <VitalAlerts analysis={analysis} />
        </div>
      )}

      {/* Empty state */}
      {!hasReadings && (
        <div className="text-center py-12 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800">
          <Activity className="w-10 h-10 text-surface-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-surface-900 dark:text-white mb-1">
            No vital readings yet
          </h3>
          <p className="text-xs text-surface-500 max-w-sm mx-auto">
            Log your vitals manually or import data from your health apps to track trends and get AI-powered insights.
          </p>
        </div>
      )}
    </div>
  );
}
