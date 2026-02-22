'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface PatientViewContextValue {
  patientId: string | null;
  setPatientId: (id: string | null) => void;
}

const PatientViewContext = createContext<PatientViewContextValue>({
  patientId: null,
  setPatientId: () => {},
});

const STORAGE_KEY = 'care-hub-patient-id';

export function PatientViewProvider({ children }: { children: ReactNode }) {
  const [patientId, setPatientIdState] = useState<string | null>(null);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setPatientIdState(stored);
  }, []);

  const setPatientId = (id: string | null) => {
    setPatientIdState(id);
    if (id) {
      localStorage.setItem(STORAGE_KEY, id);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <PatientViewContext.Provider value={{ patientId, setPatientId }}>
      {children}
    </PatientViewContext.Provider>
  );
}

export function usePatientView() {
  return useContext(PatientViewContext);
}
