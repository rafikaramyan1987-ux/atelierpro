'use client';

import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Pen, Trash2, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { toast } from 'sonner';

interface SignaturePadProps {
  existingSignature?: string | null;
  signatureDate?: string | null;
  onSave: (dataUrl: string) => Promise<void>;
  readOnly?: boolean;
}

export function SignaturePad({ existingSignature, signatureDate, onSave, readOnly }: SignaturePadProps) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPad, setShowPad] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [showPad]);

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0] ?? e.changedTouches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    if (readOnly) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing || readOnly) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasContent(true);
  }

  function stopDraw() {
    setIsDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasContent(false);
  }

  async function handleSave() {
    const canvas = canvasRef.current;
    if (!canvas || !hasContent) return;
    setSaving(true);
    const dataUrl = canvas.toDataURL('image/png');
    await onSave(dataUrl);
    setSaving(false);
    setShowPad(false);
    setHasContent(false);
  }

  if (existingSignature && !showPad) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="text-sm font-medium text-success">{t('sig.signed')}</span>
          {signatureDate && (
            <span className="text-xs text-muted-foreground">
              {t('sig.signedOn')} {new Date(signatureDate).toLocaleDateString('fr-CH')}
            </span>
          )}
        </div>
        <div className="rounded-lg border border-border/60 bg-secondary/30 p-3">
          <img src={existingSignature} alt={t('sig.signed')} className="max-h-24 mx-auto" />
        </div>
        {!readOnly && (
          <Button size="sm" variant="outline" onClick={() => setShowPad(true)}>
            <Pen className="h-3.5 w-3.5 mr-1.5" />
            {t('sig.title')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('sig.desc')}</p>
      <div className="rounded-lg border-2 border-dashed border-border/60 bg-white p-1">
        <canvas
          ref={canvasRef}
          width={500}
          height={180}
          className="w-full touch-none cursor-crosshair rounded-md bg-white"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>
      {!hasContent && (
        <p className="text-xs text-muted-foreground text-center">{t('sig.signHere')}</p>
      )}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={clearCanvas} disabled={!hasContent}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          {t('sig.clear')}
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!hasContent || saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          {t('sig.save')}
        </Button>
      </div>
    </div>
  );
}
