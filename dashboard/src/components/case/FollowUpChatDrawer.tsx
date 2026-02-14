'use client';

import { useRef, useEffect, FormEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageCircle, Send, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { FollowUpMessage } from '@/types/case';

interface FollowUpChatDrawerProps {
  isOpen: boolean;
  onToggle: () => void;
  followUpMessages: FollowUpMessage[];
  followUpInput: string;
  setFollowUpInput: (value: string) => void;
  handleFollowUpSubmit: (question: string) => void;
  isFollowUpLoading: boolean;
  suggestedQuestions: string[];
  followUpEndRef: React.RefObject<HTMLDivElement>;
}

export function FollowUpChatDrawer({
  isOpen,
  onToggle,
  followUpMessages,
  followUpInput,
  setFollowUpInput,
  handleFollowUpSubmit,
  isFollowUpLoading,
  suggestedQuestions,
  followUpEndRef,
}: FollowUpChatDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      followUpEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [followUpMessages, isOpen, followUpEndRef]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleFollowUpSubmit(followUpInput);
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={onToggle}
        className={cn(
          'fixed bottom-6 right-6 z-40 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105',
          'bg-primary text-primary-foreground',
          isOpen && 'bg-muted text-muted-foreground',
        )}
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        {!isOpen && followUpMessages.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {followUpMessages.filter(m => m.role === 'assistant').length}
          </span>
        )}
      </button>

      {/* Slide-over panel */}
      <div
        ref={panelRef}
        className={cn(
          'fixed bottom-20 right-6 z-40 w-[380px] max-h-[520px] transition-all duration-300 ease-in-out',
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none',
        )}
      >
        <Card className="shadow-2xl border-primary/20 flex flex-col max-h-[520px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Follow-Up Chat</span>
            </div>
          </div>

          <CardContent className="p-3 flex flex-col flex-1 min-h-0 gap-3">
            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto space-y-2 p-2 bg-muted/30 rounded-lg">
              {followUpMessages.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-4">
                  Ask clinical follow-up questions about this case.
                </p>
              )}
              {followUpMessages.map((msg) => (
                <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn(
                    'max-w-[85%] rounded-lg px-3 py-1.5 text-xs',
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background border shadow-sm'
                  )}>
                    {msg.role === 'assistant' ? (
                      <div className="text-xs [&>p]:mb-1.5 [&>ol]:list-decimal [&>ol]:pl-4 [&>ol]:mb-1.5 [&>ul]:list-disc [&>ul]:pl-4 [&>ul]:mb-1.5 [&_strong]:font-semibold [&_em]:italic [&>p:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {isFollowUpLoading && (
                <div className="flex justify-start">
                  <div className="bg-background border shadow-sm rounded-lg px-3 py-1.5">
                    <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={followUpEndRef} />
            </div>

            {/* Suggested questions */}
            {suggestedQuestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => handleFollowUpSubmit(q)}
                    disabled={isFollowUpLoading}
                    className="text-[10px] px-2 py-1 rounded-full border bg-background hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50 text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={onSubmit} className="flex gap-1.5">
              <input
                type="text"
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.target.value)}
                placeholder="Ask a follow-up question..."
                className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                disabled={isFollowUpLoading}
              />
              <Button type="submit" size="sm" className="h-8 w-8 p-0" disabled={!followUpInput.trim() || isFollowUpLoading}>
                {isFollowUpLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
