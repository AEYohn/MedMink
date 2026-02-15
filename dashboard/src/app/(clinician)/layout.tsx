import { AppShell } from '@/components/layout/AppShell';
import { ReactNode } from 'react';

export default function ClinicianLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
