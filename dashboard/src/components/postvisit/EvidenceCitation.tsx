'use client';

import { BookOpen, Stethoscope, ExternalLink } from 'lucide-react';
import type { EvidenceCitation as EvidenceCitationType } from '@/types/postvisit';

const styles: Record<string, { bg: string; icon: typeof BookOpen; label: string }> = {
  pubmed: {
    bg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: BookOpen,
    label: 'Medical literature',
  },
  guideline: {
    bg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: BookOpen,
    label: 'Guideline',
  },
  clinician_approved: {
    bg: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    icon: Stethoscope,
    label: 'Doctor-approved',
  },
};

export function EvidenceCitationBadge({ citation }: { citation: EvidenceCitationType }) {
  const style = styles[citation.type] || styles.pubmed;
  const Icon = style.icon;

  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium ${style.bg}`}>
        <Icon className="w-3 h-3" />
        {style.label}
      </span>
      {citation.url ? (
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[240px]"
        >
          {citation.title}
          <ExternalLink className="w-2.5 h-2.5 inline ml-0.5" />
        </a>
      ) : (
        <span className="text-surface-600 dark:text-surface-300 truncate max-w-[240px]">
          {citation.title}
        </span>
      )}
    </div>
  );
}
