'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { Heart, ArrowLeftRight } from 'lucide-react';
import { HealthContextProvider } from '@/components/patient/HealthContextProvider';
import { MedicalTermProvider } from '@/components/patient/terms/MedicalTermProvider';
import { RoleGate } from '@/components/shared/RoleGate';
import { useRole } from '@/contexts/RoleContext';
import { PatientViewProvider } from '@/contexts/PatientViewContext';
import { SelectedSummaryProvider } from '@/contexts/SelectedSummaryContext';
import { PostVisitProvider } from '@/contexts/PostVisitContext';
import { BottomNav } from '@/components/care-hub/BottomNav';
import { LanguageProvider, useTranslation } from '@/i18n';
import { LanguageSelector } from '@/components/patient/LanguageSelector';

function PatientShell({ children }: { children: ReactNode }) {
  const { clearRole } = useRole();
  const { t, dir } = useTranslation();

  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground">
      {/* Header — matches clinician AppShell header */}
      <header className="sticky top-0 z-40 h-14 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-full">
          <div className="flex items-center justify-between h-full">
            <Link href="/patient" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
                <Heart className="w-4.5 h-4.5 text-primary-foreground" />
              </div>
              <span className="text-base font-bold text-foreground">
                MedMink
              </span>
            </Link>

            <div className="flex items-center gap-3">
              <LanguageSelector />
              <button
                onClick={clearRole}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span className="hidden sm:inline">{t('header.switchRole')}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation — BottomNav renders both mobile (fixed bottom) and desktop (inline) variants */}
      <div className="hidden sm:flex justify-center pt-3 px-4">
        <BottomNav />
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-6 animate-fade-in">
        {children}
      </main>

      {/* Footer disclaimer */}
      <footer className="py-4 px-4 pb-20 sm:pb-4">
        <p className="text-center text-xs text-muted-foreground">
          {t('footer.disclaimer')}
        </p>
      </footer>

      {/* Mobile bottom nav (fixed, rendered separately from desktop) */}
      <div className="sm:hidden">
        <BottomNav />
      </div>
    </div>
  );
}

export default function PatientLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate allowedRoles={['patient']}>
    <LanguageProvider>
    <PatientViewProvider>
    <HealthContextProvider>
      <MedicalTermProvider>
        <SelectedSummaryProvider>
        <PostVisitProvider>
        <PatientShell>
          {children}
        </PatientShell>
        </PostVisitProvider>
        </SelectedSummaryProvider>
      </MedicalTermProvider>
    </HealthContextProvider>
    </PatientViewProvider>
    </LanguageProvider>
    </RoleGate>
  );
}
