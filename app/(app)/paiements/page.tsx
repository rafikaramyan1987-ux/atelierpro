'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCHF, PAYMENT_METHOD_LABELS, type Invoice, type TwintPayment } from '@/lib/types/database';
import { CreditCard, QrCode, Smartphone, Wallet, ArrowLeft, Download, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { generateInvoicePDF } from '@/lib/pdf';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';

export default function PaiementsPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [twintPayments, setTwintPayments] = useState<TwintPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    async function fetchData() {
      const [invRes, twintRes] = await Promise.all([
        supabase.from('invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('twint_payments').select('*').order('created_at', { ascending: false }),
      ]);
      setInvoices((invRes.data as Invoice[]) ?? []);
      setTwintPayments((twintRes.data as TwintPayment[]) ?? []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const paidInvoices = invoices.filter((i) => i.status === 'payee');
  const pendingInvoices = invoices.filter((i) => i.status === 'envoyee' || i.status === 'en_retard');
  const totalRevenue = paidInvoices.reduce((sum, i) => sum + Number(i.total), 0);
  const totalPending = pendingInvoices.reduce((sum, i) => sum + Number(i.total), 0);

  const methodBreakdown = invoices.reduce((acc, inv) => {
    if (inv.payment_method && inv.status === 'payee') {
      acc[inv.payment_method] = (acc[inv.payment_method] ?? 0) + 1;
    }
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
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('admin.payments.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">{formatCHF(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">{paidInvoices.length} {t('invoices.paid')}</p>
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
            <CardTitle className="text-base">{t('admin.payments.title')}</CardTitle>
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
                        {method === 'qr_bill' ? t('invoices.qrBill') : method === 'carte' ? t('invoices.card') : method === 'twint' ? t('invoices.twint') : PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method}
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
            <CardTitle className="text-base">{t('admin.payments.title')}</CardTitle>
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
          {invoices.slice(0, 10).map((inv) => (
            <div key={inv.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 hover:bg-secondary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium">{inv.invoice_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(inv.issue_date).toLocaleDateString('fr-CH')}
                    {inv.payment_method && ` · ${inv.payment_method === 'qr_bill' ? t('invoices.qrBill') : inv.payment_method === 'carte' ? t('invoices.card') : inv.payment_method === 'twint' ? t('invoices.twint') : PAYMENT_METHOD_LABELS[inv.payment_method] ?? inv.payment_method}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">{formatCHF(Number(inv.total))}</span>
                <Badge
                  variant={inv.status === 'payee' ? 'default' : inv.status === 'en_retard' ? 'destructive' : 'secondary'}
                >
                  {inv.status === 'payee' ? t('invoices.paid') : inv.status === 'envoyee' ? t('invoices.unpaid') : inv.status === 'en_retard' ? t('invoices.late') : t('invoices.draft')}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => router.push(`/factures/${inv.id}`)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          {invoices.length === 0 && <p className="text-sm text-muted-foreground">{t('admin.invoices.none')}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
