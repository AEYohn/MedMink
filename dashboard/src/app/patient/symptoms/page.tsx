'use client';

import { useState, useRef, useEffect, FormEvent } from 'react';
import {
  Send,
  Loader2,
  AlertTriangle,
  Info,
  Stethoscope,
  Thermometer,
  Clock,
  Heart,
  Brain,
  Activity,
  ChevronRight,
  Shield,
  Sparkles,
} from 'lucide-react';
import { getApiUrl } from '@/lib/api-url';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    urgency?: 'emergency' | 'urgent' | 'routine' | 'self-care';
    possibleConditions?: Array<{
      name: string;
      probability: 'high' | 'moderate' | 'low';
      description: string;
    }>;
    recommendations?: string[];
    seekCare?: boolean;
    careTimeframe?: string;
  };
}

const urgencyConfig = {
  emergency: {
    color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
    icon: AlertTriangle,
    label: 'Emergency - Call 911',
  },
  urgent: {
    color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    borderColor: 'border-orange-200 dark:border-orange-800',
    icon: Clock,
    label: 'Seek Care Today',
  },
  routine: {
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    borderColor: 'border-amber-200 dark:border-amber-800',
    icon: Info,
    label: 'Schedule Appointment',
  },
  'self-care': {
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    borderColor: 'border-emerald-200 dark:border-emerald-800',
    icon: Heart,
    label: 'Self-Care Appropriate',
  },
};

const commonSymptoms = [
  { icon: Thermometer, label: 'Fever', query: "I've had a fever" },
  { icon: Brain, label: 'Headache', query: "I have a headache" },
  { icon: Activity, label: 'Fatigue', query: "I'm feeling very tired and fatigued" },
  { icon: Heart, label: 'Chest pain', query: "I'm experiencing chest pain" },
];

export default function SymptomsPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hello! I'm your AI health assistant powered by MedGemma. I can help analyze your symptoms and provide guidance on next steps.\n\nPlease describe what you're experiencing, including:\n- Your main symptoms\n- How long you've had them\n- Any factors that make them better or worse",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const apiUrl = getApiUrl();
      if (!apiUrl) return;
      const response = await fetch(`${apiUrl}/api/patient/symptoms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symptoms: input.trim(),
          conversation_history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze symptoms');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        metadata: {
          urgency: data.urgency,
          possibleConditions: data.possible_conditions,
          recommendations: data.recommendations,
          seekCare: data.seek_care,
          careTimeframe: data.care_timeframe,
        },
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'system',
        content: 'I apologize, but I encountered an error analyzing your symptoms. Please try again or contact a healthcare provider if you have urgent concerns.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickSymptom = (query: string) => {
    setInput(query);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header Card */}
      <div className="card p-4 mb-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-gradient-to-br from-rose-500 to-pink-500 rounded-2xl">
            <Stethoscope className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-surface-900 dark:text-white">
              Symptom Checker
            </h1>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Describe your symptoms to get AI-powered health guidance
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 rounded-full">
            <Shield className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Private & Secure
            </span>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto card p-4 mb-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[85%] ${
                message.role === 'user'
                  ? 'bg-rose-500 text-white rounded-2xl rounded-tr-md px-4 py-3'
                  : message.role === 'system'
                  ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-2xl px-4 py-3 border border-amber-200 dark:border-amber-800'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-white rounded-2xl rounded-tl-md px-4 py-3'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>

              {/* Metadata (urgency, conditions, etc.) */}
              {message.metadata && message.role === 'assistant' && (
                <div className="mt-4 space-y-3">
                  {/* Urgency Banner */}
                  {message.metadata.urgency && (
                    <div
                      className={`flex items-center gap-2 p-3 rounded-xl ${
                        urgencyConfig[message.metadata.urgency].color
                      } ${urgencyConfig[message.metadata.urgency].borderColor} border`}
                    >
                      {(() => {
                        const UrgencyIcon =
                          urgencyConfig[message.metadata.urgency].icon;
                        return <UrgencyIcon className="w-5 h-5 flex-shrink-0" />;
                      })()}
                      <span className="font-medium">
                        {urgencyConfig[message.metadata.urgency].label}
                      </span>
                      {message.metadata.careTimeframe && (
                        <span className="text-sm opacity-80">
                          - {message.metadata.careTimeframe}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Possible Conditions */}
                  {message.metadata.possibleConditions &&
                    message.metadata.possibleConditions.length > 0 && (
                      <div className="p-3 bg-white dark:bg-surface-700 rounded-xl">
                        <h4 className="text-sm font-semibold text-surface-700 dark:text-surface-300 mb-2">
                          Possible Conditions
                        </h4>
                        <div className="space-y-2">
                          {message.metadata.possibleConditions.map((condition, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-surface-50 dark:bg-surface-600 rounded-lg"
                            >
                              <div>
                                <p className="font-medium text-sm text-surface-900 dark:text-white">
                                  {condition.name}
                                </p>
                                <p className="text-xs text-surface-500 dark:text-surface-400">
                                  {condition.description}
                                </p>
                              </div>
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                  condition.probability === 'high'
                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                    : condition.probability === 'moderate'
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    : 'bg-surface-200 text-surface-600 dark:bg-surface-500 dark:text-surface-300'
                                }`}
                              >
                                {condition.probability}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {/* Recommendations */}
                  {message.metadata.recommendations &&
                    message.metadata.recommendations.length > 0 && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400 mb-2">
                          Recommendations
                        </h4>
                        <ul className="space-y-1">
                          {message.metadata.recommendations.map((rec, idx) => (
                            <li
                              key={idx}
                              className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-300"
                            >
                              <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              )}

              <span className="block mt-2 text-xs opacity-60">
                {message.timestamp.toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl rounded-tl-md px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                <span className="text-sm text-surface-500 dark:text-surface-400">
                  Analyzing symptoms...
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Symptoms */}
      {messages.length <= 2 && !isLoading && (
        <div className="mb-4">
          <p className="text-xs text-surface-500 dark:text-surface-400 mb-2">
            Common symptoms:
          </p>
          <div className="flex flex-wrap gap-2">
            {commonSymptoms.map((symptom, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickSymptom(symptom.query)}
                className="flex items-center gap-2 px-3 py-2 bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 rounded-lg text-sm text-surface-700 dark:text-surface-300 transition-colors"
              >
                <symptom.icon className="w-4 h-4" />
                {symptom.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="card p-3">
        <div className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Describe your symptoms..."
              rows={1}
              className="w-full px-4 py-3 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-3 bg-rose-500 hover:bg-rose-600 disabled:bg-surface-300 dark:disabled:bg-surface-700 text-white rounded-xl transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-surface-400">
          <Sparkles className="w-3 h-3" />
          <span>Powered by MedGemma - Your data stays private</span>
        </div>
      </form>
    </div>
  );
}
