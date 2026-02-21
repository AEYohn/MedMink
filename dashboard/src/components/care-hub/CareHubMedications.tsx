'use client';

import { useState, FormEvent } from 'react';
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
  // Drug interaction checker state
  const [extraMeds, setExtraMeds] = useState<{ id: string; name: string }[]>([]);
  const [newMedName, setNewMedName] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<InteractionCheckResult | null>(null);
  const [expandedInteraction, setExpandedInteraction] = useState<string | null>(null);

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
    ...summary.medications.filter(m => m.action !== 'discontinue').map(m => m.name),
    ...extraMeds.map(m => m.name),
  ];

  const handleCheckInteractions = async () => {
    if (allMedNames.length < 2) return;
    setIsChecking(true);
    setCheckResult(null);
    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) return;
      const resp = await fetch(`${apiUrl}/api/patient/medications/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medications: allMedNames }),
      });
      if (!resp.ok) throw new Error('Failed');
      setCheckResult(await resp.json());
    } catch {
      setCheckResult({
        safe: true,
        interactions: [],
        recommendations: ['Unable to check interactions. Please consult your pharmacist.'],
      });
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Medication Table */}
      {summary.medications.length > 0 && (
        <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="w-4 h-4 text-rose-500" />
            <h3 className="font-semibold text-surface-900 dark:text-white">Your Medications</h3>
          </div>
          <div className="rounded-xl border border-surface-200 dark:border-surface-700 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="bg-rose-50/50 dark:bg-surface-700/50 border-b border-surface-200 dark:border-surface-700">
                  <th className="text-left px-4 py-2 text-xs font-medium text-surface-500">Medication</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-surface-500">Dose</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-surface-500">How Often</th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-surface-500">Action</th>
                </tr>
              </thead>
              <tbody>
                {summary.medications.map((med, i) => (
                  <tr key={i} className="border-b last:border-0 border-surface-100 dark:border-surface-700">
                    <td className="px-4 py-2.5 font-medium text-surface-900 dark:text-white">
                      <ExplainableText text={med.name} />
                    </td>
                    <td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">{med.dose || '—'}</td>
                    <td className="px-4 py-2.5 text-surface-600 dark:text-surface-300">{med.frequency || '—'}</td>
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
            {summary.medications.map((med, i) =>
              med.plainLanguageInstructions ? (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs text-surface-500 dark:text-surface-400">
                    {med.plainLanguageInstructions}
                  </span>
                  <button
                    onClick={() => onAskAI(`Why was ${med.name} prescribed? How should I take it?`)}
                    className="flex-shrink-0 text-rose-500 hover:text-rose-600"
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
      {summary.medications.filter(m => m.action !== 'discontinue').length > 0 && (
        <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-purple-500" />
            <h3 className="font-semibold text-sm text-surface-900 dark:text-white">When to Take Your Medications</h3>
          </div>
          <div className="space-y-2">
            {summary.medications
              .filter(m => m.action !== 'discontinue')
              .map((med, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-rose-50/30 dark:bg-surface-700/30 border border-rose-100 dark:border-surface-700 px-4 py-3">
                  <div className="w-2 h-2 rounded-full bg-rose-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-900 dark:text-white">{med.name} {med.dose}</p>
                    <p className="text-xs text-surface-500">{med.frequency}</p>
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
      <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Search className="w-4 h-4 text-rose-500" />
          <h3 className="font-semibold text-surface-900 dark:text-white">Drug Interaction Checker</h3>
        </div>
        <p className="text-xs text-surface-500 dark:text-surface-400 mb-3">
          Add any other medications, supplements, or OTC drugs you take to check for interactions with your prescribed medications.
        </p>

        {/* Extra meds list */}
        {extraMeds.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {extraMeds.map(med => (
              <div key={med.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-rose-50/30 dark:bg-surface-700/30 border border-rose-100 dark:border-surface-700">
                <div className="flex items-center gap-2">
                  <Pill className="w-3.5 h-3.5 text-rose-400" />
                  <span className="text-sm text-surface-900 dark:text-white">{med.name}</span>
                </div>
                <button onClick={() => handleRemoveMed(med.id)} className="p-1 text-surface-400 hover:text-red-500">
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
            className="flex-1 px-3 py-2 bg-rose-50/30 dark:bg-surface-700 border border-rose-100 dark:border-surface-600 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 text-surface-900 dark:text-white placeholder-surface-400"
          />
          <button
            type="submit"
            disabled={!newMedName.trim()}
            className="px-3 py-2 bg-rose-500 hover:bg-rose-600 disabled:bg-surface-300 dark:disabled:bg-surface-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>

        {/* Check button */}
        {allMedNames.length >= 2 && (
          <button
            onClick={handleCheckInteractions}
            disabled={isChecking}
            className="w-full px-4 py-2.5 bg-rose-500 hover:bg-rose-600 disabled:bg-surface-300 dark:disabled:bg-surface-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2"
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
          <p className="text-xs text-center text-surface-400 mt-2 flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" />
            Powered by AI + medical literature
          </p>
        )}
      </div>

      {/* Interaction Results */}
      {checkResult && (
        <div className="rounded-2xl border border-rose-100 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
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
            <div className="divide-y divide-surface-200 dark:divide-surface-700">
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
                          <p className="font-medium text-surface-900 dark:text-white">
                            {interaction.drug1} + {interaction.drug2}
                          </p>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-surface-400" /> : <ChevronDown className="w-5 h-5 text-surface-400" />}
                    </button>
                    {isExpanded && (
                      <div className="mt-4 ml-10 space-y-3">
                        <div>
                          <h4 className="text-xs font-semibold text-surface-500 uppercase">Description</h4>
                          <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">{interaction.description}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-surface-500 uppercase">Recommendation</h4>
                          <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">{interaction.recommendation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {checkResult.recommendations.length > 0 && (
            <div className="p-4 border-t border-surface-200 dark:border-surface-700 bg-rose-50/30 dark:bg-surface-800/50">
              <h4 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-2">Recommendations</h4>
              <ul className="space-y-1">
                {checkResult.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-surface-600 dark:text-surface-400">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-400" />
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
