'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Heart,
  Menu,
  X,
  ArrowLeftRight,
  User,
} from 'lucide-react';
import { HealthContextProvider } from '@/components/patient/HealthContextProvider';
import { MedicalTermProvider } from '@/components/patient/terms/MedicalTermProvider';
import { RoleGate } from '@/components/shared/RoleGate';
import { useRole } from '@/contexts/RoleContext';
import { PatientViewProvider, usePatientView } from '@/contexts/PatientViewContext';
import { getPatients } from '@/lib/patient-storage';
import type { Patient } from '@/lib/patient-storage';

interface PatientLayoutProps {
  children: ReactNode;
}

function PatientSelector() {
  const { patientId, setPatientId } = usePatientView();
  const [patients, setPatients] = useState<Patient[]>([]);

  useEffect(() => {
    setPatients(getPatients());
  }, []);

  if (patients.length === 0) return null;

  return (
    <div className="hidden sm:flex items-center gap-1.5">
      <User className="w-4 h-4 text-muted-foreground" />
      <select
        value={patientId || ''}
        onChange={(e) => setPatientId(e.target.value || null)}
        className="text-sm bg-transparent border border-border rounded-md px-2 py-1 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <option value="">All patients</option>
        {patients.map((p) => (
          <option key={p.id} value={p.id}>
            {p.firstName} {p.lastName}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function PatientLayout({ children }: PatientLayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { clearRole } = useRole();

  return (
    <RoleGate allowedRoles={['patient']}>
    <PatientViewProvider>
    <HealthContextProvider>
      <MedicalTermProvider>
        <div className="min-h-screen bg-background">
          {/* Top Navigation */}
          <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                {/* Logo */}
                <Link href="/patient" className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-primary to-brand-600 rounded-xl">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-foreground">
                      MedMink Care Hub
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      Your health companion
                    </p>
                  </div>
                </Link>

                {/* Right side */}
                <div className="flex items-center gap-3">
                  <PatientSelector />
                  <button
                    onClick={clearRole}
                    className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    Switch Role
                  </button>

                  {/* Mobile menu button */}
                  <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="sm:hidden p-2 text-muted-foreground hover:text-foreground"
                  >
                    {isMobileMenuOpen ? (
                      <X className="w-6 h-6" />
                    ) : (
                      <Menu className="w-6 h-6" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Mobile Menu */}
            {isMobileMenuOpen && (
              <div className="sm:hidden border-t border-border bg-card">
                <nav className="px-4 py-3 space-y-1">
                  <button
                    onClick={() => { clearRole(); setIsMobileMenuOpen(false); }}
                    className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted transition-colors"
                  >
                    <div className="p-2 rounded-lg bg-muted">
                      <ArrowLeftRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="font-medium text-foreground">Switch Role</p>
                  </button>
                </nav>
              </div>
            )}
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {children}
          </main>

          {/* Footer */}
          <footer className="mt-auto border-t border-border py-4">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <p className="text-center text-xs text-muted-foreground">
                This is not a substitute for professional medical advice. Always consult with a healthcare provider.
              </p>
            </div>
          </footer>
        </div>
      </MedicalTermProvider>
    </HealthContextProvider>
    </PatientViewProvider>
    </RoleGate>
  );
}
