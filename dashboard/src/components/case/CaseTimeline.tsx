'use client';

import { useState } from 'react';
import {
  ChevronDown,
  FileText,
  FlaskConical,
  RefreshCw,
  StickyNote,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { CaseEvent } from '@/lib/storage';

const EVENT_CONFIG: Record<CaseEvent['type'], {
  label: string;
  icon: typeof FileText;
  color: string;
  badgeClass: string;
}> = {
  initial_analysis: {
    label: 'Initial Analysis',
    icon: FileText,
    color: 'text-blue-600',
    badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  },
  new_findings: {
    label: 'New Findings',
    icon: FlaskConical,
    color: 'text-purple-600',
    badgeClass: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  },
  reassessment_complete: {
    label: 'Reassessment',
    icon: RefreshCw,
    color: 'text-green-600',
    badgeClass: 'bg-green-500/10 text-green-600 border-green-500/30',
  },
  note: {
    label: 'Note',
    icon: StickyNote,
    color: 'text-gray-600',
    badgeClass: 'bg-gray-500/10 text-gray-600 border-gray-500/30',
  },
};

interface CaseTimelineProps {
  events: CaseEvent[];
}

export function CaseTimeline({ events }: CaseTimelineProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (events.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-slate-500/20">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                <CardTitle className="text-sm">Case Timeline</CardTitle>
                <Badge variant="secondary" className="text-xs">{events.length}</Badge>
              </div>
              <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-[9px] top-0 bottom-0 w-px bg-border" />

              {events.map((event, i) => {
                const config = EVENT_CONFIG[event.type];
                const Icon = config.icon;
                const time = new Date(event.timestamp);
                const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const dateStr = time.toLocaleDateString([], { month: 'short', day: 'numeric' });

                return (
                  <div key={event.id} className="relative mb-4 last:mb-0">
                    {/* Dot on timeline */}
                    <div className={cn(
                      'absolute -left-6 w-[18px] h-[18px] rounded-full border-2 bg-background flex items-center justify-center',
                      i === events.length - 1 ? 'border-primary' : 'border-muted-foreground/30'
                    )}>
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        i === events.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40'
                      )} />
                    </div>

                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <Badge variant="outline" className={cn('text-[10px] gap-1', config.badgeClass)}>
                            <Icon className="w-3 h-3" />
                            {config.label}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {dateStr} {timeStr}
                          </span>
                        </div>

                        {event.findings && (
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium">{event.findings.category.replace('_', ' ')}:</span>{' '}
                            {event.findings.text}
                            {event.findings.clinicalTime && (
                              <span className="italic"> ({event.findings.clinicalTime})</span>
                            )}
                          </p>
                        )}

                        {event.changeSummary && (
                          <p className="text-xs text-muted-foreground">{event.changeSummary}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
