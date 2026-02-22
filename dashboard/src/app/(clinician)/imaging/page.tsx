'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Camera,
  ArrowLeft,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ImageAnalysisCard } from '@/components/case/ImageAnalysisCard';
import { PatientBanner } from '@/components/shared/PatientBanner';
import { usePatientFromUrl } from '@/hooks/usePatientFromUrl';
import { getApiUrl } from '@/lib/api-url';

interface ImageAnalysisResult {
  modality: string;
  findings: string[];
  impression: string;
  differential_diagnoses: string[];
  confidence: number;
  recommendations: string[];
  model: string;
  limitations?: string;
}

const SUPPORTED_MEDICAL_MODALITIES = ['xray', 'ct', 'mri', 'dermoscopy', 'pathology', 'fundus', 'oct'];

export default function ImagingPage() {
  usePatientFromUrl();
  const [imageResult, setImageResult] = useState<ImageAnalysisResult | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);

  const handleImageUpload = useCallback(async (file: File) => {
    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setIsImageLoading(true);
    setImageResult(null);

    try {
      const apiUrl = getApiUrl();
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${apiUrl}/api/case/image/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Image analysis failed');
      const data = await response.json();
      setImageResult(data);
    } catch (err) {
      console.error('Image analysis error:', err);
      setImageResult({
        modality: 'unknown',
        findings: ['Analysis failed — check that the backend is running'],
        impression: 'Unable to complete analysis',
        differential_diagnoses: [],
        confidence: 0,
        recommendations: ['Retry or check backend logs'],
        model: 'error',
      });
    } finally {
      setIsImageLoading(false);
    }
  }, []);

  const clearImage = useCallback(() => {
    setImagePreview(null);
    setImageResult(null);
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
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Medical Imaging</h1>
              <p className="text-sm text-muted-foreground">
                AI-powered image analysis with MedGemma Multimodal
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] bg-teal-500/10 border-teal-500/30 text-teal-500">
              MedGemma Multimodal
            </Badge>
          </div>
        </header>

        <PatientBanner className="mb-4" />

        {/* Non-medical modality warning */}
        {imageResult && !SUPPORTED_MEDICAL_MODALITIES.includes(imageResult.modality) && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-600 dark:text-amber-400">
                This appears to be a regular photograph, not a medical scan.
              </p>
              <p className="text-muted-foreground mt-1">
                MedGemma is optimized for medical imaging (X-ray, CT, MRI, dermoscopy, pathology). Results on consumer photos may be unreliable.
              </p>
              {imageResult.limitations && (
                <p className="text-muted-foreground mt-1 italic">{imageResult.limitations}</p>
              )}
            </div>
          </div>
        )}

        {/* Image Analysis */}
        <ImageAnalysisCard
          result={imageResult}
          imagePreview={imagePreview}
          isLoading={isImageLoading}
          onUpload={handleImageUpload}
          onClear={clearImage}
        />

        {/* Info */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            Supported modalities: Chest X-ray &bull; CT &bull; MRI &bull; Dermoscopy &bull; Pathology &bull; Fundoscopy
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            For educational purposes only &bull; Always correlate with clinical findings
          </p>
        </div>
      </div>
    </div>
  );
}
