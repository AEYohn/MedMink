'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { SOAPData } from '@/components/charting/SOAPEditor';
import type { ComplianceFlag, ComplianceScanResult } from '@/types/compliance';
import { runClientCompliance, computeScore } from '@/lib/compliance-rules';
import { getApiUrl } from '@/lib/api-url';

interface UseComplianceScanReturn {
  flags: ComplianceFlag[];
  score: number;
  grade: string;
  claimDenialScore: number;
  malpracticeScore: number;
  rulesChecked: number;
  rulesPassed: number;
  isScanning: boolean;
  applyFix: (flag: ComplianceFlag) => Promise<{ fixedText: string; fieldPath: string } | null>;
  dismissFlag: (ruleId: string, field: string) => void;
  dismissedRules: Set<string>;
}

function makeDismissKey(ruleId: string, field: string): string {
  return `${ruleId}::${field}`;
}

export function useComplianceScan(soapData: SOAPData | null): UseComplianceScanReturn {
  const [aiFlags, setAiFlags] = useState<ComplianceFlag[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [dismissedRules, setDismissedRules] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSoapRef = useRef<string>('');

  // Tier 1: Instant client-side rules (synchronous, runs on every change)
  const clientFlags = useMemo(() => {
    if (!soapData) return [];
    return runClientCompliance(soapData);
  }, [soapData]);

  // Merge client + AI flags, dedup by rule_id + field
  const allFlags = useMemo(() => {
    const seen = new Set<string>();
    const merged: ComplianceFlag[] = [];
    // Client flags take priority
    for (const f of clientFlags) {
      const key = `${f.rule_id}::${f.field}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(f);
      }
    }
    for (const f of aiFlags) {
      const key = `${f.rule_id}::${f.field}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(f);
      }
    }
    return merged;
  }, [clientFlags, aiFlags]);

  // Filter out dismissed
  const visibleFlags = useMemo(() => {
    return allFlags.filter(f => !dismissedRules.has(makeDismissKey(f.rule_id, f.field)));
  }, [allFlags, dismissedRules]);

  // Compute score from all flags (including dismissed, since they still represent issues)
  const result = useMemo(() => computeScore(allFlags), [allFlags]);

  // Tier 2: Debounced AI scan (1s after last edit)
  useEffect(() => {
    if (!soapData) return;

    const soapStr = JSON.stringify(soapData);
    if (soapStr === lastSoapRef.current) return;
    lastSoapRef.current = soapStr;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      const apiUrl = getApiUrl();
      if (!apiUrl) return;

      setIsScanning(true);
      try {
        const resp = await fetch(`${apiUrl}/api/compliance/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ soap: soapData }),
        });
        if (resp.ok) {
          const data: ComplianceScanResult = await resp.json();
          // Only keep AI-generated flags (those not matching client rule IDs)
          const clientRuleIds = new Set(clientFlags.map(f => `${f.rule_id}::${f.field}`));
          const newAiFlags = data.flags.filter(
            f => !clientRuleIds.has(`${f.rule_id}::${f.field}`)
          );
          setAiFlags(newAiFlags);
        }
      } catch {
        // AI scan failure is non-critical
      } finally {
        setIsScanning(false);
      }
    }, 1000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [soapData, clientFlags]);

  const applyFix = useCallback(async (flag: ComplianceFlag) => {
    // If there's a deterministic fix, return it immediately
    if (flag.suggested_fix) {
      return { fixedText: flag.suggested_fix, fieldPath: flag.field };
    }

    const apiUrl = getApiUrl();
    if (!apiUrl || !soapData) return null;

    try {
      const resp = await fetch(`${apiUrl}/api/compliance/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soap: soapData, flag }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return { fixedText: data.fixed_text as string, fieldPath: data.field_path as string };
      }
    } catch {
      // Fix generation failure
    }
    return null;
  }, [soapData]);

  const dismissFlag = useCallback((ruleId: string, field: string) => {
    setDismissedRules(prev => {
      const next = new Set(prev);
      next.add(makeDismissKey(ruleId, field));
      return next;
    });
  }, []);

  return {
    flags: visibleFlags,
    score: result.score,
    grade: result.grade,
    claimDenialScore: result.claim_denial_score,
    malpracticeScore: result.malpractice_score,
    rulesChecked: result.rules_checked,
    rulesPassed: result.rules_passed,
    isScanning,
    applyFix,
    dismissFlag,
    dismissedRules,
  };
}
