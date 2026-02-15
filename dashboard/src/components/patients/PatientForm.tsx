'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, Plus } from 'lucide-react';
import { patientSchema, PatientFormData } from '@/lib/validations/patient';
import { Patient } from '@/lib/patient-storage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

interface PatientFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: Patient | null;
  onSubmit: (data: PatientFormData) => void;
}

function TagInput({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
      setInput('');
    }
  };

  return (
    <div>
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex flex-wrap gap-1.5 mt-1.5 mb-1.5">
        {values.map((val, i) => (
          <Badge key={i} variant="secondary" className="gap-1 pr-1">
            {val}
            <button
              type="button"
              onClick={() => onChange(values.filter((_, idx) => idx !== i))}
              className="hover:text-destructive transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag();
            }
          }}
          className="flex-1"
        />
        <button
          type="button"
          onClick={addTag}
          className="px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export function PatientForm({ open, onOpenChange, patient, onSubmit }: PatientFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: patient
      ? {
          firstName: patient.firstName,
          lastName: patient.lastName,
          dateOfBirth: patient.dateOfBirth,
          sex: patient.sex,
          mrn: patient.mrn || '',
          phone: patient.phone || '',
          email: patient.email || '',
          allergies: patient.allergies,
          conditions: patient.conditions,
          medications: patient.medications,
        }
      : {
          firstName: '',
          lastName: '',
          dateOfBirth: '',
          sex: 'male' as const,
          mrn: '',
          phone: '',
          email: '',
          allergies: [],
          conditions: [],
          medications: [],
        },
  });

  const allergies = watch('allergies') || [];
  const conditions = watch('conditions') || [];
  const medications = watch('medications') || [];

  const handleFormSubmit = (data: PatientFormData) => {
    onSubmit(data);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{patient ? 'Edit Patient' : 'Add Patient'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" {...register('firstName')} className="mt-1.5" />
              {errors.firstName && (
                <p className="text-xs text-destructive mt-1">{errors.firstName.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" {...register('lastName')} className="mt-1.5" />
              {errors.lastName && (
                <p className="text-xs text-destructive mt-1">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} className="mt-1.5" />
              {errors.dateOfBirth && (
                <p className="text-xs text-destructive mt-1">{errors.dateOfBirth.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="sex">Sex *</Label>
              <select
                id="sex"
                {...register('sex')}
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              {errors.sex && (
                <p className="text-xs text-destructive mt-1">{errors.sex.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="mrn">MRN</Label>
              <Input id="mrn" {...register('mrn')} placeholder="Medical Record #" className="mt-1.5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" {...register('phone')} className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} className="mt-1.5" />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
              )}
            </div>
          </div>

          <TagInput
            label="Allergies"
            values={allergies}
            onChange={(v) => setValue('allergies', v)}
            placeholder="Add allergy..."
          />

          <TagInput
            label="Conditions"
            values={conditions}
            onChange={(v) => setValue('conditions', v)}
            placeholder="Add condition..."
          />

          <TagInput
            label="Medications"
            values={medications}
            onChange={(v) => setValue('medications', v)}
            placeholder="Add medication..."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm font-medium text-muted-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {patient ? 'Update Patient' : 'Add Patient'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
