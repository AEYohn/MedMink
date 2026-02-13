'use client';

import { useRef, useEffect } from 'react';
import { Mic, MicOff, Send, Loader2 } from 'lucide-react';

interface Message {
  role: 'assistant' | 'user';
  content: string;
  transcript?: string;
}

interface InterviewChatProps {
  messages: Message[];
  isLoading: boolean;
  isRecording: boolean;
  audioDuration: number;
  inputText: string;
  onInputChange: (text: string) => void;
  onSendText: () => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export function InterviewChat({
  messages,
  isLoading,
  isRecording,
  audioDuration,
  inputText,
  onInputChange,
  onSendText,
  onStartRecording,
  onStopRecording,
}: InterviewChatProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputText.trim() && !isLoading) {
        onSendText();
      }
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted rounded-bl-md'
              }`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              {msg.transcript && msg.role === 'user' && (
                <p className="text-xs opacity-70 mt-1 italic">Transcribed from audio</p>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border p-4">
        <div className="flex items-end gap-2">
          {/* Mic Button */}
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={isLoading}
            className={`flex-shrink-0 p-3 rounded-xl transition-all ${
              isRecording
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            } disabled:opacity-50`}
            title={isRecording ? `Recording... ${audioDuration}s` : 'Record audio'}
          >
            {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              value={inputText}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isRecording ? `Recording... ${audioDuration}s` : 'Type your response...'}
              disabled={isLoading || isRecording}
              rows={1}
              className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={onSendText}
            disabled={!inputText.trim() || isLoading || isRecording}
            className="flex-shrink-0 p-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
