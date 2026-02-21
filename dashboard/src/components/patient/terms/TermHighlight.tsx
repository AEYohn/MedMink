'use client';

import type { MedicalTerm } from '@/types/medical-terms';
import { TermPopover } from './TermPopover';

export function TermHighlight({
  term,
  matchedText,
}: {
  term: MedicalTerm;
  matchedText: string;
}) {
  return (
    <TermPopover term={term}>
      {matchedText}
    </TermPopover>
  );
}
