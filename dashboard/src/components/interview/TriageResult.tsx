'use client';

import type { TriageData } from '@/types/intake';

const ESI_CONFIG: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Immediate', color: 'text-red-700 dark:text-red-300', bg: 'bg-red-500/20 border-red-500/30' },
  2: { label: 'Emergent', color: 'text-orange-700 dark:text-orange-300', bg: 'bg-orange-500/20 border-orange-500/30' },
  3: { label: 'Urgent', color: 'text-yellow-700 dark:text-yellow-300', bg: 'bg-yellow-500/20 border-yellow-500/30' },
  4: { label: 'Less Urgent', color: 'text-blue-700 dark:text-blue-300', bg: 'bg-blue-500/20 border-blue-500/30' },
  5: { label: 'Non-Urgent', color: 'text-green-700 dark:text-green-300', bg: 'bg-green-500/20 border-green-500/30' },
};

const SETTING_LABELS: Record<string, string> = {
  ER: 'Emergency Room',
  urgent_care: 'Urgent Care',
  primary_care: 'Primary Care',
  telehealth: 'Telehealth',
  self_care: 'Self-Care',
};

interface TriageResultProps {
  triage: TriageData;
}

export function TriageResult({ triage }: TriageResultProps) {
  const esi = ESI_CONFIG[triage.esi_level] || ESI_CONFIG[3];
  const settingLabel = SETTING_LABELS[triage.recommended_setting] || triage.recommended_setting;

  return (
    <div className="space-y-4">
      {/* ESI + Setting Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border ${esi.bg}`}>
          <span className={`text-2xl font-bold ${esi.color}`}>ESI {triage.esi_level}</span>
          <span className={`text-sm font-medium ${esi.color}`}>{esi.label}</span>
        </div>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-muted/50">
          <span className="text-sm font-medium">{settingLabel}</span>
        </div>
      </div>

      {/* Red Flags */}
      {triage.red_flags.length > 0 && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">Red Flags</p>
          <ul className="space-y-0.5">
            {triage.red_flags.map((flag, i) => (
              <li key={i} className="text-sm text-red-600 dark:text-red-400 flex items-start gap-1">
                <span className="mt-1">•</span> {flag}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Reasoning */}
      <div className="space-y-2">
        {triage.esi_reasoning && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">ESI Reasoning</p>
            <p className="text-sm mt-0.5">{triage.esi_reasoning}</p>
          </div>
        )}
        {triage.setting_reasoning && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Setting Rationale</p>
            <p className="text-sm mt-0.5">{triage.setting_reasoning}</p>
          </div>
        )}
      </div>

      {/* Chief Complaint + HPI */}
      <div className="border-t border-border pt-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Chief Complaint</p>
        <p className="text-sm">{triage.chief_complaint}</p>

        {triage.hpi && Object.values(triage.hpi).some(Boolean) && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {triage.hpi.onset && <Detail label="Onset" value={triage.hpi.onset} />}
            {triage.hpi.location && <Detail label="Location" value={triage.hpi.location} />}
            {triage.hpi.duration && <Detail label="Duration" value={triage.hpi.duration} />}
            {triage.hpi.character && <Detail label="Character" value={triage.hpi.character} />}
            {triage.hpi.severity && <Detail label="Severity" value={triage.hpi.severity} />}
            {triage.hpi.aggravating && <Detail label="Worse with" value={triage.hpi.aggravating} />}
            {triage.hpi.relieving && <Detail label="Better with" value={triage.hpi.relieving} />}
          </div>
        )}
      </div>

      {/* ROS */}
      {triage.review_of_systems && (
        <div className="border-t border-border pt-3 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Review of Systems</p>
          {triage.review_of_systems.positive && triage.review_of_systems.positive.length > 0 && (
            <p className="text-sm"><span className="font-medium text-red-600 dark:text-red-400">+</span> {triage.review_of_systems.positive.join(', ')}</p>
          )}
          {triage.review_of_systems.negative && triage.review_of_systems.negative.length > 0 && (
            <p className="text-sm"><span className="font-medium text-green-600 dark:text-green-400">-</span> {triage.review_of_systems.negative.join(', ')}</p>
          )}
        </div>
      )}

      {/* PMH, Meds, Allergies */}
      <div className="border-t border-border pt-3 grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Past History</p>
          {triage.past_medical_history.length > 0 ? (
            <ul className="space-y-0.5">
              {triage.past_medical_history.map((h, i) => (
                <li key={i} className="text-xs">{h}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">None reported</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Medications</p>
          {triage.medications.length > 0 ? (
            <ul className="space-y-0.5">
              {triage.medications.map((m, i) => (
                <li key={i} className="text-xs">{m}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">None reported</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Allergies</p>
          {triage.allergies.length > 0 ? (
            <ul className="space-y-0.5">
              {triage.allergies.map((a, i) => (
                <li key={i} className="text-xs">{a}</li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">NKDA</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted-foreground">{label}:</span>
      <span className="text-xs ml-1">{value}</span>
    </div>
  );
}
