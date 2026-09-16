'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { LOCALES, LOCALE_CODES, LOCALE_LABELS, type Locale } from '@/lib/i18n/translations';
import { Globe, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({
    position: 'absolute',
    right: 0,
    top: '100%',
    marginTop: '0.5rem',
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useLayoutEffect(() => {
    if (!open || !ref.current || !dropdownRef.current) return;

    const buttonRect = ref.current.getBoundingClientRect();
    const dropdownHeight = dropdownRef.current.offsetHeight;
    const dropdownWidth = 176; // w-44 = 11rem = 176px
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left: number;
    if (buttonRect.right - dropdownWidth < 8) {
      left = 8;
    } else {
      left = buttonRect.right - dropdownWidth;
    }

    const spaceBelow = viewportHeight - buttonRect.bottom;
    const showAbove = spaceBelow < dropdownHeight + 16 && buttonRect.top > dropdownHeight + 16;

    const top = showAbove
      ? buttonRect.top - dropdownHeight - 8
      : buttonRect.bottom + 8;

    setDropdownStyle({
      position: 'fixed',
      left: Math.max(8, Math.min(left, viewportWidth - dropdownWidth - 8)),
      top: Math.max(8, top),
      width: dropdownWidth,
    });
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg text-sm font-medium transition-colors',
          compact
            ? 'text-muted-foreground hover:text-foreground px-1.5 py-1'
            : 'border border-border/60 px-3 py-1.5 text-foreground hover:bg-secondary'
        )}
      >
        <Globe className="h-4 w-4" />
        <span className="font-mono text-xs font-bold">{LOCALE_CODES[locale]}</span>
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>

      {open && (
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="rounded-lg border border-border/60 bg-card shadow-lg z-[60] overflow-hidden"
        >
          {LOCALES.map((loc) => (
            <button
              key={loc}
              onClick={() => {
                setLocale(loc as Locale);
                setOpen(false);
              }}
              className={cn(
                'flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors',
                locale === loc
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground hover:bg-secondary'
              )}
            >
              <span>{LOCALE_LABELS[loc]}</span>
              <span className="font-mono text-xs text-muted-foreground">{LOCALE_CODES[loc]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
