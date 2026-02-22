'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { FullHealthContext } from '@/types/health-context';
import { buildHealthContext } from '@/lib/health-context-store';

interface HealthContextValue {
  context: FullHealthContext | null;
  isLoaded: boolean;
}

const HealthCtx = createContext<HealthContextValue>({ context: null, isLoaded: false });

export function useHealthContext() {
  return useContext(HealthCtx);
}

export function HealthContextProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<FullHealthContext | null>(null);

  useEffect(() => {
    setContext(buildHealthContext());
  }, []);

  return (
    <HealthCtx.Provider value={{ context, isLoaded: context !== null }}>
      {children}
    </HealthCtx.Provider>
  );
}
