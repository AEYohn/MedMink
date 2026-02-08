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
  readOnly?: boolean;
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

export function SOAPEditor({ data, onChange, readOnly = false }: SOAPEditorProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>([
    'subjective',
    'objective',
    'assessment',
    'plan',
  ]);

  const soapData = data || defaultSOAPData;

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
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Chief Complaint
                </label>
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
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  History of Present Illness
                </label>
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
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Review of Systems
                </label>
                <ArrayField
                  items={soapData.subjective.review_of_systems}
                  path="subjective.review_of_systems"
                  placeholder="system finding"
                  icon={Activity}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Patient Reported
                </label>
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
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Vital Signs
                </label>
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
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Physical Exam Findings
                </label>
                <ArrayField
                  items={soapData.objective.physical_exam}
                  path="objective.physical_exam"
                  placeholder="exam finding"
                  icon={HeartPulse}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Labs
                </label>
                <ArrayField
                  items={soapData.objective.labs}
                  path="objective.labs"
                  placeholder="lab result"
                  icon={Beaker}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Imaging
                </label>
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
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Primary Diagnosis
                </label>
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
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Differential Diagnoses
                </label>
                <ArrayField
                  items={soapData.assessment.differential}
                  path="assessment.differential"
                  placeholder="differential"
                  icon={Activity}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Clinical Impression
                </label>
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
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Medications
                </label>
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
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Procedures
                </label>
                <ArrayField
                  items={soapData.plan.procedures}
                  path="plan.procedures"
                  placeholder="procedure"
                  icon={Stethoscope}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Referrals
                </label>
                <ArrayField
                  items={soapData.plan.referrals}
                  path="plan.referrals"
                  placeholder="referral"
                  icon={User}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Follow-Up
                </label>
                <Input
                  value={soapData.plan.follow_up || ''}
                  onChange={(e) => updateField('plan.follow_up', e.target.value)}
                  placeholder="Follow-up plan..."
                  className="mt-1"
                  readOnly={readOnly}
                />
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">
                  Patient Education
                </label>
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
          <Button>
            <Save className="w-4 h-4 mr-2" />
            Save Note
          </Button>
        </div>
      )}
    </div>
  );
}
