'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Bell, Loader2, Car, User, Phone, CalendarClock, Mail, Sun, Snowflake, Package, AlertCircle,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';
import { sendEmail, serviceReminderEmail } from '@/lib/email';
import { toast } from 'sonner';
import {
  formatCHF, type CannedTask, type Vehicle, type Client, type Invoice, type Garage,
} from '@/lib/types/database';

interface ReminderRow {
  client: Client;
  vehicle: Vehicle;
  task: CannedTask;
  lastServiceDate: string | null;
  dueReason: string;
  group: 'interval' | 'seasonal' | 'gardiennage';
  serviceGroupName: string;
}

export default function RappelsPage() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const router = useRouter();
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [garage, setGarage] = useState<Garage | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReminders = useCallback(async () => {
    setLoading(true);

    const [tasksRes, invoicesRes, vehiclesRes, garageRes] = await Promise.all([
      supabase.from('canned_tasks').select('*').neq('reminder_type', 'none'),
      supabase.from('invoices')
        .select('*, client:clients(*), vehicle:vehicles(*), invoice_items(*)')
        .eq('status', 'payee')
        .order('issue_date', { ascending: false }),
      supabase.from('vehicles').select('*, client:clients(*)').order('created_at', { ascending: false }),
      profile?.garage_id
        ? supabase.from('garages').select('*').eq('id', profile.garage_id).single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    const tasks = (tasksRes.data as CannedTask[]) ?? [];
    const invoices = (invoicesRes.data as any[]) ?? [];
    const vehicles = (vehiclesRes.data as any[]) ?? [];
    setGarage((garageRes.data as Garage) ?? null);

    const rows: ReminderRow[] = [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;

    for (const vehicle of vehicles) {
      const client = vehicle.client as Client;
      if (!client) continue;

      const vehicleInvoices = invoices.filter((inv) => inv.vehicle_id === vehicle.id);

      // --- INTERVAL reminders ---
      const intervalTasks = tasks.filter((t) => t.reminder_type === 'interval');
      const groupTracker = new Map<string, { task: CannedTask; dueReason: string; lastDate: string | null }>();

      for (const task of intervalTasks) {
        const matchingInvoices = vehicleInvoices.filter((inv) => {
          const items = inv.invoice_items ?? [];
          return items.some((it: any) =>
            it.description?.toLowerCase().includes(task.name.toLowerCase())
          ) || (inv.notes ?? '').toLowerCase().includes(task.name.toLowerCase());
        });

        const lastInvoice = matchingInvoices[0];
        const lastDate = lastInvoice ? new Date(lastInvoice.issue_date) : null;

        let dueByDate = false;
        let dueByMileage = false;
        let dateReason = '';
        let mileageReason = '';

        if (task.interval_months && lastDate) {
          const dueDate = new Date(lastDate.getTime() + task.interval_months * 30 * 24 * 60 * 60 * 1000);
          if (dueDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) {
            dueByDate = true;
            const days = Math.round((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            dateReason = days <= 0 ? t('reminders.overdue', { days: Math.abs(days) }) : t('reminders.dueIn', { days });
          }
        }

        if (task.interval_km && vehicle.mileage && lastInvoice) {
          const lastVehicle = lastInvoice.vehicle;
          const lastMileage = lastVehicle?.mileage ?? 0;
          const driven = vehicle.mileage - lastMileage;
          if (driven >= task.interval_km * 0.8) {
            dueByMileage = true;
            mileageReason = t('reminders.mileageDue', { km: task.interval_km });
          }
        }

        if (dueByDate || dueByMileage) {
          const reason = [dateReason, mileageReason].filter(Boolean).join(' · ');
          const groupName = task.service_group ?? task.name;
          const existing = groupTracker.get(groupName);
          if (existing) {
            const existingDate = existing.lastDate ? new Date(existing.lastDate) : null;
            if (lastDate && existingDate && lastDate < existingDate) {
              groupTracker.set(groupName, { task, dueReason: reason, lastDate: lastDate.toISOString().split('T')[0] });
            }
          } else {
            groupTracker.set(groupName, { task, dueReason: reason, lastDate: lastDate ? lastDate.toISOString().split('T')[0] : null });
          }
        }
      }

      for (const [groupName, info] of Array.from(groupTracker)) {
        rows.push({
          client,
          vehicle,
          task: info.task,
          lastServiceDate: info.lastDate,
          dueReason: info.dueReason,
          group: 'interval',
          serviceGroupName: groupName,
        });
      }

      // --- SEASONAL reminders ---
      const seasonalTasks = tasks.filter((t) => t.reminder_type === 'seasonal');
      for (const task of seasonalTasks) {
        const months = task.seasonal_months ?? [];
        if (months.length === 0) continue;

        // Check if current month is within 3-4 weeks before any target month
        const isApproaching = months.some((targetMonth) => {
          const diff = (targetMonth - currentMonth + 12) % 12;
          return diff === 0 || diff === 1;
        });

        if (!isApproaching) continue;

        const approachingMonths = months.filter((targetMonth) => {
          const diff = (targetMonth - currentMonth + 12) % 12;
          return diff === 0 || diff === 1;
        });

        const monthNames = approachingMonths.map((m) =>
          new Date(2026, m - 1, 1).toLocaleDateString('fr-CH', { month: 'long' })
        ).join(', ');

        // Gardiennage: vehicle has tyres stored
        if (vehicle.tyres_stored && (task.service_group === 'pneus' || task.name.toLowerCase().includes('pneu') || task.name.toLowerCase().includes('tyre') || task.name.toLowerCase().includes('reifen'))) {
          rows.push({
            client,
            vehicle,
            task,
            lastServiceDate: null,
            dueReason: t('reminders.gardiennageDue', { months: monthNames }),
            group: 'gardiennage',
            serviceGroupName: task.service_group ?? task.name,
          });
        } else {
          rows.push({
            client,
            vehicle,
            task,
            lastServiceDate: null,
            dueReason: t('reminders.seasonalDue', { months: monthNames }),
            group: 'seasonal',
            serviceGroupName: task.service_group ?? task.name,
          });
        }
      }
    }

    setReminders(rows);
    setLoading(false);
  }, [t, profile?.garage_id]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  const groupedReminders = useMemo(() => {
    const groups: Record<string, ReminderRow[]> = {
      gardiennage: [],
      interval: [],
      seasonal: [],
    };
    for (const r of reminders) {
      groups[r.group]?.push(r);
    }
    return groups;
  }, [reminders]);

  function handleContact(client: Client, vehicle: Vehicle, task: CannedTask, dueReason: string) {
    if (!client.email) {
      toast.error(t('reminders.noEmail'));
      return;
    }
    const email = serviceReminderEmail(
      `${client.first_name} ${client.last_name}`,
      `${vehicle.brand} ${vehicle.model} — ${vehicle.license_plate}`,
      task.name,
      dueReason,
    );
    sendEmail(client.email, email.subject, email.html, email.text);
    toast.success(t('reminders.emailSent'));
  }

  function handleCreateAppointment(client: Client, vehicle: Vehicle, task: CannedTask) {
    const params = new URLSearchParams({
      client_id: client.id,
      vehicle_id: vehicle.id,
      service_type: task.name,
    });
    router.push(`/rendez-vous?${params.toString()}`);
  }

  function renderGroup(title: string, icon: React.ReactNode, rows: ReminderRow[], accent: string) {
    if (rows.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
          <Badge variant="secondary" className="text-xs">{rows.length}</Badge>
        </div>
        <Card className={`border-border/60 ${accent}`}>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('reminders.client')}</TableHead>
                  <TableHead>{t('reminders.vehicleCol')}</TableHead>
                  <TableHead>{t('reminders.serviceDue')}</TableHead>
                  <TableHead>{t('reminders.reason')}</TableHead>
                  <TableHead className="text-right">{t('common.save')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={`${row.client.id}-${row.vehicle.id}-${row.task.id}-${i}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{row.client.first_name} {row.client.last_name}</p>
                          {row.client.phone && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />{row.client.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Car className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm">{row.vehicle.brand} {row.vehicle.model} — {row.vehicle.license_plate}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Badge variant="secondary" className="text-xs">{row.task.name}</Badge>
                        {row.serviceGroupName !== row.task.name && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Package className="h-3 w-3" />{row.serviceGroupName}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs">{row.dueReason}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title={t('reminders.contact')}
                          onClick={() => handleContact(row.client, row.vehicle, row.task, row.dueReason)}>
                          <Mail className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={t('reminders.createAppt')}
                          onClick={() => handleCreateAppointment(row.client, row.vehicle, row.task)}>
                          <CalendarClock className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  const gardiennageEnabled = garage?.gardiennage_enabled ?? false;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('reminders.title')} description={t('reminders.desc')} />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : reminders.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Bell className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">{t('reminders.none')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-primary/30 border-2">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('reminders.thisMonth')}</p>
                  <p className="text-2xl font-bold">{reminders.length} {t('reminders.clients')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gardiennage group (highest priority) */}
          {gardiennageEnabled && renderGroup(
            t('reminders.groupGardiennage'),
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/10"><Snowflake className="h-4 w-4 text-warning" /></div>,
            groupedReminders.gardiennage,
            'border-warning/30'
          )}

          {/* Interval group */}
          {renderGroup(
            t('reminders.groupInterval'),
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"><CalendarClock className="h-4 w-4 text-primary" /></div>,
            groupedReminders.interval,
            ''
          )}

          {/* Seasonal group */}
          {renderGroup(
            t('reminders.groupSeasonal'),
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chart-4/10"><Sun className="h-4 w-4 text-chart-4" /></div>,
            groupedReminders.seasonal,
            ''
          )}
        </>
      )}
    </div>
  );
}
