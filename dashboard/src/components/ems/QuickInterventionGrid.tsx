'use client';

import { useState } from 'react';
import { Wrench } from 'lucide-react';

interface QuickInterventionGridProps {
  onSubmit: (intervention: { procedure: string; details: string }) => void;
  isSubmitting?: boolean;
}

const COMMON_INTERVENTIONS = [
  { label: 'IV Access', procedure: 'IV access', icon: '💉' },
  { label: 'IO Access', procedure: 'IO access', icon: '🦴' },
  { label: 'Intubation', procedure: 'Endotracheal intubation', icon: '🫁' },
  { label: 'BVM', procedure: 'BVM ventilation', icon: '🎈' },
  { label: 'NRB O2', procedure: 'Non-rebreather mask O2', icon: '😷' },
  { label: 'NC O2', procedure: 'Nasal cannula O2', icon: '💨' },
  { label: 'CPAP', procedure: 'CPAP', icon: '🫁' },
  { label: 'Splint', procedure: 'Splint applied', icon: '🩹' },
  { label: 'C-Collar', procedure: 'Cervical collar applied', icon: '🔒' },
  { label: 'Backboard', procedure: 'Spinal immobilization', icon: '🛏' },
  { label: '12-Lead', procedure: '12-lead ECG', icon: '📊' },
  { label: 'Defib', procedure: 'Defibrillation', icon: '⚡' },
  { label: 'CPR', procedure: 'CPR initiated', icon: '❤️' },
  { label: 'Suction', procedure: 'Oropharyngeal suctioning', icon: '🔧' },
  { label: 'Tourniquet', procedure: 'Tourniquet applied', icon: '🩸' },
  { label: 'Wound Care', procedure: 'Wound care/bandaging', icon: '🩹' },
];

export function QuickInterventionGrid({ onSubmit, isSubmitting }: QuickInterventionGridProps) {
  const [details, setDetails] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const handleTap = (procedure: string) => {
    if (selected === procedure) {
      // Double-tap = submit immediately
      onSubmit({ procedure, details });
      setSelected(null);
      setDetails('');
    } else {
      setSelected(procedure);
    }
  };

  const handleSubmit = () => {
    if (!selected) return;
    onSubmit({ procedure: selected, details });
    setSelected(null);
    setDetails('');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Wrench className="w-4 h-4 text-primary" />
        <span>Interventions</span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {COMMON_INTERVENTIONS.map(item => (
          <button
            key={item.procedure}
            onClick={() => handleTap(item.procedure)}
            disabled={isSubmitting}
            className={`flex flex-col items-center justify-center p-2 h-16 rounded-lg text-center transition-colors ${
              selected === item.procedure
                ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                : 'bg-muted/50 text-foreground hover:bg-muted'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span className="text-[10px] font-medium mt-1 leading-tight">{item.label}</span>
          </button>
        ))}
      </div>

      {selected && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Details (optional)..."
            value={details}
            onChange={e => setDetails(e.target.value)}
            className="flex-1 h-12 px-3 text-base bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/50 outline-none"
          />
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="h-12 px-6 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}
