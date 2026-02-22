'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { usePostVisit } from '@/hooks/usePostVisit';
import { useSelectedSummaryContext } from '@/contexts/SelectedSummaryContext';

type PostVisitReturn = ReturnType<typeof usePostVisit>;

const PostVisitContext = createContext<PostVisitReturn | null>(null);

export function PostVisitProvider({ children }: { children: ReactNode }) {
  const { selectedId } = useSelectedSummaryContext();
  const value = usePostVisit(selectedId ?? '');
  return (
    <PostVisitContext.Provider value={value}>
      {children}
    </PostVisitContext.Provider>
  );
}

export function usePostVisitContext(): PostVisitReturn {
  const ctx = useContext(PostVisitContext);
  if (!ctx) throw new Error('usePostVisitContext must be used within PostVisitProvider');
  return ctx;
}
