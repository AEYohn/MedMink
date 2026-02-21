import { AppShell } from '@/components/layout/AppShell';
import { ActivePatientProvider } from '@/contexts/ActivePatientContext';
import { RoleGate } from '@/components/shared/RoleGate';
import { ReactNode } from 'react';

export default function ClinicianLayout({ children }: { children: ReactNode }) {
  return (
    <RoleGate allowedRoles={['clinician', 'ems']}>
      <ActivePatientProvider>
        <AppShell>{children}</AppShell>
      </ActivePatientProvider>
    </RoleGate>
  );
}
