'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCHF, INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS, type Invoice } from '@/lib/types/database';
import { Plus, Search, FileText, Loader2, Eye, Download, FileSpreadsheet, Send } from 'lucide-react';
import { generateInvoicePDF, garageToPdfInfo } from '@/lib/pdf';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';
import type { Garage } from '@/lib/types/database';
import { localDateStr, localDateStrPlusDays } from '@/lib/utils';
import * as XLSX from 'xlsx';

export default function FacturesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<(Invoice & { client?: { first_name: string; last_name: string; company_name: string | null } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [exportFrom, setExportFrom] = useState(localDateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [exportTo, setExportTo] = useState(localDateStrPlusDays(0, new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0)));
  const [exporting, setExporting] = useState(false);
  const { t } = useI18n();
  const { profile } = useAuth();

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('invoices')
      .select('*, client:clients(first_name, last_name, company_name)')
      .order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      toast.error('Erreur lors du chargement des factures');
    } else {
      setInvoices(data as any);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  async function handleDownload(invoice: Invoice & { client?: any }) {
    const { data: items } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id);

    let vehicle = null;
    if (invoice.vehicle_id) {
      const { data: v } = await supabase
        .from('vehicles')
        .select('*')
        .eq('id', invoice.vehicle_id)
        .maybeSingle();
      vehicle = v;
    }

    let garage: Garage | null = null;
    if (invoice.garage_id) {
      const { data: g } = await supabase.from('garages').select('*').eq('id', invoice.garage_id).maybeSingle();
      garage = g as Garage | null;
    }
    await generateInvoicePDF(invoice, invoice.client, vehicle, items ?? [], garageToPdfInfo(garage));
    toast.success(t('toast.pdfDownloaded'));
  }

  async function handleIssueInvoice(invoice: Invoice) {
    const { error } = await supabase.from('invoices').update({ status: 'envoyee' }).eq('id', invoice.id);
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(t('invList.invoiceSent'));
      fetchInvoices();
    }
  }

  async function handleConfirmPayment(invoice: Invoice) {
    const { error } = await supabase.from('invoices').update({
      status: 'payee',
      paid_date: localDateStr(),
    }).eq('id', invoice.id);
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(t('invoices.paymentConfirmed'));
      fetchInvoices();
    }
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      let query = supabase
        .from('invoices')
        .select('*, client:clients(first_name, last_name, company_name)')
        .order('issue_date', { ascending: true });

      if (exportFrom) {
        query = query.gte('issue_date', exportFrom);
      }
      if (exportTo) {
        query = query.lte('issue_date', exportTo + 'T23:59:59');
      }

      const { data, error } = await query;
      if (error) throw error;

      const allRows = (data as any[]) ?? [];
      const rows = allRows.filter((inv) => inv.status !== 'brouillon');

      const headers = [
        t('export.invoiceNumber'),
        t('export.date'),
        t('export.clientName'),
        t('export.subtotalHT'),
        t('export.vatAmount'),
        t('export.totalTTC'),
        t('export.paymentStatus'),
        t('export.paymentMethod'),
 t('export.paymentDate'),
      ];

      const aoa: (string | number | Date)[][] = [headers];

      for (const inv of rows) {
        const clientName = inv.client?.company_name
          || `${inv.client?.first_name ?? ''} ${inv.client?.last_name ?? ''}`.trim();
        const statusLabel = inv.status === 'payee' ? t('invoices.paid')
          : inv.status === 'envoyee' ? t('invoices.unpaid')
          : inv.status === 'en_retard' ? t('invoices.late')
          : inv.status === 'paiement_declare' ? t('invoices.paymentDeclared')
          : inv.status === 'en_attente_validation' ? t('invoices.pendingValidation')
          : inv.status;
        const methodLabel = inv.payment_method ? (PAYMENT_METHOD_LABELS[inv.payment_method as keyof typeof PAYMENT_METHOD_LABELS] ?? inv.payment_method) : '';
        const paidDate = inv.paid_date ? new Date(inv.paid_date) : '';

        aoa.push([
          inv.invoice_number,
          new Date(inv.issue_date),
          clientName,
          Number(inv.subtotal),
          Number(inv.vat_amount),
          Number(inv.total),
          statusLabel,
          methodLabel,
          paidDate,
        ]);
      }

      const totalSub = rows.reduce((s, inv) => s + Number(inv.subtotal), 0);
      const totalVat = rows.reduce((s, inv) => s + Number(inv.vat_amount), 0);
      const totalTotal = rows.reduce((s, inv) => s + Number(inv.total), 0);
      aoa.push(['', '', 'TOTAL', totalSub, totalVat, totalTotal, '', '', '']);

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = [
        { wch: 18 }, { wch: 12 }, { wch: 28 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 14 },
      ];
      ws['!freeze'] = { ySplit: 1 };
      ws['!merges'] = [];

      const range = XLSX.utils.decode_range(ws['!ref']!);
      for (let C = 0; C <= 8; C++) {
        const cellAddr = XLSX.utils.encode_cell({ r: 0, c: C });
        if (ws[cellAddr]) {
          ws[cellAddr].s = { font: { bold: true } };
        }
      }
      const totalRowIdx = aoa.length - 1;
      for (let C = 0; C <= 8; C++) {
        const cellAddr = XLSX.utils.encode_cell({ r: totalRowIdx, c: C });
        if (ws[cellAddr]) {
          ws[cellAddr].s = { font: { bold: true } };
        }
      }

      for (let R = 1; R < aoa.length; R++) {
        const dateCell = ws[XLSX.utils.encode_cell({ r: R, c: 1 })];
        if (dateCell && typeof dateCell.v === 'object' && dateCell.v instanceof Date) {
          dateCell.z = 'dd.mm.yyyy';
          dateCell.t = 'd';
        }
        const paidCell = ws[XLSX.utils.encode_cell({ r: R, c: 8 })];
        if (paidCell && typeof paidCell.v === 'object' && paidCell.v instanceof Date) {
          paidCell.z = 'dd.mm.yyyy';
          paidCell.t = 'd';
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Factures');
      XLSX.writeFile(wb, `factures_${exportFrom}_${exportTo}.xlsx`);
      toast.success(t('export.success', { count: rows.length }));
    } catch (err: any) {
      toast.error(t('export.error'), { description: err.message });
    }
    setExporting(false);
  }

  const filteredInvoices = invoices.filter((inv) => {
    if (statusFilter !== 'all' && inv.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        inv.invoice_number.toLowerCase().includes(s) ||
        (inv.client?.first_name + ' ' + inv.client?.last_name).toLowerCase().includes(s) ||
        (inv.client?.company_name ?? '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  const now = new Date();
  const monthStart = localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  const monthEnd = localDateStrPlusDays(0, new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const totalAmount = invoices
    .filter((inv) => inv.status !== 'brouillon' && inv.issue_date >= monthStart && inv.issue_date <= monthEnd)
    .reduce((sum, inv) => sum + Number(inv.total), 0);
  const paidAmount = invoices
    .filter((i) => i.status === 'payee' && i.paid_date && i.paid_date >= monthStart && i.paid_date <= monthEnd)
    .reduce((sum, inv) => sum + Number(inv.total), 0);
  const pendingAmount = invoices
    .filter((i) => i.status === 'envoyee' || i.status === 'en_retard' || i.status === 'paiement_declare')
    .reduce((sum, inv) => sum + Number(inv.total), 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('admin.invoices.title')} description={t('admin.invoices.desc')}>
        <Button onClick={() => router.push('/factures/nouveau')}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.invoices.new')}
        </Button>
      </PageHeader>

      {/* Export section */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">{t('export.title')}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('export.fromLabel')}</Label>
                <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="sm:w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{t('export.toLabel')}</Label>
                <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="sm:w-40" />
              </div>
            </div>
            <Button variant="outline" onClick={handleExportExcel} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {t('export.downloadExcel')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">{t('export.hintExcel')}</p>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">{t('invoices.revenueMonth')}</p>
            <p className="text-2xl font-bold">{formatCHF(totalAmount)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">{t('invoices.totalPaidMonth')}</p>
            <p className="text-2xl font-bold text-success">{formatCHF(paidAmount)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">{t('invoices.totalPendingAll')}</p>
            <p className="text-2xl font-bold text-primary">{formatCHF(pendingAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('common.search')}
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder={t('invoices.status')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="brouillon">{t('invoices.draft')}</SelectItem>
            <SelectItem value="envoyee">{t('invoices.unpaid')}</SelectItem>
            <SelectItem value="en_attente_validation">{t('invoices.pendingValidation')}</SelectItem>
            <SelectItem value="payee">{t('invoices.paid')}</SelectItem>
            <SelectItem value="en_retard">{t('invoices.late')}</SelectItem>
            <SelectItem value="paiement_declare">{t('invoices.paymentDeclared')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">{t('admin.invoices.none')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invoices.number')}</TableHead>
                  <TableHead>{t('admin.clients.title')}</TableHead>
                  <TableHead className="text-right">{t('invoices.subtotal')}</TableHead>
                  <TableHead className="text-right">{t('invoices.vat')} 8.1%</TableHead>
                  <TableHead className="text-right">{t('invoices.total')}</TableHead>
                  <TableHead>{t('invoices.status')}</TableHead>
                  <TableHead>{t('invoices.date')}</TableHead>
                  <TableHead className="text-right">{t('common.save')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id} className="hover:bg-secondary/50 cursor-pointer" onClick={() => router.push(`/factures/${invoice.id}`)}>
                    <TableCell className="font-mono text-xs font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell>
                      {invoice.client?.company_name
                        ? invoice.client.company_name
                        : `${invoice.client?.first_name ?? ''} ${invoice.client?.last_name ?? ''}`}
                    </TableCell>
                    <TableCell className="text-right">{formatCHF(Number(invoice.subtotal))}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCHF(Number(invoice.vat_amount))}</TableCell>
                    <TableCell className="text-right font-bold">{formatCHF(Number(invoice.total))}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          invoice.status === 'payee' ? 'default'
                          : invoice.status === 'en_retard' ? 'destructive'
                          : invoice.status === 'envoyee' ? 'secondary'
                          : invoice.status === 'paiement_declare' ? 'outline'
                          : invoice.status === 'en_attente_validation' ? 'outline'
                          : 'outline'
                        }
                        className="text-xs"
                      >
                        {invoice.status === 'brouillon' ? t('invoices.draft') : invoice.status === 'envoyee' ? t('invoices.unpaid') : invoice.status === 'payee' ? t('invoices.paid') : invoice.status === 'en_retard' ? t('invoices.late') : invoice.status === 'en_attente_validation' ? t('invoices.pendingValidation') : invoice.status === 'paiement_declare' ? t('invoices.paymentDeclared') : INVOICE_STATUS_LABELS[invoice.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(invoice.issue_date).toLocaleDateString('fr-CH')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {invoice.status === 'en_attente_validation' && (profile?.role === 'admin' || profile?.role === 'secretaire') && (
                          <Button variant="ghost" size="icon" title={t('invList.issueInvoice')} onClick={() => handleIssueInvoice(invoice)}>
                            <Send className="h-4 w-4 text-primary" />
                          </Button>
                        )}
                        {invoice.status === 'paiement_declare' && (profile?.role === 'admin' || profile?.role === 'secretaire') && (
                          <Button variant="outline" size="sm" onClick={() => handleConfirmPayment(invoice)}>
                            {t('invoices.confirmPayment')}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => router.push(`/factures/${invoice.id}`)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(invoice)}>
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
    </div>
  );
}
