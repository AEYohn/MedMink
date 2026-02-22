'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import {
  Send,
  Mail,
  Stethoscope,
  User,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
} from 'lucide-react';
import type { PostVisitMessage } from '@/types/postvisit';

function MessageBubble({ msg }: { msg: PostVisitMessage }) {
  const isPatient = msg.sender === 'patient';
  const isClinician = msg.sender === 'clinician';
  const isSystem = msg.sender === 'system';

  const statusIcon = msg.status === 'replied' ? (
    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
  ) : msg.status === 'read' ? (
    <Eye className="w-3 h-3 text-blue-500" />
  ) : (
    <Clock className="w-3 h-3 text-muted-foreground" />
  );

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-3 h-3" />
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isPatient ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${
        isPatient
          ? 'bg-primary text-primary-foreground rounded-2xl rounded-tr-md px-4 py-3'
          : 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 text-foreground rounded-2xl rounded-tl-md px-4 py-3'
      }`}>
        {isClinician && (
          <div className="flex items-center gap-1.5 mb-2 text-emerald-700 dark:text-emerald-400">
            <Stethoscope className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">Your doctor:</span>
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] opacity-50">
            {new Date(msg.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          {isPatient && statusIcon}
        </div>
      </div>
    </div>
  );
}

export function PostVisitMessages({
  summaryId,
  messages,
  onSend,
  loading,
}: {
  summaryId: string;
  messages: PostVisitMessage[];
  onSend: (content: string) => Promise<void>;
  loading: boolean;
}) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;

    setSending(true);
    try {
      await onSend(input.trim());
      setInput('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)]">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-4 mb-3">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">Messages to Your Doctor</h3>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Send questions to your care team. They will review and respond.
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 mb-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No messages yet</p>
            <p className="text-xs text-muted-foreground mt-1">Send a question to start a conversation with your doctor.</p>
          </div>
        ) : (
          messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

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
            placeholder="Write a message to your doctor..."
            rows={1}
            className="flex-1 px-3 py-2.5 bg-muted/50 border border-border rounded-xl text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none text-sm"
            style={{ minHeight: '44px', maxHeight: '100px' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="p-2.5 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-xl transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Your doctor will be notified and can respond here.
        </p>
      </form>
    </div>
  );
}
