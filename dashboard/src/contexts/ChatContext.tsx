'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import {
  SavedConversation,
  ConversationMessage,
  getConversations,
  saveConversation,
  deleteConversation as deleteConversationFromStorage,
  getItem,
  setItem,
  STORAGE_KEYS,
  ChatSource
} from '@/lib/storage';
import { api } from '@/lib/api';

interface ChatState {
  conversations: SavedConversation[];
  currentConversation: SavedConversation | null;
  isLoading: boolean;
  error: string | null;
}

interface ChatContextValue extends ChatState {
  sendMessage: (content: string) => Promise<void>;
  startNewConversation: () => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
}

const ChatContext = createContext<ChatContextValue | undefined>(undefined);

function generateConversationTitle(firstMessage: string): string {
  // Take first 50 chars of first message as title
  const title = firstMessage.slice(0, 50);
  return title.length < firstMessage.length ? `${title}...` : title;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<SavedConversation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverConversationId, setServerConversationId] = useState<string | null>(null);

  // Load conversations from storage on mount
  useEffect(() => {
    const stored = getConversations();
    setConversations(stored);

    // Restore current conversation if any
    const currentId = getItem<string | null>(STORAGE_KEYS.CURRENT_CONVERSATION, null);
    if (currentId) {
      const current = stored.find(c => c.id === currentId);
      if (current) {
        setCurrentConversation(current);
      }
    }
  }, []);

  // Persist current conversation ID
  useEffect(() => {
    if (currentConversation) {
      setItem(STORAGE_KEYS.CURRENT_CONVERSATION, currentConversation.id);
    }
  }, [currentConversation?.id]);

  const startNewConversation = useCallback(() => {
    const newConversation: SavedConversation = {
      id: `conv-${Date.now()}`,
      title: 'New Conversation',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCurrentConversation(newConversation);
    setServerConversationId(null);
    setError(null);
  }, []);

  const loadConversation = useCallback((id: string) => {
    const conversation = conversations.find(c => c.id === id);
    if (conversation) {
      setCurrentConversation(conversation);
      setServerConversationId(null); // Will need to start new server conversation
      setError(null);
    }
  }, [conversations]);

  const deleteConversation = useCallback((id: string) => {
    deleteConversationFromStorage(id);
    setConversations(prev => prev.filter(c => c.id !== id));
    if (currentConversation?.id === id) {
      setCurrentConversation(null);
      setServerConversationId(null);
    }
  }, [currentConversation?.id]);

  const renameConversation = useCallback((id: string, title: string) => {
    setConversations(prev => {
      const updated = prev.map(c =>
        c.id === id ? { ...c, title, updatedAt: new Date().toISOString() } : c
      );
      const conversation = updated.find(c => c.id === id);
      if (conversation) {
        saveConversation(conversation);
      }
      return updated;
    });
    if (currentConversation?.id === id) {
      setCurrentConversation(prev => prev ? { ...prev, title } : prev);
    }
  }, [currentConversation?.id]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Start new conversation if none exists
    let conversation = currentConversation;
    if (!conversation) {
      conversation = {
        id: `conv-${Date.now()}`,
        title: generateConversationTitle(content),
        messages: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }

    // Add user message
    const userMessage: ConversationMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date().toISOString(),
    };

    const updatedConversation: SavedConversation = {
      ...conversation,
      messages: [...conversation.messages, userMessage],
      updatedAt: new Date().toISOString(),
      // Update title if this is the first message
      title: conversation.messages.length === 0 ? generateConversationTitle(content) : conversation.title,
    };

    setCurrentConversation(updatedConversation);
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.chat(content, serverConversationId || undefined);

      setServerConversationId(response.conversation_id);

      const sources: ChatSource[] = response.sources.map(s => ({
        id: s.id,
        content_type: s.content_type,
        title: s.title,
        relevance: s.relevance,
        snippet: s.snippet,
        paper_id: s.paper_id,
      }));

      const assistantMessage: ConversationMessage = {
        id: response.message_id,
        role: 'assistant',
        content: response.answer,
        sources,
        followUpQuestions: response.follow_up_questions,
        confidence: response.confidence,
        timestamp: new Date().toISOString(),
      };

      const finalConversation: SavedConversation = {
        ...updatedConversation,
        messages: [...updatedConversation.messages, assistantMessage],
        updatedAt: new Date().toISOString(),
      };

      setCurrentConversation(finalConversation);
      saveConversation(finalConversation);
      setConversations(getConversations());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');

      // Add error message to conversation
      const errorMessage: ConversationMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      };

      const errorConversation: SavedConversation = {
        ...updatedConversation,
        messages: [...updatedConversation.messages, errorMessage],
        updatedAt: new Date().toISOString(),
      };

      setCurrentConversation(errorConversation);
      saveConversation(errorConversation);
      setConversations(getConversations());
    } finally {
      setIsLoading(false);
    }
  }, [currentConversation, serverConversationId]);

  const value: ChatContextValue = {
    conversations,
    currentConversation,
    isLoading,
    error,
    sendMessage,
    startNewConversation,
    loadConversation,
    deleteConversation,
    renameConversation,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
