'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { getPatient } from '@/lib/patient-storage';
import { useActivePatient } from '@/contexts/ActivePatientContext';

/**
 * Reads ?patient=<id> from the URL and activates that patient in context.
 * Call once per tool page — avoids duplicating the same URL-reading logic.
 */
export function usePatientFromUrl() {
  const searchParams = useSearchParams();
  const { setActivePatient } = useActivePatient();

  useEffect(() => {
    const id = searchParams.get('patient');
    if (id && getPatient(id)) {
      setActivePatient(id);
    }
  }, [searchParams, setActivePatient]);
}
