'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  Clock,
  CheckCircle2,
  Reply,
  Send,
  UserRound,
  Sparkles,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  getPatientQuestions,
  updatePatientQuestion,
} from '@/lib/storage';
import type { PatientQuestion } from '@/types/patient-question';

interface PatientQuestionsPanelProps {
  caseSessionId?: string;
  patientId?: string;
}

const statusConfig = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-amber-100 text-amber-700 border-amber-300' },
  reviewed: { label: 'Reviewed', icon: CheckCircle2, className: 'bg-blue-100 text-blue-700 border-blue-300' },
  replied: { label: 'Replied', icon: Reply, className: 'bg-green-100 text-green-700 border-green-300' },
};

export function PatientQuestionsPanel({ caseSessionId, patientId }: PatientQuestionsPanelProps) {
  const [questions, setQuestions] = useState<PatientQuestion[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const loadQuestions = useCallback(() => {
    let all = getPatientQuestions();
    // Filter by patientId if available, otherwise show all
    if (patientId) {
      all = all.filter(q => q.patientId === patientId);
    }
    setQuestions(all);
  }, [patientId]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleMarkReviewed = useCallback((id: string) => {
    updatePatientQuestion(id, {
      status: 'reviewed',
      reviewedAt: new Date().toISOString(),
    });
    loadQuestions();
  }, [loadQuestions]);

  const handleReply = useCallback((id: string) => {
    if (!replyText.trim()) return;
    updatePatientQuestion(id, {
      status: 'replied',
      clinicianReply: replyText.trim(),
      reviewedAt: new Date().toISOString(),
    });
    setReplyText('');
    setReplyingTo(null);
    loadQuestions();
  }, [replyText, loadQuestions]);

  if (questions.length === 0) return null;

  const pendingCount = questions.filter(q => q.status === 'pending').length;

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-semibold">Patient Questions</h3>
          {pendingCount > 0 && (
            <Badge className="bg-amber-500 text-white text-[10px] px-1.5">
              {pendingCount} new
            </Badge>
          )}
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {questions.map((q) => {
            const sc = statusConfig[q.status];
            const StatusIcon = sc.icon;

            return (
              <div
                key={q.id}
                className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2"
              >
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserRound className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-xs text-muted-foreground">
                      {new Date(q.createdAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <Badge variant="outline" className={`text-[10px] gap-1 ${sc.className}`}>
                    <StatusIcon className="w-2.5 h-2.5" />
                    {sc.label}
                  </Badge>
                </div>

                {/* Patient's question */}
                <div>
                  <p className="text-xs font-medium text-foreground">{q.question}</p>
                </div>

                {/* AI response (collapsed context) */}
                <div className="p-2 bg-surface-100 dark:bg-surface-800 rounded-md">
                  <div className="flex items-center gap-1 mb-1">
                    <Sparkles className="w-2.5 h-2.5 text-indigo-500" />
                    <span className="text-[10px] font-medium text-muted-foreground">AI Response</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-3">{q.aiResponse}</p>
                </div>

                {/* Clinician reply (if any) */}
                {q.clinicianReply && (
                  <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                    <p className="text-[10px] font-medium text-green-700 dark:text-green-400 mb-1">Your Reply</p>
                    <p className="text-xs text-green-800 dark:text-green-300">{q.clinicianReply}</p>
                  </div>
                )}

                {/* Reply form */}
                {replyingTo === q.id && (
                  <div className="space-y-2">
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply to the patient..."
                      className="min-h-[60px] text-xs"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleReply(q.id)}
                        disabled={!replyText.trim()}
                      >
                        <Send className="w-3 h-3" /> Send Reply
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => { setReplyingTo(null); setReplyText(''); }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {q.status !== 'replied' && replyingTo !== q.id && (
                  <div className="flex gap-2">
                    {q.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        onClick={() => handleMarkReviewed(q.id)}
                      >
                        <CheckCircle2 className="w-3 h-3" /> Mark Reviewed
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      onClick={() => setReplyingTo(q.id)}
                    >
                      <Reply className="w-3 h-3" /> Reply
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function usePatientQuestionCount(patientId?: string): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let all = getPatientQuestions();
    if (patientId) {
      all = all.filter(q => q.patientId === patientId);
    }
    setCount(all.filter(q => q.status === 'pending').length);
  }, [patientId]);

  return count;
}
