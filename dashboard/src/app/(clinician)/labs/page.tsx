'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Beaker,
  ArrowLeft,
  Stethoscope,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LabExtractorCard } from '@/components/case/LabExtractorCard';
import { PatientBanner } from '@/components/shared/PatientBanner';
import { usePatientFromUrl } from '@/hooks/usePatientFromUrl';
import { useCaseSession } from '@/hooks/useCaseSession';
import { getApiUrl } from '@/lib/api-url';

interface LabValue {
  test: string;
  value: string;
  unit: string;
  reference_range: string;
  flag: string;
}

interface LabExtractionResult {
  labs: LabValue[];
  collection_date: string;
  patient_info: string;
  model: string;
  error: string;
}

export default function LabsPage() {
  usePatientFromUrl();
  const router = useRouter();
  const caseSession = useCaseSession();
  const [labResult, setLabResult] = useState<LabExtractionResult | null>(null);
  const [labPreview, setLabPreview] = useState<string | null>(null);
  const [isLabLoading, setIsLabLoading] = useState(false);

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const handleLabUpload = useCallback(async (file: File) => {
    setUploadedFile(file);
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setLabPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setIsLabLoading(true);
    setLabResult(null);

    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) return;
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${apiUrl}/api/labs/extract`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Lab extraction failed');
      const data = await response.json();
      setLabResult(data);
    } catch (err) {
      console.error('Lab extraction error:', err);
      setLabResult({
        labs: [],
        collection_date: '',
        patient_info: '',
        model: 'error',
        error: 'Extraction failed — check that the backend is running',
      });
    } finally {
      setIsLabLoading(false);
    }
  }, []);

  const clearLab = useCallback(() => {
    setLabPreview(null);
    setLabResult(null);
    setUploadedFile(null);
  }, []);

  const handleStartCaseAnalysis = useCallback(() => {
    if (!labResult || labResult.labs.length === 0) return;
    const labText = labResult.labs
      .map(l => `${l.test}: ${l.value} ${l.unit}${l.flag !== 'normal' ? ` (${l.flag.toUpperCase()})` : ''} [ref: ${l.reference_range}]`)
      .join('\n');
    const caseText = `Lab Results${labResult.collection_date ? ` (${labResult.collection_date})` : ''}:\n${labText}`;
    const title = `Lab analysis — ${labResult.labs.length} values`;
    caseSession.createSession(caseText, title);
    router.push('/case');
  }, [labResult, caseSession, router]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <header className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Beaker className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Lab Reports</h1>
              <p className="text-sm text-muted-foreground">
                Auto-extract lab values from photos with MedGemma
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] bg-indigo-500/10 border-indigo-500/30 text-indigo-500">
              Document Extraction
            </Badge>
          </div>
        </header>

        <PatientBanner className="mb-4" />

        {/* Lab Extraction */}
        <LabExtractorCard
          result={labResult}
          imagePreview={labPreview}
          isLoading={isLabLoading}
          onUpload={handleLabUpload}
          onClear={clearLab}
        />

        {/* Start Case Analysis with extracted labs */}
        {labResult && labResult.labs.length > 0 && !isLabLoading && (
          <div className="mt-4">
            <Button
              onClick={handleStartCaseAnalysis}
              className="w-full"
              size="lg"
            >
              <Stethoscope className="w-4 h-4 mr-2" />
              Start Case Analysis with These Labs
            </Button>
          </div>
        )}

        {/* Info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            MedGemma 1.5 achieves 78% F1 on medical document extraction
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            For educational purposes only &bull; Always verify extracted values
          </p>
        </div>
      </div>
    </div>
  );
}
