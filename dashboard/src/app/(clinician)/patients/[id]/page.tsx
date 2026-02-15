'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  User,
  Calendar,
  Phone,
  Mail,
  Pill,
  AlertTriangle,
  Activity,
  Plus,
  Pencil,
  ArrowLeft,
  Stethoscope,
  Clock,
} from 'lucide-react';
import {
  Patient,
  getPatient,
  updatePatient,
  getPatientDisplayName,
  getPatientAge,
} from '@/lib/patient-storage';
import { getCaseSessions, CaseSession } from '@/lib/storage';
import { PatientFormData } from '@/lib/validations/patient';
import { PatientForm } from '@/components/patients/PatientForm';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';

export default function PatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [encounters, setEncounters] = useState<CaseSession[]>([]);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    const id = params.id as string;
    const p = getPatient(id);
    if (!p) {
      router.push('/patients');
      return;
    }
    setPatient(p);

    const sessions = getCaseSessions().filter(s => s.patientId === id);
    setEncounters(sessions);
  }, [params.id, router]);

  const handleEdit = (data: PatientFormData) => {
    if (!patient) return;
    const updated = updatePatient(patient.id, data);
    if (updated) {
      setPatient(updated);
      toast.success('Patient updated');
    }
  };

  if (!patient) return null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/patients" className="p-2 hover:bg-muted rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-muted-foreground" />
        </Link>
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-xl font-semibold text-primary">
          {patient.firstName[0]}{patient.lastName[0]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{getPatientDisplayName(patient)}</h1>
            <Badge variant={patient.status === 'active' ? 'default' : 'secondary'}>
              {patient.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {getPatientAge(patient)}y {patient.sex === 'male' ? 'M' : patient.sex === 'female' ? 'F' : 'O'}
            {patient.mrn && <> &middot; MRN: {patient.mrn}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setEditOpen(true)}
            className="px-4 py-2 text-sm font-medium text-muted-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors inline-flex items-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
          <Link
            href={`/patients/${patient.id}/encounter/new`}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            New Encounter
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Encounters (left, 2/3) */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary" />
            Encounters ({encounters.length})
          </h2>

          {encounters.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="No encounters"
              description="Start a new case analysis for this patient"
              action={{
                label: 'New Encounter',
                onClick: () => router.push(`/patients/${patient.id}/encounter/new`),
              }}
            />
          ) : (
            <div className="space-y-3">
              {encounters.map((enc) => (
                <Link
                  key={enc.id}
                  href={`/cases/${enc.id}`}
                  className="block bg-card rounded-xl border border-border p-4 hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{enc.title}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(enc.createdAt).toLocaleDateString()}
                        </span>
                        {enc.events.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {enc.events.length} event{enc.events.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    {enc.currentResult && (
                      <Badge variant="outline" className="ml-2 shrink-0">Analyzed</Badge>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Patient Info Panel (right, 1/3) */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Demographics</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">DOB:</span>
                <span className="text-foreground">{new Date(patient.dateOfBirth).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Sex:</span>
                <span className="text-foreground capitalize">{patient.sex}</span>
              </div>
              {patient.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{patient.phone}</span>
                </div>
              )}
              {patient.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-foreground">{patient.email}</span>
                </div>
              )}
            </div>
          </div>

          {patient.allergies.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Allergies
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {patient.allergies.map((a, i) => (
                  <Badge key={i} variant="destructive">{a}</Badge>
                ))}
              </div>
            </div>
          )}

          {patient.conditions.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-primary" />
                Conditions
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {patient.conditions.map((c, i) => (
                  <Badge key={i} variant="outline">{c}</Badge>
                ))}
              </div>
            </div>
          )}

          {patient.medications.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Pill className="w-4 h-4 text-accent" />
                Medications
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {patient.medications.map((m, i) => (
                  <Badge key={i} variant="secondary">{m}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <PatientForm
        open={editOpen}
        onOpenChange={setEditOpen}
        patient={patient}
        onSubmit={handleEdit}
      />
    </div>
  );
}
