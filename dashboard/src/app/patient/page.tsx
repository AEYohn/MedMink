'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Home,
  FileText,
  Pill,
  Activity,
  Calendar,
  MessageCircle,
  Mail,
  Mic,
  ChevronDown,
  Heart,
  Sparkles,
} from 'lucide-react';
import { getReleasedSummaries } from '@/lib/storage';
import { usePostVisit } from '@/hooks/usePostVisit';
import { CareHubHome } from '@/components/care-hub/CareHubHome';
import { PostVisitOverview } from '@/components/postvisit/PostVisitOverview';
import { PostVisitChat } from '@/components/postvisit/PostVisitChat';
import { PostVisitMessages } from '@/components/postvisit/PostVisitMessages';
import { VitalsTracker } from '@/components/postvisit/VitalsTracker';
import { CareHubMedications } from '@/components/care-hub/CareHubMedications';
import { CareHubLabs } from '@/components/care-hub/CareHubLabs';
import { CareHubAppointments } from '@/components/care-hub/CareHubAppointments';
import { CareHubScribe } from '@/components/care-hub/CareHubScribe';
import type { ReleasedVisitSummary } from '@/types/visit-summary';

type CareHubTab = 'home' | 'visit' | 'medications' | 'labs' | 'appointments' | 'chat' | 'messages' | 'scribe';

const tabs: { id: CareHubTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'visit', label: 'Visit', icon: FileText },
  { id: 'medications', label: 'Meds', icon: Pill },
  { id: 'labs', label: 'Labs', icon: Activity },
  { id: 'appointments', label: 'Appts', icon: Calendar },
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'messages', label: 'Messages', icon: Mail },
  { id: 'scribe', label: 'Scribe', icon: Mic },
];

export default function CareHubPage() {
  const [allSummaries, setAllSummaries] = useState<ReleasedVisitSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CareHubTab>('home');
  const [askAIQuestion, setAskAIQuestion] = useState<string | undefined>();
  const [pickerOpen, setPickerOpen] = useState(false);

  // Load released summaries
  useEffect(() => {
    const summaries = getReleasedSummaries().filter(s => s.status === 'released');
    setAllSummaries(summaries);
    if (summaries.length > 0) {
      setSelectedId(summaries[0].id);
    }
  }, []);

  const selectedSummary = useMemo(
    () => allSummaries.find(s => s.id === selectedId) ?? null,
    [allSummaries, selectedId],
  );

  // PostVisit hook for chat, vitals, messages
  const postVisit = usePostVisit(selectedId ?? '');

  const handleAskAI = (question: string) => {
    setAskAIQuestion(question);
    setActiveTab('chat');
  };

  const handleEscalate = (question: string) => {
    postVisit.sendMessage(`[Escalated from AI Chat] ${question}`);
    setActiveTab('messages');
  };

  const handleNavigate = (tab: string) => {
    setActiveTab(tab as CareHubTab);
  };

  // No summaries at all
  if (allSummaries.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="mx-auto w-20 h-20 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mb-5">
          <Heart className="w-10 h-10 text-rose-400" />
        </div>
        <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">
          Welcome to MedMink Care Hub
        </h2>
        <p className="text-sm text-surface-500 dark:text-surface-400 max-w-md mx-auto">
          Your visit summaries will appear here once your healthcare provider releases them.
          Check back after your next visit.
        </p>
      </div>
    );
  }

  if (!selectedSummary) return null;

  const visitDate = new Date(selectedSummary.visitDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-4">
      {/* Visit Picker (only when multiple visits) */}
      {allSummaries.length > 1 && (
        <div className="relative">
          <button
            onClick={() => setPickerOpen(!pickerOpen)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-white dark:bg-surface-800 text-sm font-medium text-surface-900 dark:text-white hover:shadow-sm transition-shadow w-full sm:w-auto"
          >
            <Sparkles className="w-4 h-4 text-rose-500" />
            <span className="truncate">
              {selectedSummary.diagnosis} &middot; {visitDate}
            </span>
            <ChevronDown className={`w-4 h-4 text-surface-400 ml-auto transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
          </button>
          {pickerOpen && (
            <div className="absolute top-full left-0 mt-1 w-full sm:w-80 rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-white dark:bg-surface-800 shadow-lg z-50 overflow-hidden">
              {allSummaries.map(s => {
                const date = new Date(s.visitDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const isSelected = s.id === selectedId;
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedId(s.id); setPickerOpen(false); setActiveTab('home'); }}
                    className={`w-full text-left px-4 py-3 hover:bg-rose-50 dark:hover:bg-surface-700 transition-colors ${
                      isSelected ? 'bg-rose-50 dark:bg-surface-700' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{s.diagnosis}</p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">{date} &middot; {s.releasedBy}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Bar */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 p-1 rounded-2xl bg-rose-50/50 dark:bg-surface-800 border border-rose-100 dark:border-surface-700 min-w-max">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.id !== 'chat') setAskAIQuestion(undefined);
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'text-surface-600 dark:text-surface-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-100/50 dark:hover:bg-surface-700'
                }`}
                title={tab.label}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'home' && (
          <CareHubHome
            summary={selectedSummary}
            onAskAI={handleAskAI}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'visit' && (
          <PostVisitOverview summary={selectedSummary} onAskAI={handleAskAI} />
        )}

        {activeTab === 'medications' && (
          <CareHubMedications summary={selectedSummary} onAskAI={handleAskAI} />
        )}

        {activeTab === 'labs' && (
          <CareHubLabs
            summary={selectedSummary}
            vitals={postVisit.vitals}
            vitalTrends={postVisit.vitalTrends}
            vitalAnalysis={postVisit.vitalAnalysis}
            onLogVital={postVisit.logVital}
            onImport={postVisit.importVitals}
            onAnalyze={postVisit.analyzeVitals}
            vitalsLoading={postVisit.vitalsLoading}
          />
        )}

        {activeTab === 'appointments' && (
          <CareHubAppointments />
        )}

        {activeTab === 'chat' && (
          <PostVisitChat
            summary={selectedSummary}
            chatMessages={postVisit.chatMessages}
            chatLoading={postVisit.chatLoading}
            onSend={postVisit.sendChatMessage}
            onEscalate={handleEscalate}
            initialQuestion={askAIQuestion}
          />
        )}

        {activeTab === 'messages' && (
          <PostVisitMessages
            summaryId={selectedId!}
            messages={postVisit.messages}
            onSend={postVisit.sendMessage}
            loading={postVisit.messagesLoading}
          />
        )}

        {activeTab === 'scribe' && (
          <CareHubScribe />
        )}
      </div>
    </div>
  );
}
