'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles, Stethoscope, MessageCircle } from 'lucide-react';
import { useSelectedSummaryContext } from '@/contexts/SelectedSummaryContext';
import { usePostVisitContext } from '@/contexts/PostVisitContext';
import { PostVisitChat } from '@/components/postvisit/PostVisitChat';
import { PostVisitMessages } from '@/components/postvisit/PostVisitMessages';
import Link from 'next/link';
import { ClipboardCheck } from 'lucide-react';
import { useTranslation } from '@/i18n';

type MessageTab = 'ai' | 'doctor';

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const { selectedSummary, selectedId } = useSelectedSummaryContext();
  const postVisit = usePostVisitContext();
  const { t } = useTranslation();
  const [tab, setTab] = useState<MessageTab>('ai');

  // Initialize from URL param
  useEffect(() => {
    if (searchParams.get('tab') === 'doctor') {
      setTab('doctor');
    }
  }, [searchParams]);

  // Sync messages tab so lazy loading triggers
  useEffect(() => {
    if (tab === 'doctor') {
      postVisit.setActiveTab('messages');
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEscalate = useCallback((question: string) => {
    postVisit.sendMessage(`[Escalated from AI Chat] ${question}`);
    setTab('doctor');
  }, [postVisit]);

  if (!selectedSummary || !selectedId) {
    return (
      <div className="text-center py-16">
        <MessageCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">{t('messages.noMessages')}</h2>
        <p className="text-sm text-muted-foreground mb-6">
          {t('messages.noMessagesDesc')}
        </p>
        <Link
          href="/patient/checkin"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-colors"
        >
          <ClipboardCheck className="w-5 h-5" />
          {t('messages.startCheckin')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Segment toggle */}
      <div className="flex p-1 rounded-xl bg-muted border border-border">
        <button
          onClick={() => setTab('ai')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'ai'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          {t('messages.aiAssistant')}
        </button>
        <button
          onClick={() => setTab('doctor')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
            tab === 'doctor'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Stethoscope className="w-4 h-4" />
          {t('messages.yourDoctor')}
        </button>
      </div>

      {/* Tab content */}
      {tab === 'ai' ? (
        <PostVisitChat
          summary={selectedSummary}
          chatMessages={postVisit.chatMessages}
          chatLoading={postVisit.chatLoading}
          onSend={postVisit.sendChatMessage}
          onEscalate={handleEscalate}
        />
      ) : (
        <PostVisitMessages
          summaryId={selectedId}
          messages={postVisit.messages}
          onSend={postVisit.sendMessage}
          loading={postVisit.messagesLoading}
        />
      )}
    </div>
  );
}
