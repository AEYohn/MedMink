'use client';

import { useMemo } from 'react';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { FileSearch } from 'lucide-react';

interface EvidenceDimension {
  dimension: string;
  score: number;
}

interface EvidenceRadarProps {
  data?: EvidenceDimension[];
}

function averageScore(data: EvidenceDimension[]): number {
  if (data.length === 0) return 0;
  return data.reduce((sum, d) => sum + d.score, 0) / data.length;
}

function scoreToLabel(avg: number): string {
  if (avg >= 0.7) return 'Strong';
  if (avg >= 0.4) return 'Moderate';
  return 'Weak';
}

function scoreToBadgeClass(avg: number): string {
  if (avg >= 0.7) return 'bg-emerald-50 text-emerald-700 border-emerald-300';
  if (avg >= 0.4) return 'bg-amber-50 text-amber-700 border-amber-300';
  return 'bg-red-50 text-red-700 border-red-300';
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <p className="font-medium">{data.dimension}</p>
      <p className="text-muted-foreground">
        Score: {Math.round(data.score * 100)}%
      </p>
    </div>
  );
}

function CustomAngleAxisTick(props: any) {
  const { x, y, payload, cx, cy } = props;
  // Offset label outward from center
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offsetFactor = 18 / (dist || 1);
  const labelX = x + dx * offsetFactor;
  const labelY = y + dy * offsetFactor;

  return (
    <text
      x={labelX}
      y={labelY}
      fill="hsl(240 6% 45%)"
      fontSize={11}
      fontWeight={500}
      textAnchor="middle"
      dominantBaseline="central"
    >
      {payload.value}
    </text>
  );
}

export function EvidenceRadar({ data }: EvidenceRadarProps) {
  const chartData = useMemo(() => {
    if (data && data.length > 0) return data;
    return [];
  }, [data]);

  const avg = averageScore(chartData);
  const hasData = chartData.length > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Evidence Quality</CardTitle>
          {hasData && (
            <Badge
              variant="outline"
              className={cn('text-[10px] px-1.5 py-0', scoreToBadgeClass(avg))}
            >
              {scoreToLabel(avg)} ({Math.round(avg * 100)}%)
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <FileSearch className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm font-medium">Evidence dimensions not yet assessed</p>
            <p className="text-xs mt-1">Run a case analysis with PubMed evidence to populate this chart</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart
                data={chartData}
                cx="50%"
                cy="50%"
                outerRadius="68%"
              >
                <PolarGrid
                  stroke="hsl(240 6% 85%)"
                  strokeDasharray="3 3"
                />
                <PolarAngleAxis
                  dataKey="dimension"
                  tick={<CustomAngleAxisTick />}
                />
                <PolarRadiusAxis
                  domain={[0, 1]}
                  tick={false}
                  axisLine={false}
                  tickCount={5}
                />
                <Tooltip content={<CustomTooltip />} />
                <Radar
                  name="Evidence"
                  dataKey="score"
                  stroke="hsl(221 83% 53%)"
                  strokeWidth={2}
                  fill="hsl(221 83% 53%)"
                  fillOpacity={0.15}
                  dot={{
                    r: 4,
                    fill: 'hsl(221 83% 53%)',
                    stroke: 'hsl(221 83% 65%)',
                    strokeWidth: 1,
                  }}
                  activeDot={{
                    r: 6,
                    fill: 'hsl(221 83% 53%)',
                    stroke: 'hsl(0 0% 100%)',
                    strokeWidth: 2,
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>

            {/* Dimension breakdown */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 pt-3 border-t border-border">
              {chartData.map((d) => {
                const pct = Math.round(d.score * 100);
                return (
                  <div key={d.dimension} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground whitespace-nowrap mr-2">
                      {d.dimension}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              pct >= 70
                                ? '#22c55e'
                                : pct >= 40
                                  ? '#f59e0b'
                                  : '#ef4444',
                          }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums text-muted-foreground w-7 text-right">
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
