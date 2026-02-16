'use client';

import { FileText, Copy, Check, Tag, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { ICD10Code } from '@/types/ems';

interface NarrativePreviewProps {
  narrative: string;
  icd10Codes: ICD10Code[];
  medicalNecessity: string;
}

export function NarrativePreview({ narrative, icd10Codes, medicalNecessity }: NarrativePreviewProps) {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Narrative */}
      {narrative && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="w-4 h-4 text-primary" />
              <span>Narrative</span>
            </div>
            <button
              onClick={() => copyToClipboard(narrative, 'narrative')}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied === 'narrative' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied === 'narrative' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-sm leading-relaxed whitespace-pre-wrap">
            {narrative}
          </div>
        </div>
      )}

      {/* ICD-10 Codes */}
      {icd10Codes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Tag className="w-4 h-4 text-primary" />
            <span>ICD-10 Codes</span>
          </div>
          <div className="space-y-1.5">
            {icd10Codes.map((code, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-bold text-primary">{code.code}</code>
                    <span className="text-sm">{code.description}</span>
                  </div>
                  {code.rationale && (
                    <p className="text-xs text-muted-foreground mt-0.5">{code.rationale}</p>
                  )}
                </div>
                <span className="text-xs font-mono text-muted-foreground ml-2">
                  {Math.round(code.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Medical Necessity */}
      {medicalNecessity && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Medical Necessity</span>
            </div>
            <button
              onClick={() => copyToClipboard(medicalNecessity, 'necessity')}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {copied === 'necessity' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied === 'necessity' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-sm leading-relaxed">
            {medicalNecessity}
          </div>
        </div>
      )}
    </div>
  );
}
