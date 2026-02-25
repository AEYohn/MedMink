'use client';

import { ReactNode, useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { RoleProvider } from '@/contexts/RoleContext';
import { SearchProvider } from '@/contexts/SearchContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { ProgressProvider } from '@/contexts/ProgressContext';

const SCHEMA_VERSION = 3;

function runMigrations() {
  if (typeof window === 'undefined') return;
  try {
    const current = Number(localStorage.getItem('research-synthesizer:schema-version') || '0');
    if (current >= SCHEMA_VERSION) return;

    // v3: Aggressive cleanup — clear ALL research-synthesizer keys except
    // intake results (saved check-ins) and language preference
    const preserve = new Set([
      'research-synthesizer:intake-results',
      'research-synthesizer:active-intake',
      'research-synthesizer:schema-version',
    ]);
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('research-synthesizer:') && !preserve.has(key)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }

    localStorage.setItem('research-synthesizer:schema-version', String(SCHEMA_VERSION));
  } catch {
    // localStorage unavailable — skip silently
  }
}

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  useEffect(() => {
    runMigrations();
  }, []);

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
