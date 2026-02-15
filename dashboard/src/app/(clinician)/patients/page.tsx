'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Download,
  UserX,
  UserCheck,
} from 'lucide-react';
import {
  Patient,
  getPatients,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientDisplayName,
  getPatientAge,
} from '@/lib/patient-storage';
import { PatientFormData } from '@/lib/validations/patient';
import { PatientForm } from '@/components/patients/PatientForm';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type SortField = 'name' | 'dob' | 'updatedAt';
type StatusFilter = 'all' | 'active' | 'inactive';

export default function PatientsPage() {
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('updatedAt');
  const [formOpen, setFormOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  useEffect(() => {
    setPatients(getPatients());
  }, []);

  const filtered = useMemo(() => {
    let result = patients;

    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        p.mrn?.toLowerCase().includes(q) ||
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(q)
      );
    }

    result.sort((a, b) => {
      switch (sortField) {
        case 'name':
          return `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`);
        case 'dob':
          return a.dateOfBirth.localeCompare(b.dateOfBirth);
        case 'updatedAt':
        default:
          return b.updatedAt.localeCompare(a.updatedAt);
      }
    });

    return result;
  }, [patients, search, statusFilter, sortField]);

  const handleCreate = (data: PatientFormData) => {
    createPatient(data);
    setPatients(getPatients());
    toast.success('Patient added successfully');
  };

  const handleEdit = (data: PatientFormData) => {
    if (!editingPatient) return;
    updatePatient(editingPatient.id, data);
    setPatients(getPatients());
    setEditingPatient(null);
    toast.success('Patient updated');
  };

  const handleDelete = (patient: Patient) => {
    if (!confirm(`Delete ${getPatientDisplayName(patient)}? This cannot be undone.`)) return;
    deletePatient(patient.id);
    setPatients(getPatients());
    toast.success('Patient deleted');
  };

  const handleToggleStatus = (patient: Patient) => {
    const newStatus = patient.status === 'active' ? 'inactive' : 'active';
    updatePatient(patient.id, { status: newStatus });
    setPatients(getPatients());
    toast.success(`Patient ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
  };

  const handleExport = () => {
    const headers = ['First Name', 'Last Name', 'DOB', 'Sex', 'MRN', 'Phone', 'Email', 'Allergies', 'Conditions', 'Medications', 'Status'];
    const rows = patients.map(p => [
      p.firstName, p.lastName, p.dateOfBirth, p.sex,
      p.mrn || '', p.phone || '', p.email || '',
      p.allergies.join('; '), p.conditions.join('; '), p.medications.join('; '),
      p.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patients-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Patients exported');
  };

  const getInitials = (p: Patient) =>
    `${p.firstName[0] || ''}${p.lastName[0] || ''}`.toUpperCase();

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Patients</h1>
            <p className="text-sm text-muted-foreground">{patients.length} total</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            disabled={patients.length === 0}
            className="px-3 py-2 text-sm font-medium text-muted-foreground bg-secondary rounded-lg hover:bg-secondary/80 disabled:opacity-50 transition-colors inline-flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <Link
            href="/patients/new"
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Patient
          </Link>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search patients by name or MRN..."
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-2 text-sm rounded-lg border border-input bg-background"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value as SortField)}
          className="px-3 py-2 text-sm rounded-lg border border-input bg-background"
        >
          <option value="updatedAt">Recently Updated</option>
          <option value="name">Name A-Z</option>
          <option value="dob">Date of Birth</option>
        </select>
      </div>

      {/* Patient List */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'No patients found' : 'No patients yet'}
          description={search ? 'Try a different search term' : 'Add your first patient to get started'}
          action={!search ? { label: 'Add Patient', onClick: () => router.push('/patients/new') } : undefined}
        />
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Age/Sex</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">MRN</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Updated</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((patient) => (
                <tr key={patient.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/patients/${patient.id}`} className="flex items-center gap-3 hover:underline">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                        {getInitials(patient)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{getPatientDisplayName(patient)}</p>
                        {patient.conditions.length > 0 && (
                          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                            {patient.conditions.slice(0, 2).join(', ')}
                          </p>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {getPatientAge(patient)}y {patient.sex === 'male' ? 'M' : patient.sex === 'female' ? 'F' : 'O'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground font-mono">
                    {patient.mrn || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={patient.status === 'active' ? 'default' : 'secondary'}>
                      {patient.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(patient.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-muted-foreground" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditingPatient(patient); setFormOpen(true); }}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(patient)}>
                          {patient.status === 'active' ? (
                            <><UserX className="w-4 h-4 mr-2" />Deactivate</>
                          ) : (
                            <><UserCheck className="w-4 h-4 mr-2" />Activate</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(patient)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Patient Form Dialog */}
      <PatientForm
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingPatient(null);
        }}
        patient={editingPatient}
        onSubmit={editingPatient ? handleEdit : handleCreate}
      />
    </div>
  );
}
