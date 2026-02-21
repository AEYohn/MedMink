'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';
import { RoleProvider } from '@/contexts/RoleContext';
import { SearchProvider } from '@/contexts/SearchContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { ProgressProvider } from '@/contexts/ProgressContext';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <RoleProvider>
        <SearchProvider>
          <ChatProvider>
            <ProgressProvider>
              {children}
            </ProgressProvider>
          </ChatProvider>
        </SearchProvider>
      </RoleProvider>
    </ThemeProvider>
  );
}
