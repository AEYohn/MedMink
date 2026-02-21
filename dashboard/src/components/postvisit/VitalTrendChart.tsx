'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { VitalTrend } from '@/types/postvisit';
import { VITAL_REFERENCE_RANGES } from '@/types/postvisit';

const RANGE_PERIODS = ['1W', '1M', '3M', 'All'] as const;

function filterByRange(readings: any[], range: string): any[] {
  if (range === 'All') return readings;

  const now = new Date();
  let cutoff: Date;
  switch (range) {
    case '1W':
      cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '1M':
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '3M':
      cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      return readings;
  }
  return readings.filter(r => new Date(r.recorded_at || r.recordedAt) >= cutoff);
}

function TrendIcon({ trend }: { trend: string }) {
  if (trend === 'increasing') return <TrendingUp className="w-3.5 h-3.5 text-amber-500" />;
  if (trend === 'decreasing') return <TrendingDown className="w-3.5 h-3.5 text-blue-500" />;
  return <Minus className="w-3.5 h-3.5 text-surface-400" />;
}

export function VitalTrendChart({
  trends,
}: {
  trends: Record<string, VitalTrend>;
}) {
  const [selectedType, setSelectedType] = useState<string>(Object.keys(trends)[0] || 'heart_rate');
  const [range, setRange] = useState<string>('All');

  const trendData = trends[selectedType];
  if (!trendData || !trendData.readings?.length) {
    return (
      <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
        <h3 className="font-semibold text-sm text-surface-900 dark:text-white mb-3">Vital Trends</h3>
        <p className="text-sm text-surface-500 text-center py-8">
          No readings yet. Log some vitals to see trends.
        </p>
      </div>
    );
  }

  const ref = VITAL_REFERENCE_RANGES[selectedType];
  const readings = filterByRange(trendData.readings, range);

  const chartData = readings.map(r => ({
    time: new Date(r.recorded_at || r.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    value: r.value,
    fullTime: new Date(r.recorded_at || r.recordedAt).toLocaleString(),
  }));

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm text-surface-900 dark:text-white">Vital Trends</h3>
        <div className="flex items-center gap-1">
          {RANGE_PERIODS.map(p => (
            <button
              key={p}
              onClick={() => setRange(p)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                range === p
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                  : 'text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Vital type selector */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {Object.entries(trends).map(([type, trend]) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedType === type
                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 ring-1 ring-indigo-300'
                : 'bg-surface-50 dark:bg-surface-700/30 text-surface-600 dark:text-surface-400 hover:bg-surface-100'
            }`}
          >
            <TrendIcon trend={trend.stats?.trend || 'stable'} />
            {VITAL_REFERENCE_RANGES[type]?.label || type.replace(/_/g, ' ')}
            <span className="text-surface-400">({trend.readings?.length || 0})</span>
          </button>
        ))}
      </div>

      {/* Stats bar */}
      {trendData.stats && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Latest', value: readings[readings.length - 1]?.value },
            { label: 'Min', value: trendData.stats.min },
            { label: 'Max', value: trendData.stats.max },
            { label: 'Average', value: trendData.stats.mean },
          ].map(stat => (
            <div key={stat.label} className="text-center p-2 rounded-lg bg-surface-50 dark:bg-surface-700/30">
              <p className="text-[10px] text-surface-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-sm font-semibold text-surface-900 dark:text-white">
                {stat.value ?? '—'} <span className="text-xs font-normal text-surface-400">{ref?.unit || ''}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-surface-200, #e5e7eb)" />
            <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" domain={['auto', 'auto']} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload;
                return (
                  <div className="bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg p-2 shadow-lg text-xs">
                    <p className="font-medium">{point.fullTime}</p>
                    <p className="text-indigo-600 dark:text-indigo-400 font-semibold">
                      {point.value} {ref?.unit || ''}
                    </p>
                  </div>
                );
              }}
            />
            {/* Reference range shading */}
            {ref && (
              <ReferenceArea
                y1={ref.low}
                y2={ref.high}
                fill="#10b981"
                fillOpacity={0.08}
                strokeOpacity={0}
              />
            )}
            {ref && <ReferenceLine y={ref.low} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />}
            {ref && <ReferenceLine y={ref.high} stroke="#10b981" strokeDasharray="3 3" strokeOpacity={0.5} />}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#6366f1"
              strokeWidth={2}
              dot={{ fill: '#6366f1', r: 3 }}
              activeDot={{ fill: '#6366f1', r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
