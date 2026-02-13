'use client';

import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Pill, AlertTriangle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Visit {
  visit_id: string;
  timestamp: string;
  phase_reached: string;
  vitals: Record<string, string | number>;
  medications: string[];
  diagnoses: string[];
  red_flags: string[];
  triage_result?: {
    esi_level?: number;
    recommended_setting?: string;
  };
}

interface VisitHistoryProps {
  patientId: string | null;
}

export function VisitHistory({ patientId }: VisitHistoryProps) {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);

  useEffect(() => {
    if (!patientId) return;

    const fetchVisits = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/interview/visits/${patientId}`);
        if (res.ok) {
          const data = await res.json();
          setVisits(data.visits || []);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchVisits();
  }, [patientId]);

  if (!patientId) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        Link a patient ID to view visit history
      </div>
    );
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Calendar className="w-4 h-4 text-primary" />
        Visit History
        {visits.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {visits.length} visit{visits.length !== 1 ? 's' : ''}
          </Badge>
        )}
      </h3>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading visit history...
        </div>
      )}

      {!loading && visits.length === 0 && (
        <p className="text-sm text-muted-foreground">No previous visits found</p>
      )}

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

        {visits.map((visit, i) => (
          <div
            key={visit.visit_id}
            className="relative pl-8 pb-4 cursor-pointer"
            onClick={() => setSelectedVisit(selectedVisit?.visit_id === visit.visit_id ? null : visit)}
          >
            {/* Timeline dot */}
            <div className={`absolute left-1.5 top-1.5 w-3 h-3 rounded-full border-2 ${
              i === 0 ? 'bg-primary border-primary' : 'bg-background border-muted-foreground'
            }`} />

            <div className={`rounded-xl p-3 border transition-colors ${
              selectedVisit?.visit_id === visit.visit_id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium">{formatDate(visit.timestamp)}</p>
                {visit.triage_result?.esi_level && (
                  <Badge variant="outline" className="text-xs">
                    ESI {visit.triage_result.esi_level}
                  </Badge>
                )}
              </div>

              {/* Quick summary */}
              <div className="flex flex-wrap gap-1.5 mt-1">
                {visit.diagnoses.slice(0, 3).map((dx, j) => (
                  <Badge key={j} variant="secondary" className="text-xs">{dx}</Badge>
                ))}
                {visit.red_flags.length > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {visit.red_flags.length} red flag{visit.red_flags.length !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              {/* Expanded details */}
              {selectedVisit?.visit_id === visit.visit_id && (
                <div className="mt-3 space-y-2 text-sm">
                  {/* Vitals */}
                  {Object.keys(visit.vitals).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Vitals
                      </p>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        {Object.entries(visit.vitals).map(([key, val]) => (
                          <div key={key} className="text-xs">
                            <span className="text-muted-foreground capitalize">{key.replace(/_/g, ' ')}:</span>{' '}
                            <span className="font-medium">{String(val)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Medications */}
                  {visit.medications.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                        <Pill className="w-3 h-3" /> Medications
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {visit.medications.map((med, j) => (
                          <Badge key={j} variant="outline" className="text-xs">{med}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
