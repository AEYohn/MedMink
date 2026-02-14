'use client';

import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface TimelineEvent {
  type: string;
  timestamp: string;
  changeSummary: string;
  findings?: Record<string, any>;
}

interface CaseTimelineD3Props {
  events: TimelineEvent[];
}

const EVENT_TYPE_CONFIG: Record<string, { color: string; label: string; badgeClass: string }> = {
  initial_analysis: {
    color: '#3b82f6',
    label: 'Initial Analysis',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-300',
  },
  new_findings: {
    color: '#f59e0b',
    label: 'New Findings',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-300',
  },
  reassessment_complete: {
    color: '#22c55e',
    label: 'Reassessment',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  },
};

const DEFAULT_CONFIG = {
  color: '#94a3b8',
  label: 'Event',
  badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
};

function formatTimestamp(ts: string): { date: string; time: string } {
  const d = new Date(ts);
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

export function CaseTimelineD3({ events }: CaseTimelineD3Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  // Sequential reveal animation
  useEffect(() => {
    if (events.length === 0) return;
    setVisibleCount(0);

    let current = 0;
    const interval = setInterval(() => {
      current++;
      setVisibleCount(current);
      if (current >= events.length) {
        clearInterval(interval);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [events.length]);

  // D3 rendering
  useEffect(() => {
    if (!svgRef.current || events.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const nodeRadius = 8;
    const nodeSpacing = 80;
    const leftMargin = 24;
    const topMargin = 20;
    const contentLeftOffset = leftMargin + 28;
    const svgWidth = containerRef.current?.clientWidth || 400;
    const svgHeight = topMargin + events.length * nodeSpacing + 20;

    svg.attr('width', svgWidth).attr('height', svgHeight);

    const g = svg.append('g');

    // Draw connecting lines between nodes
    events.forEach((_, i) => {
      if (i === 0) return;
      const y1 = topMargin + (i - 1) * nodeSpacing;
      const y2 = topMargin + i * nodeSpacing;

      const line = g
        .append('line')
        .attr('x1', leftMargin)
        .attr('y1', y1 + nodeRadius)
        .attr('x2', leftMargin)
        .attr('y2', y2 - nodeRadius)
        .attr('stroke', 'hsl(240 6% 80%)')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4 3')
        .style('opacity', 0);

      if (i < visibleCount) {
        line
          .transition()
          .duration(300)
          .delay(50)
          .style('opacity', 1);
      }
    });

    // Draw event nodes
    events.forEach((event, i) => {
      const config = EVENT_TYPE_CONFIG[event.type] || DEFAULT_CONFIG;
      const cy = topMargin + i * nodeSpacing;

      // Outer ring
      const outerCircle = g
        .append('circle')
        .attr('cx', leftMargin)
        .attr('cy', cy)
        .attr('r', 0)
        .attr('fill', 'none')
        .attr('stroke', config.color)
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.4);

      // Inner filled circle
      const innerCircle = g
        .append('circle')
        .attr('cx', leftMargin)
        .attr('cy', cy)
        .attr('r', 0)
        .attr('fill', config.color)
        .attr('fill-opacity', 0.2);

      // Center dot
      const dot = g
        .append('circle')
        .attr('cx', leftMargin)
        .attr('cy', cy)
        .attr('r', 0)
        .attr('fill', config.color);

      if (i < visibleCount) {
        outerCircle
          .transition()
          .duration(400)
          .ease(d3.easeBackOut.overshoot(1.5))
          .attr('r', nodeRadius + 4);

        innerCircle
          .transition()
          .duration(400)
          .ease(d3.easeBackOut.overshoot(1.5))
          .attr('r', nodeRadius);

        dot
          .transition()
          .duration(400)
          .ease(d3.easeBackOut.overshoot(1.5))
          .attr('r', 3);
      }

      // Timestamp text
      const { date, time } = formatTimestamp(event.timestamp);
      const timestampText = g
        .append('text')
        .attr('x', contentLeftOffset)
        .attr('y', cy - 10)
        .attr('fill', 'hsl(240 6% 45%)')
        .attr('font-size', '10px')
        .attr('font-weight', 500)
        .text(`${date} ${time}`)
        .style('opacity', 0);

      // Summary text
      const summaryText = g
        .append('text')
        .attr('x', contentLeftOffset)
        .attr('y', cy + 6)
        .attr('fill', 'hsl(240 6% 25%)')
        .attr('font-size', '12px')
        .attr('font-weight', 400)
        .text(truncateText(event.changeSummary, svgWidth - contentLeftOffset - 20))
        .style('opacity', 0);

      // Type label badge (rendered as rect + text)
      const badgePadding = { x: 6, y: 2 };
      const label = config.label;
      const badgeY = cy + 16;

      const tempText = g
        .append('text')
        .attr('font-size', '10px')
        .attr('font-weight', 600)
        .text(label)
        .style('opacity', 0);
      const textWidth = (tempText.node() as SVGTextElement)?.getComputedTextLength() || 50;
      tempText.remove();

      const badgeGroup = g.append('g').style('opacity', 0);

      badgeGroup
        .append('rect')
        .attr('x', contentLeftOffset)
        .attr('y', badgeY - 8)
        .attr('width', textWidth + badgePadding.x * 2)
        .attr('height', 16)
        .attr('rx', 4)
        .attr('fill', config.color)
        .attr('fill-opacity', 0.12)
        .attr('stroke', config.color)
        .attr('stroke-opacity', 0.3)
        .attr('stroke-width', 1);

      badgeGroup
        .append('text')
        .attr('x', contentLeftOffset + badgePadding.x)
        .attr('y', badgeY + 1)
        .attr('fill', config.color)
        .attr('font-size', '10px')
        .attr('font-weight', 600)
        .attr('dominant-baseline', 'central')
        .text(label);

      // Findings tag if present
      if (event.findings && Object.keys(event.findings).length > 0) {
        const findingsX = contentLeftOffset + textWidth + badgePadding.x * 2 + 6;
        const findingsLabel = `${Object.keys(event.findings).length} finding(s)`;

        const fTempText = g
          .append('text')
          .attr('font-size', '10px')
          .text(findingsLabel)
          .style('opacity', 0);
        const fWidth = (fTempText.node() as SVGTextElement)?.getComputedTextLength() || 40;
        fTempText.remove();

        const fGroup = badgeGroup.append('g');
        fGroup
          .append('rect')
          .attr('x', findingsX)
          .attr('y', badgeY - 8)
          .attr('width', fWidth + badgePadding.x * 2)
          .attr('height', 16)
          .attr('rx', 4)
          .attr('fill', 'hsl(240 6% 92%)')
          .attr('stroke', 'hsl(240 6% 80%)')
          .attr('stroke-width', 1);

        fGroup
          .append('text')
          .attr('x', findingsX + badgePadding.x)
          .attr('y', badgeY + 1)
          .attr('fill', 'hsl(240 6% 45%)')
          .attr('font-size', '10px')
          .attr('dominant-baseline', 'central')
          .text(findingsLabel);
      }

      if (i < visibleCount) {
        timestampText
          .transition()
          .duration(300)
          .delay(100)
          .style('opacity', 1);

        summaryText
          .transition()
          .duration(300)
          .delay(150)
          .style('opacity', 1);

        badgeGroup
          .transition()
          .duration(300)
          .delay(200)
          .style('opacity', 1);
      }
    });
  }, [events, visibleCount]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Case Timeline</CardTitle>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
              {events.length} event{events.length !== 1 ? 's' : ''}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No timeline events
          </div>
        ) : (
          <>
            {/* Legend */}
            <div className="flex items-center gap-3 mb-4">
              {Object.entries(EVENT_TYPE_CONFIG).map(([key, config]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-[10px] text-muted-foreground">{config.label}</span>
                </div>
              ))}
            </div>

            {/* D3 Timeline SVG */}
            <div ref={containerRef} className="w-full overflow-x-hidden">
              <svg ref={svgRef} className="w-full" />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function truncateText(text: string, maxWidth: number): string {
  // Approximate: ~6.5px per character at 12px font
  const charWidth = 6.5;
  const maxChars = Math.floor(maxWidth / charWidth);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 3) + '...';
}
