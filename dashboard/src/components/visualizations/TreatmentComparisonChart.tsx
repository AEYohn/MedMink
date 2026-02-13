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
  recommended: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  consider: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  not_recommended: 'bg-red-500/10 text-red-400 border-red-500/30',
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
      fill="hsl(0 0% 98%)"
      fontSize={12}
      fontWeight={500}
      dominantBaseline="central"
    >
      {pct}%
    </text>
  );
}

function truncateName(name: string, maxLen = 32): string {
  // Strip parenthetical dosing details first, e.g. "Aspirin (325 mg PO)" → "Aspirin"
  const short = name.replace(/\s*\(e\.g\..*?\)\s*/g, '').replace(/\s*\(.*?mg.*?\)\s*/g, '');
  if (short.length <= maxLen) return short;
  return short.slice(0, maxLen - 1).trimEnd() + '…';
}

function CustomYTick({ x, y, payload }: any) {
  const label = truncateName(payload.value);
  return (
    <text
      x={x - 4}
      y={y}
      fill="hsl(0 0% 98%)"
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
    return [...treatments].sort((a, b) => b.confidence - a.confidence);
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
              margin={{ top: 4, right: 48, bottom: 4, left: 4 }}
              barCategoryGap="20%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="hsl(240 3.7% 15.9%)"
              />
              <XAxis
                type="number"
                domain={[0, 1]}
                tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                tick={{ fill: 'hsl(240 5% 64.9%)', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(240 3.7% 15.9%)' }}
                tickLine={{ stroke: 'hsl(240 3.7% 15.9%)' }}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={180}
                tick={<CustomYTick />}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'hsl(240 3.7% 15.9% / 0.5)' }}
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
