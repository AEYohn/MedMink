'use client';

import { useRole } from '@/contexts/RoleContext';
import { ClinicianDashboard } from '@/components/dashboard/ClinicianDashboard';
import { EMSDashboard } from '@/components/dashboard/EMSDashboard';

export default function DashboardPage() {
  const { role } = useRole();

  return role === 'ems' ? <EMSDashboard /> : <ClinicianDashboard />;
}
