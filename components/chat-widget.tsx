'use client';

import { useState, useRef, useEffect } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { HelpCircle, X, ArrowLeft, ChevronRight } from 'lucide-react';

const FAQ_KEYS = [
  'faq.q1',
  'faq.q2',
  'faq.q3',
  'faq.q4',
  'faq.q5',
  'faq.q6',
  'faq.q7',
  'faq.q8',
  'faq.q9',
] as const;

export function ChatWidget() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [activeQuestion, open]);

  function handleOpen() {
    setActiveQuestion(null);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setActiveQuestion(null);
  }

  function selectQuestion(key: string) {
    setActiveQuestion(key);
  }

  function backToList() {
    setActiveQuestion(null);
  }

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all"
        aria-label={t('chat.title')}
      >
        <HelpCircle className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-success" />
        </span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex h-[32rem] w-[24rem] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-3rem)] flex-col rounded-2xl border border-border bg-card shadow-2xl animate-fade-in">
      <div className="flex items-center justify-between border-b border-border/60 p-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <HelpCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">{t('chat.title')}</p>
            <p className="text-xs text-muted-foreground">{t('chat.subtitle')}</p>
          </div>
        </div>
        <button onClick={handleClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {activeQuestion === null ? (
          <div className="flex flex-col items-center text-center pt-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-3">
              <HelpCircle className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground max-w-[18rem] mb-4">{t('chat.welcome')}</p>
            <div className="w-full space-y-2">
              {FAQ_KEYS.map((key) => (
                <button
                  key={key}
                  onClick={() => selectQuestion(key)}
                  className="w-full flex items-center justify-between rounded-lg border border-border/60 bg-secondary/40 px-3 py-2.5 text-left text-sm text-foreground hover:bg-secondary hover:border-border transition-colors"
                >
                  <span>{t(`${key}`)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <button
              onClick={backToList}
              className="mb-3 flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('chat.back')}
            </button>
            <div className="rounded-xl bg-secondary/50 p-4">
              <p className="text-sm font-semibold mb-2">{t(`${activeQuestion}`)}</p>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{t(`${activeQuestion}.answer`)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
