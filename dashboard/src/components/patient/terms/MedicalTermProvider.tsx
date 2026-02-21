'use client';

import { createContext, useContext, useMemo, ReactNode } from 'react';
import type { MedicalTerm } from '@/types/medical-terms';
import { buildTermLookup } from '@/lib/medical-terms-dictionary';

interface TermContextValue {
  lookupTerm: (text: string) => MedicalTerm | undefined;
  allTerms: Map<string, MedicalTerm>;
}

const TermCtx = createContext<TermContextValue>({
  lookupTerm: () => undefined,
  allTerms: new Map(),
});

export function useMedicalTerms() {
  return useContext(TermCtx);
}

export function MedicalTermProvider({ children }: { children: ReactNode }) {
  const allTerms = useMemo(() => buildTermLookup(), []);
  const lookupTerm = useMemo(() => (text: string) => allTerms.get(text.toLowerCase()), [allTerms]);

  return (
    <TermCtx.Provider value={{ lookupTerm, allTerms }}>
      {children}
    </TermCtx.Provider>
  );
}
