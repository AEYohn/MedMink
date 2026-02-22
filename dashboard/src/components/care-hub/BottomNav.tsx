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
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-card border-t border-border h-16 flex items-center justify-around px-2 safe-area-bottom">
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
                  active ? 'bg-primary shadow-sm' : 'bg-primary/80'
                }`}>
                  <Icon className="w-5 h-5 text-primary-foreground" />
                </div>
              ) : (
                <Icon className={`w-5 h-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
              )}
              <span className={`text-[10px] leading-tight ${
                active ? 'text-primary font-medium' : 'text-muted-foreground'
              } ${item.accent ? '-mt-0.5' : ''}`}>
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Desktop/tablet horizontal sub-nav */}
      <nav className="hidden sm:flex items-center gap-1 p-1 rounded-2xl bg-muted border border-border mx-auto max-w-xl">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                active
                  ? item.accent ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-card text-foreground shadow-sm'
                  : item.accent ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-card/60'
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
