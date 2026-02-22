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

export default function PatientLayout({ children }: { children: ReactNode }) {
  const { clearRole } = useRole();

  return (
    <RoleGate allowedRoles={['patient']}>
    <PatientViewProvider>
    <HealthContextProvider>
      <MedicalTermProvider>
        <SelectedSummaryProvider>
        <PostVisitProvider>
        <div className="light min-h-screen bg-gradient-to-b from-white to-slate-50 text-slate-900">
          {/* Simplified header */}
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
              <div className="flex items-center justify-between h-14">
                <Link href="/patient" className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl">
                    <Heart className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-base font-bold text-slate-900">
                    MedMink
                  </span>
                </Link>

                <button
                  onClick={clearRole}
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span className="hidden sm:inline">Switch Role</span>
                </button>
              </div>
            </div>
          </header>

          {/* Navigation — BottomNav renders both mobile (fixed bottom) and desktop (inline) variants */}
          <div className="hidden sm:flex justify-center pt-3 px-4">
            <BottomNav />
          </div>

          {/* Main Content */}
          <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-24 sm:pb-6">
            {children}
          </main>

          {/* Footer disclaimer */}
          <footer className="py-4 px-4 pb-20 sm:pb-4">
            <p className="text-center text-xs text-slate-400">
              This is not a substitute for professional medical advice. Always consult with a healthcare provider.
            </p>
          </footer>

          {/* Mobile bottom nav (fixed, rendered separately from desktop) */}
          <div className="sm:hidden">
            <BottomNav />
          </div>
        </div>
        </PostVisitProvider>
        </SelectedSummaryProvider>
      </MedicalTermProvider>
    </HealthContextProvider>
    </PatientViewProvider>
    </RoleGate>
  );
}
