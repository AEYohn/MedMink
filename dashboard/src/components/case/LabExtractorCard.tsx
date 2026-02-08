'use client';

import { useState } from 'react';
import {
  Beaker,
  Upload,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LabValue {
  test: string;
  value: string;
  unit: string;
  reference_range: string;
  flag: string; // normal|high|low|critical_high|critical_low
}

interface LabExtractionResult {
  labs: LabValue[];
  collection_date: string;
  patient_info: string;
  model: string;
  error: string;
}

interface LabExtractorCardProps {
  result: LabExtractionResult | null;
  imagePreview: string | null;
  isLoading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  onImportToCase?: (labText: string) => void;
}

function flagColor(flag: string) {
  switch (flag) {
    case 'critical_high':
    case 'critical_low':
      return 'bg-red-500/10 text-red-700 border-red-500/30';
    case 'high':
      return 'bg-amber-500/10 text-amber-700 border-amber-500/30';
    case 'low':
      return 'bg-blue-500/10 text-blue-700 border-blue-500/30';
    default:
      return 'bg-green-500/10 text-green-700 border-green-500/30';
  }
}

function flagLabel(flag: string) {
  switch (flag) {
    case 'critical_high': return 'CRIT HIGH';
    case 'critical_low': return 'CRIT LOW';
    case 'high': return 'HIGH';
    case 'low': return 'LOW';
    default: return 'NORMAL';
  }
}

export function LabExtractorCard({
  result,
  imagePreview,
  isLoading,
  onUpload,
  onClear,
  onImportToCase,
}: LabExtractorCardProps) {
  const [selectedLabs, setSelectedLabs] = useState<Set<number>>(new Set());

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

  const toggleLab = (i: number) => {
    setSelectedLabs(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const selectAll = () => {
    if (result) {
      setSelectedLabs(new Set(result.labs.map((_, i) => i)));
    }
  };

  const handleImport = () => {
    if (!result || !onImportToCase) return;
    const labs = result.labs
      .filter((_, i) => selectedLabs.has(i))
      .map(l => `${l.test}: ${l.value} ${l.unit}${l.flag !== 'normal' ? ` (${l.flag.toUpperCase()})` : ''}`)
      .join(', ');
    onImportToCase(labs);
  };

  const abnormalCount = result?.labs.filter(l => l.flag !== 'normal').length || 0;

  return (
    <Card className="border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-transparent">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Beaker className="w-5 h-5 text-indigo-600" />
          <CardTitle>Lab Report Extraction</CardTitle>
          {result?.model && (
            <Badge variant="outline" className="text-[10px] bg-indigo-500/10 border-indigo-500/30 text-indigo-600">
              MedGemma Multimodal
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
            className="border-2 border-dashed border-indigo-500/30 rounded-xl p-8 text-center hover:border-indigo-500/60 hover:bg-indigo-500/5 transition-all cursor-pointer"
          >
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
              id="lab-upload"
            />
            <label htmlFor="lab-upload" className="cursor-pointer">
              <Upload className="w-10 h-10 mx-auto text-indigo-500/50 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">
                Drop a lab report photo or click to browse
              </p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Upload a photo of your lab results for auto-extraction
              </p>
            </label>
          </div>
        )}

        {/* Image Preview */}
        {imagePreview && (
          <div className="relative">
            <img
              src={imagePreview}
              alt="Lab report"
              className="w-full max-h-48 object-contain rounded-lg border bg-white"
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
          <div className="flex items-center gap-3 p-4 bg-indigo-500/10 rounded-lg">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            <div>
              <p className="text-sm font-medium">Extracting lab values...</p>
              <p className="text-xs text-muted-foreground">Using MedGemma document extraction</p>
            </div>
          </div>
        )}

        {/* Error */}
        {result?.error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <p className="text-sm text-destructive">{result.error}</p>
          </div>
        )}

        {/* Results Table */}
        {result && result.labs.length > 0 && !isLoading && (
          <div className="space-y-3 animate-fade-in">
            {/* Summary */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {result.labs.length} values extracted
                {abnormalCount > 0 && (
                  <span className="text-amber-600 font-medium">
                    {' '}({abnormalCount} abnormal)
                  </span>
                )}
              </p>
              {result.collection_date && (
                <Badge variant="outline" className="text-[10px]">
                  {result.collection_date}
                </Badge>
              )}
            </div>

            {/* Lab Values Table */}
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2 font-medium text-muted-foreground w-8">
                      <input
                        type="checkbox"
                        checked={selectedLabs.size === result.labs.length}
                        onChange={selectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left p-2 font-medium text-muted-foreground">Test</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Value</th>
                    <th className="text-right p-2 font-medium text-muted-foreground">Reference</th>
                    <th className="text-center p-2 font-medium text-muted-foreground">Flag</th>
                  </tr>
                </thead>
                <tbody>
                  {result.labs.map((lab, i) => (
                    <tr
                      key={i}
                      className={cn(
                        'border-t cursor-pointer hover:bg-muted/30 transition-colors',
                        lab.flag !== 'normal' && 'bg-amber-500/5',
                        selectedLabs.has(i) && 'bg-indigo-500/10',
                      )}
                      onClick={() => toggleLab(i)}
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={selectedLabs.has(i)}
                          onChange={() => toggleLab(i)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-2 font-medium">{lab.test}</td>
                      <td className={cn(
                        'p-2 text-right font-mono',
                        lab.flag !== 'normal' && 'font-bold',
                        lab.flag.includes('critical') && 'text-red-600',
                        lab.flag === 'high' && 'text-amber-600',
                        lab.flag === 'low' && 'text-blue-600',
                      )}>
                        {lab.value} {lab.unit}
                      </td>
                      <td className="p-2 text-right text-muted-foreground text-xs">
                        {lab.reference_range}
                      </td>
                      <td className="p-2 text-center">
                        <Badge variant="outline" className={cn('text-[10px]', flagColor(lab.flag))}>
                          {flagLabel(lab.flag)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Import Button */}
            {onImportToCase && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleImport}
                disabled={selectedLabs.size === 0}
                className="w-full border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                Import {selectedLabs.size} Selected Labs to Case
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
