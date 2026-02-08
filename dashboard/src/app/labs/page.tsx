'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Beaker,
  ArrowLeft,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { LabExtractorCard } from '@/components/case/LabExtractorCard';

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
  const [labResult, setLabResult] = useState<LabExtractionResult | null>(null);
  const [labPreview, setLabPreview] = useState<string | null>(null);
  const [isLabLoading, setIsLabLoading] = useState(false);

  const handleLabUpload = useCallback(async (file: File) => {
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setLabPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setIsLabLoading(true);
    setLabResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';
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
  }, []);

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

        {/* Lab Extraction */}
        <LabExtractorCard
          result={labResult}
          imagePreview={labPreview}
          isLoading={isLabLoading}
          onUpload={handleLabUpload}
          onClear={clearLab}
        />

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
