'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { createWebSocket } from '@/lib/api';

export interface Operation {
  id: string;
  type: 'ingest' | 'analyze' | 'synthesize' | 'search' | 'chat';
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  step: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface ProgressState {
  operations: Operation[];
  isConnected: boolean;
}

interface ProgressContextValue extends ProgressState {
  addOperation: (operation: Omit<Operation, 'startedAt'>) => void;
  updateOperation: (id: string, updates: Partial<Operation>) => void;
  removeOperation: (id: string) => void;
  clearCompleted: () => void;
}

const ProgressContext = createContext<ProgressContextValue | undefined>(undefined);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [operations, setOperations] = useState<Operation[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  // Handle WebSocket messages
  const handleMessage = useCallback((data: any) => {
    if (data.type === 'progress') {
      const { task_id, task_type, progress, step, status, error } = data;

      setOperations(prev => {
        const existingIndex = prev.findIndex(op => op.id === task_id);

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = {
            ...updated[existingIndex],
            progress: progress ?? updated[existingIndex].progress,
            step: step ?? updated[existingIndex].step,
            status: status ?? updated[existingIndex].status,
            error: error,
            completedAt: status === 'completed' || status === 'failed' ? new Date().toISOString() : undefined,
          };
          return updated;
        } else {
          // Create new operation from WebSocket message
          return [
            ...prev,
            {
              id: task_id,
              type: task_type || 'analyze',
              status: status || 'running',
              progress: progress ?? 0,
              step: step || 'Starting...',
              startedAt: new Date().toISOString(),
              error,
            },
          ];
        }
      });
    }
  }, []);

  // Set up WebSocket connection
  useEffect(() => {
    const ws = createWebSocket(handleMessage);

    if (ws) {
      ws.onopen = () => setIsConnected(true);
      ws.onclose = () => setIsConnected(false);
      ws.onerror = () => setIsConnected(false);

      return () => {
        ws.close();
      };
    }
  }, [handleMessage]);

  const addOperation = useCallback((operation: Omit<Operation, 'startedAt'>) => {
    const newOp: Operation = {
      ...operation,
      startedAt: new Date().toISOString(),
    };
    setOperations(prev => [...prev, newOp]);
  }, []);

  const updateOperation = useCallback((id: string, updates: Partial<Operation>) => {
    setOperations(prev =>
      prev.map(op =>
        op.id === id
          ? {
              ...op,
              ...updates,
              completedAt:
                updates.status === 'completed' || updates.status === 'failed'
                  ? new Date().toISOString()
                  : op.completedAt,
            }
          : op
      )
    );
  }, []);

  const removeOperation = useCallback((id: string) => {
    setOperations(prev => prev.filter(op => op.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setOperations(prev => prev.filter(op => op.status !== 'completed' && op.status !== 'failed'));
  }, []);

  const value: ProgressContextValue = {
    operations,
    isConnected,
    addOperation,
    updateOperation,
    removeOperation,
    clearCompleted,
  };

  return (
    <ProgressContext.Provider value={value}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
}
