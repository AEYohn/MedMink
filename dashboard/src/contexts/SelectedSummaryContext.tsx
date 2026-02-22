'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { useSelectedSummary, type UseSelectedSummaryReturn } from '@/hooks/useSelectedSummary';

const SelectedSummaryContext = createContext<UseSelectedSummaryReturn | null>(null);

export function SelectedSummaryProvider({ children }: { children: ReactNode }) {
  const value = useSelectedSummary();
  return (
    <SelectedSummaryContext.Provider value={value}>
      {children}
    </SelectedSummaryContext.Provider>
  );
}

export function useSelectedSummaryContext(): UseSelectedSummaryReturn {
  const ctx = useContext(SelectedSummaryContext);
  if (!ctx) throw new Error('useSelectedSummaryContext must be used within SelectedSummaryProvider');
  return ctx;
}
