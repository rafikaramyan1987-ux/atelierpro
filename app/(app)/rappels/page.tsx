'use client';

import { useEffect, useState, useCallback } from 'react';
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
  Bell, Loader2, Car, User, Phone, CalendarClock, Gauge, ArrowRight, Mail,
} from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { sendEmail, serviceReminderEmail } from '@/lib/email';
import { toast } from 'sonner';
import { formatCHF, type CannedTask, type Vehicle, type Client, type Invoice } from '@/lib/types/database';

interface ReminderRow {
  client: Client;
  vehicle: Vehicle;
  task: CannedTask;
  lastServiceDate: string | null;
  lastServiceName: string | null;
  dueReason: string;
  dueType: 'date' | 'mileage' | 'both';
}

export default function RappelsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [reminders, setReminders] = useState<ReminderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReminders = useCallback(async () => {
    setLoading(true);

    const [tasksRes, invoicesRes, vehiclesRes] = await Promise.all([
      supabase.from('canned_tasks').select('*').not('interval_months', 'is', null),
      supabase.from('invoices').select('*, client:clients(*), vehicle:vehicles(*)').eq('status', 'payee').order('issue_date', { ascending: false }),
      supabase.from('vehicles').select('*, client:clients(*)').order('created_at', { ascending: false }),
    ]);

    const tasks = (tasksRes.data as CannedTask[]) ?? [];
    const invoices = (invoicesRes.data as any[]) ?? [];
    const vehicles = (vehiclesRes.data as any[]) ?? [];

    const rows: ReminderRow[] = [];
    const now = new Date();

    for (const vehicle of vehicles) {
      const vehicleInvoices = invoices.filter((inv) => inv.vehicle_id === vehicle.id);
      for (const task of tasks) {
        const matchingInvoices = vehicleInvoices.filter((inv) => {
          const items = inv.invoice_items ?? [];
          return items.some((it: any) =>
            it.description?.toLowerCase().includes(task.name.toLowerCase()) ||
            inv.notes?.toLowerCase().includes(task.name.toLowerCase())
          );
        });

        const lastInvoice = matchingInvoices[0];
        if (!lastInvoice && !vehicle.mileage) continue;

        const lastDate = lastInvoice ? new Date(lastInvoice.issue_date) : null;
        const dueDate = task.interval_months ? (lastDate ? new Date(lastDate.getTime() + task.interval_months * 30 * 24 * 60 * 60 * 1000) : null) : null;
        const dueByDate = dueDate ? dueDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) : false;
        const dueByMileage = task.interval_km && vehicle.mileage && lastInvoice
          ? (vehicle.mileage - (lastInvoice.vehicle?.mileage ?? 0)) >= task.interval_km * 0.8
          : false;

        if (dueByDate || dueByMileage) {
          const client = vehicle.client as Client;
          if (!client) continue;
          const reasons: string[] = [];
          if (dueByDate && dueDate) {
            const days = Math.round((dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
            reasons.push(days <= 0 ? t('reminders.overdue', { days: Math.abs(days) }) : t('reminders.dueIn', { days }));
          }
          if (dueByMileage) {
            reasons.push(t('reminders.mileageDue', { km: task.interval_km ?? 0 }));
          }
          rows.push({
            client,
            vehicle,
            task,
            lastServiceDate: lastInvoice?.issue_date ?? null,
            lastServiceName: lastInvoice?.notes ?? task.name,
            dueReason: reasons.join(' · '),
            dueType: dueByDate && dueByMileage ? 'both' : dueByDate ? 'date' : 'mileage',
          });
        }
      }
    }

    setReminders(rows);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

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

          <Card className="border-border/60">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('reminders.client')}</TableHead>
                    <TableHead>{t('reminders.vehicleCol')}</TableHead>
                    <TableHead>{t('reminders.serviceDue')}</TableHead>
                    <TableHead>{t('reminders.reason')}</TableHead>
                    <TableHead>{t('reminders.lastService')}</TableHead>
                    <TableHead className="text-right">{t('common.save')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reminders.map((row, i) => (
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
                        <Badge variant="secondary" className="text-xs">{row.task.name}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs">{row.dueReason}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.lastServiceDate
                          ? new Date(row.lastServiceDate).toLocaleDateString('fr-CH')
                          : t('reminders.noHistory')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('reminders.contact')}
                            onClick={() => handleContact(row.client, row.vehicle, row.task, row.dueReason)}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={t('reminders.createAppt')}
                            onClick={() => handleCreateAppointment(row.client, row.vehicle, row.task)}
                          >
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
        </>
      )}
    </div>
  );
}
