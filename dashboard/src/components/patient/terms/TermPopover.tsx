'use client';

import { ReactNode, useState, useRef, useEffect } from 'react';
import type { MedicalTerm } from '@/types/medical-terms';

const categoryColor: Record<string, string> = {
  diagnosis: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  medication: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  procedure: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  lab: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  anatomy: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  'vital-sign': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export function TermPopover({
  term,
  children,
}: {
  term: MedicalTerm;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  return (
    <span ref={ref} className="relative inline">
      <span
        onClick={() => setOpen(!open)}
        className="cursor-pointer border-b border-dotted border-rose-400 dark:border-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors rounded-sm px-0.5"
      >
        {children}
      </span>
      {open && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 sm:w-80 p-4 rounded-xl shadow-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-left block">
          <span className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-sm text-surface-900 dark:text-white">
              {term.term}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                categoryColor[term.category] || 'bg-surface-100 text-surface-600'
              }`}
            >
              {term.category}
            </span>
          </span>
          <span className="block text-sm text-surface-700 dark:text-surface-300 mb-2">
            {term.definition}
          </span>
          <span className="block text-xs text-rose-700 dark:text-rose-400 font-medium">
            Why it matters
          </span>
          <span className="block text-xs text-surface-600 dark:text-surface-400 mt-0.5">
            {term.whyItMatters}
          </span>
        </span>
      )}
    </span>
  );
}
