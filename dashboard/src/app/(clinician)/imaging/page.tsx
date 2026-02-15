'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Camera,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ImageAnalysisCard } from '@/components/case/ImageAnalysisCard';
import { getApiUrl } from '@/lib/api-url';

interface ImageAnalysisResult {
  modality: string;
  findings: string[];
  impression: string;
  differential_diagnoses: string[];
  confidence: number;
  recommendations: string[];
  model: string;
}

export default function ImagingPage() {
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
      if (!apiUrl) return;
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
