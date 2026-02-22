'use client';

import { X, AlertTriangle, Activity, Pill } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getPatientDisplayName, getPatientAge } from '@/lib/patient-storage';
import type { Patient } from '@/lib/patient-storage';

interface PatientContextCardProps {
  patient: Patient;
  onUnlink: () => void;
}

export function PatientContextCard({ patient, onUnlink }: PatientContextCardProps) {
  const displayName = getPatientDisplayName(patient);
  const age = getPatientAge(patient);
  const sexLabel = patient.sex === 'male' ? 'M' : patient.sex === 'female' ? 'F' : 'O';
  const initials = `${patient.firstName[0]}${patient.lastName[0]}`;

  return (
    <div className="rounded-lg border bg-card text-card-foreground mb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
            {initials}
          </span>
          <div>
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-[11px] text-muted-foreground">
              {age}y {sexLabel}
              {patient.mrn && (
                <>
                  {' '}&middot;{' '}
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                    MRN: {patient.mrn}
                  </Badge>
                </>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={onUnlink}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="Unlink patient"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Medical context grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-border">
        {/* Allergies */}
        <div className="bg-card px-4 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
              Allergies
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {patient.allergies.length > 0
              ? patient.allergies.join(', ')
              : 'None recorded'}
          </p>
        </div>

        {/* Conditions */}
        <div className="bg-card px-4 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              Conditions
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {patient.conditions.length > 0
              ? patient.conditions.join(', ')
              : 'None recorded'}
          </p>
        </div>

        {/* Medications */}
        <div className="bg-card px-4 py-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Pill className="w-3.5 h-3.5 text-green-500" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
              Medications
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {patient.medications.length > 0
              ? patient.medications.join(', ')
              : 'None recorded'}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-1.5 border-t">
        <p className="text-[10px] text-muted-foreground italic">
          Patient context will be included in the analysis
        </p>
      </div>
    </div>
  );
}
