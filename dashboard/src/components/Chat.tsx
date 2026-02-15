'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getApiUrl } from '@/lib/api-url';
import {
  Send,
  Loader2,
  MessageCircle,
  FileText,
  Lightbulb,
  Beaker,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ChevronRight,
  Bot,
  User,
  Copy,
  Check,
} from 'lucide-react';

interface Source {
  id: string;
  content_type: string;
  title: string;
  relevance: number;
  snippet: string | null;
  paper_id: string | null;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  followUpQuestions?: string[];
  confidence?: number;
  timestamp: Date;
}

interface ChatProps {
  onPaperClick?: (paperId: string) => void;
}

export function Chat({ onPaperClick }: ChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleSourceExpanded = (messageId: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) return;
      const response = await fetch(
        `${apiUrl}/api/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: userMessage.content,
            conversation_id: conversationId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      setConversationId(data.conversation_id);

      const assistantMessage: Message = {
        id: data.message_id,
        role: 'assistant',
        content: data.answer,
        sources: data.sources,
        followUpQuestions: data.follow_up_questions,
        confidence: data.confidence,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleFollowUp = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  const getSourceIcon = (contentType: string) => {
    switch (contentType) {
      case 'paper': return <FileText className="w-3.5 h-3.5" />;
      case 'claim': return <Lightbulb className="w-3.5 h-3.5" />;
      case 'technique': return <Beaker className="w-3.5 h-3.5" />;
      default: return <FileText className="w-3.5 h-3.5" />;
    }
  };

  const getSourceColor = (contentType: string) => {
    switch (contentType) {
      case 'paper': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400';
      case 'claim': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400';
      case 'technique': return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-400';
      default: return 'bg-surface-100 text-surface-700 dark:bg-surface-800 dark:text-surface-400';
    }
  };

  const suggestions = [
    'What methods improve transformer efficiency?',
    'Show me papers about attention mechanisms',
    'What are the key claims about scaling laws?',
  ];

  return (
    <div className="flex flex-col h-full card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-surface-200 dark:border-surface-700">
        <div className="p-2 bg-gradient-to-br from-brand-500 to-accent-500 rounded-xl">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="font-semibold text-surface-900 dark:text-white">Research Assistant</h2>
          <p className="text-xs text-surface-500">Ask questions about your research corpus</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 animate-fade-in">
            <div className="p-4 bg-gradient-to-br from-brand-100 to-accent-100 dark:from-brand-900/30 dark:to-accent-900/30 rounded-2xl mb-6">
              <Sparkles className="w-12 h-12 text-brand-500" />
            </div>
            <h3 className="text-xl font-semibold text-surface-900 dark:text-white mb-2">
              How can I help you today?
            </h3>
            <p className="text-surface-500 dark:text-surface-400 max-w-md mb-8">
              I can search through papers, claims, and techniques to answer your questions with citations.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => setInput(suggestion)}
                  className="px-4 py-2 text-sm bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-full hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`flex gap-3 animate-fade-in-up ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Avatar */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
              message.role === 'user'
                ? 'bg-brand-500'
                : 'bg-gradient-to-br from-brand-500 to-accent-500'
            }`}>
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>

            {/* Message Content */}
            <div className={`flex-1 max-w-[85%] ${message.role === 'user' ? 'text-right' : ''}`}>
              <div
                className={`inline-block rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-brand-500 text-white rounded-br-md'
                    : 'bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-white rounded-bl-md'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>

                {/* Copy button for assistant messages */}
                {message.role === 'assistant' && (
                  <div className="flex justify-end mt-2 -mb-1">
                    <button
                      onClick={() => copyToClipboard(message.content, message.id)}
                      className="p-1 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Sources */}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-3">
                  <button
                    onClick={() => toggleSourceExpanded(message.id)}
                    className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition-colors"
                  >
                    {expandedSources.has(message.id) ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    <span className="font-medium">{message.sources.length} source{message.sources.length !== 1 ? 's' : ''}</span>
                  </button>

                  {expandedSources.has(message.id) && (
                    <div className="mt-2 space-y-2 animate-fade-in">
                      {message.sources.map((source, idx) => {
                        const getEntityRoute = () => {
                          if (source.content_type === 'paper' && source.paper_id) return `/paper/${source.paper_id}`;
                          if (source.content_type === 'claim') return `/claim/${source.id}`;
                          if (source.content_type === 'technique') return `/technique/${source.id}`;
                          if (source.paper_id) return `/paper/${source.paper_id}`;
                          return null;
                        };
                        const route = getEntityRoute();

                        return (
                          <button
                            key={`${source.id}-${idx}`}
                            onClick={() => route && router.push(route)}
                            disabled={!route}
                            className={`w-full flex items-start gap-3 p-3 bg-white dark:bg-surface-900 rounded-xl border border-surface-200 dark:border-surface-700 text-left transition-all ${
                              route ? 'hover:border-brand-300 dark:hover:border-brand-600 cursor-pointer group' : ''
                            }`}
                          >
                            <span className={`flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 ${getSourceColor(source.content_type)}`}>
                              {getSourceIcon(source.content_type)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-surface-900 dark:text-white truncate group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                                {source.title}
                              </p>
                              {source.snippet && (
                                <p className="text-xs text-surface-500 mt-1 line-clamp-2">
                                  {source.snippet}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-xs text-surface-400 tabular-nums">
                                {Math.round(source.relevance * 100)}%
                              </span>
                              {route && <ChevronRight className="w-4 h-4 text-surface-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Follow-up questions */}
              {message.followUpQuestions && message.followUpQuestions.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-surface-500 mb-2 font-medium">Suggested follow-ups:</p>
                  <div className="flex flex-wrap gap-2">
                    {message.followUpQuestions.map((q, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleFollowUp(q)}
                        className="px-3 py-1.5 text-xs bg-white dark:bg-surface-900 border border-surface-200 dark:border-surface-700 rounded-full hover:border-brand-300 dark:hover:border-brand-600 text-surface-700 dark:text-surface-300 transition-colors"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Confidence indicator */}
              {message.confidence !== undefined && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-surface-500">Confidence:</span>
                  <div className="flex-1 max-w-[100px] h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-brand-500 to-brand-400 rounded-full transition-all"
                      style={{ width: `${message.confidence * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-surface-500 tabular-nums">{Math.round(message.confidence * 100)}%</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-surface-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm text-surface-500">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-900/50">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about your research..."
            className="input"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="btn btn-primary px-5"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
