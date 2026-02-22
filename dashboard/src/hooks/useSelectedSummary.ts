'use client';

import { useState, useEffect, useMemo } from 'react';
import { getReleasedSummaries, getReleasedSummariesForPatient } from '@/lib/storage';
import { getPatient } from '@/lib/patient-storage';
import { usePatientView } from '@/contexts/PatientViewContext';
import type { ReleasedVisitSummary } from '@/types/visit-summary';
import type { Patient } from '@/lib/patient-storage';

export interface UseSelectedSummaryReturn {
  allSummaries: ReleasedVisitSummary[];
  selectedSummary: ReleasedVisitSummary | null;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  patient: Patient | null;
}

export function useSelectedSummary(): UseSelectedSummaryReturn {
  const { patientId: viewAsPatientId } = usePatientView();
  const [allSummaries, setAllSummaries] = useState<ReleasedVisitSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const summaries = viewAsPatientId
      ? getReleasedSummariesForPatient(viewAsPatientId)
      : getReleasedSummaries().filter(s => s.status === 'released');
    setAllSummaries(summaries);
    if (summaries.length > 0) {
      setSelectedId(summaries[0].id);
    } else {
      setSelectedId(null);
    }
  }, [viewAsPatientId]);

  const selectedSummary = useMemo(
    () => allSummaries.find(s => s.id === selectedId) ?? null,
    [allSummaries, selectedId],
  );

  const patient = useMemo(() => {
    if (!selectedSummary) return null;
    return getPatient(selectedSummary.patientId) ?? (viewAsPatientId ? getPatient(viewAsPatientId) : null);
  }, [selectedSummary, viewAsPatientId]);

  return { allSummaries, selectedSummary, selectedId, setSelectedId, patient };
}
