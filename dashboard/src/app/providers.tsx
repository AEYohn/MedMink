'use client';

import { ReactNode } from 'react';
import { SearchProvider } from '@/contexts/SearchContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { ProgressProvider } from '@/contexts/ProgressContext';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SearchProvider>
      <ChatProvider>
        <ProgressProvider>
          {children}
        </ProgressProvider>
      </ChatProvider>
    </SearchProvider>
  );
}
