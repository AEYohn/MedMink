'use client';

import {
  Camera,
  AlertTriangle,
  CheckCircle2,
  Upload,
  X,
  Loader2,
  Stethoscope,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImageAnalysisResult {
  modality: string;
  findings: string[];
  impression: string;
  differential_diagnoses: string[];
  confidence: number;
  recommendations: string[];
  model: string;
}

interface ImageAnalysisCardProps {
  result: ImageAnalysisResult | null;
  imagePreview: string | null;
  isLoading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  onImportToCase?: (findings: string[]) => void;
}

export function ImageAnalysisCard({
  result,
  imagePreview,
  isLoading,
  onUpload,
  onClear,
  onImportToCase,
}: ImageAnalysisCardProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      onUpload(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
  };

  const confidenceColor = (c: number) => {
    if (c >= 0.7) return 'text-green-600 bg-green-500/10 border-green-500/30';
    if (c >= 0.4) return 'text-amber-600 bg-amber-500/10 border-amber-500/30';
    return 'text-red-600 bg-red-500/10 border-red-500/30';
  };

  return (
    <Card className="border-teal-500/30 bg-gradient-to-br from-teal-500/5 to-transparent">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-teal-600" />
          <CardTitle>Medical Image Analysis</CardTitle>
          {result?.model && (
            <Badge variant="outline" className="text-[10px] bg-teal-500/10 border-teal-500/30 text-teal-600">
              {result.model === 'medgemma_multimodal' ? 'MedGemma Multimodal' : result.model}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Zone */}
        {!imagePreview && !result && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-teal-500/30 rounded-xl p-8 text-center hover:border-teal-500/60 hover:bg-teal-500/5 transition-all cursor-pointer"
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
              id="image-upload"
            />
            <label htmlFor="image-upload" className="cursor-pointer">
              <Upload className="w-10 h-10 mx-auto text-teal-500/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                Drop a medical image or click to browse
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Supports: X-ray, CT, MRI, Pathology, Dermoscopy
              </p>
            </label>
          </div>
        )}

        {/* Image Preview + Loading */}
        {imagePreview && (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Medical image"
              className="w-full max-h-64 object-contain rounded-lg border bg-black/5"
            />
            <button
              onClick={onClear}
              className="absolute top-2 right-2 w-7 h-7 bg-destructive/90 rounded-full flex items-center justify-center hover:bg-destructive transition-colors"
            >
              <X className="w-4 h-4 text-destructive-foreground" />
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-3 p-4 bg-teal-500/10 rounded-lg">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            <div>
              <p className="text-sm font-medium">Analyzing image with MedGemma...</p>
              <p className="text-xs text-muted-foreground">This may take 15-30 seconds</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !isLoading && (
          <div className="space-y-4 animate-fade-in">
            {/* Modality + Confidence */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-medium">
                  {result.modality || 'Unknown'}
                </Badge>
              </div>
              <Badge variant="outline" className={cn('font-semibold', confidenceColor(result.confidence))}>
                {Math.round(result.confidence * 100)}% confidence
              </Badge>
            </div>

            {/* Findings */}
            {result.findings.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 mb-2">
                  Findings
                </p>
                <ul className="space-y-1.5">
                  {result.findings.map((finding, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-500 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Impression */}
            {result.impression && (
              <div className="p-3 bg-teal-500/10 rounded-lg border border-teal-500/20">
                <p className="text-xs font-semibold uppercase tracking-wider text-teal-600 mb-1">
                  Impression
                </p>
                <p className="text-sm font-medium">{result.impression}</p>
              </div>
            )}

            {/* Differential Diagnoses */}
            {result.differential_diagnoses.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Differential Diagnoses
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.differential_diagnoses.map((dx, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {dx}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Recommendations
                </p>
                <ul className="space-y-1">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Import to Case button */}
            {onImportToCase && result.findings.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onImportToCase(result.findings)}
                className="w-full border-teal-500/30 text-teal-600 hover:bg-teal-500/10"
              >
                <Stethoscope className="w-4 h-4 mr-2" />
                Import Findings to Case Analysis
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
