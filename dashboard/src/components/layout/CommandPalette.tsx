'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  FileText,
  Lightbulb,
  Beaker,
  MessageCircle,
  Home,
  FolderOpen,
  Settings,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Command,
} from 'lucide-react';
import { useSearch } from '@/contexts/SearchContext';
import { useChat } from '@/contexts/ChatContext';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
  category: 'navigation' | 'actions' | 'search';
  action: () => void;
  shortcut?: string;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { executeSearch, setQuery, setMode } = useSearch();
  const { startNewConversation } = useChat();
  const [query, setLocalQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    // Navigation
    {
      id: 'home',
      icon: <Home className="w-4 h-4" />,
      label: 'Go to Dashboard',
      category: 'navigation',
      action: () => { router.push('/'); onClose(); },
      shortcut: 'G H',
    },
    {
      id: 'projects',
      icon: <FolderOpen className="w-4 h-4" />,
      label: 'Go to Projects',
      category: 'navigation',
      action: () => { router.push('/projects'); onClose(); },
      shortcut: 'G P',
    },
    {
      id: 'settings',
      icon: <Settings className="w-4 h-4" />,
      label: 'Open Settings',
      category: 'navigation',
      action: () => { router.push('/settings'); onClose(); },
      shortcut: 'G S',
    },
    // Actions
    {
      id: 'new-chat',
      icon: <MessageCircle className="w-4 h-4" />,
      label: 'Start New Chat',
      description: 'Ask questions about your research',
      category: 'actions',
      action: () => { startNewConversation(); router.push('/?view=chat'); onClose(); },
    },
    {
      id: 'search-papers',
      icon: <FileText className="w-4 h-4" />,
      label: 'Search Papers',
      description: 'Find papers in your corpus',
      category: 'actions',
      action: () => { setMode('search'); onClose(); },
    },
    {
      id: 'explore-claims',
      icon: <Lightbulb className="w-4 h-4" />,
      label: 'Explore Claims',
      description: 'Browse extracted claims',
      category: 'actions',
      action: () => { router.push('/?tab=claims'); onClose(); },
    },
    {
      id: 'view-techniques',
      icon: <Beaker className="w-4 h-4" />,
      label: 'View Techniques',
      description: 'Browse extracted techniques',
      category: 'actions',
      action: () => { router.push('/?tab=techniques'); onClose(); },
    },
    {
      id: 'view-trends',
      icon: <TrendingUp className="w-4 h-4" />,
      label: 'View Trends',
      description: 'Discover research trends',
      category: 'actions',
      action: () => { router.push('/?tab=trends'); onClose(); },
    },
  ];

  const filteredCommands = query
    ? commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.description?.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        } else if (query) {
          // If there's a query but no matching commands, do a search
          setQuery(query);
          setMode('search');
          executeSearch();
          onClose();
        }
        break;
    }
  }, [isOpen, filteredCommands, selectedIndex, query, setQuery, setMode, executeSearch, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      setLocalQuery('');
      setSelectedIndex(0);
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const groupedCommands = {
    navigation: filteredCommands.filter(c => c.category === 'navigation'),
    actions: filteredCommands.filter(c => c.category === 'actions'),
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-x-4 top-[20%] max-w-2xl mx-auto z-50 animate-scale-in">
        <div className="bg-white dark:bg-surface-800 rounded-2xl shadow-2xl border border-surface-200 dark:border-surface-700 overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-4 border-b border-surface-200 dark:border-surface-700">
            <Search className="w-5 h-5 text-surface-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Search commands, papers, or ask a question..."
              className="flex-1 bg-transparent text-lg text-surface-900 dark:text-white placeholder:text-surface-400 focus:outline-none"
            />
            <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-xs text-surface-400 bg-surface-100 dark:bg-surface-700 rounded">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div className="max-h-[400px] overflow-y-auto py-2">
            {filteredCommands.length === 0 && query && (
              <div className="px-4 py-8 text-center">
                <Sparkles className="w-10 h-10 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
                <p className="text-surface-500 dark:text-surface-400">
                  No commands found. Press Enter to search for "{query}"
                </p>
              </div>
            )}

            {/* Navigation Commands */}
            {groupedCommands.navigation.length > 0 && (
              <div className="px-2">
                <div className="px-2 py-1.5 text-xs font-medium text-surface-400 uppercase tracking-wider">
                  Navigation
                </div>
                {groupedCommands.navigation.map((cmd, index) => {
                  const globalIndex = filteredCommands.indexOf(cmd);
                  return (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        globalIndex === selectedIndex
                          ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                          : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'
                      }`}
                    >
                      <span className={`p-1.5 rounded-lg ${
                        globalIndex === selectedIndex
                          ? 'bg-brand-100 dark:bg-brand-900/40'
                          : 'bg-surface-100 dark:bg-surface-700'
                      }`}>
                        {cmd.icon}
                      </span>
                      <span className="flex-1 text-left font-medium">{cmd.label}</span>
                      {cmd.shortcut && (
                        <span className="text-xs text-surface-400 font-mono">{cmd.shortcut}</span>
                      )}
                      <ArrowRight className={`w-4 h-4 transition-opacity ${
                        globalIndex === selectedIndex ? 'opacity-100' : 'opacity-0'
                      }`} />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Action Commands */}
            {groupedCommands.actions.length > 0 && (
              <div className="px-2 mt-2">
                <div className="px-2 py-1.5 text-xs font-medium text-surface-400 uppercase tracking-wider">
                  Actions
                </div>
                {groupedCommands.actions.map((cmd) => {
                  const globalIndex = filteredCommands.indexOf(cmd);
                  return (
                    <button
                      key={cmd.id}
                      onClick={cmd.action}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        globalIndex === selectedIndex
                          ? 'bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400'
                          : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-700'
                      }`}
                    >
                      <span className={`p-1.5 rounded-lg ${
                        globalIndex === selectedIndex
                          ? 'bg-brand-100 dark:bg-brand-900/40'
                          : 'bg-surface-100 dark:bg-surface-700'
                      }`}>
                        {cmd.icon}
                      </span>
                      <div className="flex-1 text-left">
                        <div className="font-medium">{cmd.label}</div>
                        {cmd.description && (
                          <div className="text-xs text-surface-500 dark:text-surface-400">
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      <ArrowRight className={`w-4 h-4 transition-opacity ${
                        globalIndex === selectedIndex ? 'opacity-100' : 'opacity-0'
                      }`} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50">
            <div className="flex items-center justify-between text-xs text-surface-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-surface-200 dark:bg-surface-700 rounded">↑</kbd>
                  <kbd className="px-1.5 py-0.5 bg-surface-200 dark:bg-surface-700 rounded">↓</kbd>
                  to navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-surface-200 dark:bg-surface-700 rounded">↵</kbd>
                  to select
                </span>
              </div>
              <span className="flex items-center gap-1">
                <Command className="w-3 h-3" />
                <span>K to open</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
