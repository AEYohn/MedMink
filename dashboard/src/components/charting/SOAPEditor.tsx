'use client';

import { useState } from 'react';
import {
  User,
  Activity,
  Stethoscope,
  ClipboardList,
  ChevronDown,
  Plus,
  X,
  Pill,
  Calendar,
  BookOpen,
  HeartPulse,
  Beaker,
  Scan,
  Save,
  Printer,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { createDocument } from '@/lib/document-storage';
import { normalizeSOAP } from '@/lib/compliance-rules';
import type { ComplianceFlag } from '@/types/compliance';
import { InlineComplianceMarker } from '@/components/compliance/InlineComplianceMarker';

export interface SOAPData {
  subjective: {
    chief_complaint: string | null;
    history_of_present_illness: string | null;
    review_of_systems: string[];
    patient_reported: string[];
  };
  objective: {
    vital_signs: {
      BP: string | null;
      HR: string | null;
      Temp: string | null;
      RR: string | null;
      SpO2: string | null;
    };
    physical_exam: string[];
    labs: string[];
    imaging: string[];
  };
  assessment: {
    primary_diagnosis: string | null;
    differential: string[];
    clinical_impression: string | null;
  };
  plan: {
    medications: Array<{ drug: string; dose: string; frequency: string }>;
    procedures: string[];
    referrals: string[];
    follow_up: string | null;
    patient_education: string[];
  };
}

interface SOAPEditorProps {
  data: SOAPData | null;
  onChange?: (data: SOAPData) => void;
  onSave?: () => void;
  readOnly?: boolean;
  complianceFlags?: ComplianceFlag[];
}

const defaultSOAPData: SOAPData = {
  subjective: {
    chief_complaint: null,
    history_of_present_illness: null,
    review_of_systems: [],
    patient_reported: [],
  },
  objective: {
    vital_signs: { BP: null, HR: null, Temp: null, RR: null, SpO2: null },
    physical_exam: [],
    labs: [],
    imaging: [],
  },
  assessment: {
    primary_diagnosis: null,
    differential: [],
    clinical_impression: null,
  },
  plan: {
    medications: [],
    procedures: [],
    referrals: [],
    follow_up: null,
    patient_education: [],
  },
};

export function SOAPEditor({ data, onChange, onSave, readOnly = false, complianceFlags = [] }: SOAPEditorProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'subjective',
    'objective',
    'assessment',
    'plan',
  ]);

  const soapData = normalizeSOAP(data || defaultSOAPData);

  // Helper: get compliance flags for a specific field path
  const flagsForField = (fieldPath: string): ComplianceFlag[] =>
    complianceFlags.filter(f => f.field === fieldPath);

  // Render label with optional compliance marker
  const FieldLabel = ({ label, fieldPath, block = false }: { label: string; fieldPath: string; block?: boolean }) => (
    <label className={cn('text-xs font-semibold uppercase tracking-wider text-muted-foreground', block && 'mb-2 block')}>
      {label}
      <InlineComplianceMarker flags={flagsForField(fieldPath)} />
    </label>
  );

  const toggleSection = (section: string) => {
    setExpandedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const updateField = (path: string, value: unknown) => {
    if (readOnly || !onChange) return;

    const pathParts = path.split('.');
    const newData = JSON.parse(JSON.stringify(soapData));

    let current: Record<string, unknown> = newData;
    for (let i = 0; i < pathParts.length - 1; i++) {
      current = current[pathParts[i]] as Record<string, unknown>;
    }
    current[pathParts[pathParts.length - 1]] = value;

    onChange(newData);
  };

  const addToArray = (path: string, value: string | Record<string, string>) => {
    if (readOnly || !onChange) return;

    const pathParts = path.split('.');
    const newData = JSON.parse(JSON.stringify(soapData));

    let current: Record<string, unknown> = newData;
    for (let i = 0; i < pathParts.length; i++) {
      current = current[pathParts[i]] as Record<string, unknown>;
    }
    (current as unknown as (string | Record<string, string>)[]).push(value);

    onChange(newData);
  };

  const removeFromArray = (path: string, index: number) => {
    if (readOnly || !onChange) return;

    const pathParts = path.split('.');
    const newData = JSON.parse(JSON.stringify(soapData));

    let current: Record<string, unknown> = newData;
    for (let i = 0; i < pathParts.length; i++) {
      current = current[pathParts[i]] as Record<string, unknown>;
    }
    (current as unknown as unknown[]).splice(index, 1);

    onChange(newData);
  };

  const SectionHeader = ({
    title,
    icon: Icon,
    section,
    color,
  }: {
    title: string;
    icon: React.ElementType;
    section: string;
    color: string;
  }) => (
    <CollapsibleTrigger asChild>
      <CardHeader
        className={cn(
          'cursor-pointer hover:bg-accent/50 transition-colors py-3',
          `border-l-4 ${color}`
        )}
        onClick={() => toggleSection(section)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-5 h-5" />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          <ChevronDown
            className={cn(
              'w-5 h-5 transition-transform',
              expandedSections.includes(section) && 'rotate-180'
            )}
          />
        </div>
      </CardHeader>
    </CollapsibleTrigger>
  );

  const ArrayField = ({
    items,
    path,
    placeholder,
    icon: Icon,
  }: {
    items: string[];
    path: string;
    placeholder: string;
    icon: React.ElementType;
  }) => (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Input
            value={item}
            onChange={(e) => {
              const newItems = [...items];
              newItems[idx] = e.target.value;
              updateField(path, newItems);
            }}
            className="flex-1"
            readOnly={readOnly}
          />
          {!readOnly && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => removeFromArray(path, idx)}
              className="h-8 w-8 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      ))}
      {!readOnly && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => addToArray(path, '')}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add {placeholder}
        </Button>
      )}
    </div>
  );

  if (!data) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <ClipboardList className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground text-center">
            Click "Enhance with MedGemma" to generate the SOAP note
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Subjective */}
      <Card>
        <Collapsible open={expandedSections.includes('subjective')}>
          <SectionHeader
            title="Subjective"
            icon={User}
            section="subjective"
            color="border-blue-500"
          />
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div>
                <FieldLabel label="Chief Complaint" fieldPath="subjective.chief_complaint" />
                <Textarea
                  value={soapData.subjective.chief_complaint || ''}
                  onChange={(e) =>
                    updateField('subjective.chief_complaint', e.target.value)
                  }
                  placeholder="Patient's main reason for visit..."
                  className="mt-1"
                  readOnly={readOnly}
                />
              </div>

              <div>
                <FieldLabel label="History of Present Illness" fieldPath="subjective.history_of_present_illness" />
                <Textarea
                  value={soapData.subjective.history_of_present_illness || ''}
                  onChange={(e) =>
                    updateField('subjective.history_of_present_illness', e.target.value)
                  }
                  placeholder="Detailed narrative of current illness..."
                  className="mt-1 min-h-[100px]"
                  readOnly={readOnly}
                />
              </div>

              <div>
                <FieldLabel label="Review of Systems" fieldPath="subjective.review_of_systems" block />
                <ArrayField
                  items={soapData.subjective.review_of_systems}
                  path="subjective.review_of_systems"
                  placeholder="system finding"
                  icon={Activity}
                />
              </div>

              <div>
                <FieldLabel label="Patient Reported" fieldPath="subjective.patient_reported" block />
                <ArrayField
                  items={soapData.subjective.patient_reported}
                  path="subjective.patient_reported"
                  placeholder="patient statement"
                  icon={User}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Objective */}
      <Card>
        <Collapsible open={expandedSections.includes('objective')}>
          <SectionHeader
            title="Objective"
            icon={Stethoscope}
            section="objective"
            color="border-green-500"
          />
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {/* Vital Signs */}
              <div>
                <FieldLabel label="Vital Signs" fieldPath="objective.vital_signs" block />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {Object.entries(soapData.objective.vital_signs).map(([key, value]) => (
                    <div key={key}>
                      <label className="text-xs text-muted-foreground">{key}</label>
                      <Input
                        value={value || ''}
                        onChange={(e) =>
                          updateField(`objective.vital_signs.${key}`, e.target.value)
                        }
                        placeholder="—"
                        className="text-sm"
                        readOnly={readOnly}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <FieldLabel label="Physical Exam Findings" fieldPath="objective.physical_exam" block />
                <ArrayField
                  items={soapData.objective.physical_exam}
                  path="objective.physical_exam"
                  placeholder="exam finding"
                  icon={HeartPulse}
                />
              </div>

              <div>
                <FieldLabel label="Labs" fieldPath="objective.labs" block />
                <ArrayField
                  items={soapData.objective.labs}
                  path="objective.labs"
                  placeholder="lab result"
                  icon={Beaker}
                />
              </div>

              <div>
                <FieldLabel label="Imaging" fieldPath="objective.imaging" block />
                <ArrayField
                  items={soapData.objective.imaging}
                  path="objective.imaging"
                  placeholder="imaging finding"
                  icon={Scan}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Assessment */}
      <Card>
        <Collapsible open={expandedSections.includes('assessment')}>
          <SectionHeader
            title="Assessment"
            icon={Activity}
            section="assessment"
            color="border-amber-500"
          />
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              <div>
                <FieldLabel label="Primary Diagnosis" fieldPath="assessment.primary_diagnosis" />
                <Input
                  value={soapData.assessment.primary_diagnosis || ''}
                  onChange={(e) =>
                    updateField('assessment.primary_diagnosis', e.target.value)
                  }
                  placeholder="Main diagnosis..."
                  className="mt-1 font-medium"
                  readOnly={readOnly}
                />
              </div>

              <div>
                <FieldLabel label="Differential Diagnoses" fieldPath="assessment.differential" block />
                <ArrayField
                  items={soapData.assessment.differential}
                  path="assessment.differential"
                  placeholder="differential"
                  icon={Activity}
                />
              </div>

              <div>
                <FieldLabel label="Clinical Impression" fieldPath="assessment.clinical_impression" />
                <Textarea
                  value={soapData.assessment.clinical_impression || ''}
                  onChange={(e) =>
                    updateField('assessment.clinical_impression', e.target.value)
                  }
                  placeholder="Overall clinical picture..."
                  className="mt-1"
                  readOnly={readOnly}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Plan */}
      <Card>
        <Collapsible open={expandedSections.includes('plan')}>
          <SectionHeader
            title="Plan"
            icon={ClipboardList}
            section="plan"
            color="border-purple-500"
          />
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-4">
              {/* Medications */}
              <div>
                <FieldLabel label="Medications" fieldPath="plan.medications" block />
                <div className="space-y-2">
                  {soapData.plan.medications.map((med, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Pill className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        value={med.drug}
                        onChange={(e) => {
                          const newMeds = [...soapData.plan.medications];
                          newMeds[idx] = { ...med, drug: e.target.value };
                          updateField('plan.medications', newMeds);
                        }}
                        placeholder="Drug name"
                        className="flex-1"
                        readOnly={readOnly}
                      />
                      <Input
                        value={med.dose}
                        onChange={(e) => {
                          const newMeds = [...soapData.plan.medications];
                          newMeds[idx] = { ...med, dose: e.target.value };
                          updateField('plan.medications', newMeds);
                        }}
                        placeholder="Dose"
                        className="w-24"
                        readOnly={readOnly}
                      />
                      <Input
                        value={med.frequency}
                        onChange={(e) => {
                          const newMeds = [...soapData.plan.medications];
                          newMeds[idx] = { ...med, frequency: e.target.value };
                          updateField('plan.medications', newMeds);
                        }}
                        placeholder="Frequency"
                        className="w-28"
                        readOnly={readOnly}
                      />
                      {!readOnly && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeFromArray('plan.medications', idx)}
                          className="h-8 w-8 flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        addToArray('plan.medications', { drug: '', dose: '', frequency: '' })
                      }
                      className="w-full"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Medication
                    </Button>
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <FieldLabel label="Procedures" fieldPath="plan.procedures" block />
                <ArrayField
                  items={soapData.plan.procedures}
                  path="plan.procedures"
                  placeholder="procedure"
                  icon={Stethoscope}
                />
              </div>

              <div>
                <FieldLabel label="Referrals" fieldPath="plan.referrals" block />
                <ArrayField
                  items={soapData.plan.referrals}
                  path="plan.referrals"
                  placeholder="referral"
                  icon={User}
                />
              </div>

              <div>
                <FieldLabel label="Follow-Up" fieldPath="plan.follow_up" />
                <Input
                  value={soapData.plan.follow_up || ''}
                  onChange={(e) => updateField('plan.follow_up', e.target.value)}
                  placeholder="Follow-up plan..."
                  className="mt-1"
                  readOnly={readOnly}
                />
              </div>

              <div>
                <FieldLabel label="Patient Education" fieldPath="plan.patient_education" block />
                <ArrayField
                  items={soapData.plan.patient_education}
                  path="plan.patient_education"
                  placeholder="education point"
                  icon={BookOpen}
                />
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Action Buttons */}
      {!readOnly && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline">
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
          <Button onClick={() => {
            const sections = [
              `SUBJECTIVE\nChief Complaint: ${soapData.subjective.chief_complaint || 'N/A'}\nHPI: ${soapData.subjective.history_of_present_illness || 'N/A'}${soapData.subjective.review_of_systems.length ? `\nROS: ${soapData.subjective.review_of_systems.join('; ')}` : ''}${soapData.subjective.patient_reported.length ? `\nPatient Reported: ${soapData.subjective.patient_reported.join('; ')}` : ''}`,
              `OBJECTIVE\nVitals: ${Object.entries(soapData.objective.vital_signs).filter(([,v]) => v).map(([k,v]) => `${k}: ${v}`).join(', ') || 'N/A'}${soapData.objective.physical_exam.length ? `\nPhysical Exam: ${soapData.objective.physical_exam.join('; ')}` : ''}${soapData.objective.labs.length ? `\nLabs: ${soapData.objective.labs.join('; ')}` : ''}${soapData.objective.imaging.length ? `\nImaging: ${soapData.objective.imaging.join('; ')}` : ''}`,
              `ASSESSMENT\nPrimary Diagnosis: ${soapData.assessment.primary_diagnosis || 'N/A'}${soapData.assessment.differential.length ? `\nDifferential: ${soapData.assessment.differential.join('; ')}` : ''}${soapData.assessment.clinical_impression ? `\nClinical Impression: ${soapData.assessment.clinical_impression}` : ''}`,
              `PLAN${soapData.plan.medications.length ? `\nMedications: ${soapData.plan.medications.map(m => `${m.drug} ${m.dose} ${m.frequency}`.trim()).join('; ')}` : ''}${soapData.plan.procedures.length ? `\nProcedures: ${soapData.plan.procedures.join('; ')}` : ''}${soapData.plan.referrals.length ? `\nReferrals: ${soapData.plan.referrals.join('; ')}` : ''}${soapData.plan.follow_up ? `\nFollow-Up: ${soapData.plan.follow_up}` : ''}${soapData.plan.patient_education.length ? `\nPatient Education: ${soapData.plan.patient_education.join('; ')}` : ''}`,
            ];
            const content = sections.join('\n\n');
            const title = `SOAP Note — ${new Date().toLocaleDateString()}`;
            createDocument({ type: 'soap_note', title, content });
            toast.success('Note saved');
            onSave?.();
          }}>
            <Save className="w-4 h-4 mr-2" />
            Save Note
          </Button>
        </div>
      )}
    </div>
  );
}
