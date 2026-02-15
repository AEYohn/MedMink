'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { usePersistentState } from '@/hooks/usePersistentState';
import { Patient, getPatient, getPatientDisplayName, getPatientAge } from '@/lib/patient-storage';

interface ActivePatientContextValue {
  patientId: string | null;
  patient: Patient | null;
  displayName: string | null;
  age: number | null;
  setActivePatient: (id: string) => void;
  clearActivePatient: () => void;
}

const ActivePatientContext = createContext<ActivePatientContextValue>({
  patientId: null,
  patient: null,
  displayName: null,
  age: null,
  setActivePatient: () => {},
  clearActivePatient: () => {},
});

export function ActivePatientProvider({ children }: { children: ReactNode }) {
  const [patientId, setPatientId] = usePersistentState<string | null>('active-patient-id', null);
  const [patient, setPatient] = useState<Patient | null>(null);

  // Resolve full patient object when patientId changes
  useEffect(() => {
    if (!patientId) {
      setPatient(null);
      return;
    }
    const p = getPatient(patientId);
    if (p) {
      setPatient(p);
    } else {
      // Patient was deleted — auto-clear
      setPatientId(null);
      setPatient(null);
    }
  }, [patientId, setPatientId]);

  const setActivePatient = useCallback((id: string) => {
    setPatientId(id);
  }, [setPatientId]);

  const clearActivePatient = useCallback(() => {
    setPatientId(null);
  }, [setPatientId]);

  const displayName = patient ? getPatientDisplayName(patient) : null;
  const age = patient ? getPatientAge(patient) : null;

  return (
    <ActivePatientContext.Provider value={{ patientId, patient, displayName, age, setActivePatient, clearActivePatient }}>
      {children}
    </ActivePatientContext.Provider>
  );
}

export function useActivePatient() {
  return useContext(ActivePatientContext);
}
