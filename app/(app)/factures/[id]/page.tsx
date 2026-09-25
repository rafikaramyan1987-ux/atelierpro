'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  formatCHF,
  INVOICE_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  type Invoice,
  type InvoiceItem,
  type Client,
  type Vehicle,
  type TwintPayment,
  type PaymentMethod,
  type InvoiceStatus,
} from '@/lib/types/database';
import { ArrowLeft, Download, Loader2, CreditCard, CheckCircle2, Clock, AlertTriangle, Car, User, QrCode, Smartphone, Wallet, FileText, Users } from 'lucide-react';
import { generateInvoicePDF, garageToPdfInfo } from '@/lib/pdf';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import type { Garage } from '@/lib/types/database';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [twintPayments, setTwintPayments] = useState<TwintPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    async function fetchInvoice() {
      const id = params.id as string;
      const { data: inv } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!inv) {
        toast.error('Facture introuvable');
        router.push('/factures');
        return;
      }

      setInvoice(inv as Invoice);

      const [clientRes, itemsRes, twintRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', inv.client_id).maybeSingle(),
        supabase.from('invoice_items').select('*').eq('invoice_id', id),
        supabase.from('twint_payments').select('*').eq('invoice_id', id).order('created_at', { ascending: false }),
      ]);

      setClient(clientRes.data as Client | null);
      setItems(itemsRes.data as InvoiceItem[] ?? []);
      setTwintPayments(twintRes.data as TwintPayment[] ?? []);

      if (inv.vehicle_id) {
        const { data: v } = await supabase.from('vehicles').select('*').eq('id', inv.vehicle_id).maybeSingle();
        setVehicle(v as Vehicle | null);
      }

      setLoading(false);
    }
    fetchInvoice();
  }, [params.id, router]);

  async function updateStatus(status: InvoiceStatus) {
    if (!invoice) return;
    setUpdating(true);
    const payload: any = { status };
    if (status === 'payee') {
      payload.paid_date = new Date().toISOString().split('T')[0];
    }
    const { error } = await supabase.from('invoices').update(payload).eq('id', invoice.id);
    if (error) {
      toast.error('Erreur lors de la mise à jour');
    } else {
      setInvoice({ ...invoice, ...payload });
      toast.success('Statut mis à jour');
    }
    setUpdating(false);
  }

  async function updatePaymentMethod(method: PaymentMethod) {
    if (!invoice) return;
    const { error } = await supabase.from('invoices').update({ payment_method: method }).eq('id', invoice.id);
    if (error) {
      toast.error('Erreur');
    } else {
      setInvoice({ ...invoice, payment_method: method });
      toast.success(t('invDetail.methodUpdated'));
    }
  }

  async function handleDownload() {
    if (!invoice) return;
    let garage: Garage | null = null;
    if (invoice.garage_id) {
      const { data: g } = await supabase.from('garages').select('*').eq('id', invoice.garage_id).maybeSingle();
      garage = g as Garage | null;
    }
    await generateInvoicePDF(invoice, client, vehicle, items, garageToPdfInfo(garage));
    toast.success('PDF téléchargé');
  }

  async function markAsPaid() {
    await updateStatus('payee');
  }

  if (loading || !invoice) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusConfig: Record<InvoiceStatus, { icon: any; color: string; bg: string }> = {
    payee: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
    envoyee: { icon: Clock, color: 'text-primary', bg: 'bg-primary/10' },
    brouillon: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted' },
    en_retard: { icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
    en_attente_validation: { icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
    paiement_declare: { icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
  };
  const StatusIcon = statusConfig[invoice.status].icon;

  const paymentMethods: { value: PaymentMethod; label: string; icon: any; desc: string }[] = [
    { value: 'qr_bill', label: t('invoices.qrBill'), icon: QrCode, desc: t('invDetail.qrDesc2') },
    { value: 'carte', label: t('invoices.card'), icon: CreditCard, desc: t('invDetail.cardDesc2') },
    { value: 'twint', label: t('invoices.twint'), icon: Smartphone, desc: t('invDetail.twintDesc2') },
    { value: 'virement', label: t('invDetail.transfer'), icon: Wallet, desc: t('invDetail.transferDesc') },
    { value: 'especes', label: t('invDetail.cash'), icon: Wallet, desc: t('invDetail.cashDesc') },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <PageHeader title={invoice.invoice_number} description="">
        <Button variant="outline" onClick={() => router.push('/factures')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('common.back')}
        </Button>
        <Button onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          {t('common.save')}
        </Button>
      </PageHeader>

      <div className={`flex items-center gap-3 rounded-lg p-4 ${statusConfig[invoice.status].bg}`}>
        <StatusIcon className={`h-5 w-5 ${statusConfig[invoice.status].color}`} />
        <div className="flex-1">
          <p className="text-sm font-medium">{invoice.status === 'brouillon' ? t('invoices.draft') : invoice.status === 'envoyee' ? t('invoices.unpaid') : invoice.status === 'payee' ? t('invoices.paid') : invoice.status === 'en_retard' ? t('invoices.late') : invoice.status === 'paiement_declare' ? t('invoices.paymentDeclared') : INVOICE_STATUS_LABELS[invoice.status]}</p>
          <p className="text-xs text-muted-foreground">
            {invoice.status === 'payee' && invoice.paid_date
              ? `${t('invoices.paid')} ${new Date(invoice.paid_date).toLocaleDateString('fr-CH')}`
              : `${t('invoices.dueDate')}: ${new Date(invoice.due_date).toLocaleDateString('fr-CH')}`}
          </p>
        </div>
        {invoice.status !== 'payee' && invoice.status !== 'paiement_declare' && (
          <Button size="sm" onClick={markAsPaid} disabled={updating}>
            <CheckCircle2 className="h-4 w-4 mr-1" />
            {t('invoices.paid')}
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {t('invDetail.client')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {client && (
              <>
                {client.company_name && <p className="font-medium">{client.company_name}</p>}
                <p className="font-medium">{client.first_name} {client.last_name}</p>
                {client.address && <p className="text-muted-foreground">{client.address}</p>}
                {client.postal_code && client.city && (
                  <p className="text-muted-foreground">{client.postal_code} {client.city}</p>
                )}
                <p className="text-muted-foreground">{client.phone}</p>
                {client.email && <p className="text-muted-foreground">{client.email}</p>}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="h-4 w-4 text-muted-foreground" />
              {t('invoices.vehicle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {vehicle ? (
              <>
                <p className="font-medium">{vehicle.brand} {vehicle.model}</p>
                <p className="text-muted-foreground">{t('invDetail.plate')} {vehicle.license_plate}</p>
                {vehicle.vin && <p className="text-muted-foreground">VIN: {vehicle.vin}</p>}
                {vehicle.year && <p className="text-muted-foreground">{t('invDetail.year')} {vehicle.year}</p>}
                {vehicle.mileage != null && <p className="text-muted-foreground">{vehicle.mileage.toLocaleString('fr-CH')} km</p>}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">{t('invDetail.noVehicle')}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              {t('invDetail.payment')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{t('invDetail.paymentMethod')}</p>
              <Select
                value={invoice.payment_method ?? 'none'}
                onValueChange={(v) => updatePaymentMethod(v === 'none' ? 'qr_bill' : v as PaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('common.save')}</SelectItem>
                  <SelectItem value="qr_bill">{t('invoices.qrBill')}</SelectItem>
                  <SelectItem value="carte">{t('invoices.card')}</SelectItem>
                  <SelectItem value="twint">{t('invoices.twint')}</SelectItem>
                  <SelectItem value="virement">{t('invDetail.transfer')}</SelectItem>
                  <SelectItem value="especes">{t('invDetail.cash')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {invoice.payment_method && (
              <Badge variant="outline">{invoice.payment_method === 'qr_bill' ? t('invoices.qrBill') : invoice.payment_method === 'carte' ? t('invoices.card') : invoice.payment_method === 'twint' ? t('invoices.twint') : PAYMENT_METHOD_LABELS[invoice.payment_method]}</Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment methods overview */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            {t('admin.payments.title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {paymentMethods.map((method) => {
              const Icon = method.icon;
              const isActive = invoice.payment_method === method.value;
              return (
                <button
                  key={method.value}
                  onClick={() => updatePaymentMethod(method.value)}
                  className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-all hover:border-primary/40 ${
                    isActive ? 'border-primary bg-primary/5' : 'border-border/60 hover:bg-secondary/30'
                  }`}
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{method.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{method.desc}</p>
                  </div>
                  {isActive && (
                    <CheckCircle2 className="h-4 w-4 text-primary ml-auto shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">{t('invoices.details')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="border-b">
            <div className="grid grid-cols-12 gap-2 px-6 py-3 text-xs font-medium text-muted-foreground">
              <div className="col-span-6">{t('admin.appts.itemDesc')}</div>
              <div className="col-span-2 text-center">{t('admin.appts.qty')}</div>
              <div className="col-span-2 text-right">{t('admin.appts.unitPrice')}</div>
              <div className="col-span-2 text-right">{t('admin.appts.quoteTotal')}</div>
            </div>
          </div>
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-2 px-6 py-3 text-sm border-b last:border-0 hover:bg-secondary/30">
              <div className="col-span-6">{item.description}</div>
              <div className="col-span-2 text-center">{item.quantity}</div>
              <div className="col-span-2 text-right">{formatCHF(item.unit_price)}</div>
              <div className="col-span-2 text-right font-medium">{formatCHF(item.line_total)}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardContent className="p-6">
          <div className="space-y-3 ml-auto max-w-xs">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('invoices.subtotal')}</span>
              <span className="font-medium">{formatCHF(Number(invoice.subtotal))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('invoices.vat')} ({invoice.vat_rate}%)</span>
              <span className="font-medium">{formatCHF(Number(invoice.vat_amount))}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg">
              <span className="font-bold">{t('invoices.total')}</span>
              <span className="font-bold text-primary">{formatCHF(Number(invoice.total))}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {twintPayments.length > 0 && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              {t('invDetail.twintTransactions')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {twintPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{formatCHF(payment.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(payment.created_at).toLocaleDateString('fr-CH')} — {payment.twint_transaction_id ?? t('invDetail.pending')}
                  </p>
                </div>
                <Badge
                  variant={
                    payment.status === 'confirmee' ? 'default'
                    : payment.status === 'echouee' ? 'destructive'
                    : 'secondary'
                  }
                >
                  {payment.status === 'confirmee' ? t('admin.appts.confirmed')
                  : payment.status === 'echouee' ? t('admin.appts.refuse')
                  : payment.status === 'remboursee' ? t('admin.appts.refuse')
                  : t('admin.appts.pending')}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {invoice.payer_type && invoice.payer_type !== 'client' && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              {t('inv.payerInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('inv.payerType')}</span>
              <span className="font-medium">{invoice.payer_type === 'assurance' ? t('inv.payerAssurance') : invoice.payer_type === 'flotte' ? t('inv.payerFlotte') : t('inv.payerClient')}</span>
            </div>
            {invoice.secondary_payer_type && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('inv.secondaryPayerType')}</span>
                  <span className="font-medium">{invoice.secondary_payer_type === 'assurance' ? t('inv.payerAssurance') : invoice.secondary_payer_type === 'flotte' ? t('inv.payerFlotte') : t('inv.payerClient')}</span>
                </div>
                {invoice.secondary_payer_amount != null && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('inv.secondaryPayerAmount')}</span>
                    <span className="font-medium">{formatCHF(Number(invoice.secondary_payer_amount))}</span>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {invoice.notes && (
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">{t('invDetail.notes')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
