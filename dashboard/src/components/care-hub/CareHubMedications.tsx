'use client';

import { useState, useMemo, FormEvent } from 'react';
import {
  Pill,
  Clock,
  HelpCircle,
  Plus,
  Trash2,
  AlertTriangle,
  Check,
  Search,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { ExplainableText } from '@/components/patient/terms/ExplainableText';
import { getApiUrl } from '@/lib/api-url';
import type { ReleasedVisitSummary } from '@/types/visit-summary';
import { filterActualMedications } from '@/types/visit-summary';

const actionBadge: Record<string, string> = {
  continue: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  new: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  discontinue: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};
const actionLabel: Record<string, string> = {
  continue: 'Continue',
  new: 'New',
  discontinue: 'Stop',
};

interface DrugInteraction {
  drug1: string;
  drug2: string;
  severity: 'major' | 'moderate' | 'minor';
  description: string;
  recommendation: string;
}

interface InteractionCheckResult {
  safe: boolean;
  interactions: DrugInteraction[];
  recommendations: string[];
}

const severityConfig = {
  major: {
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    label: 'Major',
    icon: AlertTriangle,
  },
  moderate: {
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    label: 'Moderate',
    icon: Info,
  },
  minor: {
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    label: 'Minor',
    icon: Info,
  },
};

export function CareHubMedications({
  summary,
  onAskAI,
}: {
  summary: ReleasedVisitSummary;
  onAskAI: (question: string) => void;
}) {
  const medications = useMemo(() => filterActualMedications(summary.medications), [summary.medications]);

  // Drug interaction checker state
  const [extraMeds, setExtraMeds] = useState<{ id: string; name: string }[]>([]);
  const [newMedName, setNewMedName] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<InteractionCheckResult | null>(null);
  const [expandedInteraction, setExpandedInteraction] = useState<string | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  const handleAddMed = (e: FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) return;
    setExtraMeds(prev => [...prev, { id: Date.now().toString(), name: newMedName.trim() }]);
    setNewMedName('');
    setCheckResult(null);
  };

  const handleRemoveMed = (id: string) => {
    setExtraMeds(prev => prev.filter(m => m.id !== id));
    setCheckResult(null);
  };

  const allMedNames = [
    ...medications.filter(m => m.action !== 'discontinue').map(m => m.name),
    ...extraMeds.map(m => m.name),
  ];

  const handleCheckInteractions = async () => {
    if (allMedNames.length < 2) return;
    setIsChecking(true);
    setCheckResult(null);
    setCheckError(null);
    try {
      const apiUrl = getApiUrl();
      const resp = await fetch(`${apiUrl}/api/patient/medications/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medications: allMedNames }),
      });
      if (!resp.ok) throw new Error('Failed');
      setCheckResult(await resp.json());
    } catch {
      setCheckResult(null);
      setCheckError('Unable to check interactions right now. Please try again later or consult your pharmacist.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Medication Table */}
      {medications.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Your Medications</h3>
          </div>
          <div className="rounded-xl border border-border overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Medication</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Dose</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">How Often</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {medications.map((med, i) => (
                  <tr key={i} className="border-b last:border-0 border-border">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <ExplainableText text={med.name} />
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{med.dose || '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{med.frequency || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${actionBadge[med.action] || ''}`}>
                        {actionLabel[med.action] || med.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Plain language instructions */}
          <div className="mt-3 space-y-2">
            {medications.map((med, i) =>
              med.plainLanguageInstructions ? (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground">
                    {med.plainLanguageInstructions}
                  </span>
                  <button
                    onClick={() => onAskAI(`Why was ${med.name} prescribed? How should I take it?`)}
                    className="flex-shrink-0 text-primary hover:text-primary/80"
                  >
                    <HelpCircle className="w-3 h-3" />
                  </button>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}

      {/* When to Take */}
      {medications.filter(m => m.action !== 'discontinue').length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-purple-500" />
            <h3 className="font-semibold text-sm text-foreground">When to Take Your Medications</h3>
          </div>
          <div className="space-y-2">
            {medications
              .filter(m => m.action !== 'discontinue')
              .map((med, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-muted/50 border border-border px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{med.name} {med.dose}</p>
                    <p className="text-xs text-muted-foreground">{med.frequency}</p>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${actionBadge[med.action]}`}>
                    {actionLabel[med.action]}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Drug Interaction Checker */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Drug Interaction Checker</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Add any other medications, supplements, or OTC drugs you take to check for interactions with your prescribed medications.
        </p>

        {/* Extra meds list */}
        {extraMeds.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {extraMeds.map(med => (
              <div key={med.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-center gap-2">
                  <Pill className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm text-foreground">{med.name}</span>
                </div>
                <button onClick={() => handleRemoveMed(med.id)} className="p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add med form */}
        <form onSubmit={handleAddMed} className="flex gap-2 mb-3">
          <input
            type="text"
            value={newMedName}
            onChange={e => setNewMedName(e.target.value)}
            placeholder="e.g., Ibuprofen, Vitamin D..."
            className="flex-1 px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground placeholder-muted-foreground"
          />
          <button
            type="submit"
            disabled={!newMedName.trim()}
            className="px-3 py-2 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>

        {/* Check button */}
        {allMedNames.length >= 2 && (
          <button
            onClick={handleCheckInteractions}
            disabled={isChecking}
            className="w-full px-4 py-2.5 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            {isChecking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Check for Interactions
              </>
            )}
          </button>
        )}

        {allMedNames.length >= 2 && (
          <p className="text-xs text-center text-muted-foreground mt-2 flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" />
            Powered by AI + medical literature
          </p>
        )}
      </div>

      {/* Error State */}
      {checkError && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-card overflow-hidden">
          <div className="p-4 bg-amber-50 dark:bg-amber-900/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">Check Failed</h3>
                <p className="text-sm text-amber-600 dark:text-amber-400">{checkError}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Interaction Results */}
      {checkResult && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div
            className={`p-4 border-b ${
              checkResult.safe
                ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800'
            }`}
          >
            <div className="flex items-center gap-3">
              {checkResult.safe ? (
                <>
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl">
                    <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-emerald-800 dark:text-emerald-200">No Major Interactions Found</h3>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">These medications appear safe together</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-800 dark:text-amber-200">Potential Interactions Detected</h3>
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      {checkResult.interactions.length} interaction(s) found
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {checkResult.interactions.length > 0 && (
            <div className="divide-y divide-border">
              {checkResult.interactions.map((interaction, idx) => {
                const interactionId = `${interaction.drug1}-${interaction.drug2}`;
                const isExpanded = expandedInteraction === interactionId;
                const config = severityConfig[interaction.severity];
                return (
                  <div key={idx} className="p-4">
                    <button
                      onClick={() => setExpandedInteraction(isExpanded ? null : interactionId)}
                      className="w-full flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${config.color}`}>
                          <config.icon className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <p className="font-medium text-foreground">
                            {interaction.drug1} + {interaction.drug2}
                          </p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                    </button>
                    {isExpanded && (
                      <div className="mt-4 ml-10 space-y-3">
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Description</h4>
                          <p className="text-sm text-muted-foreground mt-1">{interaction.description}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase">Recommendation</h4>
                          <p className="text-sm text-muted-foreground mt-1">{interaction.recommendation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {checkResult.recommendations.length > 0 && (
            <div className="p-4 border-t border-border bg-muted/50">
              <h4 className="text-sm font-semibold text-foreground mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {checkResult.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
