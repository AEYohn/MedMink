'use client';

import { useRef, useEffect } from 'react';
import { FileText, Copy, Check, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface TranscriptDisplayProps {
  transcript: string;
  isInterim?: boolean;
  corrections?: Array<{ original: string; corrected: string }>;
  onTranscriptEdit?: (newTranscript: string) => void;
  readOnly?: boolean;
}

export function TranscriptDisplay({
  transcript,
  isInterim = false,
  corrections = [],
  onTranscriptEdit,
  readOnly = false,
}: TranscriptDisplayProps) {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom as transcript updates
  useEffect(() => {
    if (textareaRef.current && isInterim) {
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [transcript, isInterim]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Highlight corrections in transcript
  const getHighlightedTranscript = () => {
    if (corrections.length === 0) return transcript;

    let highlighted = transcript;
    corrections.forEach(({ original, corrected }) => {
      const regex = new RegExp(`\\b${original}\\b`, 'gi');
      highlighted = highlighted.replace(
        regex,
        `~~${original}~~ **${corrected}**`
      );
    });
    return highlighted;
  };

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-base">Transcript</CardTitle>
            {isInterim && (
              <Badge variant="secondary" className="text-xs">
                Live
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {wordCount} words
            </Badge>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleCopy}
              disabled={!transcript}
              className="h-8 w-8"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {transcript ? (
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={transcript}
              onChange={(e) => onTranscriptEdit?.(e.target.value)}
              readOnly={readOnly}
              className={cn(
                'min-h-[200px] resize-none font-mono text-sm',
                isInterim && 'border-amber-500/50',
                readOnly && 'cursor-default'
              )}
              placeholder="Dictation will appear here..."
            />
            {isInterim && (
              <div className="absolute bottom-2 right-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="w-10 h-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Start dictating to see your transcript here
            </p>
          </div>
        )}

        {/* Corrections Display */}
        {corrections.length > 0 && (
          <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/30">
            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2">
              Medical Term Corrections Applied:
            </p>
            <div className="flex flex-wrap gap-2">
              {corrections.map((correction, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="text-xs bg-green-500/20 text-green-700 dark:text-green-400"
                >
                  <span className="line-through mr-1">{correction.original}</span>
                  <span className="font-semibold">{correction.corrected}</span>
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
