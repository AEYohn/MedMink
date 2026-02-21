'use client';

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ComplianceScoreBadgeProps {
  score: number;
  grade: string;
  isScanning: boolean;
  onClick?: () => void;
}

function getGradeColor(grade: string): { bg: string; text: string; ring: string } {
  switch (grade) {
    case 'A':
      return { bg: 'bg-green-100 dark:bg-green-950', text: 'text-green-700 dark:text-green-400', ring: 'ring-green-500' };
    case 'B':
      return { bg: 'bg-green-50 dark:bg-green-950/50', text: 'text-green-600 dark:text-green-400', ring: 'ring-green-400' };
    case 'C':
      return { bg: 'bg-amber-100 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400', ring: 'ring-amber-500' };
    case 'D':
      return { bg: 'bg-yellow-100 dark:bg-yellow-950', text: 'text-yellow-700 dark:text-yellow-400', ring: 'ring-yellow-500' };
    default:
      return { bg: 'bg-red-100 dark:bg-red-950', text: 'text-red-700 dark:text-red-400', ring: 'ring-red-500' };
  }
}

export function ComplianceScoreBadge({ score, grade, isScanning, onClick }: ComplianceScoreBadgeProps) {
  const colors = getGradeColor(grade);

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
        'ring-1 ring-inset transition-all cursor-pointer hover:opacity-80',
        colors.bg,
        colors.text,
        colors.ring,
      )}
    >
      <span className="text-sm font-bold tabular-nums">{Math.round(score)}</span>
      <span className="text-xs font-semibold">{grade}</span>
      {isScanning && (
        <Loader2 className="w-3 h-3 animate-spin" />
      )}
    </button>
  );
}
