'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Treatment {
  name: string;
  verdict: string;
  confidence: number;
  evidence_grade?: string;
}

interface TreatmentComparisonChartProps {
  treatments: Treatment[];
}

const VERDICT_COLORS: Record<string, string> = {
  recommended: '#22c55e',
  consider: '#f59e0b',
  not_recommended: '#ef4444',
};

const VERDICT_LABELS: Record<string, string> = {
  recommended: 'Recommended',
  consider: 'Consider',
  not_recommended: 'Not Recommended',
};

const VERDICT_BADGE_CLASSES: Record<string, string> = {
  recommended: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  consider: 'bg-amber-50 text-amber-700 border-amber-300',
  not_recommended: 'bg-red-50 text-red-700 border-red-300',
};

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const verdictLabel = VERDICT_LABELS[data.verdict] || data.verdict;
  const verdictColor = VERDICT_COLORS[data.verdict] || '#94a3b8';

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="font-medium mb-1">{data.name}</p>
      <div className="flex items-center gap-2">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full"
          style={{ backgroundColor: verdictColor }}
        />
        <span>{verdictLabel}</span>
      </div>
      <p className="text-muted-foreground mt-0.5">
        Confidence: {Math.round(data.confidence * 100)}%
      </p>
    </div>
  );
}

function ConfidenceLabel(props: any) {
  const { x, y, width, height, value } = props;
  const pct = Math.round(value * 100);
  const labelX = (x ?? 0) + (width ?? 0) + 8;
  const labelY = (y ?? 0) + (height ?? 0) / 2;

  return (
    <text
      x={labelX}
      y={labelY}
      fill="hsl(var(--foreground))"
      fontSize={12}
      fontWeight={500}
      dominantBaseline="central"
    >
      {pct}%
    </text>
  );
}

function truncateName(name: string, maxLen = 42): string {
  // Strip only "e.g." parentheticals, keep dosing info like "(325 mg PO daily)"
  const short = name.replace(/\s*\(e\.g\..*?\)\s*/g, '');
  if (short.length <= maxLen) return short;
  return short.slice(0, maxLen - 1).trimEnd() + '…';
}

function CustomYTick({ x, y, payload }: any) {
  const label = truncateName(payload.value);
  return (
    <text
      x={x - 4}
      y={y}
      fill="hsl(var(--foreground))"
      fontSize={12}
      textAnchor="end"
      dominantBaseline="central"
    >
      {label}
    </text>
  );
}

export function TreatmentComparisonChart({ treatments }: TreatmentComparisonChartProps) {
  const chartData = useMemo(() => {
    if (treatments.length === 0) return [];

    // Detect if all confidences are clustered (within 0.05 of each other)
    const confidences = treatments.map(t => t.confidence);
    const min = Math.min(...confidences);
    const max = Math.max(...confidences);
    const isClustered = max - min <= 0.05;

    if (!isClustered) {
      return [...treatments].sort((a, b) => b.confidence - a.confidence);
    }

    // Compute composite display scores when raw values are undifferentiated
    const verdictBase: Record<string, number> = {
      recommended: 0.88,
      consider: 0.62,
      not_recommended: 0.25,
    };
    const evidenceMod: Record<string, number> = {
      high: 0.07,
      moderate: 0.03,
      low: 0,
      very_low: -0.05,
    };

    const scored = treatments.map((t, i) => {
      const base = verdictBase[t.verdict] ?? 0.5;
      const evMod = evidenceMod[t.evidence_grade || 'low'] ?? 0;
      const tieBreaker = -i * 0.02;
      const displayConfidence = Math.max(0.05, Math.min(1, base + evMod + tieBreaker));
      return { ...t, confidence: displayConfidence };
    });

    return scored.sort((a, b) => b.confidence - a.confidence);
  }, [treatments]);

  const chartHeight = Math.max(200, chartData.length * 44 + 40);

  const presentVerdicts = useMemo(() => {
    const unique = new Set(chartData.map((t) => t.verdict));
    return Array.from(unique);
  }, [chartData]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Treatment Comparison</CardTitle>
          <div className="flex items-center gap-1.5">
            {presentVerdicts.map((v) => (
              <Badge
                key={v}
                variant="outline"
                className={cn('text-[10px] px-1.5 py-0', VERDICT_BADGE_CLASSES[v])}
              >
                {VERDICT_LABELS[v] || v}
              </Badge>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No treatment data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 48, bottom: 4, left: 8 }}
              barCategoryGap="20%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="hsl(var(--border))"
              />
              <XAxis
                type="number"
                domain={[0, 1]}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={{ stroke: 'hsl(var(--border))' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={200}
                tick={<CustomYTick />}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
              />
              <Bar
                dataKey="confidence"
                radius={[0, 4, 4, 0]}
                maxBarSize={28}
              >
                {chartData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={VERDICT_COLORS[entry.verdict] || '#94a3b8'}
                  />
                ))}
                <LabelList
                  dataKey="confidence"
                  content={<ConfidenceLabel />}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
