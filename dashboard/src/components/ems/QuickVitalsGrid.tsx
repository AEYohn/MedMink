'use client';

import { useState } from 'react';
import { Activity } from 'lucide-react';

interface QuickVitalsGridProps {
  onSubmit: (vitals: Record<string, number | null>) => void;
  isSubmitting?: boolean;
}

export function QuickVitalsGrid({ onSubmit, isSubmitting }: QuickVitalsGridProps) {
  const [bpSys, setBpSys] = useState('');
  const [bpDia, setBpDia] = useState('');
  const [hr, setHr] = useState('');
  const [rr, setRr] = useState('');
  const [spo2, setSpo2] = useState('');
  const [bgl, setBgl] = useState('');
  const [pain, setPain] = useState<number | null>(null);
  const [gcsE, setGcsE] = useState('');
  const [gcsV, setGcsV] = useState('');
  const [gcsM, setGcsM] = useState('');

  const handleSubmit = () => {
    const vitals: Record<string, number | null> = {
      bp_systolic: bpSys ? parseInt(bpSys) : null,
      bp_diastolic: bpDia ? parseInt(bpDia) : null,
      heart_rate: hr ? parseInt(hr) : null,
      respiratory_rate: rr ? parseInt(rr) : null,
      spo2: spo2 ? parseInt(spo2) : null,
      blood_glucose: bgl ? parseInt(bgl) : null,
      pain_scale: pain,
      gcs_total: gcsE && gcsV && gcsM ? parseInt(gcsE) + parseInt(gcsV) + parseInt(gcsM) : null,
    };
    onSubmit(vitals);
    // Clear after submit
    setBpSys(''); setBpDia(''); setHr(''); setRr('');
    setSpo2(''); setBgl(''); setPain(null);
    setGcsE(''); setGcsV(''); setGcsM('');
  };

  const inputClass = "w-full h-12 text-center text-lg font-mono bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Activity className="w-4 h-4 text-primary" />
        <span>Quick Vitals</span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {/* BP */}
        <div className="col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">BP</label>
          <div className="flex items-center gap-1">
            <input
              type="number" placeholder="SYS" value={bpSys}
              onChange={e => setBpSys(e.target.value)}
              className={inputClass}
            />
            <span className="text-muted-foreground font-bold">/</span>
            <input
              type="number" placeholder="DIA" value={bpDia}
              onChange={e => setBpDia(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* HR */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">HR</label>
          <input
            type="number" placeholder="--" value={hr}
            onChange={e => setHr(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* RR */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">RR</label>
          <input
            type="number" placeholder="--" value={rr}
            onChange={e => setRr(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* SpO2 */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">SpO2 %</label>
          <input
            type="number" placeholder="--" value={spo2}
            onChange={e => setSpo2(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* BGL */}
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">BGL</label>
          <input
            type="number" placeholder="--" value={bgl}
            onChange={e => setBgl(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* GCS */}
        <div className="col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">GCS (E / V / M)</label>
          <div className="flex items-center gap-1">
            <input
              type="number" placeholder="E" value={gcsE} min={1} max={4}
              onChange={e => setGcsE(e.target.value)}
              className={inputClass}
            />
            <input
              type="number" placeholder="V" value={gcsV} min={1} max={5}
              onChange={e => setGcsV(e.target.value)}
              className={inputClass}
            />
            <input
              type="number" placeholder="M" value={gcsM} min={1} max={6}
              onChange={e => setGcsM(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Pain Scale */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 block">Pain (0-10)</label>
        <div className="flex gap-1">
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i}
              onClick={() => setPain(i)}
              className={`flex-1 h-10 rounded-lg text-sm font-bold transition-colors ${
                pain === i
                  ? i <= 3 ? 'bg-green-500 text-white'
                    : i <= 6 ? 'bg-amber-500 text-white'
                    : 'bg-red-500 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full h-12 bg-primary text-primary-foreground rounded-lg font-medium text-base hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {isSubmitting ? 'Saving...' : 'Record Vitals'}
      </button>
    </div>
  );
}
