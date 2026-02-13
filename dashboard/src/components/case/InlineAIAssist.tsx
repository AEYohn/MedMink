'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InlineAIAssistProps {
  contextType: string;
  contextItem: string;
  caseSnippet: string;
}

const QUESTIONS = [
  { key: 'why_recommended', label: 'Why?' },
  { key: 'alternatives', label: 'Alternatives?' },
  { key: 'explain', label: 'Explain' },
] as const;

export function InlineAIAssist({ contextType, contextItem, caseSnippet }: InlineAIAssistProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleAsk = async (question: string) => {
    setIsLoading(true);
    setAnswer(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
      const response = await fetch(`${apiUrl}/api/case/ai-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_type: contextType,
          context_item: contextItem,
          question,
          case_snippet: caseSnippet,
        }),
      });
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      setAnswer(data.answer);
    } catch {
      setAnswer('Unable to get a response. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative inline-flex" ref={popoverRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); setAnswer(null); }}
        className="inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-primary/10 transition-colors"
        title="AI Assist"
      >
        <Sparkles className="w-3 h-3 text-primary/60 hover:text-primary" />
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-popover border border-border rounded-lg shadow-lg p-2 animate-in fade-in-0 zoom-in-95">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">AI Assist</span>
            <button onClick={() => setIsOpen(false)}>
              <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
            </button>
          </div>

          {!answer && !isLoading && (
            <div className="flex gap-1">
              {QUESTIONS.map(q => (
                <button
                  key={q.key}
                  onClick={(e) => { e.stopPropagation(); handleAsk(q.key); }}
                  className="flex-1 text-[10px] px-2 py-1.5 rounded border bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          )}

          {answer && (
            <div className="space-y-1.5">
              <p className="text-xs text-foreground leading-relaxed">{answer}</p>
              <div className="flex gap-1">
                {QUESTIONS.map(q => (
                  <button
                    key={q.key}
                    onClick={(e) => { e.stopPropagation(); handleAsk(q.key); }}
                    className="text-[9px] px-1.5 py-0.5 rounded border bg-background hover:bg-accent transition-colors text-muted-foreground"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
