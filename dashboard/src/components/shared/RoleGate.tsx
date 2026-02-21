'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '@/contexts/RoleContext';
import { UserRole, ROLE_CONFIGS } from '@/types/role';
import { RoleSelector } from './RoleSelector';

interface RoleGateProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

export function RoleGate({ allowedRoles, children }: RoleGateProps) {
  const { role, isLoaded } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && role && !allowedRoles.includes(role)) {
      router.push(ROLE_CONFIGS[role].homePath);
    }
  }, [isLoaded, role, allowedRoles, router]);

  // Not yet loaded from localStorage — show skeleton to prevent hydration flash
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center">
        <div className="w-8 h-8 rounded-lg bg-muted animate-pulse" />
      </div>
    );
  }

  // No role selected — show role selector
  if (!role) {
    return <RoleSelector />;
  }

  // Role not allowed for this layout — redirecting
  if (!allowedRoles.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
