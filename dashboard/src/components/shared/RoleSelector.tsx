'use client';

import { useRouter } from 'next/navigation';
import { Stethoscope, Heart, Siren } from 'lucide-react';
import { useRole } from '@/contexts/RoleContext';
import { UserRole, ROLE_CONFIGS } from '@/types/role';
import Link from 'next/link';

const ROLE_ICONS: Record<UserRole, React.ComponentType<{ className?: string }>> = {
  clinician: Stethoscope,
  patient: Heart,
  ems: Siren,
};

const ROLE_ORDER: UserRole[] = ['clinician', 'patient', 'ems'];

export function RoleSelector() {
  const { setRole } = useRole();
  const router = useRouter();

  const handleSelect = (role: UserRole) => {
    setRole(role);
    router.push(ROLE_CONFIGS[role].homePath);
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div className="relative">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-primary-foreground" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3C7.5 3 5 4.5 5 7c0 1.5.5 2.5 1 3-1.5 1-3 3-3 6 0 3 2 5 5 5 1.5 0 3-.5 4-2 1 1.5 2.5 2 4 2 3 0 5-2 5-5 0-3-1.5-5-3-6 .5-.5 1-1.5 1-3 0-2.5-2.5-4-4-4-1 0-2 .5-3 1.5C11 3.5 10 3 9 3z"/>
              <circle cx="9" cy="7.5" r="0.8" fill="currentColor" stroke="none"/>
              <circle cx="15" cy="7.5" r="0.8" fill="currentColor" stroke="none"/>
              <path d="M10.5 10c.5.5 2.5.5 3 0"/>
            </svg>
          </div>
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            <span className="text-foreground">Med</span><span className="text-primary">Mink</span>
          </h1>
          <p className="text-2xs text-muted-foreground tracking-wide uppercase">Clinical Intelligence</p>
        </div>
      </div>

      {/* Title */}
      <h2 className="text-2xl font-display font-semibold text-foreground mb-2">Welcome</h2>
      <p className="text-sm text-muted-foreground mb-8">Select your role to continue</p>

      {/* Role Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl w-full animate-stagger">
        {ROLE_ORDER.map((role) => {
          const config = ROLE_CONFIGS[role];
          const Icon = ROLE_ICONS[role];

          return (
            <button
              key={role}
              onClick={() => handleSelect(role)}
              className="group relative rounded-2xl border border-border bg-card overflow-clip hover:border-primary/30 hover:shadow-lg transition-all text-left"
            >
              {/* Gradient accent */}
              <div className={`h-1.5 bg-gradient-to-r ${config.gradientFrom} ${config.gradientTo}`} />

              <div className="p-6">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${config.gradientFrom} ${config.gradientTo} flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
                  {config.label}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {config.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Demo seed link */}
      <Link
        href="/demo/seed"
        className="mt-8 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors underline underline-offset-2"
      >
        Seed Demo Data
      </Link>
    </div>
  );
}
