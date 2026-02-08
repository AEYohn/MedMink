'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface ConsensusGaugeProps {
  score: number;
  divergencePoints?: string[];
}

function scoreToColor(value: number): string {
  if (value <= 0.4) return '#ef4444';
  if (value <= 0.7) return '#f59e0b';
  return '#22c55e';
}

function scoreToLabel(value: number): string {
  if (value <= 0.4) return 'Low';
  if (value <= 0.7) return 'Moderate';
  return 'High';
}

function scoreToBadgeClass(value: number): string {
  if (value <= 0.4) return 'bg-red-500/10 text-red-400 border-red-500/30';
  if (value <= 0.7) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
}

export function ConsensusGauge({ score, divergencePoints = [] }: ConsensusGaugeProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [animatedScore, setAnimatedScore] = useState(0);
  const animationRef = useRef<number | null>(null);

  // Clamp score
  const clampedScore = Math.max(0, Math.min(1, score));

  // Animate the score value from 0 to clampedScore
  useEffect(() => {
    const duration = 1200;
    const startTime = performance.now();

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(eased * clampedScore);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [clampedScore]);

  // Draw the gauge arc with D3
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = 220;
    const height = 140;
    const outerRadius = 90;
    const innerRadius = 68;
    const startAngle = -Math.PI * 0.75;
    const endAngle = Math.PI * 0.75;
    const totalAngle = endAngle - startAngle;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height - 20})`);

    // Background arc
    const bgArc = d3
      .arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(startAngle)
      .endAngle(endAngle)
      .cornerRadius(4);

    g.append('path')
      .attr('d', bgArc({}) as string)
      .attr('fill', 'hsl(240 3.7% 15.9%)');

    // Gradient definition
    const defs = svg.append('defs');
    const gradientId = 'gaugeGradient';
    const gradient = defs
      .append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '100%')
      .attr('y2', '0%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#ef4444');
    gradient.append('stop').attr('offset', '50%').attr('stop-color', '#f59e0b');
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#22c55e');

    // Value arc
    const valueEndAngle = startAngle + totalAngle * animatedScore;
    const valueArc = d3
      .arc<any>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .startAngle(startAngle)
      .endAngle(valueEndAngle)
      .cornerRadius(4);

    g.append('path')
      .attr('d', valueArc({}) as string)
      .attr('fill', scoreToColor(animatedScore));

    // Tick marks at 0%, 40%, 70%, 100%
    const ticks = [0, 0.4, 0.7, 1.0];
    ticks.forEach((t) => {
      const tickAngle = startAngle + totalAngle * t;
      const tickOuterR = outerRadius + 4;
      const tickInnerR = outerRadius - 2;
      const x1 = tickInnerR * Math.cos(tickAngle - Math.PI / 2);
      const y1 = tickInnerR * Math.sin(tickAngle - Math.PI / 2);
      const x2 = tickOuterR * Math.cos(tickAngle - Math.PI / 2);
      const y2 = tickOuterR * Math.sin(tickAngle - Math.PI / 2);

      g.append('line')
        .attr('x1', x1)
        .attr('y1', y1)
        .attr('x2', x2)
        .attr('y2', y2)
        .attr('stroke', 'hsl(240 5% 64.9%)')
        .attr('stroke-width', 1.5);
    });

    // Needle indicator
    const needleAngle = startAngle + totalAngle * animatedScore;
    const needleLength = innerRadius - 8;
    const needleX = needleLength * Math.cos(needleAngle - Math.PI / 2);
    const needleY = needleLength * Math.sin(needleAngle - Math.PI / 2);

    g.append('circle')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', 5)
      .attr('fill', scoreToColor(animatedScore));

    g.append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', needleX)
      .attr('y2', needleY)
      .attr('stroke', scoreToColor(animatedScore))
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'round');
  }, [animatedScore]);

  const displayPct = Math.round(animatedScore * 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Model Consensus</CardTitle>
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 py-0', scoreToBadgeClass(clampedScore))}
          >
            {scoreToLabel(clampedScore)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          {/* Gauge SVG */}
          <div className="relative">
            <svg ref={svgRef} />
            {/* Center percentage text */}
            <div className="absolute inset-0 flex items-end justify-center pb-6 pointer-events-none">
              <div className="text-center">
                <span className="text-3xl font-bold tabular-nums" style={{ color: scoreToColor(clampedScore) }}>
                  {displayPct}
                </span>
                <span className="text-lg text-muted-foreground ml-0.5">%</span>
              </div>
            </div>
          </div>

          {/* Divergence points */}
          {divergencePoints.length > 0 && (
            <div className="w-full mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-medium text-muted-foreground">
                  Divergence Points
                </span>
              </div>
              <ul className="space-y-1">
                {divergencePoints.map((point, i) => (
                  <li
                    key={i}
                    className="text-xs text-muted-foreground pl-5 relative before:content-[''] before:absolute before:left-1.5 before:top-1.5 before:w-1.5 before:h-1.5 before:rounded-full before:bg-amber-500/50"
                  >
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
