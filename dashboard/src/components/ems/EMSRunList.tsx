'use client';

import { FileText, Clock, ChevronRight, Trash2 } from 'lucide-react';
import type { EMSSession } from '@/types/ems';

interface EMSRunListProps {
  sessions: EMSSession[];
  currentId?: string;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

function getCompletionPercent(completeness: Record<string, number>): number {
  const values = Object.values(completeness);
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100);
}

export function EMSRunList({ sessions, currentId, onSelect, onDelete }: EMSRunListProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No run reports yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {sessions.map(session => {
        const cc = (session.extractedData?.patient_info as Record<string, string>)?.chief_complaint || 'Untitled Run';
        const pct = getCompletionPercent(session.sectionCompleteness);

        return (
          <div
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
              currentId === session.id
                ? 'bg-primary/10 ring-1 ring-primary/20'
                : 'hover:bg-muted/50'
            }`}
          >
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
              session.status === 'complete' ? 'bg-green-500' : 'bg-amber-500'
            }`} />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{cc}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                <span>{formatTime(session.startedAt)}</span>
                <span className="font-mono">{pct}%</span>
              </div>
            </div>

            <button
              onClick={e => {
                e.stopPropagation();
                onDelete(session.id);
              }}
              className="hidden group-hover:flex p-1.5 text-muted-foreground hover:text-destructive rounded transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>

            <ChevronRight className="w-4 h-4 text-muted-foreground/40" />
          </div>
        );
      })}
    </div>
  );
}
