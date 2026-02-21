'use client';

import { useState } from 'react';
import {
  Mail,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  Send,
  Sparkles,
  Edit3,
} from 'lucide-react';
import type { PostVisitMessage } from '@/types/postvisit';

interface PatientMessageQueueProps {
  messages: PostVisitMessage[];
  onSendReply: (messageId: string, summaryId: string, content: string) => Promise<void>;
  onGenerateDraft: (messageId: string, summaryId: string) => Promise<string>;
}

export function PatientMessageQueue({
  messages,
  onSendReply,
  onGenerateDraft,
}: PatientMessageQueueProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editedDrafts, setEditedDrafts] = useState<Record<string, string>>({});
  const [loadingDrafts, setLoadingDrafts] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<Set<string>>(new Set());

  const pendingMessages = messages.filter(m => m.sender === 'patient' && m.status !== 'replied');

  const handleGenerateDraft = async (msgId: string, summaryId: string) => {
    setLoadingDrafts(prev => new Set(prev).add(msgId));
    try {
      const draft = await onGenerateDraft(msgId, summaryId);
      setDrafts(prev => ({ ...prev, [msgId]: draft }));
      setEditedDrafts(prev => ({ ...prev, [msgId]: draft }));
    } finally {
      setLoadingDrafts(prev => {
        const next = new Set(prev);
        next.delete(msgId);
        return next;
      });
    }
  };

  const handleSend = async (msgId: string, summaryId: string) => {
    const content = editedDrafts[msgId] || drafts[msgId];
    if (!content) return;

    setSending(prev => new Set(prev).add(msgId));
    try {
      await onSendReply(msgId, summaryId, content);
    } finally {
      setSending(prev => {
        const next = new Set(prev);
        next.delete(msgId);
        return next;
      });
    }
  };

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
      <div className="px-5 py-4 border-b border-surface-100 dark:border-surface-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-500" />
            <h3 className="font-semibold text-sm text-surface-900 dark:text-white">Patient Messages</h3>
          </div>
          {pendingMessages.length > 0 && (
            <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-medium rounded-full">
              {pendingMessages.length} pending
            </span>
          )}
        </div>
      </div>

      {pendingMessages.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <Mail className="w-8 h-8 text-surface-300 mx-auto mb-2" />
          <p className="text-sm text-surface-500">No pending patient messages</p>
        </div>
      ) : (
        <div className="divide-y divide-surface-100 dark:divide-surface-700">
          {pendingMessages.map((msg) => (
            <div key={msg.id} className="px-5 py-3">
              <button
                onClick={() => setExpanded(expanded === msg.id ? null : msg.id)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-1.5 rounded-full bg-surface-100 dark:bg-surface-700">
                    <User className="w-3.5 h-3.5 text-surface-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-surface-900 dark:text-white truncate">{msg.content}</p>
                    <div className="flex items-center gap-1.5 text-[10px] text-surface-400">
                      <Clock className="w-3 h-3" />
                      {new Date(msg.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                {expanded === msg.id ? (
                  <ChevronUp className="w-4 h-4 text-surface-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-surface-400 shrink-0" />
                )}
              </button>

              {expanded === msg.id && (
                <div className="mt-3 pl-10 space-y-3">
                  {/* Patient's message */}
                  <div className="rounded-lg bg-surface-50 dark:bg-surface-700/30 p-3">
                    <p className="text-sm text-surface-700 dark:text-surface-300">{msg.content}</p>
                  </div>

                  {/* AI Draft */}
                  {!drafts[msg.id] && !loadingDrafts.has(msg.id) && (
                    <button
                      onClick={() => handleGenerateDraft(msg.id, msg.summaryId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate AI Draft
                    </button>
                  )}

                  {loadingDrafts.has(msg.id) && (
                    <div className="flex items-center gap-2 text-xs text-purple-600">
                      <div className="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                      Generating draft...
                    </div>
                  )}

                  {drafts[msg.id] && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400">
                        <Sparkles className="w-3 h-3" />
                        AI-Generated Draft (edit before sending)
                      </div>
                      <textarea
                        value={editedDrafts[msg.id] || ''}
                        onChange={(e) => setEditedDrafts(prev => ({ ...prev, [msg.id]: e.target.value }))}
                        rows={3}
                        className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSend(msg.id, msg.summaryId)}
                          disabled={sending.has(msg.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          <Send className="w-3 h-3" />
                          {sending.has(msg.id) ? 'Sending...' : 'Send Reply'}
                        </button>
                        <button
                          onClick={() => handleGenerateDraft(msg.id, msg.summaryId)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-600 dark:text-surface-300 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          Regenerate
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
