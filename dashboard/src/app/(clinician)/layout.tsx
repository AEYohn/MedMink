import { AppShell } from '@/components/layout/AppShell';
import { ActivePatientProvider } from '@/contexts/ActivePatientContext';
import { ReactNode } from 'react';

export default function ClinicianLayout({ children }: { children: ReactNode }) {
  return (
    <ActivePatientProvider>
      <AppShell>{children}</AppShell>
    </ActivePatientProvider>
  );
}
