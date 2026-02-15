'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import { useActivePatient } from '@/contexts/ActivePatientContext';

interface PatientBannerProps {
  showClear?: boolean;
  className?: string;
}

export function PatientBanner({ showClear, className }: PatientBannerProps) {
  const { patient, displayName, age, clearActivePatient } = useActivePatient();

  if (!patient) return null;

  const initials = `${patient.firstName[0]}${patient.lastName[0]}`;
  const sexLabel = patient.sex === 'male' ? 'M' : patient.sex === 'female' ? 'F' : 'O';

  return (
    <div className={`flex items-center gap-2.5 px-2.5 py-2 bg-primary/5 border border-primary/15 rounded-lg ${className ?? ''}`}>
      <Link
        href={`/patients/${patient.id}`}
        className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0 hover:bg-primary/20 transition-colors"
      >
        {initials}
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/patients/${patient.id}`} className="text-[12px] font-medium text-foreground truncate block hover:text-primary transition-colors">
          {displayName}
        </Link>
        <p className="text-[10px] text-muted-foreground truncate">
          {age}y {sexLabel}
          {patient.mrn && <> &middot; MRN: {patient.mrn}</>}
        </p>
      </div>
      {showClear && (
        <button
          onClick={clearActivePatient}
          className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors shrink-0"
          title="Clear active patient"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
