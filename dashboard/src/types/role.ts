export type UserRole = 'clinician' | 'patient' | 'ems';

export interface RoleConfig {
  label: string;
  description: string;
  iconName: string;
  gradientFrom: string;
  gradientTo: string;
  homePath: string;
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  clinician: {
    label: 'Clinician',
    description: 'Case analysis, patient management, and clinical tools',
    iconName: 'Stethoscope',
    gradientFrom: 'from-teal-500',
    gradientTo: 'to-emerald-500',
    homePath: '/',
  },
  patient: {
    label: 'Patient',
    description: 'Visit summaries, health companion, and medications',
    iconName: 'Heart',
    gradientFrom: 'from-rose-500',
    gradientTo: 'to-pink-500',
    homePath: '/patient',
  },
  ems: {
    label: 'EMS',
    description: 'Emergency reports and patient triage',
    iconName: 'Siren',
    gradientFrom: 'from-amber-500',
    gradientTo: 'to-orange-500',
    homePath: '/',
  },
};
