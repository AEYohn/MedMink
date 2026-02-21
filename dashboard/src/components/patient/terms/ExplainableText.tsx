'use client';

import { useMemo } from 'react';
import { useMedicalTerms } from './MedicalTermProvider';
import { TermHighlight } from './TermHighlight';
import type { MedicalTerm } from '@/types/medical-terms';

/**
 * Wraps a text string, scanning for known medical terms and replacing them
 * with interactive TermHighlight spans that show definitions on click.
 */
export function ExplainableText({ text, className }: { text: string; className?: string }) {
  const { allTerms } = useMedicalTerms();

  const parts = useMemo(() => {
    if (!text || allTerms.size === 0) return [{ type: 'text' as const, value: text }];

    // Build regex from all keys, longest first to match multi-word terms first
    const keys = Array.from(allTerms.keys()).sort((a, b) => b.length - a.length);
    // Escape special regex characters
    const escaped = keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');

    const result: Array<{ type: 'text'; value: string } | { type: 'term'; value: string; term: MedicalTerm }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const idx = match.index;
      if (idx > lastIndex) {
        result.push({ type: 'text', value: text.slice(lastIndex, idx) });
      }
      const termObj = allTerms.get(match[0].toLowerCase());
      if (termObj) {
        result.push({ type: 'term', value: match[0], term: termObj });
      } else {
        result.push({ type: 'text', value: match[0] });
      }
      lastIndex = idx + match[0].length;
    }
    if (lastIndex < text.length) {
      result.push({ type: 'text', value: text.slice(lastIndex) });
    }
    return result;
  }, [text, allTerms]);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.type === 'term' ? (
          <TermHighlight key={i} term={part.term} matchedText={part.value} />
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </span>
  );
}
