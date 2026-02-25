'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Stethoscope, Loader2, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { TriageResult } from '@/components/interview/TriageResult';
import { getIntakeResults } from '@/lib/storage';
import { getApiUrl } from '@/lib/api-url';
import { useRole } from '@/contexts/RoleContext';
import { useTranslation } from '@/i18n';
import { buildVignetteFromTriage } from '@/lib/build-vignette';
import { getPatient, getPatientAge } from '@/lib/patient-storage';
import type { IntakeTriageResult } from '@/types/intake';

const API_URL = getApiUrl() || '';

function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .catch((err) => {
      if (err.name === 'AbortError') throw new Error('Request timed out. Please try again.');
      throw err;
    })
    .finally(() => clearTimeout(timeout));
}

export default function CheckinDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { setRole } = useRole();
  const { t, bcp47 } = useTranslation();
  const [intake, setIntake] = useState<IntakeTriageResult | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isHandingOff, setIsHandingOff] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    const id = params.id as string;
    const results = getIntakeResults();
    const found = results.find((r) => r.id === id);
    if (found) {
      setIntake(found);
    } else {
      setNotFound(true);
    }
  }, [params.id]);

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-muted-foreground">Check-in not found</p>
        <button
          onClick={() => router.push('/patient')}
          className="text-sm text-primary hover:underline"
        >
          Back to home
        </button>
      </div>
    );
  }

  if (!intake) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleHandoff = async () => {
    if (isHandingOff) return;
    setIsHandingOff(true);
    setError(null);
    try {
      // Try backend handoff first
      try {
        const res = await fetchWithTimeout(`${API_URL}/api/interview/${intake.sessionId}/handoff`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_history: intake.conversationHistory?.map(m => ({ role: m.role, content: m.content })) || [],
            phase: 'complete',
          }),
        }, 30000);
        if (res.ok) {
          const data = await res.json();
          if (data.vignette) {
            sessionStorage.setItem('handoff-vignette', data.vignette);
            if (data.management_plan) {
              sessionStorage.setItem('handoff-management-plan', JSON.stringify(data.management_plan));
            }
            if (data.recommended_imaging?.length) {
              sessionStorage.setItem('handoff-imaging', JSON.stringify(data.recommended_imaging));
            }
            if (intake.patientId) sessionStorage.setItem('handoff-patient-id', intake.patientId);
            setRole('clinician');
            router.push('/case?from=interview');
            return;
          }
        }
      } catch {
        // Fall through to local vignette
      }

      // Fallback: build vignette from saved triage data
      const linkedPatient = intake.patientId ? getPatient(intake.patientId) : null;
      const vignette = buildVignetteFromTriage(
        intake.triageData,
        linkedPatient ? { age: getPatientAge(linkedPatient), sex: linkedPatient.sex } : undefined,
      );
      sessionStorage.setItem('handoff-vignette', vignette);
      sessionStorage.setItem('handoff-management-plan', JSON.stringify({
        triage: { esi_level: intake.triageData.esi_level, reasoning: intake.triageData.esi_reasoning },
        red_flags: intake.triageData.red_flags,
        recommended_setting: intake.triageData.recommended_setting,
      }));
      if (intake.patientId) sessionStorage.setItem('handoff-patient-id', intake.patientId);
      setRole('clinician');
      router.push('/case?from=interview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Handoff failed');
    } finally {
      setIsHandingOff(false);
    }
  };

  return (
    <div className="space-y-4 py-4">
      {/* Back button */}
      <button
        onClick={() => router.push('/patient')}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {intake.triageData.chief_complaint || 'Check-in details'}
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date(intake.completedAt).toLocaleDateString(bcp47, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* Triage details */}
      <div className="rounded-xl border border-border bg-card p-4">
        <TriageResult triage={intake.triageData} />
      </div>

      {/* Conversation History */}
      {intake.conversationHistory && intake.conversationHistory.length > 0 && (
        <div className="border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setShowHistory(prev => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              Conversation History
              <span className="text-xs text-muted-foreground font-normal">({intake.conversationHistory.length} messages)</span>
            </div>
            {showHistory ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
          {showHistory && (
            <div className="border-t border-border px-4 py-4 max-h-96 overflow-y-auto space-y-3">
              {intake.conversationHistory.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                    }`}
                  >
                    <p dir="auto" className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.transcript && msg.transcript !== 'transcribing'
                        ? msg.transcript
                        : msg.content}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Prepare for clinician */}
      <button
        onClick={handleHandoff}
        disabled={isHandingOff}
        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-50"
      >
        {isHandingOff ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Preparing...
          </>
        ) : (
          <>
            <Stethoscope className="w-4 h-4" />
            {t('intake.prepareClinician')}
          </>
        )}
      </button>
    </div>
  );
}
