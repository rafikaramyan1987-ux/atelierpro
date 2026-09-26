'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { type PartsOrder, type PartsOrderStatus, type PartsOrderUrgency, type Part } from '@/lib/types/database';
import { Package, Search, Loader2, Plus, Clock, CheckCircle2, Truck, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FieldHint } from '@/components/ui/field-hint';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const URGENCY_COLORS: Record<PartsOrderUrgency, string> = {
  normal: 'bg-secondary text-muted-foreground',
  urgent: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  critique: 'bg-destructive/15 text-destructive border-destructive/30',
};

const STATUS_ICONS: Record<PartsOrderStatus, typeof Clock> = {
  en_attente: Clock,
  commandee: Truck,
  recue: CheckCircle2,
};

const STATUS_COLORS: Record<PartsOrderStatus, string> = {
  en_attente: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  commandee: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  recue: 'bg-success/10 text-success border-success/20',
};

export default function CommandesPiecesPage() {
  const { profile } = useAuth();
  const { t } = useI18n();

  const [orders, setOrders] = useState<PartsOrder[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [partName, setPartName] = useState('');
  const [partReference, setPartReference] = useState('');
  const [partId, setPartId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState('1');
  const [urgency, setUrgency] = useState<PartsOrderUrgency>('normal');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    async function fetchData() {
      const [ordersRes, partsRes] = await Promise.all([
        supabase.from('parts_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('parts').select('*').order('name'),
      ]);
      setOrders((ordersRes.data as PartsOrder[]) ?? []);
      setParts((partsRes.data as Part[]) ?? []);
      setLoading(false);
    }
    fetchData();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!partName.trim()) return;
    setSubmitting(true);

    const { data, error } = await supabase
      .from('parts_orders')
      .insert({
        garage_id: profile?.garage_id ?? null,
        part_name: partName.trim(),
        part_reference: partReference.trim() || null,
        part_id: partId,
        quantity: parseInt(quantity) || 1,
        urgency,
        notes: notes.trim() || null,
        created_by: profile?.id ?? null,
      })
      .select()
      .single();

    if (error) {
      toast.error(t('partsOrders.toast.error'), { description: error.message });
    } else {
      toast.success(t('partsOrders.toast.created'));
      setOrders([data as PartsOrder, ...orders]);
      setPartName('');
      setPartReference('');
      setPartId(null);
      setQuantity('1');
      setUrgency('normal');
      setNotes('');
    }
    setSubmitting(false);
  }

  async function updateStatus(id: string, status: PartsOrderStatus) {
    const { error } = await supabase.from('parts_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
      toast.error(t('partsOrders.toast.error'), { description: error.message });
    } else {
      toast.success(t('partsOrders.toast.updated'));
      setOrders(orders.map((o) => (o.id === id ? { ...o, status } : o)));
    }
  }

  function orderFromStock(part: Part) {
    setPartName(part.name);
    setPartReference(part.reference);
    setPartId(part.id);
    setQuantity('1');
  }

  const filteredParts = parts.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.reference.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.category ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('partsOrders.title')} description={t('partsOrders.desc')} />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* New order form */}
        <div className="lg:col-span-1">
          <Card className="border-border/60 sticky top-6">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Plus className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">{t('partsOrders.new')}</h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('partsOrders.linkStockPart')}</label>
                  <Select
                    value={partId ?? 'none'}
                    onValueChange={(v) => {
                      if (v === 'none') {
                        setPartId(null);
                      } else {
                        const part = parts.find((p) => p.id === v);
                        if (part) {
                          setPartId(part.id);
                          setPartName(part.name);
                          setPartReference(part.reference);
                        }
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('partsOrders.selectStockPart')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('partsOrders.noStockPart')}</SelectItem>
                      {parts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.reference} — {p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldHint>{t('partsOrders.linkStockHint')}</FieldHint>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('partsOrders.partName')} *</label>
                  <Input value={partName} onChange={(e) => setPartName(e.target.value)} placeholder={t('ph.partName')} required />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('partsOrders.reference')}</label>
                  <Input value={partReference} onChange={(e) => setPartReference(e.target.value)} placeholder={t('ph.partRef')} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('partsOrders.quantity')}</label>
                    <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder={t('ph.quantity')} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('partsOrders.urgency')}</label>
                    <select
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value as PartsOrderUrgency)}
                    >
                      <option value="normal">{t('partsOrders.urgency.normal')}</option>
                      <option value="urgent">{t('partsOrders.urgency.urgent')}</option>
                      <option value="critique">{t('partsOrders.urgency.critique')}</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('partsOrders.notes')}</label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('partsOrders.notesPlaceholder')} rows={2} />
                </div>

                <Button type="submit" disabled={submitting} className="w-full">
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Package className="h-4 w-4 mr-2" />}
                  {submitting ? t('partsOrders.submitting') : t('partsOrders.submit')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right column: stock browse + order history */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stock browse */}
          <Card className="border-border/60">
            <CardContent className="p-6">
              <h3 className="font-semibold mb-1">{t('partsOrders.browseTitle')}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t('partsOrders.browseDesc')}</p>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('partsOrders.searchPlaceholder')}
                  className="pl-10"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              {filteredParts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">{t('partsOrders.browseNone')}</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredParts.slice(0, 20).map((part) => (
                    <div key={part.id} className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/20 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{part.name}</p>
                        <p className="text-xs text-muted-foreground">{part.reference}{part.category ? ` · ${part.category}` : ''}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => orderFromStock(part)}>
                        {t('partsOrders.orderFromStock')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order history */}
          <div>
            <h3 className="font-semibold mb-3">{t('partsOrders.history')}</h3>
            {orders.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                  <Package className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">{t('partsOrders.none')}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => {
                  const StatusIcon = STATUS_ICONS[order.status];
                  return (
                    <Card key={order.id} className="border-border/60">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium truncate">{order.part_name}</p>
                              {order.part_reference && (
                                <span className="text-xs text-muted-foreground shrink-0">{order.part_reference}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>×{order.quantity}</span>
                              <span className={cn('rounded px-2 py-0.5 font-medium border', URGENCY_COLORS[order.urgency])}>
                                {t(`partsOrders.urgency.${order.urgency}`)}
                              </span>
                              {order.notes && <span className="truncate">— {order.notes}</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border', STATUS_COLORS[order.status])}>
                              <StatusIcon className="h-3 w-3" />
                              {t(`partsOrders.status.${order.status}`)}
                            </span>
                            <div className="flex gap-1">
                              {order.status === 'en_attente' && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(order.id, 'commandee')}>
                                  {t('partsOrders.markCommandee')}
                                </Button>
                              )}
                              {order.status === 'commandee' && (
                                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(order.id, 'recue')}>
                                  {t('partsOrders.markRecue')}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
