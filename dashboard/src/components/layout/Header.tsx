'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  Settings,
  Bell,
  Command,
  Activity,
  ChevronDown,
  X,
} from 'lucide-react';

interface HeaderProps {
  onOpenCommandPalette: () => void;
}

export function Header({ onOpenCommandPalette }: HeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

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

  return (
    <header className="h-14 bg-card/80 backdrop-blur-xl border-b border-border flex items-center px-4 lg:px-5 gap-3 sticky top-0 z-40">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
        <div className="relative">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <Activity className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-card status-pulse" />
        </div>
        <div className="hidden lg:block">
          <h1 className="text-sm font-semibold tracking-tight">
            <span className="text-foreground">Med</span><span className="text-primary">Lit</span>
          </h1>
          <p className="text-2xs text-muted-foreground -mt-0.5 tracking-wide uppercase">Clinical Intelligence</p>
        </div>
      </Link>

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
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-72 bg-card rounded-xl shadow-lg border border-border overflow-hidden z-50 animate-slide-down">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <h3 className="text-sm font-semibold">Notifications</h3>
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="px-4 py-8 text-center">
                <Bell className="w-6 h-6 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">All caught up</p>
              </div>
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

        {/* User Avatar */}
        <button className="flex items-center gap-1.5 p-1 pl-1 pr-2.5 hover:bg-muted rounded-lg transition-colors ml-1">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-xs font-semibold shadow-sm">
            R
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
