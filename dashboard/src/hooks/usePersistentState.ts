'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { getItem, setItem } from '@/lib/storage';

/**
 * A hook that persists state to localStorage with automatic syncing
 * @param key - The storage key (will be prefixed with 'research-synthesizer:')
 * @param defaultValue - The default value if nothing is stored
 * @returns [value, setValue, isLoaded] - The state, setter, and whether initial load is complete
 */
export function usePersistentState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void, boolean] {
  const [isLoaded, setIsLoaded] = useState(false);
  const [value, setValue] = useState<T>(defaultValue);
  const isInitialMount = useRef(true);
  const defaultValueRef = useRef(defaultValue);
  defaultValueRef.current = defaultValue;

  // Load from localStorage on mount
  useEffect(() => {
    const stored = getItem<T>(key, defaultValueRef.current);
    setValue(stored);
    setIsLoaded(true);
    isInitialMount.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist to localStorage when value changes (after initial mount)
  useEffect(() => {
    if (!isInitialMount.current && isLoaded) {
      setItem(key, value);
    }
  }, [key, value, isLoaded]);

  // Listen for storage changes from other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `research-synthesizer:${key}` && e.newValue !== null) {
        try {
          const newValue = JSON.parse(e.newValue) as T;
          setValue(newValue);
        } catch {
          // Ignore parse errors
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  const setValueWithPersist = useCallback((newValue: T | ((prev: T) => T)) => {
    setValue(newValue);
  }, []);

  return [value, setValueWithPersist, isLoaded];
}

/**
 * A hook for managing a list with persistence
 */
export function usePersistentList<T extends { id: string }>(
  key: string,
  maxItems = 50
) {
  const [items, setItems, isLoaded] = usePersistentState<T[]>(key, []);

  const addItem = useCallback((item: T) => {
    setItems(prev => {
      const filtered = prev.filter(i => i.id !== item.id);
      return [item, ...filtered].slice(0, maxItems);
    });
  }, [setItems, maxItems]);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, [setItems]);

  const updateItem = useCallback((id: string, updates: Partial<T>) => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, ...updates } : item
    ));
  }, [setItems]);

  const clearAll = useCallback(() => {
    setItems([]);
  }, [setItems]);

  return {
    items,
    addItem,
    removeItem,
    updateItem,
    clearAll,
    isLoaded,
  };
}
