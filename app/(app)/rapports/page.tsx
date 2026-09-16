'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp, FileText, ClipboardList, Wrench, Loader2, Calendar, Clock,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { formatCHF, type Invoice, type RepairOrder, type Profile } from '@/lib/types/database';

interface ReportData {
  totalRevenue: number;
  invoiceCount: number;
  completedOrders: number;
  topServices: { name: string; count: number }[];
  mechanicHours: { name: string; hours: number }[];
  monthlyRevenue: { month: string; revenue: number }[];
}

export default function RapportsPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [repairOrders, setRepairOrders] = useState<(RepairOrder & { assigned_mechanic?: Profile })[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const [invRes, roRes] = await Promise.all([
        supabase.from('invoices').select('*').order('issue_date', { ascending: false }),
        supabase.from('repair_orders').select('*, assigned_mechanic:profiles(*)').order('created_at', { ascending: false }),
      ]);
      setInvoices((invRes.data as Invoice[]) ?? []);
      setRepairOrders((roRes.data as any[]) ?? []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const report: ReportData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59);

    const monthInvoices = invoices.filter((inv) => {
      const d = new Date(inv.issue_date);
      return d >= monthStart && d <= monthEnd;
    });

    const paidInvoices = monthInvoices.filter((i) => i.status === 'payee');
    const totalRevenue = paidInvoices.reduce((sum, i) => sum + Number(i.total), 0);

    const monthOrders = repairOrders.filter((ro) => {
      const d = new Date(ro.created_at);
      return d >= monthStart && d <= monthEnd;
    });
    const completedOrders = monthOrders.filter((ro) => ro.status === 'termine' || ro.status === 'facture').length;

    // Top services from invoice items
    const serviceCounts = new Map<string, number>();
    for (const inv of monthInvoices) {
      // We don't have invoice_items loaded, so use notes as proxy
      const note = inv.notes ?? '';
      if (note) {
        const words = note.split(/[,;]/).map((w) => w.trim()).filter(Boolean);
        for (const w of words) {
          serviceCounts.set(w, (serviceCounts.get(w) ?? 0) + 1);
        }
      }
    }
    const topServices = Array.from(serviceCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Mechanic hours from repair orders
    const mechanicMap = new Map<string, number>();
    for (const ro of monthOrders) {
      if (ro.start_time && ro.end_time) {
        const start = new Date(ro.start_time);
        const end = new Date(ro.end_time);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const name = ro.assigned_mechanic?.full_name ?? t('reports.unassigned');
        mechanicMap.set(name, (mechanicMap.get(name) ?? 0) + hours);
      }
    }
    const mechanicHours = Array.from(mechanicMap.entries())
      .map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours);

    // 6-month revenue chart
    const monthlyRevenue: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - 1 - i, 1);
      const s = new Date(d.getFullYear(), d.getMonth(), 1);
      const e = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      const rev = invoices
        .filter((inv) => inv.status === 'payee')
        .filter((inv) => {
          const id = new Date(inv.issue_date);
          return id >= s && id <= e;
        })
        .reduce((sum, inv) => sum + Number(inv.total), 0);
      monthlyRevenue.push({
        month: d.toLocaleDateString('fr-CH', { month: 'short' }),
        revenue: Math.round(rev * 100) / 100,
      });
    }

    return {
      totalRevenue,
      invoiceCount: monthInvoices.length,
      completedOrders,
      topServices,
      mechanicHours,
      monthlyRevenue,
    };
  }, [invoices, repairOrders, selectedMonth, t]);

  const monthOptions = useMemo(() => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('reports.title')} description={t('reports.desc')}>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-56">
            <Calendar className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('reports.revenue')}</p>
                <p className="text-2xl font-bold">{formatCHF(report.totalRevenue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('reports.invoiceCount')}</p>
                <p className="text-2xl font-bold">{report.invoiceCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                <ClipboardList className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('reports.completedOrders')}</p>
                <p className="text-2xl font-bold">{report.completedOrders}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <Wrench className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('reports.mechanicHours')}</p>
                <p className="text-2xl font-bold">{report.mechanicHours.reduce((s, m) => s + m.hours, 0).toFixed(1)}h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue chart */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">{t('reports.revenueChart')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={report.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value: number) => [formatCHF(value), t('reports.revenue')]}
              />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Top services */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">{t('reports.topServices')}</CardTitle>
          </CardHeader>
          <CardContent>
            {report.topServices.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.service')}</TableHead>
                    <TableHead className="text-right">{t('reports.frequency')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.topServices.map((svc, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">{svc.name}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{svc.count}×</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t('reports.noData')}</p>
            )}
          </CardContent>
        </Card>

        {/* Mechanic hours */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">{t('reports.mechanicHoursTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {report.mechanicHours.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reports.mechanic')}</TableHead>
                    <TableHead className="text-right">{t('reports.hours')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.mechanicHours.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          {m.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{m.hours.toFixed(1)}h</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">{t('reports.noData')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
