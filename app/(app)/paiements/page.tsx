'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCHF, PAYMENT_METHOD_LABELS, type Invoice, type TwintPayment, type InvoicePayment, type PaymentMethodNoQR } from '@/lib/types/database';
import { CreditCard, QrCode, Smartphone, Wallet, ArrowLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';

export default function PaiementsPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [twintPayments, setTwintPayments] = useState<TwintPayment[]>([]);
  const [payments, setPayments] = useState<InvoicePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    async function fetchData() {
      const [invRes, twintRes, payRes] = await Promise.all([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('twint_payments').select('*').order('created_at', { ascending: false }),
        supabase.from('invoice_payments').select('*').order('paid_at', { ascending: false }),
      ]);
      setInvoices((invRes.data as Invoice[]) ?? []);
      setTwintPayments((twintRes.data as TwintPayment[]) ?? []);
      setPayments((payRes.data as InvoicePayment[]) ?? []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  const pendingStatuses = ['envoyee', 'en_retard', 'partiellement_payee', 'paiement_declare'];
  const pendingInvoices = invoices.filter((i) => pendingStatuses.includes(i.status));
  const totalPending = pendingInvoices.reduce((sum, i) => sum + (Number(i.total) - Number(i.amount_paid ?? 0)), 0);

  const methodBreakdown = payments.reduce((acc, p) => {
    acc[p.method] = (acc[p.method] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const methodIcons: Record<string, any> = {
    qr_bill: QrCode,
    carte: CreditCard,
    twint: Smartphone,
    virement: Wallet,
    especes: Wallet,
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const methodLabel = (m: string) => {
    if (m === 'qr_bill') return t('invoices.qrBill');
    if (m === 'carte') return t('invoices.card');
    if (m === 'twint') return t('invoices.twint');
    return PAYMENT_METHOD_LABELS[m as keyof typeof PAYMENT_METHOD_LABELS] ?? m;
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <PageHeader title={t('admin.payments.title')} description={t('admin.payments.desc')}>
        <Button variant="outline" onClick={() => router.push('/factures')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('admin.invoices.title')}
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('invoices.collectedTTC')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">{formatCHF(totalCollected)}</p>
            <p className="text-xs text-muted-foreground mt-1">{payments.length} {t('invDetail.payments').toLowerCase()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('admin.appts.pending')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-warning">{formatCHF(totalPending)}</p>
            <p className="text-xs text-muted-foreground mt-1">{pendingInvoices.length} {t('invoices.unpaid')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('pay.twintTransactions')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{twintPayments.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {twintPayments.filter((p) => p.status === 'confirmee').length} {t('admin.appts.confirmed').toLowerCase()}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('invDetail.payments')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(methodBreakdown).length > 0 ? (
              Object.entries(methodBreakdown).map(([method, count]) => {
                const Icon = methodIcons[method] ?? CreditCard;
                return (
                  <div key={method} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-4.5 w-4.5 text-primary" />
                      </div>
                      <span className="text-sm font-medium">
                        {methodLabel(method)}
                      </span>
                    </div>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">{t('admin.payments.none')}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('pay.twintTransactions')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {twintPayments.length > 0 ? (
              twintPayments.slice(0, 8).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div>
                    <p className="text-sm font-medium">{formatCHF(payment.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(payment.created_at).toLocaleDateString('fr-CH')}
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
              ))
            ) : (
              <p className="text-sm text-muted-foreground">{t('admin.payments.none')}</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('admin.dashboard.recentActivity')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {payments.slice(0, 10).map((p) => {
            const inv = invoices.find((i) => i.id === p.invoice_id);
            return (
              <div key={p.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="text-sm font-medium">{inv?.invoice_number ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.paid_at).toLocaleDateString('fr-CH')}
                      {` · ${methodLabel(p.method)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">{formatCHF(Number(p.amount))}</span>
                  {inv && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => router.push(`/factures/${inv.id}`)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {payments.length === 0 && <p className="text-sm text-muted-foreground">{t('admin.payments.none')}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
