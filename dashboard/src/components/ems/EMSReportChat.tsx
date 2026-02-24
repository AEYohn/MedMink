'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Square, Mic, Loader2 } from 'lucide-react';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import type { EMSMessage } from '@/types/ems';

interface EMSReportChatProps {
  messages: EMSMessage[];
  onSendText: (text: string) => void;
  onSendAudio?: (blob: Blob) => void;
  isLoading: boolean;
  disabled?: boolean;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function EMSReportChat({
  messages,
  onSendText,
  onSendAudio,
  isLoading,
  disabled,
}: EMSReportChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isRecording,
    audioBlob,
    audioDuration,
    error: recorderError,
    start: startRecording,
    stop: stopRecording,
    clear: clearRecording,
  } = useAudioRecorder();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // When recording finishes and blob is available, send it
  useEffect(() => {
    if (audioBlob && onSendAudio) {
      onSendAudio(audioBlob);
      clearRecording();
    }
  }, [audioBlob, onSendAudio, clearRecording]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || disabled) return;
    onSendText(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted text-foreground rounded-bl-md'
              }`}
            >
              {msg.content === '(transcribing audio...)' && msg.role === 'user' ? (
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span className="text-xs italic opacity-70">Transcribing audio...</span>
                </div>
              ) : (
                msg.content
              )}
              {msg.transcript && msg.transcript !== 'transcribing' && msg.role === 'user' && (
                <p className="text-[10px] opacity-60 mt-1 italic">
                  Transcribed: {msg.transcript}
                </p>
              )}
              <span className="block mt-1 text-[10px] opacity-50">
                {msg.timestamp
                  ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : ''}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Recorder error */}
      {recorderError && (
        <div className="px-3 py-1.5 text-xs text-red-600 bg-red-50 border-t border-red-100">
          {recorderError}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border">
        {isRecording ? (
          /* Recording banner — replaces text input */
          <div className="flex items-center justify-between h-12 px-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span className="text-sm font-medium text-red-700">Recording...</span>
              <span className="text-sm tabular-nums text-red-600">{formatDuration(audioDuration)}</span>
            </div>
            <button
              type="button"
              onClick={stopRecording}
              className="h-9 px-3 flex items-center gap-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop
            </button>
          </div>
        ) : (
          /* Normal input area */
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={disabled ? 'Report complete' : 'Dictate or type...'}
              disabled={disabled || isLoading}
              className="flex-1 h-12 px-4 text-base bg-background border border-border rounded-xl focus:ring-2 focus:ring-primary/50 outline-none disabled:opacity-50"
            />

            {onSendAudio && (
              <button
                type="button"
                onClick={startRecording}
                disabled={disabled || isLoading}
                className="h-12 w-12 flex items-center justify-center rounded-xl bg-muted text-muted-foreground hover:bg-muted/80 disabled:opacity-50 transition-colors"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}

            <button
              type="submit"
              disabled={!input.trim() || disabled || isLoading}
              className="h-12 w-12 flex items-center justify-center bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
