'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  ArrowLeft,
  UserPlus,
  User,
  Heart,
  Pill,
  ClipboardCheck,
  Check,
} from 'lucide-react';
import { patientSchema, PatientFormData } from '@/lib/validations/patient';
import { createPatient } from '@/lib/patient-storage';
import { TagInput } from '@/components/shared/TagInput';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

const SECTIONS = [
  { id: 'demographics', label: 'Demographics', icon: User },
  { id: 'history', label: 'History', icon: Heart },
  { id: 'medications', label: 'Meds & Allergies', icon: Pill },
  { id: 'review', label: 'Review', icon: ClipboardCheck },
] as const;

export default function NewPatientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeSection, setActiveSection] = useState('demographics');
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PatientFormData>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      sex: 'male',
      mrn: '',
      phone: '',
      email: '',
      allergies: [],
      conditions: [],
      medications: [],
    },
  });

  const formValues = watch();
  const allergies = formValues.allergies || [];
  const conditions = formValues.conditions || [];
  const medications = formValues.medications || [];

  // Pre-fill form from query params (e.g. from "Create Patient from Case")
  useEffect(() => {
    const sex = searchParams.get('sex');
    if (sex && ['male', 'female', 'other'].includes(sex)) {
      setValue('sex', sex as 'male' | 'female' | 'other');
    }
    const dob = searchParams.get('dateOfBirth');
    if (dob) setValue('dateOfBirth', dob);
    const conds = searchParams.get('conditions');
    if (conds) setValue('conditions', conds.split(',').map(c => c.trim()).filter(Boolean));
    const meds = searchParams.get('medications');
    if (meds) setValue('medications', meds.split(',').map(m => m.trim()).filter(Boolean));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // IntersectionObserver for scroll-based section highlighting
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const visibleSections = new Map<string, number>();

    SECTIONS.forEach(({ id }) => {
      const el = sectionRefs.current[id];
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            visibleSections.set(id, entry.intersectionRatio);
          } else {
            visibleSections.delete(id);
          }
          // Pick the section with the highest intersection ratio
          let best = '';
          let bestRatio = 0;
          visibleSections.forEach((ratio, sectionId) => {
            if (ratio > bestRatio) {
              best = sectionId;
              bestRatio = ratio;
            }
          });
          if (best) setActiveSection(best);
        },
        { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '-80px 0px -40% 0px' }
      );
      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const onSubmit = (data: PatientFormData) => {
    const patient = createPatient(data);
    toast.success(`${data.firstName} ${data.lastName} added successfully`);
    router.push(`/patients/${patient.id}`);
  };

  // Count filled fields for the progress indicator
  const filledCount = useMemo(() => {
    let count = 0;
    if (formValues.firstName) count++;
    if (formValues.lastName) count++;
    if (formValues.dateOfBirth) count++;
    if (conditions.length > 0) count++;
    if (medications.length > 0 || allergies.length > 0) count++;
    return count;
  }, [formValues.firstName, formValues.lastName, formValues.dateOfBirth, conditions, medications, allergies]);

  const activeSectionIndex = SECTIONS.findIndex((s) => s.id === activeSection);

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <Link
                href="/patients"
                className="p-1.5 -ml-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-foreground leading-tight">New Patient</h1>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {filledCount > 0 ? `${filledCount} field${filledCount !== 1 ? 's' : ''} completed` : 'Patient intake form'}
                  </p>
                </div>
              </div>
            </div>

            {/* Section Progress Pills */}
            <nav className="hidden sm:flex items-center gap-1">
              {SECTIONS.map((section, i) => {
                const Icon = section.icon;
                const isActive = section.id === activeSection;
                const isPast = i < activeSectionIndex;
                return (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`
                      relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-all duration-300
                      ${isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : isPast
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      }
                    `}
                  >
                    {isPast && !isActive ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Icon className="w-3 h-3" />
                    )}
                    <span className="hidden md:inline">{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Form Content */}
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Section 1: Demographics */}
        <div ref={(el) => { sectionRefs.current['demographics'] = el; }} className="scroll-mt-20">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <User className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Demographics</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Basic patient information</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name <span className="text-destructive">*</span></Label>
                  <Input id="firstName" {...register('firstName')} placeholder="John" className="mt-1.5" />
                  {errors.firstName && (
                    <p className="text-xs text-destructive mt-1">{errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name <span className="text-destructive">*</span></Label>
                  <Input id="lastName" {...register('lastName')} placeholder="Doe" className="mt-1.5" />
                  {errors.lastName && (
                    <p className="text-xs text-destructive mt-1">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth <span className="text-destructive">*</span></Label>
                  <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} className="mt-1.5" />
                  {errors.dateOfBirth && (
                    <p className="text-xs text-destructive mt-1">{errors.dateOfBirth.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="sex">Sex <span className="text-destructive">*</span></Label>
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" {...register('phone')} placeholder="(555) 123-4567" className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...register('email')} placeholder="patient@email.com" className="mt-1.5" />
                  {errors.email && (
                    <p className="text-xs text-destructive mt-1">{errors.email.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section 2: Medical History */}
        <div ref={(el) => { sectionRefs.current['history'] = el; }} className="scroll-mt-20">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <Heart className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Medical History</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Known conditions and diagnoses</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TagInput
                label="Conditions"
                values={conditions}
                onChange={(v) => setValue('conditions', v)}
                placeholder="e.g. Hypertension, Type 2 Diabetes..."
              />
            </CardContent>
          </Card>
        </div>

        {/* Section 3: Medications & Allergies */}
        <div ref={(el) => { sectionRefs.current['medications'] = el; }} className="scroll-mt-20">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Pill className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Medications & Allergies</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Current medications and known allergies</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <TagInput
                label="Current Medications"
                values={medications}
                onChange={(v) => setValue('medications', v)}
                placeholder="e.g. Metformin 500mg, Lisinopril 10mg..."
              />
              <TagInput
                label="Allergies"
                values={allergies}
                onChange={(v) => setValue('allergies', v)}
                placeholder="e.g. Penicillin, Sulfa drugs..."
              />
            </CardContent>
          </Card>
        </div>

        {/* Section 4: Review & Confirm */}
        <div ref={(el) => { sectionRefs.current['review'] = el; }} className="scroll-mt-20">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <ClipboardCheck className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <CardTitle className="text-base">Review & Confirm</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Verify patient information before saving</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border bg-muted/30 divide-y divide-border">
                {/* Demographics Summary */}
                <div className="p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Demographics</p>
                  {formValues.firstName || formValues.lastName ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {formValues.firstName} {formValues.lastName}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {formValues.dateOfBirth && <span>DOB: {formValues.dateOfBirth}</span>}
                        {formValues.sex && <span>Sex: {formValues.sex}</span>}
                        {formValues.mrn && <span>MRN: {formValues.mrn}</span>}
                        {formValues.phone && <span>Phone: {formValues.phone}</span>}
                        {formValues.email && <span>Email: {formValues.email}</span>}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">No demographics entered yet</p>
                  )}
                </div>

                {/* Conditions Summary */}
                <div className="p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Conditions</p>
                  {conditions.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {conditions.map((c, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">None listed</p>
                  )}
                </div>

                {/* Medications Summary */}
                <div className="p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Medications</p>
                  {medications.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {medications.map((m, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{m}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">None listed</p>
                  )}
                </div>

                {/* Allergies Summary */}
                <div className="p-4">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Allergies</p>
                  {allergies.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {allergies.map((a, i) => (
                        <Badge key={i} variant="destructive" className="text-xs">{a}</Badge>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 italic">None listed</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                <Link
                  href="/patients"
                  className="px-4 py-2 text-sm font-medium text-muted-foreground bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors inline-flex items-center gap-2 shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  {isSubmitting ? 'Saving...' : 'Create Patient'}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>
    </div>
  );
}
