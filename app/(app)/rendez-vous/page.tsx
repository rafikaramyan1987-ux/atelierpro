'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  APPOINTMENT_STATUS_LABELS,
  TIME_SLOTS,
  type Appointment,
  type Client,
  type Vehicle,
  type Profile,
  type AppointmentStatus,
} from '@/lib/types/database';
import {
  CalendarClock,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Car,
  User,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';
import { sendEmail, appointmentConfirmedEmail } from '@/lib/email';

export default function RendezVousPage() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<(Appointment & { client?: Client; vehicle?: Vehicle })[]>([]);
  const [mechanics, setMechanics] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{ item: any } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useI18n();

  const [apptAction, setApptAction] = useState({
    status: 'confirme' as AppointmentStatus,
    scheduled_date: '',
    scheduled_time: '09:00',
    assigned_to: '',
    garage_notes: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [apptRes, mechRes] = await Promise.all([
      supabase.from('appointments').select('*, client:clients(*), vehicle:vehicles(*)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').in('role', ['admin', 'mecanicien']).eq('active', true).eq('garage_id', profile?.garage_id ?? ''),
    ]);
    setAppointments(apptRes.data as any ?? []);
    setMechanics(mechRes.data as Profile[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openApptDialog(appt: any) {
    setActionDialog({ item: appt });
    setApptAction({
      status: 'confirme',
      scheduled_date: appt.requested_date,
      scheduled_time: appt.requested_time,
      assigned_to: '',
      garage_notes: '',
    });
  }

  async function handleApptAction(e: React.FormEvent) {
    e.preventDefault();
    if (!actionDialog) return;
    setSubmitting(true);
    const { error } = await supabase.from('appointments').update({
      status: apptAction.status,
      scheduled_date: apptAction.status === 'confirme' ? apptAction.scheduled_date : null,
      scheduled_time: apptAction.status === 'confirme' ? apptAction.scheduled_time : null,
      assigned_to: apptAction.assigned_to || null,
      garage_notes: apptAction.garage_notes || null,
      garage_id: apptAction.status === 'confirme' ? (profile?.garage_id ?? null) : undefined,
    }).eq('id', actionDialog.item.id);

    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(apptAction.status === 'confirme' ? t('admin.appts.toast.confirmed') : apptAction.status === 'refuse' ? t('admin.appts.toast.refused') : t('admin.appts.toast.updated'));

      if (apptAction.status === 'confirme' && actionDialog.item.client?.email) {
        const email = appointmentConfirmedEmail(
          `${actionDialog.item.client.first_name} ${actionDialog.item.client.last_name}`,
          actionDialog.item.service_type,
          new Date(apptAction.scheduled_date).toLocaleDateString('fr-CH'),
          apptAction.scheduled_time,
          apptAction.garage_notes || undefined
        );
        sendEmail(actionDialog.item.client.email, email.subject, email.html, email.text);
      }
      setActionDialog(null);
      fetchData();
    }
    setSubmitting(false);
  }

  const pendingAppts = appointments.filter((a) => a.status === 'en_attente');
  const activeAppts = appointments.filter((a) => a.status === 'confirme' || a.status === 'termine');

  const statusConfig: Record<string, { icon: any; color: string }> = {
    en_attente: { icon: Clock, color: 'text-warning' },
    confirme: { icon: CheckCircle2, color: 'text-success' },
    refuse: { icon: XCircle, color: 'text-destructive' },
    termine: { icon: CheckCircle2, color: 'text-muted-foreground' },
    annule: { icon: XCircle, color: 'text-muted-foreground' },
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('admin.appts.title')} description={t('admin.appts.desc')} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('admin.appts.pending')}</p>
                <p className="text-xl font-bold">{pendingAppts.length}</p>
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
                <p className="text-sm text-muted-foreground">{t('admin.appts.confirmed')}</p>
                <p className="text-xl font-bold">{activeAppts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : appointments.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CalendarClock className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">{t('admin.appts.noAppts')}</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {pendingAppts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('admin.appts.pendingConfirm')}</h3>
                <div className="space-y-3">
                  {pendingAppts.map((appt) => {
                    const StatusIcon = statusConfig[appt.status]?.icon ?? Clock;
                    return (
                      <Card key={appt.id} className="border-warning/30 border-2">
                        <CardContent className="p-5">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 shrink-0">
                                <StatusIcon className="h-5 w-5 text-warning" />
                              </div>
                              <div className="space-y-1">
                                <p className="font-medium">{appt.service_type}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <User className="h-3.5 w-3.5" />
                                  {appt.client ? `${appt.client.first_name} ${appt.client.last_name}` : '—'}
                                  {appt.client?.phone && <><Phone className="h-3.5 w-3.5 ml-2" />{appt.client.phone}</>}
                                </div>
                                {appt.vehicle && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Car className="h-3.5 w-3.5" />
                                    {appt.vehicle.brand} {appt.vehicle.model} — {appt.vehicle.license_plate}
                                  </div>
                                )}
                                <p className="text-sm">
                                  <span className="text-muted-foreground">{t('admin.appts.requested')}: </span>
                                  {new Date(appt.requested_date).toLocaleDateString('fr-CH')} {t('admin.appts.confirmedTime').toLowerCase()} {appt.requested_time}
                                </p>
                                {appt.description && (
                                  <p className="text-sm text-muted-foreground max-w-md">{appt.description}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                              <Button size="sm" variant="outline" className="hover:text-destructive" onClick={() => {
                                setActionDialog({ item: appt });
                                setApptAction({ status: 'refuse', scheduled_date: '', scheduled_time: '09:00', assigned_to: '', garage_notes: '' });
                              }}>
                                <XCircle className="h-4 w-4 mr-1" /> {t('admin.appts.refuse')}
                              </Button>
                              <Button size="sm" onClick={openApptDialog.bind(null, appt)}>
                                <CheckCircle2 className="h-4 w-4 mr-1" /> {t('admin.appts.process')}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {activeAppts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('admin.appts.confirmedCompleted')}</h3>
                <div className="space-y-3">
                  {activeAppts.map((appt) => {
                    const StatusIcon = statusConfig[appt.status]?.icon ?? Clock;
                    return (
                      <Card key={appt.id} className="border-border/60">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary shrink-0">
                                <StatusIcon className={`h-5 w-5 ${statusConfig[appt.status]?.color}`} />
                              </div>
                              <div className="space-y-1">
                                <p className="font-medium">{appt.service_type}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <User className="h-3.5 w-3.5" />
                                  {appt.client ? `${appt.client.first_name} ${appt.client.last_name}` : '—'}
                                </div>
                                {appt.vehicle && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Car className="h-3.5 w-3.5" />
                                    {appt.vehicle.brand} {appt.vehicle.model} — {appt.vehicle.license_plate}
                                  </div>
                                )}
                                {appt.scheduled_date && (
                                  <p className="text-sm text-success font-medium">
                                    {t('admin.appts.confirmedLabel')}: {new Date(appt.scheduled_date).toLocaleDateString('fr-CH')} {t('admin.appts.confirmedTime').toLowerCase()} {appt.scheduled_time}
                                  </p>
                                )}
                                {appt.garage_notes && (
                                  <p className="text-xs text-muted-foreground mt-1">{appt.garage_notes}</p>
                                )}
                              </div>
                            </div>
                            <Badge variant={appt.status === 'confirme' ? 'default' : 'secondary'} className="text-xs">
                              {appt.status === 'confirme' ? t('admin.appts.confirmedLabel') : appt.status === 'termine' ? t('admin.appts.markCompleted') : APPOINTMENT_STATUS_LABELS[appt.status]}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Appointment action dialog */}
      <Dialog open={!!actionDialog} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.appts.process')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleApptAction} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('admin.appts.decision')}</Label>
              <Select value={apptAction.status} onValueChange={(v) => setApptAction({ ...apptAction, status: v as AppointmentStatus })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="confirme">{t('admin.appts.confirm')}</SelectItem>
                  <SelectItem value="refuse">{t('admin.appts.refuse')}</SelectItem>
                  <SelectItem value="termine">{t('admin.appts.markCompleted')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {apptAction.status === 'confirme' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sched-date">{t('admin.appts.confirmedDate')}</Label>
                  <Input id="sched-date" type="date" required value={apptAction.scheduled_date} onChange={(e) => setApptAction({ ...apptAction, scheduled_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sched-time">{t('admin.appts.confirmedTime')}</Label>
                  <Select value={apptAction.scheduled_time} onValueChange={(v) => setApptAction({ ...apptAction, scheduled_time: v })}>
                    <SelectTrigger id="sched-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            {apptAction.status === 'confirme' && (
              <div className="space-y-2">
                <Label htmlFor="assign">{t('admin.appts.assignedMechanic')}</Label>
                <Select value={apptAction.assigned_to || 'none'} onValueChange={(v) => setApptAction({ ...apptAction, assigned_to: v === 'none' ? '' : v })}>
                  <SelectTrigger id="assign">
                    <SelectValue placeholder={t('admin.appts.none')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('admin.appts.none')}</SelectItem>
                    {mechanics.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="appt-notes">{t('admin.appts.internalNotes')}</Label>
              <Textarea id="appt-notes" placeholder={t('admin.appts.notesPlaceholder')} value={apptAction.garage_notes} onChange={(e) => setApptAction({ ...apptAction, garage_notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setActionDialog(null)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t('admin.appts.confirm')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
