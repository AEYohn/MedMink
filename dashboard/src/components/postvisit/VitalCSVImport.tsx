'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

export function VitalCSVImport({
  onImport,
}: {
  onImport: (file: File) => Promise<number>;
}) {
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ count: number; error?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setImporting(true);
    setResult(null);
    try {
      const count = await onImport(file);
      setResult({ count });
    } catch (err) {
      setResult({ count: 0, error: err instanceof Error ? err.message : 'Import failed' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 p-5">
      <h3 className="font-semibold text-sm text-surface-900 dark:text-white mb-3 flex items-center gap-2">
        <Upload className="w-4 h-4 text-teal-500" />
        Import Data
      </h3>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFile(file);
        }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/10'
            : 'border-surface-300 dark:border-surface-600 hover:border-teal-400 hover:bg-surface-50 dark:hover:bg-surface-700/30'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json,.xml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="hidden"
        />
        {importing ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-surface-500">Importing...</p>
          </div>
        ) : (
          <>
            <FileText className="w-8 h-8 text-surface-400 mx-auto mb-2" />
            <p className="text-sm text-surface-700 dark:text-surface-300 font-medium">
              Drop a file or click to browse
            </p>
            <p className="text-xs text-surface-400 mt-1">
              CSV, JSON, or Apple Health XML export
            </p>
          </>
        )}
      </div>

      {result && (
        <div className={`mt-3 flex items-center gap-2 text-sm ${result.error ? 'text-red-600' : 'text-emerald-600'}`}>
          {result.error ? (
            <>
              <AlertCircle className="w-4 h-4" />
              <span>{result.error}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              <span>Imported {result.count} readings</span>
            </>
          )}
        </div>
      )}

      <div className="mt-3 text-[11px] text-surface-400">
        <p className="font-medium mb-1">Supported formats:</p>
        <ul className="space-y-0.5 pl-3">
          <li>• CSV with columns: date, vital_type, value, unit</li>
          <li>• JSON array of readings</li>
          <li>• Apple Health XML export</li>
        </ul>
      </div>
    </div>
  );
}
