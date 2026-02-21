'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Settings,
  Bell,
  Command,
  ChevronDown,
  X,
  Eye,
  MessageCircle,
  Menu,
  ArrowLeftRight,
} from 'lucide-react';
import { useReferralNotifications } from '@/hooks/useReferralNotifications';
import { useRole } from '@/contexts/RoleContext';

interface HeaderProps {
  onOpenCommandPalette: () => void;
  onMobileMenuToggle?: () => void;
}

export function Header({ onOpenCommandPalette, onMobileMenuToggle }: HeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { notifications, unreadCount, markAsRead } = useReferralNotifications();
  const { roleConfig, clearRole } = useRole();

  // Close notifications on outside click — no viewport-blocking overlay
  useEffect(() => {
    if (!notificationsOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [notificationsOpen]);

  const handleNotificationClick = (notificationId: string, referralId: string) => {
    markAsRead(notificationId);
    setNotificationsOpen(false);
    router.push(`/referrals/${referralId}`);
  };

  return (
    <header className="h-14 bg-card/80 backdrop-blur-xl border-b border-border flex items-center px-4 lg:px-5 gap-3 sticky top-0 z-40">
      {/* Mobile hamburger */}
      {onMobileMenuToggle && (
        <button
          onClick={onMobileMenuToggle}
          className="md:hidden p-2 -ml-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
        <div className="relative">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="w-[18px] h-[18px] text-primary-foreground" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3C7.5 3 5 4.5 5 7c0 1.5.5 2.5 1 3-1.5 1-3 3-3 6 0 3 2 5 5 5 1.5 0 3-.5 4-2 1 1.5 2.5 2 4 2 3 0 5-2 5-5 0-3-1.5-5-3-6 .5-.5 1-1.5 1-3 0-2.5-2.5-4-4-4-1 0-2 .5-3 1.5C11 3.5 10 3 9 3z"/>
              <circle cx="9" cy="7.5" r="0.8" fill="currentColor" stroke="none"/>
              <circle cx="15" cy="7.5" r="0.8" fill="currentColor" stroke="none"/>
              <path d="M10.5 10c.5.5 2.5.5 3 0"/>
            </svg>
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-card status-pulse" />
        </div>
        <div className="hidden lg:block">
          <h1 className="text-sm font-semibold tracking-tight">
            <span className="text-foreground">Med</span><span className="text-primary">Mink</span>
          </h1>
          <p className="text-2xs text-muted-foreground -mt-0.5 tracking-wide uppercase">Clinical Intelligence</p>
        </div>
      </Link>

      {/* Role Badge */}
      {roleConfig && (
        <span className="hidden lg:inline-flex px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wider">
          {roleConfig.label}
        </span>
      )}

      {/* Command Bar */}
      <button
        onClick={onOpenCommandPalette}
        className="flex-1 max-w-lg mx-3 flex items-center gap-2.5 px-3.5 py-2 bg-muted/60 hover:bg-muted rounded-lg border border-transparent hover:border-border transition-all group"
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
        <span className="flex-1 text-left text-sm text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
          Search patients, cases, commands...
        </span>
        <div className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 bg-background/80 rounded text-muted-foreground/50">
          <Command className="w-3 h-3" />
          <span className="text-[10px] font-mono font-medium">K</span>
        </div>
      </button>

      {/* Right Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Notifications */}
        <div className="relative" ref={notificationRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-80 max-w-[calc(100vw-2rem)] bg-card rounded-xl shadow-lg border border-border overflow-hidden z-50 animate-slide-down">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <h3 className="text-sm font-semibold">Notifications</h3>
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-6 h-6 mx-auto text-muted-foreground/30 mb-2" />
                  <p className="text-xs text-muted-foreground">All caught up</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  {notifications.slice(0, 10).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n.id, n.referral_id)}
                      className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border last:border-0 ${
                        !n.read ? 'bg-primary/5' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          n.type === 'viewed'
                            ? 'bg-purple-100 text-purple-600'
                            : 'bg-green-100 text-green-600'
                        }`}>
                          {n.type === 'viewed' ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <MessageCircle className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs ${!n.read ? 'font-semibold' : ''}`}>
                            {n.message}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(n.created_at).toLocaleString()}
                          </p>
                        </div>
                        {!n.read && (
                          <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Settings */}
        <Link
          href="/settings"
          className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
        >
          <Settings className="w-4 h-4" />
        </Link>

        {/* Switch Role */}
        <button
          onClick={clearRole}
          className="flex items-center gap-1.5 p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          title="Switch Role"
        >
          <ArrowLeftRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
