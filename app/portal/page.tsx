'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  formatCHF,
  type Vehicle,
  type Appointment,
  type Invoice,
} from '@/lib/types/database';
import {
  Car,
  CalendarClock,
  FileText,
  FileSearch,
  MapPin,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Loader2,
  Wrench,
  Bell,
  AlertCircle,
} from 'lucide-react';

export default function ClientPortalHome() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [appointments, setAppointments] = useState<(Appointment & { vehicle?: Vehicle })[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [serviceDueVehicles, setServiceDueVehicles] = useState<{ vehicle: Vehicle; reason: string }[]>([]);

  useEffect(() => {
    if (!profile?.client_id) {
      setLoading(false);
      return;
    }
    setClientId(profile.client_id);
  }, [profile]);

  useEffect(() => {
    if (!clientId) return;
    async function fetchData() {
      const [vehiclesRes, apptsRes, invoicesRes, tasksRes] = await Promise.all([
        supabase.from('vehicles').select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
        supabase.from('appointments').select('*, vehicle:vehicles(*)').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5),
        supabase.from('invoices').select('*, vehicle:vehicles(*)').eq('client_id', clientId).order('created_at', { ascending: false }).limit(5),
        supabase.from('canned_tasks').select('*').not('interval_months', 'is', null),
      ]);
      const allVehicles = vehiclesRes.data as Vehicle[] ?? [];
      setVehicles(allVehicles);
      setAppointments(apptsRes.data as any ?? []);
      setInvoices(invoicesRes.data as Invoice[] ?? []);

      // Compute service due
      const tasks = (tasksRes.data as any[]) ?? [];
      const allInvoices = (invoicesRes.data as any[]) ?? [];
      const dueList: { vehicle: Vehicle; reason: string }[] = [];
      const now = new Date();
      for (const vehicle of allVehicles) {
        const vehicleInvoices = allInvoices.filter((inv) => inv.vehicle_id === vehicle.id);
        for (const task of tasks) {
          const matching = vehicleInvoices.filter((inv) =>
            (inv.notes ?? '').toLowerCase().includes(task.name.toLowerCase())
          );
          const lastInv = matching[0];
          if (!lastInv) continue;
          const lastDate = new Date(lastInv.issue_date);
          const dueDate = new Date(lastDate.getTime() + (task.interval_months ?? 12) * 30 * 24 * 60 * 60 * 1000);
          if (dueDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
            const days = Math.round((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            dueList.push({
              vehicle,
              reason: days <= 0 ? t('reminders.overdueShort', { days: Math.abs(days) }) : t('reminders.dueInShort', { days }),
            });
            break;
          }
        }
      }
      setServiceDueVehicles(dueList);

      setLoading(false);
    }
    fetchData();
  }, [clientId]);

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="p-6">
        <Card className="border-border/60">
          <CardContent className="p-8 text-center">
            <Wrench className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t('portal.noClientAccount')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingAppts = appointments.filter((a) => a.status === 'en_attente').length;
  const confirmedAppts = appointments.filter((a) => a.status === 'confirme').length;
  const paidInvoices = invoices.filter((i) => i.status === 'payee');
  const totalPaid = paidInvoices.reduce((sum, i) => sum + Number(i.total), 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={`${t('portal.welcome')}, ${profile?.full_name?.split(' ')[0]}`} description="AtelierPro" />

      {/* Quick actions */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/60 hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/portal/rendez-vous')}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600/10">
              <CalendarClock className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('portal.bookAppointment')}</p>
              <p className="text-xs text-muted-foreground">{t('portal.appointments')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/portal/vehicules')}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Car className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('portal.myVehicles')}</p>
              <p className="text-xs text-muted-foreground">{t('portal.myVehiclesCount')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/portal/factures')}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-chart-4/10">
              <FileText className="h-5 w-5 text-chart-4" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('portal.invoices')}</p>
              <p className="text-xs text-muted-foreground">{t('portal.viewInvoices')}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 hover:shadow-md transition-shadow cursor-pointer" onClick={() => router.push('/portal/devis')}>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10">
              <FileSearch className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('portal.devis')}</p>
              <p className="text-xs text-muted-foreground">{t('portal.getQuote')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Service due notice */}
      {serviceDueVehicles.length > 0 && (
        <Card className="border-warning/40 border-2">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10 shrink-0">
                <Bell className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold mb-2">{t('reminders.clientTitle')}</p>
                <div className="space-y-2">
                  {serviceDueVehicles.map((item, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-border/40 bg-secondary/30 p-3">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{item.vehicle.brand} {item.vehicle.model} — {item.vehicle.license_plate}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />{item.reason}
                        </span>
                        <Button size="sm" variant="outline" onClick={() => router.push('/portal/rendez-vous')}>
                          <CalendarClock className="h-3.5 w-3.5 mr-1" />
                          {t('reminders.bookNow')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('portal.pendingAppts')}</p>
                <p className="text-xl font-bold">{pendingAppts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('portal.confirmedAppts')}</p>
                <p className="text-xl font-bold">{confirmedAppts}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                <span className="text-lg font-bold text-chart-4">₣</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('portal.totalBilledPaid')}</p>
                <p className="text-xl font-bold">{formatCHF(totalPaid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent appointments + invoices */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('portal.appointments')}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push('/portal/rendez-vous')}>
              {t('portal.viewAll')} <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {appointments.length > 0 ? (
              appointments.map((appt) => (
                <div key={appt.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                      <CalendarClock className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{appt.service_type}</p>
                      <p className="text-xs text-muted-foreground">
                        {appt.vehicle ? `${appt.vehicle.brand} ${appt.vehicle.model}` : '—'} · {new Date(appt.requested_date).toLocaleDateString('fr-CH')}
                      </p>
                    </div>
                  </div>
                  <Badge variant={appt.status === 'confirme' ? 'default' : appt.status === 'refuse' ? 'destructive' : 'secondary'} className="text-xs">
                    {appt.status === 'confirme' ? t('appts.status.confirmed') : appt.status === 'refuse' ? t('appts.status.refused') : appt.status === 'termine' ? t('appts.status.completed') : appt.status === 'annule' ? t('appts.status.cancelled') : t('appts.status.pending')}
                  </Badge>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <CalendarClock className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">{t('portal.noAppointments')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t('portal.invoices')}</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push('/portal/factures')}>
              {t('portal.viewAll')} <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {invoices.length > 0 ? (
              invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chart-4/10">
                      <FileText className="h-4 w-4 text-chart-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{inv.invoice_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(inv.issue_date).toLocaleDateString('fr-CH')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{formatCHF(Number(inv.total))}</p>
                    <Badge variant={inv.status === 'payee' ? 'default' : 'secondary'} className="text-xs">
                      {inv.status === 'payee' ? t('invoices.paid') : inv.status === 'envoyee' ? t('invoices.unpaid') : inv.status === 'en_retard' ? t('invoices.late') : t('invoices.draft')}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">{t('portal.noInvoices')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
