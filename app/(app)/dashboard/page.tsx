'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCHF, INVOICE_STATUS_LABELS, type Invoice, type Part, type Profile } from '@/lib/types/database';
import {
  FileText,
  Package,
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  Wrench,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n/context';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface DashboardData {
  totalRevenue: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  totalClients: number;
  totalParts: number;
  lowStockParts: Part[];
  recentInvoices: (Invoice & { client?: { first_name: string; last_name: string } })[];
  monthlyRevenue: { month: string; revenue: number }[];
  invoiceStatusData: { name: string; value: number; color: string }[];
  teamMembers: Profile[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    async function fetchDashboard() {
      const [invoices, clients, parts, profiles] = await Promise.all([
        supabase.from('invoices').select('*, client:clients(first_name, last_name)').order('created_at', { ascending: false }).limit(10),
        supabase.from('clients').select('id', { count: 'exact', head: true }),
        supabase.from('parts').select('*').order('stock_quantity', { ascending: true }),
        supabase.from('profiles').select('*').in('role', ['admin', 'mecanicien']).order('created_at', { ascending: false }),
      ]);

      const allInvoices = invoices.data ?? [];
      const allParts = parts.data ?? [];
      const allProfiles = (profiles.data as Profile[]) ?? [];

      const paid = allInvoices.filter((i: any) => i.status === 'payee');
      const pending = allInvoices.filter((i: any) => i.status === 'envoyee');
      const overdue = allInvoices.filter((i: any) => i.status === 'en_retard');
      const totalRevenue = paid.reduce((sum: number, i: any) => sum + Number(i.total), 0);

      const lowStock = allParts.filter((p) => p.stock_quantity <= p.min_stock_threshold);

      const monthlyMap = new Map<string, number>();
      paid.forEach((inv: any) => {
        const month = new Date(inv.issue_date).toLocaleDateString('fr-CH', { month: 'short' });
        monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + Number(inv.total));
      });
      const monthlyRevenue = Array.from(monthlyMap.entries()).map(([month, revenue]) => ({ month, revenue }));

      const statusColors: Record<string, string> = {
        brouillon: 'hsl(var(--muted-foreground))',
        envoyee: 'hsl(var(--chart-1))',
        payee: 'hsl(var(--success))',
        en_retard: 'hsl(var(--destructive))',
      };

      const statusCounts: Record<string, number> = {};
      allInvoices.forEach((inv: any) => {
        statusCounts[inv.status] = (statusCounts[inv.status] ?? 0) + 1;
      });

      const invoiceStatusKey: Record<string, string> = {
        brouillon: 'invoices.draft',
        envoyee: 'invoices.unpaid',
        payee: 'invoices.paid',
        en_retard: 'invoices.late',
      };
      const invoiceStatusData = Object.entries(statusCounts).map(([status, count]) => ({
        name: invoiceStatusKey[status] ? t(invoiceStatusKey[status]) : status,
        value: count,
        color: statusColors[status] ?? 'hsl(var(--muted-foreground))',
      }));

      setData({
        totalRevenue,
        paidCount: paid.length,
        pendingCount: pending.length,
        overdueCount: overdue.length,
        totalClients: clients.count ?? 0,
        totalParts: allParts.length,
        lowStockParts: lowStock,
        recentInvoices: allInvoices as any,
        monthlyRevenue,
        invoiceStatusData,
        teamMembers: allProfiles,
      });
      setLoading(false);
    }
    fetchDashboard();
  }, []);

  if (loading || !data) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t('admin.dashboard.title')} description="" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-32" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: t('admin.dashboard.revenue'),
      value: formatCHF(data.totalRevenue),
      icon: TrendingUp,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      title: t('admin.dashboard.pendingAppts'),
      value: data.pendingCount.toString(),
      icon: Clock,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: t('admin.dashboard.activeInvoices'),
      value: data.overdueCount.toString(),
      icon: AlertTriangle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      title: t('admin.dashboard.lowStock'),
      value: data.totalClients.toString(),
      icon: Users,
      color: 'text-chart-4',
      bgColor: 'bg-chart-4/10',
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('admin.dashboard.title')} description="" />

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-border/60 hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.bgColor}`}>
                    <Icon className={`h-5.5 w-5.5 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/60">
          <CardHeader>
            <CardTitle className="text-base">{t('admin.dashboard.revenue')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data.monthlyRevenue}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    formatter={(value: number) => [formatCHF(value), t('admin.dashboard.revenue')]}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                {t('admin.dashboard.noActivity')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">{t('admin.dashboard.activeInvoices')}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.invoiceStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={data.invoiceStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {data.invoiceStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">
                {t('admin.invoices.none')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent invoices + Low stock */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('admin.dashboard.recentActivity')}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push('/factures')}>
              {t('common.back')} <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentInvoices.length > 0 ? (
              data.recentInvoices.slice(0, 5).map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-secondary/50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/factures/${invoice.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{invoice.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.client ? `${invoice.client.first_name} ${invoice.client.last_name}` : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCHF(Number(invoice.total))}</p>
                    <Badge
                      variant={invoice.status === 'payee' ? 'default' : invoice.status === 'en_retard' ? 'destructive' : 'secondary'}
                      className="text-[10px]"
                    >
                      {invoice.status === 'brouillon' ? t('invoices.draft') : invoice.status === 'envoyee' ? t('invoices.unpaid') : invoice.status === 'payee' ? t('invoices.paid') : invoice.status === 'en_retard' ? t('invoices.late') : invoice.status}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">{t('admin.invoices.none')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('admin.dashboard.lowStock')}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push('/stock')}>
              {t('common.back')} <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.lowStockParts.length > 0 ? (
              data.lowStockParts.slice(0, 5).map((part) => (
                <div key={part.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
                      <Package className="h-4 w-4 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{part.name}</p>
                      <p className="text-xs text-muted-foreground">{part.reference}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-warning">{part.stock_quantity} {t('dash.remaining')}</p>
                    <p className="text-xs text-muted-foreground">{t('dash.min')} {part.min_stock_threshold}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-2 text-success" />
                <p className="text-sm">{t('admin.stock.none')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team overview */}
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('admin.team.title')}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => router.push('/equipe')}>
            {t('common.save')} <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            {data.teamMembers.map((member) => (
              <div key={member.id} className="flex items-center gap-3 rounded-lg border p-3 pr-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  {member.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{member.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {member.role === 'admin' ? t('role.admin') : t('role.mecanicien')}
                  </p>
                </div>
                {member.role === 'admin' && (
                  <Wrench className="h-3.5 w-3.5 text-primary ml-2" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
