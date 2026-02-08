'use client';

import { useState } from 'react';
import {
  MessageCircle,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useChat } from '@/contexts/ChatContext';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListProps {
  compact?: boolean;
  maxItems?: number;
}

export function ConversationList({ compact = false, maxItems }: ConversationListProps) {
  const {
    conversations,
    currentConversation,
    startNewConversation,
    loadConversation,
    deleteConversation,
    renameConversation,
  } = useChat();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const displayConversations = maxItems ? conversations.slice(0, maxItems) : conversations;

  const handleStartEdit = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const handleSaveEdit = (id: string) => {
    if (editTitle.trim()) {
      renameConversation(id, editTitle.trim());
    }
    setEditingId(null);
    setEditTitle('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  if (compact) {
    return (
      <div className="space-y-1 animate-fade-in">
        <button
          onClick={startNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-600 hover:to-brand-700 text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>

        <div className="mt-3 space-y-0.5">
          {displayConversations.map((conv, index) => (
            <div
              key={conv.id}
              className={`group flex items-center gap-2 px-3 py-2 rounded-lg transition-all cursor-pointer animate-fade-in ${
                currentConversation?.id === conv.id
                  ? 'bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800'
                  : 'hover:bg-surface-100 dark:hover:bg-surface-800 border border-transparent'
              }`}
              style={{ animationDelay: `${index * 30}ms` }}
              onClick={() => loadConversation(conv.id)}
            >
              <MessageCircle className={`w-3.5 h-3.5 flex-shrink-0 ${
                currentConversation?.id === conv.id
                  ? 'text-brand-500'
                  : 'text-surface-400'
              }`} />
              <span className={`flex-1 text-sm truncate ${
                currentConversation?.id === conv.id
                  ? 'font-medium text-brand-700 dark:text-brand-400'
                  : 'text-surface-700 dark:text-surface-300'
              }`}>
                {conv.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteConversation(conv.id);
                }}
                className="hidden group-hover:flex p-1 text-surface-400 hover:text-red-500 rounded transition-colors"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {conversations.length === 0 && (
          <div className="px-3 py-6 text-center">
            <Sparkles className="w-8 h-8 mx-auto text-surface-300 dark:text-surface-600 mb-2" />
            <p className="text-xs text-surface-400">No conversations yet</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-brand-500 to-accent-500 rounded-xl">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-surface-900 dark:text-white">Conversations</h3>
            <p className="text-xs text-surface-500">{conversations.length} total</p>
          </div>
        </div>
        <button
          onClick={startNewConversation}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-surface-200 dark:divide-surface-700 max-h-[400px] overflow-y-auto">
        {displayConversations.map((conv, index) => (
          <div
            key={conv.id}
            className={`group flex items-start gap-3 p-4 transition-all animate-fade-in ${
              currentConversation?.id === conv.id
                ? 'bg-brand-50 dark:bg-brand-900/20'
                : 'hover:bg-surface-50 dark:hover:bg-surface-800/50'
            }`}
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div className={`p-2 rounded-lg flex-shrink-0 ${
              currentConversation?.id === conv.id
                ? 'bg-brand-100 dark:bg-brand-900/40'
                : 'bg-surface-100 dark:bg-surface-800'
            }`}>
              <MessageCircle
                className={`w-4 h-4 ${
                  currentConversation?.id === conv.id
                    ? 'text-brand-500'
                    : 'text-surface-400'
                }`}
              />
            </div>

            <div className="flex-1 min-w-0">
              {editingId === conv.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit(conv.id);
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    className="flex-1 px-3 py-1.5 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
                    autoFocus
                  />
                  <button
                    onClick={() => handleSaveEdit(conv.id)}
                    className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="p-1.5 text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => loadConversation(conv.id)}
                    className="w-full text-left"
                  >
                    <p className={`text-sm font-medium truncate transition-colors ${
                      currentConversation?.id === conv.id
                        ? 'text-brand-700 dark:text-brand-400'
                        : 'text-surface-700 dark:text-surface-300 hover:text-brand-600 dark:hover:text-brand-400'
                    }`}>
                      {conv.title}
                    </p>
                  </button>
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex items-center gap-1 text-xs text-surface-400">
                      <Clock className="w-3 h-3" />
                      {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true })}
                    </div>
                    <span className="text-xs text-surface-300 dark:text-surface-600">•</span>
                    <span className="text-xs text-surface-400">
                      {conv.messages.length} messages
                    </span>
                  </div>
                </>
              )}
            </div>

            {editingId !== conv.id && (
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleStartEdit(conv.id, conv.title)}
                  className="p-1.5 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-lg transition-colors"
                  title="Rename"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => deleteConversation(conv.id)}
                  className="p-1.5 text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}

        {conversations.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-surface-100 dark:bg-surface-800 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-surface-400" />
            </div>
            <p className="text-sm font-medium text-surface-500 dark:text-surface-400">
              No conversations yet
            </p>
            <p className="text-xs text-surface-400 mt-1">
              Start a new chat to begin
            </p>
          </div>
        )}
      </div>

      {conversations.length > (maxItems || 0) && maxItems && (
        <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50">
          <span className="text-xs text-surface-500">
            Showing {maxItems} of {conversations.length} conversations
          </span>
        </div>
      )}
    </div>
  );
}
