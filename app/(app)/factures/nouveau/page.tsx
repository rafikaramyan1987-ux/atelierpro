'use client';

import { useEffect, useState } from 'react';
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
import { formatCHF, calculateVAT, VAT_RATE, type Client, type Vehicle, type Part, type PayerType } from '@/lib/types/database';
import { Plus, Trash2, Loader2, ArrowLeft, Save, Package } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';
import { localDateStr, localDateStrPlusDays } from '@/lib/utils';

interface FormItem {
  id: string;
  part_id: string | null;
  description: string;
  quantity: string;
  unit_price: string;
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useI18n();
  const { profile } = useAuth();

  const [clientId, setClientId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [issueDate, setIssueDate] = useState(localDateStr());
  const [dueDate, setDueDate] = useState(localDateStrPlusDays(30));
  const [notes, setNotes] = useState('');
  const [payerType, setPayerType] = useState<PayerType>('client');
  const [secondaryPayerType, setSecondaryPayerType] = useState<PayerType | 'none'>('none');
  const [secondaryPayerAmount, setSecondaryPayerAmount] = useState('');
  const [items, setItems] = useState<FormItem[]>([
    { id: crypto.randomUUID(), part_id: null, description: '', quantity: '1', unit_price: '' },
  ]);

  useEffect(() => {
    async function fetchData() {
      const [clientsRes, partsRes] = await Promise.all([
        supabase.from('clients').select('*').order('last_name'),
        supabase.from('parts').select('*').order('name'),
      ]);
      setClients(clientsRes.data as Client[] ?? []);
      setParts(partsRes.data as Part[] ?? []);
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
    setItems([...items, { id: crypto.randomUUID(), part_id: null, description: '', quantity: '1', unit_price: '' }]);
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
        }
      }
      return updated;
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

      {/* Client & vehicle */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">{t('admin.invoices.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('admin.clients.title')} *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.clients.title')} />
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
                  <SelectValue placeholder={t('admin.invoices.title')} />
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
          <CardTitle className="text-base">{t('admin.appts.devisItems')}</CardTitle>
          <Button size="sm" variant="outline" onClick={addItem}>
            <Plus className="h-4 w-4 mr-1" /> {t('common.add')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item, index) => (
            <div key={item.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
              <div className="flex-1 min-w-0 space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('admin.appts.itemDesc')} {index + 1}</Label>
                <Select
                  value={item.part_id ?? 'custom'}
                  onValueChange={(v) => updateItem(item.id, 'part_id', v === 'custom' ? '' : v)}
                >
                  <SelectTrigger className="mb-1">
                    <SelectValue placeholder={t('admin.appts.itemDesc')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">{t('common.save')}</SelectItem>
                    {parts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.reference} — {p.name} ({formatCHF(p.unit_price)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  placeholder={t('admin.appts.itemDesc')}
                  value={item.description}
                  onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                />
              </div>
              <div className="w-20 space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('admin.appts.qty')}</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
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
                <Label className="text-xs text-muted-foreground">{t('admin.appts.quoteTotal')}</Label>
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
          <CardTitle className="text-base">{t('invList.notes')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder={t('admin.appts.notesPlaceholder')}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
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
