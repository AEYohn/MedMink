'use client';

import { useState, useMemo } from 'react';
import { Link2, X, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import {
  searchPatients,
  getPatientDisplayName,
  getPatientAge,
  getPatient,
} from '@/lib/patient-storage';
import type { Patient } from '@/lib/patient-storage';

interface PatientSelectorProps {
  selectedPatientId: string | null;
  onSelect: (patient: Patient | null) => void;
  disabled?: boolean;
}

export function PatientSelector({
  selectedPatientId,
  onSelect,
  disabled,
}: PatientSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selectedPatient = useMemo(
    () => (selectedPatientId ? getPatient(selectedPatientId) : null),
    [selectedPatientId],
  );

  const results = useMemo(() => searchPatients(query), [query]);

  const handleSelect = (patient: Patient) => {
    onSelect(patient);
    setOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    onSelect(null);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className="gap-1.5"
        >
          {selectedPatient ? (
            <>
              <span className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-semibold text-primary">
                {selectedPatient.firstName[0]}
                {selectedPatient.lastName[0]}
              </span>
              <span className="text-xs font-medium truncate max-w-[120px]">
                {getPatientDisplayName(selectedPatient)}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {getPatientAge(selectedPatient)}y
              </span>
            </>
          ) : (
            <>
              <Link2 className="w-3.5 h-3.5" />
              Link Patient
            </>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or MRN..."
              className="h-8 pl-8 text-xs"
              autoFocus
            />
          </div>
        </div>

        <div className="max-h-48 overflow-y-auto">
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No patients found
            </p>
          ) : (
            results.map((patient) => {
              const isSelected = patient.id === selectedPatientId;
              const sexLabel =
                patient.sex === 'male'
                  ? 'M'
                  : patient.sex === 'female'
                    ? 'F'
                    : 'O';
              return (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => handleSelect(patient)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-accent/50 transition-colors ${
                    isSelected ? 'bg-accent' : ''
                  }`}
                >
                  <span className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                    {patient.firstName[0]}
                    {patient.lastName[0]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {getPatientDisplayName(patient)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {getPatientAge(patient)}y {sexLabel}
                    </p>
                  </div>
                  {patient.mrn && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
                      {patient.mrn}
                    </Badge>
                  )}
                </button>
              );
            })
          )}
        </div>

        {selectedPatient && (
          <div className="p-2 border-t">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground gap-1.5"
              onClick={handleClear}
            >
              <X className="w-3 h-3" />
              Clear selection
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
