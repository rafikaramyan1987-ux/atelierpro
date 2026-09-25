'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  formatCHF,
  VAT_RATE,
  type Invoice,
  type InvoiceItem,
  type Vehicle,
  type Client,
  type PaymentMethod,
} from '@/lib/types/database';
import { FileText, Loader2, Download, CreditCard, QrCode, Smartphone, CheckCircle2, ArrowLeft } from 'lucide-react';
import { generateInvoicePDF, garageToPdfInfo, type GaragePdfInfo } from '@/lib/pdf';
import { toast } from 'sonner';
import { formatQty } from '@/lib/utils';

export default function ClientInvoicesPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [invoices, setInvoices] = useState<(Invoice & { vehicle?: Vehicle })[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailInvoice, setDetailInvoice] = useState<(Invoice & { vehicle?: Vehicle }) | null>(null);
  const [detailItems, setDetailItems] = useState<InvoiceItem[]>([]);
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!profile?.client_id) return;
    async function fetchData() {
      const { data } = await supabase
        .from('invoices')
        .select('*, vehicle:vehicles(*)')
        .eq('client_id', profile!.client_id)
        .order('created_at', { ascending: false });
      setInvoices(data as any ?? []);
      setLoading(false);
    }
    fetchData();
  }, [profile]);

  async function handleDownload(invoice: Invoice & { vehicle?: Vehicle }) {
    const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id);
    const { data: client } = await supabase.from('clients').select('*').eq('id', invoice.client_id).maybeSingle();
    let garageInfo: GaragePdfInfo | null = null;
    if (invoice.garage_id) {
      const { data: billing } = await supabase.rpc('invoice_billing_info', { p_invoice_id: invoice.id }).maybeSingle() as { data: any };
      if (billing) {
        garageInfo = {
          name: billing.name,
          address: billing.address || '',
          postal_code: billing.postal_code || '',
          city: billing.city || '',
          phone: billing.phone || '',
          email: billing.email,
          vat_number: billing.vat_number,
          iban: billing.iban,
          logo_url: null,
        };
      }
    }
    try {
      await generateInvoicePDF(invoice, client as any, invoice.vehicle ?? null, items ?? [], garageInfo);
      toast.success(t('toast.pdfDownloaded'));
    } catch (err: any) {
      toast.error(t('toast.error'), { description: err?.message ?? String(err) });
    }
  }

  async function openDetail(invoice: Invoice & { vehicle?: Vehicle }) {
    setDetailInvoice(invoice);
    const [itemsRes, clientRes] = await Promise.all([
      supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id),
      supabase.from('clients').select('*').eq('id', invoice.client_id).maybeSingle(),
    ]);
    setDetailItems(itemsRes.data as InvoiceItem[] ?? []);
    setDetailClient(clientRes.data as Client | null);
  }

  function openPayDialog(invoice: Invoice) {
    setPayInvoice(invoice);
    setPayDialogOpen(true);
  }

  async function handlePay(method: PaymentMethod) {
    if (!payInvoice) return;
    setPaying(true);
    const { error } = await supabase.rpc('client_declare_payment', {
      p_invoice_id: payInvoice.id,
      p_method: method,
    });

    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(t('toast.paymentDeclared'), { description: `${t('invoices.paidVia')} ${method === 'qr_bill' ? t('invoices.qrBill') : method === 'carte' ? t('invoices.card') : t('invoices.twint')}` });
      setPayDialogOpen(false);
      setPayInvoice(null);
      // Refresh invoices
      if (profile?.client_id) {
        const { data } = await supabase.from('invoices').select('*, vehicle:vehicles(*)').eq('client_id', profile.client_id).order('created_at', { ascending: false });
        setInvoices(data as any ?? []);
      }
    }
    setPaying(false);
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalPaid = invoices.filter((i) => i.status === 'payee').reduce((sum, i) => sum + Number(i.total), 0);
  const totalPending = invoices.filter((i) => i.status === 'envoyee' || i.status === 'en_retard' || i.status === 'paiement_declare').reduce((sum, i) => sum + Number(i.total), 0);

  const paymentOptions: { method: PaymentMethod; label: string; icon: any; desc: string }[] = [
    { method: 'qr_bill', label: t('invoices.qrBill'), icon: QrCode, desc: t('invoices.qrBillDesc') },
    { method: 'carte', label: t('invoices.card'), icon: CreditCard, desc: t('invoices.cardDesc') },
    { method: 'twint', label: t('invoices.twint'), icon: Smartphone, desc: t('invoices.twintDesc') },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('invoices.title')} description={t('invoices.desc')} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">{t('invoices.totalPaid')}</p>
            <p className="text-2xl font-bold text-success">{formatCHF(totalPaid)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">{t('invoices.totalPending')}</p>
            <p className="text-2xl font-bold text-warning">{formatCHF(totalPending)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">{t('invoices.none')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invoices.number')}</TableHead>
                  <TableHead>{t('invoices.date')}</TableHead>
                  <TableHead>{t('invoices.vehicle')}</TableHead>
                  <TableHead className="text-right">{t('invoices.amount')}</TableHead>
                  <TableHead>{t('invoices.status')}</TableHead>
                  <TableHead className="text-right">{t('invoices.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id} className="cursor-pointer hover:bg-secondary/30" onClick={() => openDetail(inv)}>
                    <TableCell className="font-mono text-xs font-medium">{inv.invoice_number}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(inv.issue_date).toLocaleDateString('fr-CH')}</TableCell>
                    <TableCell className="text-sm">
                      {inv.vehicle ? `${inv.vehicle.brand} ${inv.vehicle.model}` : '—'}
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCHF(Number(inv.total))}</TableCell>
                    <TableCell>
                      <Badge
                        variant={inv.status === 'payee' ? 'default' : inv.status === 'en_retard' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {inv.status === 'payee' ? t('invoices.paid') : inv.status === 'envoyee' ? t('invoices.unpaid') : inv.status === 'en_retard' ? t('invoices.late') : inv.status === 'paiement_declare' ? t('invoices.paymentDeclared') : t('invoices.draft')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {inv.status !== 'payee' && inv.status !== 'brouillon' && inv.status !== 'paiement_declare' && (
                          <Button size="sm" onClick={() => openPayDialog(inv)}>
                            {t('invoices.pay')}
                          </Button>
                        )}
                        {inv.status === 'paiement_declare' && (
                          <Badge variant="outline" className="text-xs text-warning">{t('invoices.paymentDeclared')}</Badge>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(inv)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invoice detail dialog */}
      <Dialog open={!!detailInvoice} onOpenChange={(open) => !open && setDetailInvoice(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {detailInvoice?.invoice_number}
            </DialogTitle>
          </DialogHeader>
          {detailInvoice && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{t('invoices.issueDate')}</p>
                  <p className="text-sm font-medium">{new Date(detailInvoice.issue_date).toLocaleDateString('fr-CH')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('invoices.dueDate')}</p>
                  <p className="text-sm font-medium">{new Date(detailInvoice.due_date).toLocaleDateString('fr-CH')}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('invoices.status')}</p>
                  <Badge variant={detailInvoice.status === 'payee' ? 'default' : detailInvoice.status === 'en_retard' ? 'destructive' : 'secondary'}>
                    {detailInvoice.status === 'payee' ? t('invoices.paid') : detailInvoice.status === 'en_retard' ? t('invoices.late') : detailInvoice.status === 'envoyee' ? t('invoices.unpaid') : t('invoices.draft')}
                  </Badge>
                </div>
              </div>

              {detailInvoice.vehicle && (
                <div className="rounded-lg border border-border/60 bg-secondary/30 p-3">
                  <p className="text-xs text-muted-foreground">{t('invoices.vehicle')}</p>
                  <p className="text-sm font-medium">{detailInvoice.vehicle.brand} {detailInvoice.vehicle.model} — {detailInvoice.vehicle.license_plate}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium mb-2">{t('invoices.details')}</p>
                <div className="rounded-lg border border-border/60">
                  {(() => {
                    const laborItems = detailItems.filter((it) => it.item_type === 'main_oeuvre');
                    const partItems = detailItems.filter((it) => (it.item_type ?? 'piece') === 'piece');
                    const renderHeader = (qtyLabel: string, priceLabel: string) => (
                      <div className="grid grid-cols-12 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground border-b">
                        <div className="col-span-6">{t('clientInv.description')}</div>
                        <div className="col-span-2 text-center">{qtyLabel}</div>
                        <div className="col-span-2 text-right">{priceLabel}</div>
                        <div className="col-span-2 text-right">{t('clientInv.totalCol')}</div>
                      </div>
                    );
                    const renderRow = (it: any) => (
                      <div key={it.id} className="grid grid-cols-12 gap-2 px-4 py-2 text-sm border-b last:border-0">
                        <div className="col-span-6">{it.description}</div>
                        <div className="col-span-2 text-center">{formatQty(Number(it.quantity))}</div>
                        <div className="col-span-2 text-right">{formatCHF(it.unit_price)}</div>
                        <div className="col-span-2 text-right font-medium">{formatCHF(it.line_total)}</div>
                      </div>
                    );
                    return (
                      <>
                        {laborItems.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 pt-2 pb-1">{t('items.labor')}</p>
                            {renderHeader(t('items.hours'), t('items.hourlyRate'))}
                            {laborItems.map(renderRow)}
                          </div>
                        )}
                        {partItems.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 pt-2 pb-1">{t('items.parts')}</p>
                            {renderHeader(t('clientInv.qty'), t('clientInv.unitPrice'))}
                            {partItems.map(renderRow)}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="ml-auto max-w-xs space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('invoices.subtotal')}</span>
                  <span>{formatCHF(Number(detailInvoice.subtotal))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('invoices.vat')} ({detailInvoice.vat_rate}%)</span>
                  <span>{formatCHF(Number(detailInvoice.vat_amount))}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg">
                  <span className="font-bold">{t('invoices.total')}</span>
                  <span className="font-bold text-primary">{formatCHF(Number(detailInvoice.total))}</span>
                </div>
              </div>

              {detailInvoice.payment_method && detailInvoice.status === 'payee' && (
                <div className="flex items-center gap-2 rounded-lg bg-success/10 p-3">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm">{t('invoices.paidVia')} {detailInvoice.payment_method === 'qr_bill' ? t('invoices.qrBill') : detailInvoice.payment_method === 'carte' ? t('invoices.card') : t('invoices.twint')}</span>
                  {detailInvoice.paid_date && (
                    <span className="text-xs text-muted-foreground">{t('invoices.on')} {new Date(detailInvoice.paid_date).toLocaleDateString('fr-CH')}</span>
                  )}
                </div>
              )}

              <div className="flex justify-between gap-2 pt-2">
                <Button variant="outline" onClick={() => setDetailInvoice(null)}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {t('common.close')}
                </Button>
                <div className="flex gap-2">
                  {detailInvoice.status !== 'payee' && detailInvoice.status !== 'brouillon' && detailInvoice.status !== 'paiement_declare' && (
                    <Button onClick={() => { setPayInvoice(detailInvoice); setPayDialogOpen(true); setDetailInvoice(null); }}>
                      {t('invoices.payNow')}
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => handleDownload(detailInvoice)}>
                    <Download className="h-4 w-4 mr-2" />
                    PDF
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('invoices.payTitle')}</DialogTitle>
          </DialogHeader>
          {payInvoice && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-secondary/30 p-4 text-center">
                <p className="text-sm text-muted-foreground">{t('invoices.amountToPay')}</p>
                <p className="text-3xl font-bold text-primary">{formatCHF(Number(payInvoice.total))}</p>
                <p className="text-xs text-muted-foreground mt-1">{payInvoice.invoice_number}</p>
              </div>
              <p className="text-sm text-muted-foreground">{t('invoices.choosePayment')}</p>
              <div className="space-y-2">
                {paymentOptions.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.method}
                      onClick={() => handlePay(opt.method)}
                      disabled={paying}
                      className="flex w-full items-center gap-3 rounded-lg border border-border/60 p-4 text-left hover:border-primary/40 hover:bg-secondary/30 transition-all disabled:opacity-50"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {paying && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('invoices.processing')}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
