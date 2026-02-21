'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  LayoutDashboard,
  MessageCircle,
  Activity,
  Mail,
  Sparkles,
} from 'lucide-react';
import { usePostVisit } from '@/hooks/usePostVisit';
import { PostVisitOverview } from '@/components/postvisit/PostVisitOverview';
import { PostVisitChat } from '@/components/postvisit/PostVisitChat';
import { VitalsTracker } from '@/components/postvisit/VitalsTracker';
import { PostVisitMessages } from '@/components/postvisit/PostVisitMessages';
import type { PostVisitTab } from '@/types/postvisit';

const tabs: { id: PostVisitTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'companion', label: 'AI Companion', icon: MessageCircle },
  { id: 'tracker', label: 'Health Tracker', icon: Activity },
  { id: 'messages', label: 'Messages', icon: Mail },
];

export default function PostVisitPage() {
  const params = useParams();
  const router = useRouter();
  const summaryId = params.id as string;
  const [askAIQuestion, setAskAIQuestion] = useState<string | undefined>();

  const {
    summary,
    loading,
    chatMessages,
    chatLoading,
    sendChatMessage,
    vitals,
    vitalTrends,
    vitalAnalysis,
    logVital,
    importVitals,
    analyzeVitals,
    vitalsLoading,
    messages,
    sendMessage,
    messagesLoading,
    activeTab,
    setActiveTab,
  } = usePostVisit(summaryId);

  // Handle "Ask AI about this" from Overview
  const handleAskAI = (question: string) => {
    setAskAIQuestion(question);
    setActiveTab('companion');
  };

  // Handle escalation from chat to messages
  const handleEscalate = (question: string) => {
    sendMessage(`[Escalated from AI Companion] ${question}`);
    setActiveTab('messages');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-surface-500">Loading visit summary...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-4">
          <LayoutDashboard className="w-8 h-8 text-surface-400" />
        </div>
        <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-1">
          Visit summary not found
        </h2>
        <p className="text-sm text-surface-500 max-w-sm mx-auto mb-4">
          This visit summary may have been removed or is no longer available.
        </p>
        <button
          onClick={() => router.push('/patient/visit-summary')}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Back to Visit Summaries
        </button>
      </div>
    );
  }

  const visitDate = new Date(summary.visitDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/patient/visit-summary')}
              className="p-1.5 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-surface-500" />
            </button>
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-900 dark:text-white">PostVisit AI</h1>
              <p className="text-xs text-surface-500">
                {summary.diagnosis} · {visitDate} · {summary.releasedBy}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-full">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400">AI-Powered</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id !== 'companion') setAskAIQuestion(undefined);
                setActiveTab(tab.id);
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-white dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-700 dark:hover:text-surface-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && (
          <PostVisitOverview summary={summary} onAskAI={handleAskAI} />
        )}

        {activeTab === 'companion' && (
          <PostVisitChat
            summary={summary}
            chatMessages={chatMessages}
            chatLoading={chatLoading}
            onSend={sendChatMessage}
            onEscalate={handleEscalate}
            initialQuestion={askAIQuestion}
          />
        )}

        {activeTab === 'tracker' && (
          <VitalsTracker
            patientId={summary.patientId}
            vitals={vitals}
            trends={vitalTrends}
            analysis={vitalAnalysis}
            onLogVital={logVital}
            onImport={importVitals}
            onAnalyze={analyzeVitals}
            loading={vitalsLoading}
          />
        )}

        {activeTab === 'messages' && (
          <PostVisitMessages
            summaryId={summaryId}
            messages={messages}
            onSend={sendMessage}
            loading={messagesLoading}
          />
        )}
      </div>
    </div>
  );
}
