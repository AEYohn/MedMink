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
  X,
  Sparkles,
  Search,
  Stethoscope,
  Camera,
  ClipboardList,
  Users,
  FolderOpen,
  Send,
  Siren,
} from 'lucide-react';
import { useSearch } from '@/contexts/SearchContext';
import { useChat } from '@/contexts/ChatContext';
import { useActivePatient } from '@/contexts/ActivePatientContext';
import { usePersistentState } from '@/hooks/usePersistentState';
import { getBookmarks, Bookmark as BookmarkType } from '@/lib/storage';
import { PatientBanner } from '@/components/shared/PatientBanner';
import { useReferralNotifications } from '@/hooks/useReferralNotifications';

interface SidebarProps {
  isCollapsed?: boolean;
  onToggle?: () => void;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isCollapsed, onToggle, isMobile, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { history, clearHistory } = useSearch();
  const { conversations, currentConversation, startNewConversation, loadConversation, deleteConversation } = useChat();
  const { patientId, patient } = useActivePatient();
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

  const { unreadCount: referralUnreadCount } = useReferralNotifications();

  // Mobile mode: render nothing when closed
  if (isMobile && !isOpen) return null;

  const mainNav = [
    { href: '/', icon: Home, label: 'Home' },
    { href: '/patients', icon: Users, label: 'Patients' },
    { href: '/cases', icon: FolderOpen, label: 'Cases' },
    { href: '/referrals', icon: Send, label: 'Referrals', badge: referralUnreadCount },
    { href: '/documents', icon: FileText, label: 'Documents' },
  ];

  const toolsNav = [
    { href: '/case', icon: Stethoscope, label: 'Case Analysis' },
    { href: '/interview', icon: ClipboardList, label: 'Interview' },
    { href: '/chart', icon: FileText, label: 'Charting' },
    { href: '/ems', icon: Siren, label: 'EMS Report' },
  ];

  if (isCollapsed && !isMobile) {
    const toolHref = (href: string) => patientId ? `${href}?patient=${patientId}` : href;
    const isToolLink = (href: string) => toolsNav.some(t => t.href === href);

    return (
      <aside className="w-14 bg-card/50 border-r border-border flex flex-col py-3">
        <button
          onClick={onToggle}
          className="mx-auto p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-all"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {patient && (
          <Link
            href={`/patients/${patient.id}`}
            className="mx-auto mt-3 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary hover:bg-primary/20 transition-colors"
            title={`${patient.firstName} ${patient.lastName}`}
          >
            {patient.firstName[0]}{patient.lastName[0]}
          </Link>
        )}

        <nav className="mt-4 space-y-1 px-2">
          {[...mainNav, ...toolsNav].map(item => (
            <Link
              key={item.href}
              href={isToolLink(item.href) ? toolHref(item.href) : item.href}
              className={`relative flex items-center justify-center p-2.5 rounded-lg transition-all ${
                pathname === item.href
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
              title={item.label}
            >
              <item.icon className="w-4 h-4" />
              {'badge' in item && (item as { badge?: number }).badge ? (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center">
                  {(item as { badge?: number }).badge! > 9 ? '9+' : (item as { badge?: number }).badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <div className="mt-auto px-2 space-y-1">
          <button
            onClick={startNewConversation}
            className="w-full flex items-center justify-center p-2.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            title="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-2 px-2">
          <div className="flex items-center justify-center p-1.5">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full status-pulse" />
          </div>
        </div>
      </aside>
    );
  }

  const handleNavClick = () => {
    if (isMobile && onClose) onClose();
  };

  const sidebarContent = (
    <aside className={isMobile ? 'w-72 bg-card h-full flex flex-col overflow-hidden' : 'w-60 h-full bg-card/50 border-r border-border flex flex-col overflow-hidden'}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Navigation</span>
        <button
          onClick={isMobile ? onClose : onToggle}
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-all"
        >
          {isMobile ? <X className="w-3.5 h-3.5" /> : <PanelLeftClose className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Main Navigation */}
        <nav className="p-2 space-y-0.5">
          {mainNav.map(item => (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-[13px] ${
                pathname === item.href
                  ? 'bg-primary/8 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <item.icon className={`w-4 h-4 ${pathname === item.href ? 'text-primary' : ''}`} />
              <span className="flex-1">{item.label}</span>
              {'badge' in item && (item as { badge?: number }).badge ? (
                <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                  {(item as { badge?: number }).badge! > 9 ? '9+' : (item as { badge?: number }).badge}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        {/* Tools Section */}
        <div className="px-2 pt-1 pb-2">
          <PatientBanner showClear className="mb-2" />
          <p className="px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Tools</p>
          <div className="space-y-0.5">
            {toolsNav.map(item => (
              <Link
                key={item.href}
                href={patientId ? `${item.href}?patient=${patientId}` : item.href}
                onClick={handleNavClick}
                className={`relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all text-[13px] ${
                  pathname === item.href
                    ? 'bg-primary/8 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className={`w-4 h-4 ${pathname === item.href ? 'text-primary' : ''}`} />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* New Chat Button */}
        <div className="px-3 pb-3">
          <button
            onClick={() => { startNewConversation(); handleNavClick(); }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/15 text-primary text-[13px] font-medium rounded-lg transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>

        {/* Conversations Section */}
        <div className="border-t border-border">
          <button
            onClick={() => toggleSection('conversations')}
            className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <MessageCircle className="w-3.5 h-3.5" />
              Conversations
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${
              isExpanded('conversations') ? '' : '-rotate-90'
            }`} />
          </button>

          {isExpanded('conversations') && (
            <div className="px-2 pb-2 space-y-0.5 animate-fade-in">
              {conversations.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <Sparkles className="w-6 h-6 mx-auto text-muted-foreground/20 mb-1.5" />
                  <p className="text-[11px] text-muted-foreground/60">No conversations yet</p>
                </div>
              ) : (
                conversations.slice(0, 8).map(conv => (
                  <div
                    key={conv.id}
                    className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all cursor-pointer ${
                      currentConversation?.id === conv.id
                        ? 'bg-muted'
                        : 'hover:bg-muted/50'
                    }`}
                    onClick={() => { loadConversation(conv.id); handleNavClick(); }}
                  >
                    <MessageCircle className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
                    <span className="flex-1 text-[12px] text-foreground/70 truncate">
                      {conv.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="hidden group-hover:flex p-0.5 text-muted-foreground hover:text-destructive rounded transition-colors"
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
            className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <History className="w-3.5 h-3.5" />
              Recent
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${
              isExpanded('history') ? '' : '-rotate-90'
            }`} />
          </button>

          {isExpanded('history') && (
            <div className="px-2 pb-2 space-y-0.5 animate-fade-in">
              {history.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-muted-foreground/60 text-center">No recent searches</p>
              ) : (
                <>
                  {history.slice(0, 5).map(item => (
                    <button
                      key={item.id}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-muted-foreground hover:bg-muted/50 rounded-md transition-colors text-left"
                    >
                      <Search className="w-3 h-3 flex-shrink-0 opacity-50" />
                      <span className="flex-1 truncate">{item.query}</span>
                      <span className="text-[10px] font-mono tabular-nums opacity-40">{item.resultCount}</span>
                    </button>
                  ))}
                  <button
                    onClick={clearHistory}
                    className="w-full px-2.5 py-1 text-[11px] text-muted-foreground/60 hover:text-destructive text-left transition-colors"
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
            className="w-full flex items-center justify-between px-4 py-2.5 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest hover:bg-muted/50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Bookmark className="w-3.5 h-3.5" />
              Bookmarks
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${
              isExpanded('bookmarks') ? '' : '-rotate-90'
            }`} />
          </button>

          {isExpanded('bookmarks') && (
            <div className="px-2 pb-2 space-y-0.5 animate-fade-in">
              {bookmarks.length === 0 ? (
                <p className="px-3 py-2 text-[11px] text-muted-foreground/60 text-center">No bookmarks</p>
              ) : (
                bookmarks.slice(0, 8).map(bookmark => (
                  <Link
                    key={bookmark.id}
                    href={`/${bookmark.entityType}/${bookmark.entityId}`}
                    onClick={handleNavClick}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-muted-foreground hover:bg-muted/50 rounded-md transition-colors"
                  >
                    {bookmark.entityType === 'paper' && <FileText className="w-3 h-3 text-chart-1" />}
                    {bookmark.entityType === 'claim' && <Lightbulb className="w-3 h-3 text-chart-4" />}
                    {bookmark.entityType === 'technique' && <Beaker className="w-3 h-3 text-chart-2" />}
                    <span className="flex-1 truncate">{bookmark.title}</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-2.5 border-t border-border">
        <div className="flex items-center gap-2 px-2.5 py-1.5">
          <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full status-pulse" />
          <span className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-wider">MedGemma Online</span>
        </div>
      </div>
    </aside>
  );

  // Mobile: render as fixed overlay with backdrop
  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
        />
        {/* Drawer */}
        <div className="relative z-10 h-full">
          {sidebarContent}
        </div>
      </div>
    );
  }

  return sidebarContent;
}
