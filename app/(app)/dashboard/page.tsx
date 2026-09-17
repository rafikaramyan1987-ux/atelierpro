'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCHF, type Invoice, type Part, type Profile, type UserRole } from '@/lib/types/database';
import {
  FileText,
  Package,
  Users,
  TrendingUp,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowRight,
  CheckCircle2,
  Wrench,
  Bell,
  ShieldAlert,
  ClipboardList,
  CalendarDays,
  Send,
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
  reminderCount: number;
  pendingDevisCount: number;
  // mecanicien
  myRepairOrders: any[];
  todayPlanning: any[];
  // secretaire
  invoicesToIssue: any[];
  todayAppointments: any[];
  unpaidInvoices: any[];
  clientsDueForReminder: any[];
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { t } = useI18n();

  const role: UserRole = profile?.role ?? 'mecanicien';

  useEffect(() => {
    async function fetchDashboard() {
      if (role === 'admin') {
        await fetchAdminDashboard();
      } else if (role === 'mecanicien') {
        await fetchMecanicienDashboard();
      } else if (role === 'secretaire') {
        await fetchSecretaireDashboard();
      }
    }
    fetchDashboard();
  }, [role]);

  async function fetchAdminDashboard() {
    const [invoices, clients, parts, profiles, remindersRes, devisRes] = await Promise.all([
      supabase.from('invoices').select('*, client:clients(first_name, last_name)').order('created_at', { ascending: false }).limit(10),
      supabase.from('clients').select('id', { count: 'exact', head: true }),
      supabase.from('parts').select('*').order('stock_quantity', { ascending: true }),
      supabase.from('profiles').select('*').in('role', ['admin', 'mecanicien', 'secretaire']).order('created_at', { ascending: false }),
      supabase.from('canned_tasks').select('id', { count: 'exact', head: true }).not('interval_months', 'is', null),
      supabase.from('service_requests').select('id', { count: 'exact', head: true }).eq('status', 'en_attente_validation'),
    ]);

    const reminderCount = remindersRes.count ?? 0;
    const pendingDevisCount = devisRes.count ?? 0;
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
      en_attente_validation: 'hsl(var(--warning))',
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
      en_attente_validation: 'invoices.pendingValidation',
    };
    const invoiceStatusData = Object.entries(statusCounts).map(([status, count]) => ({
      name: invoiceStatusKey[status] ? t(invoiceStatusKey[status]) : status,
      value: count,
      color: statusColors[status] ?? 'hsl(var(--muted-foreground))',
    }));

    setData({
      totalRevenue, paidCount: paid.length, pendingCount: pending.length, overdueCount: overdue.length,
      totalClients: clients.count ?? 0, totalParts: allParts.length, lowStockParts: lowStock,
      recentInvoices: allInvoices as any, monthlyRevenue, invoiceStatusData,
      teamMembers: allProfiles, reminderCount, pendingDevisCount,
      myRepairOrders: [], todayPlanning: [],
      invoicesToIssue: [], todayAppointments: [], unpaidInvoices: [], clientsDueForReminder: [],
    });
    setLoading(false);
  }

  async function fetchMecanicienDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const [repairOrders, planning, parts] = await Promise.all([
      supabase.from('repair_orders').select('*, client:clients(first_name, last_name), vehicle:vehicles(brand, model, license_plate)').eq('status', 'en_cours').order('created_at', { ascending: false }),
      supabase.from('appointments').select('*, client:clients(first_name, last_name), vehicle:vehicles(brand, model, license_plate)').eq('scheduled_date', today).order('scheduled_time', { ascending: true }),
      supabase.from('parts').select('*').order('stock_quantity', { ascending: true }),
    ]);

    const allParts = parts.data ?? [];
    const lowStock = allParts.filter((p) => p.stock_quantity <= p.min_stock_threshold);

    setData({
      totalRevenue: 0, paidCount: 0, pendingCount: 0, overdueCount: 0,
      totalClients: 0, totalParts: allParts.length, lowStockParts: lowStock,
      recentInvoices: [], monthlyRevenue: [], invoiceStatusData: [],
      teamMembers: [], reminderCount: 0, pendingDevisCount: 0,
      myRepairOrders: repairOrders.data ?? [],
      todayPlanning: planning.data ?? [],
      invoicesToIssue: [], todayAppointments: [], unpaidInvoices: [], clientsDueForReminder: [],
    });
    setLoading(false);
  }

  async function fetchSecretaireDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const [invoicesToIssue, todayAppts, unpaidInvs, clientsRes] = await Promise.all([
      supabase.from('invoices').select('*, client:clients(first_name, last_name)').eq('status', 'en_attente_validation').order('created_at', { ascending: false }),
      supabase.from('appointments').select('*, client:clients(first_name, last_name), vehicle:vehicles(brand, model, license_plate)').in('scheduled_date', [today, tomorrowStr]).order('scheduled_date', { ascending: true }).order('scheduled_time', { ascending: true }),
      supabase.from('invoices').select('*, client:clients(first_name, last_name)').in('status', ['envoyee', 'en_retard']).order('due_date', { ascending: true }),
      supabase.from('clients').select('id, first_name, last_name, phone, email').order('created_at', { ascending: false }),
    ]);

    setData({
      totalRevenue: 0, paidCount: 0, pendingCount: 0, overdueCount: 0,
      totalClients: 0, totalParts: 0, lowStockParts: [],
      recentInvoices: [], monthlyRevenue: [], invoiceStatusData: [],
      teamMembers: [], reminderCount: 0, pendingDevisCount: 0,
      myRepairOrders: [],
      todayPlanning: [],
      invoicesToIssue: invoicesToIssue.data ?? [],
      todayAppointments: todayAppts.data ?? [],
      unpaidInvoices: unpaidInvs.data ?? [],
      clientsDueForReminder: (clientsRes.data ?? []).slice(0, 5),
    });
    setLoading(false);
  }

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

  // ── ADMIN DASHBOARD ──
  if (role === 'admin') {
    const stats = [
      { title: t('admin.dashboard.revenue'), value: formatCHF(data.totalRevenue), icon: TrendingUp, color: 'text-success', bgColor: 'bg-success/10' },
      { title: t('admin.dashboard.pendingAppts'), value: data.pendingCount.toString(), icon: Clock, color: 'text-primary', bgColor: 'bg-primary/10' },
      { title: t('admin.dashboard.activeInvoices'), value: data.overdueCount.toString(), icon: AlertTriangle, color: 'text-destructive', bgColor: 'bg-destructive/10' },
      { title: t('admin.dashboard.lowStock'), value: data.totalClients.toString(), icon: Users, color: 'text-chart-4', bgColor: 'bg-chart-4/10' },
    ];

    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t('admin.dashboard.title')} description="" />

        {data.pendingDevisCount > 0 && (
          <Card className="border-warning/30 border-2 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/rendez-vous')}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <ShieldAlert className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('devis.pendingApproval')} ({data.pendingDevisCount})</p>
                  <p className="text-xs text-muted-foreground">{t('devis.pendingApprovalHint')}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        )}

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

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-border/60">
            <CardHeader><CardTitle className="text-base">{t('admin.dashboard.revenue')}</CardTitle></CardHeader>
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
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} formatter={(value: number) => [formatCHF(value), t('admin.dashboard.revenue')]} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#revenueGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">{t('admin.dashboard.noActivity')}</div>
              )}
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader><CardTitle className="text-base">{t('admin.dashboard.activeInvoices')}</CardTitle></CardHeader>
            <CardContent>
              {data.invoiceStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={data.invoiceStatusData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2} dataKey="value">
                      {data.invoiceStatusData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }} />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-[280px] items-center justify-center text-muted-foreground text-sm">{t('admin.invoices.none')}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t('admin.dashboard.recentActivity')}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => router.push('/factures')}>{t('common.back')} <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recentInvoices.length > 0 ? (
                data.recentInvoices.slice(0, 5).map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => router.push(`/factures/${invoice.id}`)}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><FileText className="h-4 w-4 text-primary" /></div>
                      <div>
                        <p className="text-sm font-medium">{invoice.invoice_number}</p>
                        <p className="text-xs text-muted-foreground">{invoice.client ? `${invoice.client.first_name} ${invoice.client.last_name}` : '—'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{formatCHF(Number(invoice.total))}</p>
                      <Badge variant={invoice.status === 'payee' ? 'default' : invoice.status === 'en_retard' ? 'destructive' : 'secondary'} className="text-[10px]">
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
              <Button variant="ghost" size="sm" onClick={() => router.push('/stock')}>{t('common.back')} <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.lowStockParts.length > 0 ? (
                data.lowStockParts.slice(0, 5).map((part) => (
                  <div key={part.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10"><Package className="h-4 w-4 text-warning" /></div>
                      <div><p className="text-sm font-medium">{part.name}</p><p className="text-xs text-muted-foreground">{part.reference}</p></div>
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

        {data.reminderCount > 0 && (
          <Card className="border-primary/30 border-2 cursor-pointer hover:shadow-md transition-shadow" onClick={() => router.push('/rappels')}>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10"><Bell className="h-5 w-5 text-primary" /></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{t('reminders.dashboardCount', { count: data.reminderCount })}</p>
                  <p className="text-xs text-muted-foreground">{t('reminders.dashboardHint')}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── MECANICIEN DASHBOARD ──
  if (role === 'mecanicien') {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t('admin.dashboard.title')} description="" />

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/60">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"><ClipboardList className="h-5.5 w-5.5 text-primary" /></div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{t('dash.myRepairOrders')}</p>
              <p className="text-2xl font-bold">{data.myRepairOrders.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-4/10"><CalendarDays className="h-5.5 w-5.5 text-chart-4" /></div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{t('dash.todayPlanning')}</p>
              <p className="text-2xl font-bold">{data.todayPlanning.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10"><Package className="h-5.5 w-5.5 text-warning" /></div>
              </div>
              <p className="text-sm text-muted-foreground mb-1">{t('admin.dashboard.lowStock')}</p>
              <p className="text-2xl font-bold">{data.lowStockParts.length}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t('dash.myRepairOrders')}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => router.push('/ordres-reparation')}>{t('common.back')} <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.myRepairOrders.length > 0 ? (
                data.myRepairOrders.slice(0, 5).map((ro: any) => (
                  <div key={ro.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => router.push('/ordres-reparation')}>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><ClipboardList className="h-4 w-4 text-primary" /></div>
                      <div>
                        <p className="text-sm font-medium">{ro.vehicle ? `${ro.vehicle.brand} ${ro.vehicle.model}` : '—'}</p>
                        <p className="text-xs text-muted-foreground">{ro.client ? `${ro.client.first_name} ${ro.client.last_name}` : '—'}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{ro.status}</Badge>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <ClipboardList className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">{t('dash.noRepairOrders')}</p>
                </div>
              )}
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t('dash.todayPlanning')}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => router.push('/planning')}>{t('common.back')} <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.todayPlanning.length > 0 ? (
                data.todayPlanning.map((appt: any) => (
                  <div key={appt.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-4/10"><CalendarDays className="h-4 w-4 text-chart-4" /></div>
                      <div>
                        <p className="text-sm font-medium">{appt.client ? `${appt.client.first_name} ${appt.client.last_name}` : '—'}</p>
                        <p className="text-xs text-muted-foreground">{appt.service_type}</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium">{appt.scheduled_time ?? '—'}</p>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CalendarDays className="h-8 w-8 mb-2 opacity-50" />
                  <p className="text-sm">{t('dash.noAppointmentsToday')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {data.lowStockParts.length > 0 && (
          <Card className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{t('admin.dashboard.lowStock')}</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => router.push('/stock')}>{t('common.back')} <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.lowStockParts.slice(0, 5).map((part) => (
                <div key={part.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10"><Package className="h-4 w-4 text-warning" /></div>
                    <div><p className="text-sm font-medium">{part.name}</p><p className="text-xs text-muted-foreground">{part.reference}</p></div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-warning">{part.stock_quantity} {t('dash.remaining')}</p>
                    <p className="text-xs text-muted-foreground">{t('dash.min')} {part.min_stock_threshold}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ── SECRETAIRE DASHBOARD ──
  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('admin.dashboard.title')} description="" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10"><Send className="h-5.5 w-5.5 text-warning" /></div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{t('dash.invoicesToIssue')}</p>
            <p className="text-2xl font-bold">{data.invoicesToIssue.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-4/10"><CalendarDays className="h-5.5 w-5.5 text-chart-4" /></div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{t('dash.appointmentsTodayTomorrow')}</p>
            <p className="text-2xl font-bold">{data.todayAppointments.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10"><AlertTriangle className="h-5.5 w-5.5 text-destructive" /></div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{t('dash.unpaidInvoices')}</p>
            <p className="text-2xl font-bold">{data.unpaidInvoices.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10"><Bell className="h-5.5 w-5.5 text-primary" /></div>
            </div>
            <p className="text-sm text-muted-foreground mb-1">{t('dash.clientsDueForReminder')}</p>
            <p className="text-2xl font-bold">{data.clientsDueForReminder.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('dash.invoicesToIssue')}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push('/factures')}>{t('common.back')} <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.invoicesToIssue.length > 0 ? (
              data.invoicesToIssue.slice(0, 5).map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => router.push(`/factures/${inv.id}`)}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10"><FileText className="h-4 w-4 text-warning" /></div>
                    <div>
                      <p className="text-sm font-medium">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{inv.client ? `${inv.client.first_name} ${inv.client.last_name}` : '—'}</p>
                    </div>
                  </div>
                  <p className="text-sm font-semibold">{formatCHF(Number(inv.total))}</p>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mb-2 text-success" />
                <p className="text-sm">{t('dash.noInvoicesToIssue')}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('dash.appointmentsTodayTomorrow')}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push('/rendez-vous')}>{t('common.back')} <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.todayAppointments.length > 0 ? (
              data.todayAppointments.slice(0, 5).map((appt: any) => (
                <div key={appt.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-4/10"><CalendarDays className="h-4 w-4 text-chart-4" /></div>
                    <div>
                      <p className="text-sm font-medium">{appt.client ? `${appt.client.first_name} ${appt.client.last_name}` : '—'}</p>
                      <p className="text-xs text-muted-foreground">{appt.service_type}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{appt.scheduled_time ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{new Date(appt.scheduled_date).toLocaleDateString('fr-CH')}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CalendarDays className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">{t('dash.noAppointmentsToday')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t('dash.unpaidInvoices')}</CardTitle>
          <Button variant="ghost" size="sm" onClick={() => router.push('/factures')}>{t('common.back')} <ArrowUpRight className="h-3.5 w-3.5 ml-1" /></Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.unpaidInvoices.length > 0 ? (
            data.unpaidInvoices.slice(0, 5).map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-secondary/50 transition-colors cursor-pointer" onClick={() => router.push(`/factures/${inv.id}`)}>
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10"><AlertTriangle className="h-4 w-4 text-destructive" /></div>
                  <div>
                    <p className="text-sm font-medium">{inv.invoice_number}</p>
                    <p className="text-xs text-muted-foreground">{inv.client ? `${inv.client.first_name} ${inv.client.last_name}` : '—'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCHF(Number(inv.total))}</p>
                  <p className="text-xs text-muted-foreground">{t('invoices.dueDate')}: {new Date(inv.due_date).toLocaleDateString('fr-CH')}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mb-2 text-success" />
              <p className="text-sm">{t('dash.noUnpaidInvoices')}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
