'use client';

import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  math: string;
  block?: boolean;
  className?: string;
}

export function MathRenderer({ math, block = false, className = '' }: MathRendererProps) {
  const rendered = useMemo(() => {
    // Clean up the formula - remove surrounding $ if present
    let formula = math.trim();

    // Remove single $ wrapping (inline math)
    if (formula.startsWith('$') && formula.endsWith('$') && !formula.startsWith('$$')) {
      formula = formula.slice(1, -1);
    }
    // Remove $$ wrapping (display math)
    if (formula.startsWith('$$') && formula.endsWith('$$')) {
      formula = formula.slice(2, -2);
    }

    try {
      return katex.renderToString(formula, {
        displayMode: block,
        throwOnError: false,
        strict: false,
        trust: true,
        macros: {
          '\\R': '\\mathbb{R}',
          '\\N': '\\mathbb{N}',
          '\\Z': '\\mathbb{Z}',
          '\\E': '\\mathbb{E}',
          '\\P': '\\mathbb{P}',
        },
      });
    } catch (e) {
      // If KaTeX fails, return the original text formatted nicely
      return null;
    }
  }, [math, block]);

  if (!rendered) {
    // Fallback for non-LaTeX or failed rendering
    return (
      <span className={`font-mono text-surface-700 dark:text-surface-300 ${className}`}>
        {math}
      </span>
    );
  }

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

// Component that can handle mixed text with LaTeX
interface MathTextProps {
  children: string;
  className?: string;
}

export function MathText({ children, className = '' }: MathTextProps) {
  const parts = useMemo(() => {
    // Split on $...$ patterns (both inline and display)
    const regex = /(\$\$[\s\S]*?\$\$|\$[^$]+?\$)/g;
    const result: { type: 'text' | 'math'; content: string; block: boolean }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(children)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        result.push({
          type: 'text',
          content: children.slice(lastIndex, match.index),
          block: false,
        });
      }

      // Add the math
      const isBlock = match[0].startsWith('$$');
      result.push({
        type: 'math',
        content: match[0],
        block: isBlock,
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < children.length) {
      result.push({
        type: 'text',
        content: children.slice(lastIndex),
        block: false,
      });
    }

    return result;
  }, [children]);

  return (
    <span className={className}>
      {parts.map((part, i) => (
        part.type === 'math' ? (
          <MathRenderer key={i} math={part.content} block={part.block} />
        ) : (
          <span key={i}>{part.content}</span>
        )
      ))}
    </span>
  );
}
