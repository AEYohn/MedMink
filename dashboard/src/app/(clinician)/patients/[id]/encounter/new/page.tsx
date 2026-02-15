'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Stethoscope, Send } from 'lucide-react';
import {
  Patient,
  getPatient,
  getPatientDisplayName,
  getPatientAge,
} from '@/lib/patient-storage';
import { useCaseSession } from '@/hooks/useCaseSession';
import { Badge } from '@/components/ui/badge';

export default function NewEncounterPage() {
  const params = useParams();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [caseText, setCaseText] = useState('');
  const { createSession, updatePatientId } = useCaseSession();

  useEffect(() => {
    const id = params.id as string;
    const p = getPatient(id);
    if (!p) {
      router.push('/patients');
      return;
    }
    setPatient(p);

    // Pre-fill case context
    const parts: string[] = [];
    parts.push(`${getPatientAge(p)}yo ${p.sex === 'male' ? 'male' : p.sex === 'female' ? 'female' : 'patient'}`);
    if (p.conditions.length > 0) {
      parts.push(`with PMH of ${p.conditions.join(', ')}`);
    }
    if (p.medications.length > 0) {
      parts.push(`on ${p.medications.join(', ')}`);
    }
    if (p.allergies.length > 0) {
      parts.push(`Allergies: ${p.allergies.join(', ')}.`);
    }
    parts.push('\n\nPresenting complaint: ');
    setCaseText(parts.join(' '));
  }, [params.id, router]);

  const handleStartAnalysis = () => {
    if (!patient || caseText.trim().length < 20) return;
    const session = createSession(caseText, `Encounter: ${getPatientDisplayName(patient)}`);
    updatePatientId(patient.id);
    router.push(`/case?session=${session.id}`);
  };

  if (!patient) return null;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/patients/${patient.id}`} className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-foreground">New Encounter</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            {getPatientDisplayName(patient)}
            <Badge variant="outline">{getPatientAge(patient)}y {patient.sex === 'male' ? 'M' : 'F'}</Badge>
            {patient.mrn && <Badge variant="secondary">MRN: {patient.mrn}</Badge>}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Stethoscope className="w-4 h-4" />
          Patient context has been pre-filled. Add the presenting complaint and clinical details.
        </div>

        <textarea
          value={caseText}
          onChange={(e) => setCaseText(e.target.value)}
          rows={12}
          className="w-full px-4 py-3 text-sm bg-background border border-input rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-ring font-mono"
          placeholder="Describe the clinical case..."
        />

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {caseText.length} characters {caseText.length < 20 && '(minimum 20)'}
          </p>
          <button
            onClick={handleStartAnalysis}
            disabled={caseText.trim().length < 20}
            className="px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Analyze Case
          </button>
        </div>
      </div>
    </div>
  );
}
