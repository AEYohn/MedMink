'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  ClipboardCheck,
  FileText,
  HeartPulse,
  MessageCircle,
} from 'lucide-react';
import { useTranslation } from '@/i18n';

interface NavItem {
  href: string;
  labelKey: string;
  icon: typeof Home;
  accent?: boolean;
}

const navItems: NavItem[] = [
  { href: '/patient', labelKey: 'nav.home', icon: Home },
  { href: '/patient/checkin', labelKey: 'nav.checkin', icon: ClipboardCheck, accent: true },
  { href: '/patient/visit', labelKey: 'nav.visit', icon: FileText },
  { href: '/patient/health', labelKey: 'nav.health', icon: HeartPulse },
  { href: '/patient/messages', labelKey: 'nav.messages', icon: MessageCircle },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  const isActive = (href: string) => {
    if (href === '/patient') return pathname === '/patient';
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile bottom bar */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 h-16 flex items-center justify-around px-2 safe-area-bottom">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 min-w-0 px-1"
            >
              {item.accent ? (
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  active ? 'bg-teal-600' : 'bg-teal-500'
                }`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              ) : (
                <Icon className={`w-5 h-5 ${active ? 'text-teal-600' : 'text-gray-400'}`} />
              )}
              <span className={`text-[10px] leading-tight ${
                active ? 'text-teal-600 font-medium' : 'text-gray-400'
              } ${item.accent ? '-mt-0.5' : ''}`}>
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop/tablet horizontal sub-nav */}
      <nav className="hidden sm:flex items-center gap-1 p-1 rounded-2xl bg-slate-100 border border-slate-200 mx-auto max-w-xl">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                active
                  ? item.accent ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm'
                  : item.accent ? 'text-teal-600 hover:bg-teal-50' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
