'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCHF, calculateVAT, VAT_RATE, type Client, type Vehicle, type Part, type PayerType, type CannedTask, type ItemType } from '@/lib/types/database';
import { Plus, Trash2, Loader2, ArrowLeft, Save, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';
import { localDateStr, localDateStrPlusDays } from '@/lib/utils';
import { useDraftAutoSave } from '@/hooks/use-draft-autosave';

interface FormItem {
  id: string;
  part_id: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  item_type: ItemType;
}

function emptyItem(): FormItem {
  return { id: crypto.randomUUID(), part_id: null, description: '', quantity: '1', unit_price: '', item_type: 'piece' };
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [cannedTasks, setCannedTasks] = useState<CannedTask[]>([]);
  const [garage, setGarage] = useState<{ hourly_rate: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useI18n();
  const { profile } = useAuth();

  const [clientId, setClientId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [issueDate, setIssueDate] = useState(localDateStr());
  const [dueDate, setDueDate] = useState(localDateStrPlusDays(30));
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [payerType, setPayerType] = useState<PayerType>('client');
  const [secondaryPayerType, setSecondaryPayerType] = useState<PayerType | 'none'>('none');
  const [secondaryPayerAmount, setSecondaryPayerAmount] = useState('');
  const [items, setItems] = useState<FormItem[]>([
    emptyItem(),
  ]);
  const [draftCleared, setDraftCleared] = useState(false);

  const formData = { clientId, vehicleId, issueDate, dueDate, notes, internalNotes, payerType, secondaryPayerType, secondaryPayerAmount, items };
  const initialFormData = useRef({ clientId: '', vehicleId: '', issueDate: localDateStr(), dueDate: localDateStrPlusDays(30), notes: '', internalNotes: '', payerType: 'client' as PayerType, secondaryPayerType: 'none' as PayerType | 'none', secondaryPayerAmount: '', items: [{ id: 'init', part_id: null, description: '', quantity: '1', unit_price: '', item_type: 'piece' as ItemType }] });
  const { hasDraft, draftData, restoreDraft, ignoreDraft, clearDraft } = useDraftAutoSave(
    'invoice',
    profile?.id,
    formData,
    initialFormData.current,
    (d) => {
      setClientId(d.clientId ?? '');
      setVehicleId(d.vehicleId ?? '');
      setIssueDate(d.issueDate ?? localDateStr());
      setDueDate(d.dueDate ?? localDateStrPlusDays(30));
      setNotes(d.notes ?? '');
      setInternalNotes(d.internalNotes ?? '');
      setPayerType((d.payerType as PayerType) ?? 'client');
      setSecondaryPayerType((d.secondaryPayerType as PayerType | 'none') ?? 'none');
      setSecondaryPayerAmount(d.secondaryPayerAmount ?? '');
      setItems(d.items?.length ? d.items : [emptyItem()]);
    },
    draftCleared,
  );

  useEffect(() => {
    async function fetchData() {
      const [clientsRes, partsRes, tasksRes, garageRes] = await Promise.all([
        supabase.from('clients').select('*').order('last_name'),
        supabase.from('parts').select('*').order('name'),
        supabase.from('canned_tasks').select('*').order('name'),
        supabase.from('garages').select('hourly_rate').eq('id', profile?.garage_id ?? '').maybeSingle(),
      ]);
      setClients(clientsRes.data as Client[] ?? []);
      setParts(partsRes.data as Part[] ?? []);
      setCannedTasks(tasksRes.data as CannedTask[] ?? []);
      setGarage(garageRes.data as { hourly_rate: number } | null);
      setLoading(false);
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (clientId) {
      supabase.from('vehicles').select('*').eq('client_id', clientId).then(({ data }) => {
        setVehicles(data as Vehicle[] ?? []);
        setVehicleId('');
      });
    } else {
      setVehicles([]);
      setVehicleId('');
    }
  }, [clientId]);

  function addItem() {
    setItems([...items, emptyItem()]);
  }

  function removeItem(id: string) {
    if (items.length > 1) {
      setItems(items.filter((i) => i.id !== id));
    }
  }

  function updateItem(id: string, field: keyof FormItem, value: string) {
    setItems(items.map((i) => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      if (field === 'part_id' && value) {
        const part = parts.find((p) => p.id === value);
        if (part) {
          updated.description = part.name;
          updated.unit_price = part.unit_price.toString();
          updated.item_type = 'piece' as ItemType;
        }
      }
      if (field === 'item_type' && value === 'main_oeuvre' && !updated.unit_price) {
        updated.unit_price = String(garage?.hourly_rate ?? 120);
      }
      return updated;
    }));
  }

  function applyCannedTask(id: string, taskId: string) {
    const task = cannedTasks.find((t2) => t2.id === taskId);
    if (!task) return;
    setItems(items.map((i) => {
      if (i.id !== id) return i;
      if (task.default_labor_hours != null) {
        return { ...i, part_id: null, description: task.name, quantity: String(task.default_labor_hours), unit_price: String(garage?.hourly_rate ?? 120), item_type: 'main_oeuvre' as ItemType };
      }
      return { ...i, part_id: null, description: task.name, quantity: '1', unit_price: task.default_price != null ? String(task.default_price) : '', item_type: 'piece' as ItemType };
    }));
  }

  const subtotal = items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
  }, 0);
  const { vat, total } = calculateVAT(subtotal);

  async function handleSubmit(status: 'brouillon' | 'envoyee') {
    if (!clientId) {
      toast.error(t('invList.selectClient'));
      return;
    }
    if (items.some((i) => !i.description || !i.unit_price)) {
      toast.error(t('invList.fillAllItems'));
      return;
    }

    setSubmitting(true);

    // Mechanics cannot issue invoices directly — send to validation instead
    const isPrivileged = profile?.role === 'admin' || profile?.role === 'secretaire';
    const actualStatus = status === 'envoyee' && !isPrivileged ? 'en_attente_validation' : status;

    const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number', {
      p_garage_id: profile?.garage_id ?? null,
    });

    const { data: invoice, error: invError } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      client_id: clientId,
      vehicle_id: vehicleId || null,
      garage_id: profile?.garage_id ?? null,
      status: actualStatus,
      subtotal: Math.round(subtotal * 100) / 100,
      vat_rate: VAT_RATE,
      vat_amount: vat,
      total,
      issue_date: issueDate,
      due_date: dueDate,
      notes: notes || null,
      internal_notes: internalNotes || null,
      payer_type: payerType,
      secondary_payer_type: secondaryPayerType !== 'none' ? secondaryPayerType : null,
      secondary_payer_amount: secondaryPayerType !== 'none' && secondaryPayerAmount ? parseFloat(secondaryPayerAmount) : null,
    }).select().single();

    if (invError) {
      toast.error(t('invList.createError'), { description: invError.message });
      setSubmitting(false);
      return;
    }

    const itemPayload = items.map((item) => ({
      invoice_id: invoice.id,
      garage_id: profile?.garage_id ?? null,
      part_id: item.part_id || null,
      description: item.description,
      quantity: parseFloat(item.quantity) || 1,
      unit_price: parseFloat(item.unit_price) || 0,
      line_total: Math.round((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0) * 100) / 100,
      item_type: item.item_type,
    }));

    const { error: itemsError } = await supabase.from('invoice_items').insert(itemPayload);

    if (itemsError) {
      toast.error(t('invList.itemsError'), { description: itemsError.message });
    } else {
      if (actualStatus === 'brouillon') {
        toast.success(t('invList.draftSaved'));
      } else if (actualStatus === 'en_attente_validation') {
        toast.success(t('invList.submittedForApproval'));
      } else {
        toast.success(t('invList.invoiceSent'));
      }
      router.push('/factures');
      clearDraft();
      setDraftCleared(true);
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader title={t('admin.invoices.new')} description="">
        <Button variant="outline" onClick={() => router.push('/factures')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Button>
      </PageHeader>

      {hasDraft && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
          <span className="font-medium">{t('draft.found')}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={restoreDraft}>{t('draft.restore')}</Button>
            <Button size="sm" variant="ghost" onClick={ignoreDraft}>{t('draft.ignore')}</Button>
          </div>
        </div>
      )}

      {/* Client & vehicle */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">{t('invNew.details')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('invNew.client')}</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('invNew.selectClient')} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.company_name ? `${c.company_name} (${c.first_name} ${c.last_name})` : `${c.first_name} ${c.last_name}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clients.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('admin.clients.none')}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('invoices.vehicle')} ({t('common.optional')})</Label>
              <Select value={vehicleId} onValueChange={setVehicleId} disabled={!clientId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('invNew.selectVehicle')} />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.brand} {v.model} — {v.license_plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="issue_date">{t('invoices.issueDate')}</Label>
              <Input id="issue_date" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="due_date">{t('invoices.dueDate')}</Label>
              <Input id="due_date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('invNew.items')}</CardTitle>
          <Button size="sm" variant="outline" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" /> {t('common.add')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
              <div className="flex-1 min-w-0 space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('invNew.itemDesc')} {index + 1}</Label>
                <div className="flex gap-2">
                  <Select
                    value={item.item_type}
                    onValueChange={(v) => updateItem(item.id, 'item_type', v)}
                  >
                    <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="piece">{t('items.piece')}</SelectItem>
                      <SelectItem value="main_oeuvre">{t('items.labor')}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={item.part_id ?? 'custom'}
                    onValueChange={(v) => {
                      if (v === 'custom') updateItem(item.id, 'part_id', '');
                      else if (v.startsWith('task-')) applyCannedTask(item.id, v.slice(5));
                      else updateItem(item.id, 'part_id', v);
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={t('invNew.selectTask')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">{t('invNew.itemDesc')}</SelectItem>
                      {parts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.reference} — {p.name} ({formatCHF(p.unit_price)})
                        </SelectItem>
                      ))}
                      {cannedTasks.length > 0 && <SelectItem value="__tasks__" disabled>{t('cannedTasks.pickTask')}</SelectItem>}
                      {cannedTasks.map((task) => (
                        <SelectItem key={task.id} value={`task-${task.id}`}>
                          {task.name}{task.default_labor_hours != null ? ` — ${task.default_labor_hours}h` : task.default_price != null ? ` (${formatCHF(task.default_price)})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  placeholder={t('invNew.itemDesc')}
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                />
              </div>
              <div className="w-20 space-y-1.5">
                <Label className="text-xs text-muted-foreground">{item.item_type === 'main_oeuvre' ? t('items.hours') : t('admin.appts.qty')}</Label>
                <Input
                  type="number"
                  step="0.25"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                  onFocus={(e) => e.target.select()}
                />
              </div>
              <div className="w-32 space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('admin.appts.unitPrice')}</Label>
                <Input
                  type="number"
                  step="0.05"
                  placeholder="0.00"
                  value={item.unit_price}
                  onChange={(e) => updateItem(item.id, 'unit_price', e.target.value)}
                />
              </div>
              <div className="w-28 space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('invNew.lineTotal')}</Label>
                <div className="h-10 flex items-center px-3 rounded-md border bg-muted/50 text-sm font-medium">
                  {formatCHF((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="mt-5 shrink-0 hover:text-destructive"
                onClick={() => removeItem(item.id)}
                disabled={items.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Payer info */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">{t('inv.payerInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('inv.payerType')} *</Label>
              <Select value={payerType} onValueChange={(v: any) => setPayerType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">{t('inv.payerClient')}</SelectItem>
                  <SelectItem value="assurance">{t('inv.payerAssurance')}</SelectItem>
                  <SelectItem value="flotte">{t('inv.payerFlotte')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('inv.secondaryPayer')}</Label>
              <Select value={secondaryPayerType} onValueChange={(v: any) => setSecondaryPayerType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('inv.none')}</SelectItem>
                  <SelectItem value="client">{t('inv.payerClient')}</SelectItem>
                  <SelectItem value="assurance">{t('inv.payerAssurance')}</SelectItem>
                  <SelectItem value="flotte">{t('inv.payerFlotte')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {secondaryPayerType !== 'none' && (
            <div className="space-y-2 max-w-xs">
              <Label>{t('inv.secondaryPayerAmount')}</Label>
              <Input type="number" step="0.05" placeholder="0.00" value={secondaryPayerAmount} onChange={(e) => setSecondaryPayerAmount(e.target.value)} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">{t('invNew.notesLabel')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder={t('invNew.notesLabel')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="space-y-2">
            <Label className="text-sm font-medium">{t('invNew.internalNotesLabel')}</Label>
            <Textarea
              placeholder={t('invNew.internalNotesPlaceholder')}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="space-y-2 ml-auto max-w-xs">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('invoices.subtotal')}</span>
              <span className="font-medium">{formatCHF(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('invoices.vat')} ({VAT_RATE}%)</span>
              <span className="font-medium">{formatCHF(vat)}</span>
            </div>
            <div className="flex justify-between text-lg pt-2 border-t">
              <span className="font-bold">{t('invoices.total')}</span>
              <span className="font-bold text-primary">{formatCHF(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => handleSubmit('brouillon')} disabled={submitting}>
          {t('invoices.draft')}
        </Button>
        <Button onClick={() => handleSubmit('envoyee')} disabled={submitting}>
          {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          {profile?.role === 'admin' || profile?.role === 'secretaire' ? t('invList.issueInvoice') : t('invList.submitForApproval')}
        </Button>
      </div>
    </div>
  );
}
