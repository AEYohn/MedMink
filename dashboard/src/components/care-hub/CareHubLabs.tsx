'use client';

import { useState, useMemo } from 'react';
import {
  Activity,
  Heart,
  Thermometer,
  Droplets,
  Wind,
  TrendingUp,
  TrendingDown,
  Minus,
  FlaskConical,
  Brain,
  Loader2,
} from 'lucide-react';
import { useHealthContext } from '@/components/patient/HealthContextProvider';
import { VitalsTracker } from '@/components/postvisit/VitalsTracker';
import type { ReleasedVisitSummary } from '@/types/visit-summary';
import type { LabResult } from '@/types/health-context';
import type {
  VitalReading as PostVisitVitalReading,
  VitalTrend,
  VitalAnalysis,
} from '@/types/postvisit';

// ── Sparkline SVG ──
function Sparkline({ data, color = '#f43f5e' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} className="inline-block ml-2">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── VitalCard ──
function VitalCard({
  label,
  value,
  unit,
  icon: Icon,
  trend,
  normalRange,
  sparkData,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'stable';
  normalRange: string;
  sparkData: number[];
  color: string;
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-red-500'
      : trend === 'down'
      ? 'text-emerald-500'
      : 'text-surface-400';

  return (
    <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${color}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-medium text-surface-600 dark:text-surface-400">
            {label}
          </span>
        </div>
        <TrendIcon className={`w-4 h-4 ${trendColor}`} />
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-surface-900 dark:text-white">{value}</span>
        <span className="text-sm text-surface-500 dark:text-surface-400">{unit}</span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-surface-400">Normal: {normalRange}</span>
        <Sparkline data={sparkData} />
      </div>
    </div>
  );
}

// ── Lab trend chart ──
function LabTrendChart({ results }: { results: LabResult[] }) {
  if (results.length < 2) return null;
  const sorted = [...results].sort((a, b) => a.date.localeCompare(b.date));
  const low = sorted[0].referenceRange.low;
  const high = sorted[0].referenceRange.high;
  const allVals = sorted.map(r => r.value);
  const minV = Math.min(...allVals, low) * 0.9;
  const maxV = Math.max(...allVals, high) * 1.1;
  const range = maxV - minV || 1;
  const w = 200;
  const h = 60;
  const pad = 4;

  const toY = (v: number) => pad + (1 - (v - minV) / range) * (h - 2 * pad);
  const refTop = toY(high);
  const refBot = toY(low);

  const points = sorted.map((r, i) => {
    const x = pad + (i / (sorted.length - 1)) * (w - 2 * pad);
    const y = toY(r.value);
    return `${x},${y}`;
  });

  return (
    <svg width={w} height={h} className="w-full max-w-[200px]">
      <rect x={pad} y={refTop} width={w - 2 * pad} height={Math.max(refBot - refTop, 1)} fill="#10b98120" rx="2" />
      <polyline points={points.join(' ')} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {sorted.map((r, i) => {
        const x = pad + (i / (sorted.length - 1)) * (w - 2 * pad);
        const y = toY(r.value);
        return <circle key={i} cx={x} cy={y} r="3" fill="#f43f5e" />;
      })}
    </svg>
  );
}

const statusStyle: Record<string, string> = {
  normal: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

type LabCategory = 'all' | 'metabolic' | 'cbc' | 'lipid' | 'thyroid' | 'cardiac';
const categoryLabels: Record<LabCategory, string> = {
  all: 'All',
  metabolic: 'Metabolic',
  cbc: 'CBC',
  lipid: 'Lipid',
  thyroid: 'Thyroid',
  cardiac: 'Cardiac',
};

type SortField = 'testName' | 'value' | 'status' | 'date';

export function CareHubLabs({
  summary,
  vitals: postVisitVitals,
  vitalTrends,
  vitalAnalysis,
  onLogVital,
  onImport,
  onAnalyze,
  vitalsLoading,
}: {
  summary: ReleasedVisitSummary;
  vitals: PostVisitVitalReading[];
  vitalTrends: Record<string, VitalTrend>;
  vitalAnalysis: VitalAnalysis | null;
  onLogVital: (reading: Omit<PostVisitVitalReading, 'id'>) => Promise<void>;
  onImport: (file: File) => Promise<number>;
  onAnalyze: () => Promise<void>;
  vitalsLoading: boolean;
}) {
  const { context } = useHealthContext();
  const [category, setCategory] = useState<LabCategory>('all');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const healthVitals = context?.vitals ?? [];
  const labs = context?.labs ?? [];
  const latest = healthVitals[healthVitals.length - 1];

  // Sparkline data
  const sparkBP = healthVitals.map(v => v.systolic ?? 0).filter(Boolean);
  const sparkHR = healthVitals.map(v => v.heartRate ?? 0).filter(Boolean);
  const sparkTemp = healthVitals.map(v => v.temperature ?? 0).filter(Boolean);
  const sparkWeight = healthVitals.map(v => v.weight ?? 0).filter(Boolean);
  const sparkSpO2 = healthVitals.map(v => v.spO2 ?? 0).filter(Boolean);
  const sparkGlucose = healthVitals.map(v => v.glucose ?? 0).filter(Boolean);

  function trend(data: number[]): 'up' | 'down' | 'stable' {
    if (data.length < 4) return 'stable';
    const recent = data.slice(-4);
    const earlier = data.slice(-8, -4);
    const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
    const avgEarlier = earlier.reduce((a, b) => a + b, 0) / (earlier.length || 1);
    const diff = avgRecent - avgEarlier;
    if (Math.abs(diff) < 2) return 'stable';
    return diff > 0 ? 'up' : 'down';
  }

  // Filter & sort labs
  const filteredLabs = useMemo(() => {
    let filtered = category === 'all' ? labs : labs.filter(l => l.category === category);
    filtered = [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === 'testName') cmp = a.testName.localeCompare(b.testName);
      else if (sortField === 'value') cmp = a.value - b.value;
      else if (sortField === 'status') cmp = a.status.localeCompare(b.status);
      else cmp = a.date.localeCompare(b.date);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return filtered;
  }, [labs, category, sortField, sortDir]);

  const latestDateLabs = useMemo(() => {
    const byName = new Map<string, LabResult[]>();
    for (const l of labs) {
      const arr = byName.get(l.testName) ?? [];
      arr.push(l);
      byName.set(l.testName, arr);
    }
    return byName;
  }, [labs]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  const SortIndicator = ({ field }: { field: SortField }) =>
    sortField === field ? (
      <span className="ml-1 text-rose-500">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
    ) : null;

  return (
    <div className="space-y-6">
      {/* Vitals Grid */}
      {latest && (
        <section>
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-3">
            Current Vitals
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <VitalCard label="Blood Pressure" value={`${latest.systolic}/${latest.diastolic}`} unit="mmHg" icon={Heart} trend={trend(sparkBP)} normalRange="<130/80" sparkData={sparkBP} color="bg-rose-500" />
            <VitalCard label="Heart Rate" value={`${latest.heartRate}`} unit="bpm" icon={Activity} trend={trend(sparkHR)} normalRange="60-100" sparkData={sparkHR} color="bg-red-500" />
            <VitalCard label="Temperature" value={`${latest.temperature}`} unit="\u00b0F" icon={Thermometer} trend={trend(sparkTemp)} normalRange="97.8-99.1" sparkData={sparkTemp} color="bg-amber-500" />
            <VitalCard label="Weight" value={`${latest.weight}`} unit="lbs" icon={Activity} trend={trend(sparkWeight)} normalRange="\u2014" sparkData={sparkWeight} color="bg-blue-500" />
            <VitalCard label="SpO2" value={`${latest.spO2}`} unit="%" icon={Wind} trend={trend(sparkSpO2)} normalRange="95-100" sparkData={sparkSpO2} color="bg-teal-500" />
            <VitalCard label="Glucose" value={`${latest.glucose}`} unit="mg/dL" icon={Droplets} trend={trend(sparkGlucose)} normalRange="70-100" sparkData={sparkGlucose} color="bg-purple-500" />
          </div>
        </section>
      )}

      {/* Lab Results */}
      {labs.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-3">
            Lab Results
          </h2>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(Object.keys(categoryLabels) as LabCategory[]).map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  category === cat
                    ? 'bg-rose-500 text-white'
                    : 'bg-rose-50 text-surface-600 hover:bg-rose-100 dark:bg-surface-800 dark:text-surface-400 dark:hover:bg-surface-700'
                }`}
              >
                {categoryLabels[cat]}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-rose-50/50 dark:bg-surface-700/50 border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-surface-500 cursor-pointer hover:text-surface-700" onClick={() => handleSort('testName')}>
                    Test <SortIndicator field="testName" />
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-surface-500 cursor-pointer hover:text-surface-700" onClick={() => handleSort('value')}>
                    Result <SortIndicator field="value" />
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-surface-500">Reference</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-surface-500 cursor-pointer hover:text-surface-700" onClick={() => handleSort('status')}>
                    Status <SortIndicator field="status" />
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-surface-500 cursor-pointer hover:text-surface-700" onClick={() => handleSort('date')}>
                    Date <SortIndicator field="date" />
                  </th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-surface-500">Trend</th>
                </tr>
              </thead>
              <tbody>
                {filteredLabs.map(lab => (
                  <tr key={lab.id} className="border-b last:border-0 border-surface-100 dark:border-surface-700 hover:bg-rose-50/30 dark:hover:bg-surface-700/30">
                    <td className="px-4 py-2.5 font-medium text-surface-900 dark:text-white">
                      <div className="flex items-center gap-2">
                        <FlaskConical className="w-3.5 h-3.5 text-surface-400" />
                        {lab.testName}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-surface-900 dark:text-white font-semibold">
                      {lab.value} <span className="font-normal text-surface-500">{lab.unit}</span>
                    </td>
                    <td className="px-4 py-2.5 text-surface-500 dark:text-surface-400">
                      {lab.referenceRange.low}&ndash;{lab.referenceRange.high} {lab.unit}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusStyle[lab.status]}`}>
                        {lab.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-surface-500 dark:text-surface-400">
                      {new Date(lab.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-2.5">
                      <LabTrendChart results={latestDateLabs.get(lab.testName) ?? [lab]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Vitals Tracker (manual entry, CSV import, AI analysis) */}
      <section>
        <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-3">
          Track Your Vitals
        </h2>
        <VitalsTracker
          patientId={summary.patientId}
          vitals={postVisitVitals}
          trends={vitalTrends}
          analysis={vitalAnalysis}
          onLogVital={onLogVital}
          onImport={onImport}
          onAnalyze={onAnalyze}
          loading={vitalsLoading}
        />
      </section>
    </div>
  );
}
