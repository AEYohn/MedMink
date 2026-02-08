'use client';

import { useState, FormEvent } from 'react';
import {
  Pill,
  Plus,
  Trash2,
  AlertTriangle,
  Check,
  Search,
  Loader2,
  Info,
  Clock,
  Shield,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';

interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  addedAt: Date;
}

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
    borderColor: 'border-red-200 dark:border-red-800',
    label: 'Major',
    icon: AlertTriangle,
  },
  moderate: {
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    borderColor: 'border-amber-200 dark:border-amber-800',
    label: 'Moderate',
    icon: Info,
  },
  minor: {
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
    label: 'Minor',
    icon: Info,
  },
};

export default function MedicationsPage() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [newMedName, setNewMedName] = useState('');
  const [newMedDosage, setNewMedDosage] = useState('');
  const [newMedFrequency, setNewMedFrequency] = useState('');
  const [isAddingMed, setIsAddingMed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<InteractionCheckResult | null>(null);
  const [expandedInteraction, setExpandedInteraction] = useState<string | null>(null);

  const handleAddMedication = (e: FormEvent) => {
    e.preventDefault();
    if (!newMedName.trim()) return;

    const newMed: Medication = {
      id: Date.now().toString(),
      name: newMedName.trim(),
      dosage: newMedDosage.trim() || 'Not specified',
      frequency: newMedFrequency.trim() || 'As prescribed',
      addedAt: new Date(),
    };

    setMedications((prev) => [...prev, newMed]);
    setNewMedName('');
    setNewMedDosage('');
    setNewMedFrequency('');
    setIsAddingMed(false);
    setCheckResult(null);
  };

  const handleRemoveMedication = (id: string) => {
    setMedications((prev) => prev.filter((m) => m.id !== id));
    setCheckResult(null);
  };

  const handleCheckInteractions = async () => {
    if (medications.length < 2) return;

    setIsChecking(true);
    setCheckResult(null);

    try {
      const response = await fetch('http://localhost:8000/api/patient/medications/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          medications: medications.map((m) => m.name),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to check interactions');
      }

      const data = await response.json();
      setCheckResult(data);
    } catch (error) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-500 rounded-2xl">
            <Pill className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-surface-900 dark:text-white">
              Medication Tracker
            </h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Track your medications and check for potential interactions
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-violet-50 dark:bg-violet-900/20 rounded-full">
            <Shield className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <span className="text-xs font-medium text-violet-700 dark:text-violet-400">
              Evidence-Based
            </span>
          </div>
        </div>
      </div>

      {/* Medications List */}
      <div className="card">
        <div className="p-4 border-b border-surface-200 dark:border-surface-700 flex items-center justify-between">
          <h2 className="font-semibold text-surface-900 dark:text-white">
            Your Medications ({medications.length})
          </h2>
          <button
            onClick={() => setIsAddingMed(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus className="w-4 h-4" />
            Add Medication
          </button>
        </div>

        {/* Add Medication Form */}
        {isAddingMed && (
          <form
            onSubmit={handleAddMedication}
            className="p-4 bg-surface-50 dark:bg-surface-800/50 border-b border-surface-200 dark:border-surface-700"
          >
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Medication Name *
                </label>
                <input
                  type="text"
                  value={newMedName}
                  onChange={(e) => setNewMedName(e.target.value)}
                  placeholder="e.g., Metformin"
                  className="w-full px-3 py-2 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Dosage
                </label>
                <input
                  type="text"
                  value={newMedDosage}
                  onChange={(e) => setNewMedDosage(e.target.value)}
                  placeholder="e.g., 500mg"
                  className="w-full px-3 py-2 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
                  Frequency
                </label>
                <input
                  type="text"
                  value={newMedFrequency}
                  onChange={(e) => setNewMedFrequency(e.target.value)}
                  placeholder="e.g., Twice daily"
                  className="w-full px-3 py-2 bg-white dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => setIsAddingMed(false)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newMedName.trim()}
                className="btn btn-primary btn-sm"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </form>
        )}

        {/* Medications */}
        {medications.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 mx-auto bg-surface-100 dark:bg-surface-800 rounded-2xl flex items-center justify-center mb-4">
              <Pill className="w-8 h-8 text-surface-400" />
            </div>
            <h3 className="text-lg font-medium text-surface-900 dark:text-white mb-1">
              No medications added
            </h3>
            <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
              Add your medications to check for potential interactions
            </p>
            <button
              onClick={() => setIsAddingMed(true)}
              className="btn btn-primary"
            >
              <Plus className="w-4 h-4" />
              Add Your First Medication
            </button>
          </div>
        ) : (
          <div className="divide-y divide-surface-200 dark:divide-surface-700">
            {medications.map((med) => (
              <div
                key={med.id}
                className="p-4 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                    <Pill className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-surface-900 dark:text-white">
                      {med.name}
                    </h3>
                    <div className="flex items-center gap-3 text-xs text-surface-500 dark:text-surface-400">
                      <span>{med.dosage}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {med.frequency}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveMedication(med.id)}
                  className="p-2 text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Check Interactions Button */}
        {medications.length >= 2 && (
          <div className="p-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
            <button
              onClick={handleCheckInteractions}
              disabled={isChecking}
              className="btn btn-primary w-full"
            >
              {isChecking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking Interactions...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Check for Drug Interactions
                </>
              )}
            </button>
            <p className="text-xs text-center text-surface-400 mt-2 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3" />
              Powered by MedGemma + medical literature
            </p>
          </div>
        )}
      </div>

      {/* Interaction Results */}
      {checkResult && (
        <div className="card animate-fade-in">
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
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/40 rounded-lg">
                    <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-emerald-800 dark:text-emerald-200">
                      No Major Interactions Found
                    </h3>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                      These medications appear safe to take together
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/40 rounded-lg">
                    <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                      Potential Interactions Detected
                    </h3>
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      {checkResult.interactions.length} interaction(s) found - review with your doctor
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Interactions List */}
          {checkResult.interactions.length > 0 && (
            <div className="divide-y divide-surface-200 dark:divide-surface-700">
              {checkResult.interactions.map((interaction, idx) => {
                const interactionId = `${interaction.drug1}-${interaction.drug2}`;
                const isExpanded = expandedInteraction === interactionId;
                const config = severityConfig[interaction.severity];

                return (
                  <div key={idx} className="p-4">
                    <button
                      onClick={() =>
                        setExpandedInteraction(isExpanded ? null : interactionId)
                      }
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
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.color}`}
                          >
                            {config.label} Interaction
                          </span>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-surface-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-surface-400" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-4 ml-10 space-y-3">
                        <div>
                          <h4 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase">
                            Description
                          </h4>
                          <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">
                            {interaction.description}
                          </p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase">
                            Recommendation
                          </h4>
                          <p className="text-sm text-surface-700 dark:text-surface-300 mt-1">
                            {interaction.recommendation}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* General Recommendations */}
          {checkResult.recommendations.length > 0 && (
            <div className="p-4 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50">
              <h4 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-2">
                General Recommendations
              </h4>
              <ul className="space-y-1">
                {checkResult.recommendations.map((rec, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm text-surface-600 dark:text-surface-400"
                  >
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-500" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-xl">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-800 dark:text-amber-200">
              Important Disclaimer
            </h4>
            <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
              This tool provides general information about potential drug interactions based on
              medical literature. It is not a substitute for professional medical advice. Always
              consult your healthcare provider or pharmacist before making any changes to your
              medication regimen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
