'use client';

import { useState } from 'react';
import { Pill } from 'lucide-react';

interface QuickMedicationEntryProps {
  onSubmit: (med: { medication: string; dose: string; route: string }) => void;
  isSubmitting?: boolean;
}

const COMMON_MEDS = [
  'Aspirin', 'Nitroglycerin', 'Epinephrine', 'Naloxone',
  'Albuterol', 'Fentanyl', 'Morphine', 'Ondansetron',
  'Diphenhydramine', 'Dextrose', 'Normal Saline', 'Amiodarone',
];

const ROUTES = ['PO', 'IV', 'IM', 'IN', 'IO', 'SL', 'Neb', 'ET'];

export function QuickMedicationEntry({ onSubmit, isSubmitting }: QuickMedicationEntryProps) {
  const [medication, setMedication] = useState('');
  const [dose, setDose] = useState('');
  const [route, setRoute] = useState('');

  const handleSubmit = () => {
    if (!medication) return;
    onSubmit({ medication, dose, route });
    setMedication('');
    setDose('');
    setRoute('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Pill className="w-4 h-4 text-primary" />
        <span>Medications</span>
      </div>

      {/* Quick-pick medication */}
      <div className="flex flex-wrap gap-1.5">
        {COMMON_MEDS.map(med => (
          <button
            key={med}
            onClick={() => setMedication(med)}
            className={`px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
              medication === med
                ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                : 'bg-muted/50 text-foreground hover:bg-muted'
            }`}
          >
            {med}
          </button>
        ))}
      </div>

      {/* Custom med input */}
      <input
        type="text"
        placeholder="Or type medication name..."
        value={medication}
        onChange={e => setMedication(e.target.value)}
        className="w-full h-12 px-3 text-base bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
      />

      <div className="flex gap-2">
        {/* Dose */}
        <input
          type="text"
          placeholder="Dose (e.g., 325mg)"
          value={dose}
          onChange={e => setDose(e.target.value)}
          className="flex-1 h-12 px-3 text-base bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
        />

        {/* Route picker */}
        <div className="flex gap-1">
          {ROUTES.map(r => (
            <button
              key={r}
              onClick={() => setRoute(r)}
              className={`h-12 px-2.5 text-xs font-medium rounded-lg transition-colors ${
                route === r
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={isSubmitting || !medication}
        className="w-full h-12 bg-primary text-primary-foreground rounded-lg font-medium text-base hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? 'Saving...' : 'Record Medication'}
      </button>
    </div>
  );
}
