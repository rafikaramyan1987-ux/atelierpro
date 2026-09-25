'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export interface DraftData {
  [key: string]: unknown;
}

export function useDraftAutoSave<T extends DraftData>(
  formName: string,
  userId: string | undefined,
  data: T,
  restoreFn: (data: T) => void,
  clearOnDep: unknown,
) {
  const storageKey = `draft:${formName}:${userId ?? 'anon'}`;
  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState<T | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSaveRef = useRef(false);

  const draftHasContent = useCallback((d: T): boolean => {
    return Object.values(d).some((v) => {
      if (Array.isArray(v)) return v.length > 0 && v.some((i) => i && typeof i === 'object' && 'description' in i && (i as any).description);
      if (typeof v === 'string') return v.trim() !== '';
      return v != null;
    });
  }, []);

  useEffect(() => {
    if (!userId) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as T;
        if (draftHasContent(parsed)) {
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
  }, [storageKey, userId, draftHasContent]);

  useEffect(() => {
    if (!userId) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      try {
        const hasContent = Object.values(data).some((v) => {
          if (Array.isArray(v)) return v.length > 0 && v.some((i) => i && typeof i === 'object' && 'description' in i && (i as any).description);
          if (typeof v === 'string') return v.trim() !== '';
          return v != null;
        });
        if (hasContent) {
          localStorage.setItem(storageKey, JSON.stringify(data));
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
