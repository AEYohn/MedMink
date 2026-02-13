'use client';

import {
  User,
  Activity,
  Beaker,
  Pill,
  Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ParsedCase } from '@/types/case';

interface CaseSummaryCardProps {
  parsedCase: ParsedCase;
}

export function CaseSummaryCard({ parsedCase }: CaseSummaryCardProps) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold">Case Summary</span>
          {parsedCase.case_category && (
            <Badge variant="secondary" className="text-xs">{parsedCase.case_category}</Badge>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Patient */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <User className="w-3.5 h-3.5 text-blue-500" />
              Patient
            </div>
            <div className="text-sm">
              <p className="font-medium">{parsedCase.patient?.age} {parsedCase.patient?.sex}</p>
              {parsedCase.patient?.relevant_history?.length > 0 && (
                <ul className="text-xs text-muted-foreground mt-0.5 space-y-0.5">
                  {parsedCase.patient.relevant_history.slice(0, 3).map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                  {parsedCase.patient.relevant_history.length > 3 && (
                    <li className="italic">+{parsedCase.patient.relevant_history.length - 3} more</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {/* Presentation */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Activity className="w-3.5 h-3.5 text-purple-500" />
              Presentation
            </div>
            <div className="text-xs text-muted-foreground">
              <p>{parsedCase.findings?.presentation}</p>
              {parsedCase.findings?.timeline && (
                <p className="flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  {parsedCase.findings.timeline}
                </p>
              )}
            </div>
          </div>

          {/* Key Findings */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Beaker className="w-3.5 h-3.5 text-green-500" />
              Key Findings
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {parsedCase.findings?.labs?.slice(0, 3).map((lab, i) => (
                <p key={i}>{lab}</p>
              ))}
              {parsedCase.findings?.imaging?.slice(0, 2).map((img, i) => (
                <p key={`img-${i}`}>{img}</p>
              ))}
            </div>
          </div>

          {/* Current Management */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Pill className="w-3.5 h-3.5 text-amber-500" />
              Current Meds
            </div>
            <div className="text-xs text-muted-foreground space-y-0.5">
              {parsedCase.management?.medications?.slice(0, 4).map((med, i) => (
                <p key={i}>{med}</p>
              ))}
              {parsedCase.management?.recent_changes && (
                <p className="italic">{parsedCase.management.recent_changes}</p>
              )}
            </div>
          </div>
        </div>

        {/* Clinical Question */}
        {parsedCase.clinical_question && (
          <div className="mt-3 p-2 bg-primary/5 rounded-md border border-primary/20">
            <p className="text-xs font-medium text-primary">
              Q: {parsedCase.clinical_question}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
