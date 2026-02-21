'use client';

import { useState, useRef, useEffect, FormEvent, useCallback, useMemo } from 'react';
import {
  MessageCircle,
  Send,
  Loader2,
  Sparkles,
  FileText,
  Pill,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  UserRound,
  Stethoscope,
  HelpCircle,
} from 'lucide-react';
import { getReleasedSummaries, savePatientQuestion, getPatientQuestionsForSummary } from '@/lib/storage';
import { ExplainableText } from '@/components/patient/terms/ExplainableText';
import type { ReleasedVisitSummary, PatientMedication } from '@/types/visit-summary';
import type { PatientQuestion } from '@/types/patient-question';

// ── Message types ──

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'clinician';
  content: string;
  timestamp: Date;
  isEscalation?: boolean;
}

// ── AI response engine ──

function generateAIResponse(question: string, summary: ReleasedVisitSummary): string {
  const q = question.toLowerCase();

  // Diagnosis questions
  if (q.includes('diagnosis') || q.includes('what do i have') || q.includes('what does') && q.includes('mean')) {
    return `Based on your visit on ${new Date(summary.visitDate).toLocaleDateString()}, your diagnosis is **${summary.diagnosis}**.\n\n${summary.diagnosisExplanation}\n\nIf you'd like more details about what this means for your day-to-day life, feel free to ask, or you can send a question to your doctor.`;
  }

  // Medication questions
  const medMatch = summary.medications.find(m =>
    q.includes(m.name.toLowerCase()) || q.includes('medication') || q.includes('medicine') || q.includes('prescri')
  );
  if (medMatch || q.includes('pill') || q.includes('drug')) {
    if (medMatch) {
      return `**${medMatch.name}** (${medMatch.dose}, ${medMatch.frequency})\n\n${medMatch.plainLanguageInstructions}\n\nThis medication was marked as **${medMatch.action === 'new' ? 'newly prescribed' : medMatch.action === 'continue' ? 'continued from before' : 'discontinued'}** during your visit.`;
    }
    const medList = summary.medications
      .filter(m => m.action !== 'discontinue')
      .map(m => `- **${m.name}** ${m.dose} — ${m.frequency}`)
      .join('\n');
    return `Here are the medications from your visit:\n\n${medList}\n\nWould you like me to explain any of these in more detail?`;
  }

  // Red flags / warning signs
  if (q.includes('warning') || q.includes('red flag') || q.includes('emergency') || q.includes('call 911') || q.includes('er ') || q.includes('danger')) {
    const flags = summary.redFlags.map(f => `- ${f}`).join('\n');
    return `**Important warning signs — seek immediate care if you experience:**\n\n${flags}\n\nIf you're unsure whether your symptoms are serious, it's always better to be safe and seek medical attention.`;
  }

  // Follow-up questions
  if (q.includes('follow') || q.includes('appointment') || q.includes('come back') || q.includes('next visit')) {
    if (summary.followUps.length > 0) {
      const fups = summary.followUps.map(f => `- **${f.provider}** within ${f.timeframe} — ${f.reason}`).join('\n');
      return `Your recommended follow-up appointments:\n\n${fups}\n\nPlease schedule these as soon as possible. If you need help booking, contact your doctor's office.`;
    }
    return `Your discharge instructions didn't include specific follow-up appointments. Please contact your doctor's office to schedule a follow-up visit.`;
  }

  // Instructions / restrictions
  if (q.includes('instruction') || q.includes('restriction') || q.includes('can i') || q.includes('allowed')) {
    let response = '';
    if (summary.dischargeInstructions) {
      response += `**Your discharge instructions:**\n\n${summary.dischargeInstructions}\n\n`;
    }
    if (summary.restrictions.length > 0) {
      response += `**Restrictions:**\n${summary.restrictions.map(r => `- ${r}`).join('\n')}`;
    }
    return response || `I don't have specific instructions for that question. Would you like to send this question to your doctor?`;
  }

  // Default: offer help or escalation
  return `I can help you understand your visit summary from ${new Date(summary.visitDate).toLocaleDateString()}. Here are some things I can explain:\n\n- Your diagnosis: **${summary.diagnosis}**\n- Your medications (${summary.medications.filter(m => m.action !== 'discontinue').length} active)\n- Warning signs to watch for\n- Follow-up appointments\n- Discharge instructions\n\nWhat would you like to know more about? If I can't fully answer your question, I can send it to your doctor.`;
}

// ── Visit Context Panel ──

function VisitContextPanel({
  summary,
  onAskAbout,
}: {
  summary: ReleasedVisitSummary;
  onAskAbout: (text: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-semibold text-surface-900 dark:text-white">Visit Summary</span>
          <span className="text-xs text-surface-500">
            {new Date(summary.visitDate).toLocaleDateString()}
          </span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-surface-400" /> : <ChevronDown className="w-4 h-4 text-surface-400" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-surface-100 dark:border-surface-700">
          {/* Diagnosis */}
          <div className="pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500 mb-1">Diagnosis</p>
            <p className="text-sm font-medium text-surface-900 dark:text-white">
              <ExplainableText text={summary.diagnosis} />
            </p>
            <button
              onClick={() => onAskAbout(`What does ${summary.diagnosis} mean?`)}
              className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <HelpCircle className="w-3 h-3" /> Ask about this
            </button>
          </div>

          {/* Medications */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500 mb-1">Medications</p>
            <div className="space-y-1.5">
              {summary.medications.filter(m => m.action !== 'discontinue').map((med, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-surface-900 dark:text-white">{med.name}</span>
                    <span className="text-surface-500 ml-1">{med.dose}</span>
                  </div>
                  <button
                    onClick={() => onAskAbout(`Why was ${med.name} prescribed?`)}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline flex-shrink-0 ml-2"
                  >
                    <HelpCircle className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Red flags */}
          {summary.redFlags.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-red-500 mb-1">Warning Signs</p>
              <ul className="space-y-0.5">
                {summary.redFlags.slice(0, 3).map((flag, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-surface-700 dark:text-surface-300">
                    <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                    <ExplainableText text={flag} />
                  </li>
                ))}
                {summary.redFlags.length > 3 && (
                  <li className="text-xs text-surface-500">+{summary.redFlags.length - 3} more</li>
                )}
              </ul>
              <button
                onClick={() => onAskAbout('What are the warning signs I should watch for?')}
                className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <HelpCircle className="w-3 h-3" /> Ask about warning signs
              </button>
            </div>
          )}

          {/* Key instructions */}
          {summary.dischargeInstructions && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500 mb-1">Instructions</p>
              <p className="text-xs text-surface-700 dark:text-surface-300 line-clamp-3">
                <ExplainableText text={summary.dischargeInstructions} />
              </p>
              <button
                onClick={() => onAskAbout('Can you explain my discharge instructions?')}
                className="mt-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <HelpCircle className="w-3 h-3" /> Ask about this
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main companion page ──

export default function CompanionPage() {
  const [summary, setSummary] = useState<ReleasedVisitSummary | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showEscalationConfirm, setShowEscalationConfirm] = useState(false);
  const [escalationMessage, setEscalationMessage] = useState<{ question: string; aiResponse: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load the most recent released visit summary
  useEffect(() => {
    const summaries = getReleasedSummaries().filter(s => s.status === 'released');
    if (summaries.length > 0) {
      const latest = summaries[0];
      setSummary(latest);

      // Check for clinician replies
      const questions = getPatientQuestionsForSummary(latest.id);
      const replied = questions.filter(q => q.status === 'replied' && q.clinicianReply);

      const initialMessages: ChatMessage[] = [
        {
          id: '1',
          role: 'assistant',
          content: `Hello! I'm your health companion for your visit on ${new Date(latest.visitDate).toLocaleDateString()}.\n\nYour diagnosis was **${latest.diagnosis}**. I can help you understand your visit summary, medications, and instructions in plain language.\n\nI can help you understand your visit summary, but I'm not a doctor. For medical advice, send a question to your care team.`,
          timestamp: new Date(),
        },
      ];

      // Show clinician replies
      for (const q of replied) {
        initialMessages.push({
          id: `cr-${q.id}`,
          role: 'clinician',
          content: `**Your question:** ${q.question}\n\n${q.clinicianReply}`,
          timestamp: new Date(q.reviewedAt || q.createdAt),
        });
      }

      setMessages(initialMessages);
    } else {
      setMessages([
        {
          id: '1',
          role: 'assistant',
          content: "Hello! I'm your health companion. It looks like your doctor hasn't released a visit summary yet. Once they do, I'll be able to help you understand your diagnosis, medications, and care instructions.\n\nCheck back soon!",
          timestamp: new Date(),
        },
      ]);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const suggestedQuestions = useMemo(() => {
    if (!summary) return [];
    const questions: string[] = [
      `What does ${summary.diagnosis} mean?`,
    ];
    if (summary.medications.length > 0) {
      const firstMed = summary.medications.find(m => m.action !== 'discontinue');
      if (firstMed) questions.push(`Why was ${firstMed.name} prescribed?`);
    }
    questions.push('When should I come back to the ER?');
    questions.push('What are the warning signs I should watch for?');
    return questions;
  }, [summary]);

  const handleSend = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);

      // Simulate processing delay
      await new Promise((r) => setTimeout(r, 800));

      let responseText: string;
      if (summary) {
        responseText = generateAIResponse(text, summary);
      } else {
        responseText = "I don't have a visit summary to reference yet. Please check back once your doctor releases your visit notes.";
      }

      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      setIsLoading(false);
    },
    [isLoading, summary]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  const handleAskAbout = (text: string) => {
    setInput(text);
  };

  const handleEscalate = useCallback(() => {
    // Find the last user question and AI response
    const userMsgs = messages.filter(m => m.role === 'user');
    const lastUser = userMsgs[userMsgs.length - 1];
    const aiMsgs = messages.filter(m => m.role === 'assistant');
    const lastAi = aiMsgs[aiMsgs.length - 1];

    if (lastUser && lastAi) {
      setEscalationMessage({
        question: lastUser.content,
        aiResponse: lastAi.content,
      });
      setShowEscalationConfirm(true);
    }
  }, [messages]);

  const confirmEscalation = useCallback(() => {
    if (!escalationMessage || !summary) return;

    const question: PatientQuestion = {
      id: `pq-${Date.now()}`,
      summaryId: summary.id,
      patientId: summary.patientId,
      question: escalationMessage.question,
      aiResponse: escalationMessage.aiResponse,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    savePatientQuestion(question);

    setMessages(prev => [
      ...prev,
      {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: "Your question has been sent to your doctor. They'll review it and may respond directly here. In the meantime, feel free to ask me anything else about your visit.",
        timestamp: new Date(),
        isEscalation: true,
      },
    ]);

    setShowEscalationConfirm(false);
    setEscalationMessage(null);
  }, [escalationMessage, summary]);

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-8rem)]">
      {/* Left panel: Chat */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4 mb-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-surface-900 dark:text-white">
                Health Companion
              </h1>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Ask questions about your visit — I'll explain in plain language
              </p>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/20 rounded-full">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-[11px] font-medium text-indigo-700 dark:text-indigo-400">
                AI-Powered
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-4 mb-3 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] ${
                  message.role === 'user'
                    ? 'bg-indigo-500 text-white rounded-2xl rounded-tr-md px-4 py-3'
                    : message.role === 'clinician'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 text-surface-900 dark:text-white rounded-2xl rounded-tl-md px-4 py-3'
                    : 'bg-surface-100 dark:bg-surface-700/50 text-surface-900 dark:text-white rounded-2xl rounded-tl-md px-4 py-3'
                }`}
              >
                {message.role === 'clinician' && (
                  <div className="flex items-center gap-1.5 mb-2 text-emerald-700 dark:text-emerald-400">
                    <Stethoscope className="w-3.5 h-3.5" />
                    <span className="text-xs font-semibold">Your doctor responded:</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.role === 'user' ? (
                    message.content
                  ) : (
                    <ExplainableText text={message.content} />
                  )}
                </div>
                <span className="block mt-2 text-[10px] opacity-50">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-surface-100 dark:bg-surface-700/50 rounded-2xl rounded-tl-md px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span className="text-sm text-surface-500 dark:text-surface-400">
                    Reviewing your records...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested questions */}
        {messages.length <= 2 && !isLoading && suggestedQuestions.length > 0 && (
          <div className="mb-2">
            <p className="text-xs text-surface-500 dark:text-surface-400 mb-1.5">
              Suggested questions:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(q)}
                  className="px-2.5 py-1.5 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg text-xs text-surface-700 dark:text-surface-300 transition-colors border border-surface-200 dark:border-surface-700"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Escalation confirmation */}
        {showEscalationConfirm && (
          <div className="mb-2 p-3 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
              Send your question to your doctor?
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mb-3">
              Your doctor will see your question along with the AI's response for context.
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmEscalation}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Yes, send to my doctor
              </button>
              <button
                onClick={() => setShowEscalationConfirm(false)}
                className="px-3 py-1.5 bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-300 rounded-lg text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder="Ask about your visit..."
                rows={1}
                className="w-full px-3 py-2.5 bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
                style={{ minHeight: '44px', maxHeight: '100px' }}
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="p-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-surface-300 dark:disabled:bg-surface-700 text-white rounded-xl transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 text-[11px] text-surface-400">
              <Sparkles className="w-3 h-3" />
              <span>AI answers based on your visit summary — always verify with your doctor</span>
            </div>
            {summary && messages.length > 2 && (
              <button
                type="button"
                onClick={handleEscalate}
                className="flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
              >
                <UserRound className="w-3 h-3" />
                Send to my doctor
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Right panel: Visit Context */}
      {summary && (
        <div className="lg:w-80 xl:w-96 flex-shrink-0 overflow-y-auto">
          <VisitContextPanel summary={summary} onAskAbout={handleAskAbout} />
        </div>
      )}
    </div>
  );
}
