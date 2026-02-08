'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Search,
  Settings,
  Bell,
  Command,
  Zap,
  ChevronDown,
} from 'lucide-react';

interface HeaderProps {
  onOpenCommandPalette: () => void;
}

export function Header({ onOpenCommandPalette }: HeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <header className="h-16 glass border-b border-surface-200/50 dark:border-surface-700/50 flex items-center px-4 lg:px-6 gap-4 sticky top-0 z-40">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 flex-shrink-0 group">
        <div className="relative">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shadow-lg shadow-brand-500/25 group-hover:shadow-brand-500/40 transition-shadow">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-surface-900 status-pulse" />
        </div>
        <div className="hidden lg:block">
          <h1 className="text-lg font-bold text-surface-900 dark:text-white tracking-tight">
            Research<span className="text-brand-500">Synth</span>
          </h1>
          <p className="text-2xs text-surface-500 -mt-0.5">AI-Powered Research Analysis</p>
        </div>
      </Link>

      {/* Command Bar */}
      <button
        onClick={onOpenCommandPalette}
        className="flex-1 max-w-xl mx-4 flex items-center gap-3 px-4 py-2.5 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-xl border border-surface-200 dark:border-surface-700 transition-all group"
      >
        <Search className="w-4 h-4 text-surface-400 group-hover:text-surface-600 dark:group-hover:text-surface-300 transition-colors" />
        <span className="flex-1 text-left text-sm text-surface-400 group-hover:text-surface-600 dark:group-hover:text-surface-300 transition-colors">
          Search papers, claims, or ask a question...
        </span>
        <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-surface-200 dark:bg-surface-700 rounded-md">
          <Command className="w-3 h-3 text-surface-500" />
          <span className="text-xs text-surface-500 font-medium">K</span>
        </div>
      </button>

      {/* Right Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2.5 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors"
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-brand-500 rounded-full" />
          </button>

          {notificationsOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setNotificationsOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 overflow-hidden z-20 animate-scale-in origin-top-right">
                <div className="px-4 py-3 border-b border-surface-200 dark:border-surface-700">
                  <h3 className="font-semibold text-surface-900 dark:text-white">Notifications</h3>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  <div className="px-4 py-8 text-center">
                    <Bell className="w-8 h-8 mx-auto text-surface-300 dark:text-surface-600 mb-2" />
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      No new notifications
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Settings */}
        <Link
          href="/settings"
          className="p-2.5 text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors"
        >
          <Settings className="w-5 h-5" />
        </Link>

        {/* User Avatar */}
        <button className="flex items-center gap-2 p-1.5 pl-1.5 pr-3 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-400 to-accent-500 flex items-center justify-center text-white text-sm font-medium shadow-sm">
            R
          </div>
          <ChevronDown className="w-4 h-4 text-surface-400" />
        </button>
      </div>
    </header>
  );
}
