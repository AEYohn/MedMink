'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { SearchProvider } from '@/contexts/SearchContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { ProgressProvider } from '@/contexts/ProgressContext';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SearchProvider>
        <ChatProvider>
          <ProgressProvider>
            {children}
          </ProgressProvider>
        </ChatProvider>
      </SearchProvider>
    </ThemeProvider>
  );
}
