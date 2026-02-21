'use client';

import { useState, FormEvent } from 'react';
import { Plus, Heart, Thermometer, Droplets, Scale, Wind, Activity } from 'lucide-react';
import type { VitalReading, VitalType } from '@/types/postvisit';
import { VITAL_REFERENCE_RANGES } from '@/types/postvisit';

const vitalOptions: { type: VitalType; label: string; icon: typeof Heart; defaultUnit: string }[] = [
  { type: 'heart_rate', label: 'Heart Rate', icon: Heart, defaultUnit: 'bpm' },
  { type: 'blood_pressure_systolic', label: 'Systolic BP', icon: Activity, defaultUnit: 'mmHg' },
  { type: 'blood_pressure_diastolic', label: 'Diastolic BP', icon: Activity, defaultUnit: 'mmHg' },
  { type: 'weight', label: 'Weight', icon: Scale, defaultUnit: 'kg' },
  { type: 'temperature', label: 'Temperature', icon: Thermometer, defaultUnit: '°C' },
  { type: 'spo2', label: 'SpO2', icon: Wind, defaultUnit: '%' },
  { type: 'blood_glucose', label: 'Blood Glucose', icon: Droplets, defaultUnit: 'mg/dL' },
];

export function VitalEntryForm({
  patientId,
  onSubmit,
}: {
  patientId: string;
  onSubmit: (reading: Omit<VitalReading, 'id'>) => Promise<void>;
}) {
  const [vitalType, setVitalType] = useState<VitalType>('heart_rate');
  const [value, setValue] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const selectedOption = vitalOptions.find(v => v.type === vitalType)!;
  const ref = VITAL_REFERENCE_RANGES[vitalType];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit({
        patientId,
        vitalType,
        value: parseFloat(value),
        unit: selectedOption.defaultUnit,
        recordedAt: new Date().toISOString(),
        source: 'manual',
        notes: notes || undefined,
      });
      setValue('');
      setNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
      <h3 className="font-semibold text-sm text-surface-900 dark:text-white mb-4 flex items-center gap-2">
        <Plus className="w-4 h-4 text-indigo-500" />
        Log a Reading
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Vital type selector */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
          {vitalOptions.map((opt) => {
            const Icon = opt.icon;
            const isActive = vitalType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                onClick={() => setVitalType(opt.type)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 ring-2 ring-indigo-500'
                    : 'bg-surface-50 dark:bg-surface-700/30 text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-700'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="truncate w-full text-center">{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Value + notes */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-xs text-surface-500 mb-1">
              Value ({selectedOption.defaultUnit})
              {ref && (
                <span className="ml-1 text-surface-400">
                  Normal: {ref.low}–{ref.high}
                </span>
              )}
            </label>
            <input
              type="number"
              step="0.1"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={ref ? `${ref.low}–${ref.high}` : 'Enter value'}
              className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-surface-500 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., after exercise"
              className="w-full px-3 py-2 bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!value || submitting}
          className="w-full px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-surface-300 dark:disabled:bg-surface-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Log Reading
            </>
          )}
        </button>
      </form>
    </div>
  );
}
