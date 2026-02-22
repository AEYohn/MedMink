'use client';

import { useState, useRef, useEffect, FormEvent, useMemo } from 'react';
import {
  Send,
  Loader2,
  Sparkles,
  BookOpen,
  Stethoscope,
  UserRound,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';
import { ExplainableText } from '@/components/patient/terms/ExplainableText';
import { useTranslation } from '@/i18n';
import type { ReleasedVisitSummary } from '@/types/visit-summary';
import type { ChatMessage, EvidenceCitation } from '@/types/postvisit';

function CitationBadge({ citation }: { citation: EvidenceCitation }) {
  const styles: Record<string, string> = {
    pubmed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    guideline: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    clinician_approved: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  };
  const labels: Record<string, string> = {
    pubmed: 'Medical literature',
    guideline: 'Guideline',
    clinician_approved: 'Doctor-approved',
  };
  const icons: Record<string, typeof BookOpen> = {
    pubmed: BookOpen,
    guideline: BookOpen,
    clinician_approved: Stethoscope,
  };
  const Icon = icons[citation.type] || BookOpen;

  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium me-1 mb-1" >
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full ${styles[citation.type] || styles.pubmed}`}>
        <Icon className="w-2.5 h-2.5" />
        {labels[citation.type] || 'Source'}
      </span>
      {citation.url ? (
        <a
          href={citation.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[200px]"
          title={citation.title}
        >
          {citation.title}
          <ExternalLink className="w-2.5 h-2.5 inline ms-0.5" />
        </a>
      ) : (
        <span className="text-muted-foreground truncate max-w-[200px]" title={citation.title}>
          {citation.title}
        </span>
      )}
    </div>
  );
}

export function PostVisitChat({
  summary,
  chatMessages,
  chatLoading,
  onSend,
  onEscalate,
  initialQuestion,
}: {
  summary: ReleasedVisitSummary;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  onSend: (message: string) => Promise<void>;
  onEscalate?: (question: string) => void;
  initialQuestion?: string;
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasHandledInitial = useRef(false);
  const { t, bcp47 } = useTranslation();

  // Handle initial question from Overview tab "Ask AI" button
  useEffect(() => {
    if (initialQuestion && !hasHandledInitial.current) {
      hasHandledInitial.current = true;
      onSend(initialQuestion);
    }
  }, [initialQuestion, onSend]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  const suggestedQuestions = useMemo(() => {
    if (chatMessages.length > 1) return []; // Only show on first load
    const questions: string[] = [
      `What does ${summary.diagnosis} mean in simple terms?`,
    ];
    const firstActiveMed = summary.medications.find(m => m.action !== 'discontinue');
    if (firstActiveMed) {
      questions.push(`Why was ${firstActiveMed.name} prescribed?`);
    }
    if (summary.redFlags.length > 0) {
      questions.push('What warning signs should I watch for?');
    }
    questions.push('Can you explain my discharge instructions?');
    return questions;
  }, [summary, chatMessages.length]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatLoading) return;
    onSend(input.trim());
    setInput('');
  };

  const allMessages = chatMessages.length > 0 ? chatMessages : [];
  const welcomeMessage: ChatMessage = {
    role: 'assistant',
    content: t('chat.welcome', {
      date: new Date(summary.visitDate).toLocaleDateString(bcp47),
      diagnosis: summary.diagnosis,
    }),
    timestamp: new Date().toISOString(),
  };

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)]">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 mb-3 space-y-3">
        {/* Welcome message */}
        <div className="flex justify-start">
          <div className="max-w-[85%] bg-muted text-foreground rounded-2xl rounded-ss-md px-4 py-3">
            <div className="whitespace-pre-wrap text-sm leading-relaxed">
              <ExplainableText text={welcomeMessage.content} />
            </div>
          </div>
        </div>

        {allMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-2xl rounded-se-md px-4 py-3'
                  : 'bg-muted text-foreground rounded-2xl rounded-ss-md px-4 py-3'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {msg.role === 'user' ? msg.content : <ExplainableText text={msg.content} />}
              </div>

              {/* Citations */}
              {msg.citations && msg.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border">
                  <p className="text-[10px] font-medium text-muted-foreground mb-1">{t('chat.sources')}</p>
                  <div className="flex flex-wrap">
                    {msg.citations.map((c, j) => (
                      <CitationBadge key={j} citation={c} />
                    ))}
                  </div>
                </div>
              )}

              <span className="block mt-2 text-[10px] opacity-50">
                {new Date(msg.timestamp).toLocaleTimeString(bcp47, { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}

        {chatLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-ss-md px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                <span className="text-sm text-muted-foreground">{t('chat.reviewingRecords')}</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested questions */}
      {suggestedQuestions.length > 0 && (
        <div className="mb-2">
          <p className="text-xs text-muted-foreground mb-1.5">{t('chat.suggestedQuestions')}</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedQuestions.map((q, i) => (
              <button
                key={i}
                onClick={() => {
                  onSend(q);
                }}
                className="px-2.5 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-xs text-muted-foreground transition-colors border border-border"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder={t('chat.placeholder')}
            rows={1}
            className="flex-1 px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm"
            style={{ minHeight: '44px', maxHeight: '100px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || chatLoading}
            className="p-2.5 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-xl transition-colors"
          >
            {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Sparkles className="w-3 h-3" />
            <span>{t('chat.disclaimer')}</span>
          </div>
          {onEscalate && chatMessages.length > 1 && (
            <button
              type="button"
              onClick={() => {
                const lastUser = chatMessages.filter(m => m.role === 'user').pop();
                if (lastUser) onEscalate(lastUser.content);
              }}
              className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 transition-colors"
            >
              <UserRound className="w-3 h-3" />
              {t('chat.sendToDoctor')}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
