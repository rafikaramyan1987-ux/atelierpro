'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface DraftData {
  [key: string]: unknown;
}

function hasMeaningfulChange<T extends DraftData>(current: T, initial: T): boolean {
  for (const key of Object.keys(current)) {
    const cv = current[key];
    const iv = initial[key];

    if (Array.isArray(cv) && Array.isArray(iv)) {
      const changed = cv.some((item) => {
        if (!item || typeof item !== 'object') return false;
        const desc = (item as any).description;
        const price = parseFloat((item as any).unit_price);
        return (typeof desc === 'string' && desc.trim() !== '') || (price > 0);
      });
      if (changed) return true;
      continue;
    }

    if (typeof cv === 'string' && typeof iv === 'string') {
      if (cv.trim() !== '' && cv.trim() !== iv.trim()) return true;
      continue;
    }

    if (cv !== iv && cv !== '' && cv != null) return true;
  }
  return false;
}

export function useDraftAutoSave<T extends DraftData>(
  formName: string,
  userId: string | undefined,
  data: T,
  initialData: T,
  restoreFn: (data: T) => void,
  clearOnDep: unknown,
) {
  const storageKey = `draft:${formName}:${userId ?? 'anon'}`;
  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSaveRef = useRef(false);
  const initialRef = useRef(initialData);

  useEffect(() => {
    if (!userId) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as T;
        if (hasMeaningfulChange(parsed, initialRef.current)) {
          setDraftData(parsed);
          setHasDraft(true);
          skipSaveRef.current = true;
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [storageKey, userId]);

  useEffect(() => {
    if (!userId) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        if (hasMeaningfulChange(data, initialRef.current)) {
          localStorage.setItem(storageKey, JSON.stringify(data));
        } else {
          localStorage.removeItem(storageKey);
        }
      } catch {
        // ignore storage errors
      }
    }, 500);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [data, storageKey, userId]);

  const restoreDraft = useCallback(() => {
    if (draftData) {
      restoreFn(draftData);
    }
    setHasDraft(false);
    setDraftData(null);
  }, [draftData, restoreFn]);

  const ignoreDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setHasDraft(false);
    setDraftData(null);
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setHasDraft(false);
    setDraftData(null);
  }, [storageKey]);

  useEffect(() => {
    if (clearOnDep) {
      clearDraft();
    }
  }, [clearOnDep, clearDraft]);

  return { hasDraft, draftData, restoreDraft, ignoreDraft, clearDraft };
}
