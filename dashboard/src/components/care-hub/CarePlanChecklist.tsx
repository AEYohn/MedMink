'use client';

import {
  ScanSearch,
  Syringe,
  UserPlus,
  Calendar,
  Heart,
  MessageCircleQuestion,
} from 'lucide-react';
import { ExplainableText } from '@/components/patient/terms/ExplainableText';
import type { CarePlanItem, CarePlanStatus, CarePlanItemStatus } from '@/types/care-plan';

const TYPE_ICONS: Record<CarePlanItem['itemType'], React.ElementType> = {
  diagnostic: ScanSearch,
  procedure: Syringe,
  referral: UserPlus,
  follow_up: Calendar,
  supportive_care: Heart,
};

const STATUS_CONFIG: Record<CarePlanStatus, { label: string; color: string; bg: string }> = {
  todo: {
    label: 'To Do',
    color: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-900/30',
  },
  scheduled: {
    label: 'Scheduled',
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
  },
  done: {
    label: 'Done',
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
  },
};

const STATUS_CYCLE: CarePlanStatus[] = ['todo', 'scheduled', 'done'];

function getAIQuestion(item: CarePlanItem): string {
  switch (item.itemType) {
    case 'diagnostic':
      return `How do I prepare for my ${item.title.replace(/^Book\s+/i, '')}? What should I expect?`;
    case 'procedure':
      return `What should I know before my ${item.title.replace(/^Schedule\s+/i, '')}?`;
    case 'referral':
      return `What will my ${item.provider ?? item.title.replace(/^Referral to\s+/i, '')} appointment involve?`;
    case 'follow_up':
      return `What should I discuss at my ${item.provider ?? ''} follow-up?`;
    case 'supportive_care':
      return `Can you explain more about ${item.title.replace(/^Start\s+/i, '')} and how it helps?`;
  }
}

export function CarePlanChecklist({
  items,
  statuses,
  onStatusChange,
  onAskAI,
}: {
  items: CarePlanItem[];
  statuses: Record<string, CarePlanItemStatus>;
  onStatusChange: (itemId: string, status: CarePlanStatus) => void;
  onAskAI: (question: string) => void;
}) {
  const doneCount = items.filter(
    item => (statuses[item.id]?.status ?? 'todo') === 'done',
  ).length;
  const totalCount = items.length;
  const progress = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  function cycleStatus(itemId: string) {
    const current = statuses[itemId]?.status ?? 'todo';
    const nextIndex = (STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length;
    onStatusChange(itemId, STATUS_CYCLE[nextIndex]);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      {/* Header + Progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">Your Care Plan</h3>
          <span className="text-xs text-muted-foreground">
            {doneCount} of {totalCount} done
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1">
        {items.map(item => {
          const status = statuses[item.id]?.status ?? 'todo';
          const isDone = status === 'done';
          const cfg = STATUS_CONFIG[status];
          const Icon = TYPE_ICONS[item.itemType];

          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/50 ${
                isDone ? 'opacity-60' : ''
              }`}
            >
              {/* Type icon */}
              <div className="mt-0.5 p-1.5 rounded-lg bg-primary/10 shrink-0">
                <Icon className="w-4 h-4 text-primary" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium text-foreground ${isDone ? 'line-through' : ''}`}>
                  <ExplainableText text={item.title} />
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  <ExplainableText text={item.description} />
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  {item.timeframe && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {item.timeframe}
                    </span>
                  )}
                  <button
                    onClick={() => onAskAI(getAIQuestion(item))}
                    className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1"
                  >
                    <MessageCircleQuestion className="w-3 h-3" />
                    Ask AI
                  </button>
                </div>
              </div>

              {/* Status badge */}
              <button
                onClick={() => cycleStatus(item.id)}
                className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color} hover:opacity-80 transition-opacity`}
              >
                {cfg.label}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
