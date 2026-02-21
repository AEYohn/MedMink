'use client';

import { useState, useMemo } from 'react';
import {
  BookOpen,
  ChevronDown,
  Shield,
  CheckCircle2,
  AlertCircle,
  Info,
  Heart,
  FlaskConical,
  Pill,
} from 'lucide-react';
import { useHealthContext } from '@/components/patient/HealthContextProvider';
import type { GuidelineRef, ConditionEntry } from '@/types/health-context';

const evidenceConfig = {
  strong: {
    label: 'Strong Evidence',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    icon: Shield,
  },
  moderate: {
    label: 'Moderate Evidence',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    icon: AlertCircle,
  },
  'expert-opinion': {
    label: 'Expert Opinion',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    icon: Info,
  },
};

function EvidenceBadge({ level }: { level: GuidelineRef['evidenceLevel'] }) {
  const cfg = evidenceConfig[level];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function GuidelineCard({ guideline }: { guideline: GuidelineRef }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between px-5 py-4 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="font-semibold text-surface-900 dark:text-white">
              {guideline.title}
            </h3>
            <EvidenceBadge level={guideline.evidenceLevel} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-surface-500 dark:text-surface-400">
            <span className="px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 font-medium">
              {guideline.source}
            </span>
            <span>•</span>
            <span>{guideline.condition}</span>
            <span>•</span>
            <span>Updated {new Date(guideline.lastUpdated).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
          </div>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-surface-400 shrink-0 ml-3 mt-1 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-surface-100 dark:border-surface-700">
          <div className="pt-4">
            <p className="text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
              {guideline.summary}
            </p>
          </div>

          {/* Recommendations */}
          <div>
            <h4 className="text-sm font-semibold text-surface-900 dark:text-white mb-2">
              Key Recommendations
            </h4>
            <ul className="space-y-2">
              {guideline.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>

          {/* What this means for you */}
          <div className="rounded-lg bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 p-4">
            <h4 className="text-sm font-semibold text-rose-800 dark:text-rose-300 mb-1 flex items-center gap-1.5">
              <Heart className="w-4 h-4" />
              What This Means for You
            </h4>
            <p className="text-sm text-rose-700 dark:text-rose-400 leading-relaxed">
              {guideline.whatItMeansForYou}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ConditionOverview({ condition, guidelines, medications, labs }: {
  condition: ConditionEntry;
  guidelines: GuidelineRef[];
  medications: string[];
  labs: string[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between text-left"
      >
        <div>
          <h3 className="font-semibold text-surface-900 dark:text-white">{condition.name}</h3>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">
            {condition.description}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              condition.status === 'active'
                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                : condition.status === 'managed'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-surface-100 text-surface-600 dark:bg-surface-700 dark:text-surface-400'
            }`}
          >
            {condition.status}
          </span>
          <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-700 space-y-3">
          {guidelines.length > 0 && (
            <div>
              <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-1 flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> Related Guidelines
              </p>
              <div className="flex flex-wrap gap-1.5">
                {guidelines.map((g) => (
                  <span key={g.id} className="px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-xs text-surface-700 dark:text-surface-300">
                    {g.title}
                  </span>
                ))}
              </div>
            </div>
          )}
          {medications.length > 0 && (
            <div>
              <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-1 flex items-center gap-1">
                <Pill className="w-3 h-3" /> Related Medications
              </p>
              <div className="flex flex-wrap gap-1.5">
                {medications.map((m) => (
                  <span key={m} className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-xs text-blue-700 dark:text-blue-400">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}
          {labs.length > 0 && (
            <div>
              <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-1 flex items-center gap-1">
                <FlaskConical className="w-3 h-3" /> Labs to Track
              </p>
              <div className="flex flex-wrap gap-1.5">
                {labs.map((l) => (
                  <span key={l} className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-400">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Mapping conditions → relevant meds and labs for the overview section
const conditionMedMap: Record<string, string[]> = {
  'STEMI': ['Aspirin', 'Clopidogrel', 'Atorvastatin', 'Metoprolol', 'Nitroglycerin'],
  'Hypertension': ['Lisinopril', 'Metoprolol'],
  'Hyperlipidemia': ['Atorvastatin'],
  'Type 2 Diabetes': ['Metformin'],
  'Coronary Artery Disease': ['Aspirin', 'Clopidogrel', 'Atorvastatin', 'Nitroglycerin'],
};
const conditionLabMap: Record<string, string[]> = {
  'STEMI': ['Troponin', 'BNP', 'CRP'],
  'Hypertension': ['BUN', 'Creatinine', 'Potassium'],
  'Hyperlipidemia': ['LDL', 'HDL', 'Triglycerides', 'Total Cholesterol'],
  'Type 2 Diabetes': ['HbA1c', 'Glucose', 'Creatinine'],
  'Coronary Artery Disease': ['Troponin', 'BNP', 'LDL'],
};

export default function GuidelinesPage() {
  const { context } = useHealthContext();
  const [conditionFilter, setConditionFilter] = useState<string>('all');

  const guidelines = context?.guidelines ?? [];
  const conditions = context?.conditions ?? [];

  // Unique condition names from guidelines
  const conditionOptions = useMemo(() => {
    const set = new Set(guidelines.map((g) => g.condition));
    return ['all', ...Array.from(set)];
  }, [guidelines]);

  const filteredGuidelines = useMemo(() => {
    if (conditionFilter === 'all') return guidelines;
    return guidelines.filter((g) => g.condition === conditionFilter);
  }, [guidelines, conditionFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl">
          <BookOpen className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white">
            Guidelines & Reference
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            Evidence-based health information personalized for you
          </p>
        </div>
      </div>

      {/* My Conditions */}
      <section>
        <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-3">
          My Conditions
        </h2>
        <div className="space-y-3">
          {conditions.map((c) => {
            const key = Object.keys(conditionMedMap).find((k) => c.name.includes(k)) ?? '';
            const relatedGuidelines = guidelines.filter((g) =>
              g.condition.toLowerCase().includes(c.name.split('(')[0].trim().toLowerCase()) ||
              c.name.toLowerCase().includes(g.condition.split('/')[0].trim().toLowerCase())
            );
            return (
              <ConditionOverview
                key={c.name}
                condition={c}
                guidelines={relatedGuidelines}
                medications={conditionMedMap[key] ?? []}
                labs={conditionLabMap[key] ?? []}
              />
            );
          })}
        </div>
      </section>

      {/* Guidelines */}
      <section>
        <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-3">
          Clinical Guidelines
        </h2>

        {/* Filter */}
        <div className="flex flex-wrap gap-2 mb-4">
          {conditionOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => setConditionFilter(opt)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                conditionFilter === opt
                  ? 'bg-emerald-500 text-white'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200 dark:bg-surface-800 dark:text-surface-400 dark:hover:bg-surface-700'
              }`}
            >
              {opt === 'all' ? 'All' : opt}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {filteredGuidelines.map((g) => (
            <GuidelineCard key={g.id} guideline={g} />
          ))}
        </div>
      </section>
    </div>
  );
}
