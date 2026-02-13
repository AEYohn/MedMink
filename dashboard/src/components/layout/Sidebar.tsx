'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  MessageCircle,
  History,
  Bookmark,
  ChevronDown,
  Plus,
  Trash2,
  FileText,
  Lightbulb,
  Beaker,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  Search,
  Stethoscope,
  Camera,
  ClipboardList,
} from 'lucide-react';
import { useSearch } from '@/contexts/SearchContext';
import { useChat } from '@/contexts/ChatContext';
import { usePersistentState } from '@/hooks/usePersistentState';
import { getBookmarks, Bookmark as BookmarkType } from '@/lib/storage';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { history, clearHistory } = useSearch();
  const { conversations, currentConversation, startNewConversation, loadConversation, deleteConversation } = useChat();
  const [expandedSections, setExpandedSections] = usePersistentState<string[]>('sidebar-sections', ['conversations']);
  const [bookmarks] = useState<BookmarkType[]>(() => getBookmarks());

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  const isExpanded = (section: string) => expandedSections.includes(section);

  const navItems = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/case', icon: Stethoscope, label: 'Case Analysis' },
    { href: '/interview', icon: ClipboardList, label: 'Interview' },
    { href: '/imaging', icon: Camera, label: 'Medical Imaging' },
    { href: '/labs', icon: Beaker, label: 'Lab Reports' },
    { href: '/chart', icon: FileText, label: 'Charting' },
  ];

  const quickActions = [
    { icon: Search, label: 'Search', action: () => {}, color: 'blue' },
    { icon: MessageCircle, label: 'Chat', action: () => startNewConversation(), color: 'purple' },
  ];

  if (isCollapsed) {
    return (
      <aside className="w-16 bg-card border-r border-border flex flex-col py-4">
        <button
          onClick={onToggle}
          className="mx-auto p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-all"
        >
          <PanelLeft className="w-5 h-5" />
        </button>

        <nav className="mt-6 space-y-2 px-2">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-center p-3 rounded-xl transition-all ${
                pathname === item.href
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              title={item.label}
            >
              <item.icon className="w-5 h-5" />
            </Link>
          ))}
        </nav>

        <div className="mt-auto px-2 space-y-2">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={action.action}
              className="w-full flex items-center justify-center p-3 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              title={action.label}
            >
              <action.icon className="w-5 h-5" />
            </button>
          ))}
        </div>

        {/* MedGemma badge */}
        <div className="mt-2 px-2">
          <div className="flex items-center justify-center p-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full status-pulse" />
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold">MedLit Agent</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
        >
          <PanelLeftClose className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Quick Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                pathname === item.href
                  ? 'bg-primary/10 text-primary shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span className={`p-1.5 rounded-lg ${
                pathname === item.href
                  ? 'bg-primary/20'
                  : 'bg-muted'
              }`}>
                <item.icon className="w-4 h-4" />
              </span>
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* New Chat Button */}
        <div className="px-3 pb-3">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white text-sm font-medium rounded-xl shadow-sm hover:shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>

        {/* Conversations Section */}
        <div className="border-t border-border">
          <button
            onClick={() => toggleSection('conversations')}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4" />
              Conversations
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${
              isExpanded('conversations') ? '' : '-rotate-90'
            }`} />
          </button>

          {isExpanded('conversations') && (
            <div className="px-2 pb-3 space-y-0.5 animate-fade-in">
              {conversations.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <Sparkles className="w-8 h-8 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">No conversations yet</p>
                </div>
              ) : (
                conversations.slice(0, 8).map(conv => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 px-3 py-2 rounded-lg transition-all cursor-pointer ${
                      currentConversation?.id === conv.id
                        ? 'bg-muted'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 text-sm text-foreground/80 truncate">
                      {conv.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="hidden group-hover:flex p-1 text-muted-foreground hover:text-destructive rounded transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Recent Searches Section */}
        <div className="border-t border-border">
          <button
            onClick={() => toggleSection('history')}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <History className="w-4 h-4" />
              Recent Searches
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${
              isExpanded('history') ? '' : '-rotate-90'
            }`} />
          </button>

          {isExpanded('history') && (
            <div className="px-2 pb-3 space-y-0.5 animate-fade-in">
              {history.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground text-center">No recent searches</p>
              ) : (
                <>
                  {history.slice(0, 5).map(item => (
                    <button
                      key={item.id}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors text-left"
                    >
                      <Search className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="flex-1 truncate">{item.query}</span>
                      <span className="text-xs tabular-nums">{item.resultCount}</span>
                    </button>
                  ))}
                  <button
                    onClick={clearHistory}
                    className="w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-destructive text-left transition-colors"
                  >
                    Clear history
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Bookmarks Section */}
        <div className="border-t border-border">
          <button
            onClick={() => toggleSection('bookmarks')}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Bookmark className="w-4 h-4" />
              Bookmarks
            </span>
            <ChevronDown className={`w-4 h-4 transition-transform ${
              isExpanded('bookmarks') ? '' : '-rotate-90'
            }`} />
          </button>

          {isExpanded('bookmarks') && (
            <div className="px-2 pb-3 space-y-0.5 animate-fade-in">
              {bookmarks.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground text-center">No bookmarks yet</p>
              ) : (
                bookmarks.slice(0, 8).map(bookmark => (
                  <Link
                    key={bookmark.id}
                    href={`/${bookmark.entityType}/${bookmark.entityId}`}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 rounded-lg transition-colors"
                  >
                    {bookmark.entityType === 'paper' && <FileText className="w-3.5 h-3.5 text-blue-500" />}
                    {bookmark.entityType === 'claim' && <Lightbulb className="w-3.5 h-3.5 text-purple-500" />}
                    {bookmark.entityType === 'technique' && <Beaker className="w-3.5 h-3.5 text-cyan-500" />}
                    <span className="flex-1 truncate">{bookmark.title}</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer — Powered by MedGemma */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl">
          <div className="w-2 h-2 bg-emerald-500 rounded-full status-pulse" />
          <span className="text-xs font-medium text-primary">Powered by MedGemma</span>
        </div>
      </div>
    </aside>
  );
}
