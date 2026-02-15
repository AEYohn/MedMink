'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const isMeta = e.metaKey || e.ctrlKey;

      // Cmd+N: New case analysis
      if (isMeta && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        router.push('/case');
      }

      // Cmd+Shift+N: New patient (go to patients page)
      if (isMeta && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        router.push('/patients');
      }

      // Cmd+P: Go to patients
      if (isMeta && e.key === 'p') {
        e.preventDefault();
        router.push('/patients');
      }

      // Cmd+/: Show shortcuts help (console for now)
      if (isMeta && e.key === '/') {
        e.preventDefault();
        // Could open a shortcuts dialog in the future
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);
}
