'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  DEVIS_STATUS_LABELS,
  TIME_SLOTS,
  formatCHF,
  VAT_RATE,
  type Appointment,
  type ServiceRequest,
  type Client,
  type Vehicle,
  type Profile,
  type AppointmentStatus,
  type DevisItem,
  type CannedTask,
} from '@/lib/types/database';
import {
  CalendarClock,
  FileSearch,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Car,
  User,
  Phone,
  Plus,
  Trash2,
  ClipboardList,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';
import { sendEmail, appointmentConfirmedEmail, devisResponseEmail } from '@/lib/email';

export default function RendezVousPage() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState<(Appointment & { client?: Client; vehicle?: Vehicle })[]>([]);
  const [requests, setRequests] = useState<(ServiceRequest & { client?: Client; vehicle?: Vehicle; devis_items?: DevisItem[] })[]>([]);
  const [mechanics, setMechanics] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{ type: 'appt' | 'devis'; item: any } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useI18n();

  const [apptAction, setApptAction] = useState({
    status: 'confirme' as AppointmentStatus,
    scheduled_date: '',
    scheduled_time: '09:00',
    assigned_to: '',
    garage_notes: '',
  });

  const [devisItems, setDevisItems] = useState<{ description: string; quantity: string; unit_price: string }[]>([{ description: '', quantity: '1', unit_price: '0' }]);
  const [devisResponse, setDevisResponse] = useState('');
  const [devisValidDays, setDevisValidDays] = useState('30');
  const [cannedTasks, setCannedTasks] = useState<CannedTask[]>([]);
  const [rejectDialog, setRejectDialog] = useState<{ item: any } | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [apptRes, reqRes, mechRes, tasksRes] = await Promise.all([
      supabase.from('appointments').select('*, client:clients(*), vehicle:vehicles(*)').order('created_at', { ascending: false }),
      supabase.from('service_requests').select('*, client:clients(*), vehicle:vehicles(*), devis_items(*)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').in('role', ['admin', 'mecanicien']).eq('active', true),
      supabase.from('canned_tasks').select('*').order('name', { ascending: true }),
    ]);
    setAppointments(apptRes.data as any ?? []);
    setRequests(reqRes.data as any ?? []);
    setMechanics(mechRes.data as Profile[] ?? []);
    setCannedTasks(tasksRes.data as CannedTask[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openApptDialog(appt: any) {
    setActionDialog({ type: 'appt', item: appt });
    setApptAction({
      status: 'confirme',
      scheduled_date: appt.requested_date,
      scheduled_time: appt.requested_time,
      assigned_to: '',
      garage_notes: '',
    });
  }

  function openDevisDialog(req: any) {
    setActionDialog({ type: 'devis', item: req });
    setDevisItems([{ description: '', quantity: '1', unit_price: '0' }]);
    setDevisResponse('');
    setDevisValidDays(req.valid_until_days?.toString() ?? '30');
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

  async function handleDevisAction(e: React.FormEvent) {
    e.preventDefault();
    if (!actionDialog) return;
    setSubmitting(true);

    const isAdmin = profile?.role === 'admin';
    const newStatus = isAdmin ? 'devis_recu' : 'en_attente_validation';

    // Update the service request status
    const { data: updatedData, error: reqError } = await supabase.from('service_requests').update({
      status: newStatus,
      garage_response: devisResponse || null,
      valid_until_days: parseInt(devisValidDays) || 30,
    }).eq('id', actionDialog.item.id).select();

    if (reqError) {
      toast.error(t('toast.error'), { description: reqError.message });
      setSubmitting(false);
      return;
    }
    if (!updatedData || updatedData.length === 0) {
      toast.error(t('toast.error'), { description: 'Update failed (permission denied or record not found)' });
      setSubmitting(false);
      return;
    }

    // Insert devis items
    const validItems = devisItems.filter((it) => it.description.trim());
    if (validItems.length > 0) {
      const itemsToInsert = validItems.map((it) => ({
        devis_id: actionDialog.item.id,
        garage_id: profile?.garage_id ?? null,
        description: it.description,
        quantity: parseInt(it.quantity) || 1,
        unit_price: parseFloat(it.unit_price) || 0,
        line_total: (parseInt(it.quantity) || 1) * (parseFloat(it.unit_price) || 0),
      }));

      const { error: itemsError } = await supabase.from('devis_items').insert(itemsToInsert);
      if (itemsError) {
        toast.error(t('toast.addItemsError'), { description: itemsError.message });
        setSubmitting(false);
        return;
      }
    }

    if (isAdmin) {
      toast.success(t('admin.appts.quoteSent'));
      if (actionDialog.item.client?.email) {
        const itemsSubtotal = validItems.reduce((sum, it) => sum + (parseInt(it.quantity) || 1) * (parseFloat(it.unit_price) || 0), 0);
        const itemsTotal = itemsSubtotal + Math.round(itemsSubtotal * VAT_RATE) / 100;
        const email = devisResponseEmail(
          `${actionDialog.item.client.first_name} ${actionDialog.item.client.last_name}`,
          actionDialog.item.description,
          itemsTotal > 0 ? `${itemsTotal.toFixed(2)} CHF` : undefined
        );
        sendEmail(actionDialog.item.client.email, email.subject, email.html, email.text);
      }
    } else {
      toast.success(t('devis.submittedForApproval'));
    }
    setActionDialog(null);
    fetchData();
    setSubmitting(false);
  }

  async function handleApproveDevis(req: any) {
    setSubmitting(true);
    const { error } = await supabase.from('service_requests').update({
      status: 'devis_recu',
    }).eq('id', req.id);
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(t('admin.appts.quoteSent'));
      if (req.client?.email) {
        const items = req.devis_items ?? [];
        const subtotal = items.reduce((sum: number, it: any) => sum + Number(it.line_total), 0);
        const total = subtotal + Math.round(subtotal * VAT_RATE) / 100;
        const email = devisResponseEmail(
          `${req.client.first_name} ${req.client.last_name}`,
          req.description,
          total > 0 ? `${total.toFixed(2)} CHF` : undefined
        );
        sendEmail(req.client.email, email.subject, email.html, email.text);
      }
      fetchData();
    }
    setSubmitting(false);
  }

  async function handleRejectDevis() {
    if (!rejectDialog) return;
    setSubmitting(true);
    const { error } = await supabase.from('service_requests').update({
      status: 'en_attente',
      admin_comment: rejectComment || null,
    }).eq('id', rejectDialog.item.id);
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(t('devis.rejected'));
      setRejectDialog(null);
      setRejectComment('');
      fetchData();
    }
    setSubmitting(false);
  }

  function addDevisItem() {
    setDevisItems([...devisItems, { description: '', quantity: '1', unit_price: '0' }]);
  }

  function insertCannedTask(taskId: string) {
    const task = cannedTasks.find((t) => t.id === taskId);
    if (!task) return;
    setDevisItems([...devisItems, {
      description: task.description || task.name,
      quantity: '1',
      unit_price: task.default_price?.toString() ?? '0',
    }]);
  }

  function removeDevisItem(index: number) {
    setDevisItems(devisItems.filter((_, i) => i !== index));
  }

  async function handleReactivateDevis(req: any) {
    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + (req.valid_until_days ?? 30));
    const newStatus = profile?.role === 'admin' ? 'devis_recu' : 'en_attente_validation';
    const { error } = await supabase.from('service_requests').update({
      status: newStatus,
      expiry_date: newExpiry.toISOString().split('T')[0],
    }).eq('id', req.id);
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(t('devis.reactivated'));
      fetchData();
    }
  }

  function updateDevisItem(index: number, field: string, value: string) {
    const updated = [...devisItems];
    updated[index] = { ...updated[index], [field]: value };
    setDevisItems(updated);
  }

  const devisSubtotal = devisItems.reduce((sum, it) => sum + (parseInt(it.quantity) || 1) * (parseFloat(it.unit_price) || 0), 0);
  const devisVat = Math.round(devisSubtotal * VAT_RATE) / 100;
  const devisTotal = devisSubtotal + devisVat;

  const pendingAppts = appointments.filter((a) => a.status === 'en_attente');
  const activeAppts = appointments.filter((a) => a.status === 'confirme' || a.status === 'termine');
  const pendingReqs = requests.filter((r) => r.status === 'en_attente');
  const pendingValidationReqs = requests.filter((r) => r.status === 'en_attente_validation');
  const processedReqs = requests.filter((r) => r.status !== 'en_attente' && r.status !== 'en_attente_validation');

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

      <div className="grid gap-4 md:grid-cols-4">
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
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FileSearch className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('admin.appts.devisPending')}</p>
                <p className="text-xl font-bold">{pendingReqs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                <FileSearch className="h-5 w-5 text-chart-4" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('admin.appts.devisProcessed')}</p>
                <p className="text-xl font-bold">{processedReqs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {pendingValidationReqs.length > 0 && profile?.role === 'admin' && (
        <Card className="border-warning/30 border-2">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="h-5 w-5 text-warning" />
              <h3 className="text-sm font-semibold">{t('devis.pendingApproval')} ({pendingValidationReqs.length})</h3>
            </div>
            <div className="space-y-3">
              {pendingValidationReqs.map((req) => {
                const items = req.devis_items ?? [];
                const subtotal = items.reduce((sum, it) => sum + Number(it.line_total), 0);
                const vat = Math.round(subtotal * VAT_RATE) / 100;
                const total = subtotal + vat;
                return (
                  <div key={req.id} className="flex items-start justify-between gap-4 rounded-lg border border-border/40 p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{req.client ? `${req.client.first_name} ${req.client.last_name}` : '—'}</p>
                      <p className="text-xs text-muted-foreground max-w-md">{req.description}</p>
                      {items.length > 0 && (
                        <div className="mt-1 rounded-md bg-secondary/50 p-2 text-xs">
                          {items.map((it) => (
                            <div key={it.id} className="flex justify-between">
                              <span>{it.description} (x{it.quantity})</span>
                              <span className="font-medium">{formatCHF(Number(it.line_total))}</span>
                            </div>
                          ))}
                          <Separator className="my-1" />
                          <div className="flex justify-between font-bold">
                            <span>{t('invoices.total')}</span>
                            <span className="text-primary">{formatCHF(total)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => handleApproveDevis(req)} disabled={submitting}>
                        <ShieldCheck className="h-4 w-4 mr-1" /> {t('devis.approve')}
                      </Button>
                      <Button size="sm" variant="outline" className="hover:text-destructive" onClick={() => { setRejectDialog({ item: req }); setRejectComment(''); }}>
                        <XCircle className="h-4 w-4 mr-1" /> {t('devis.reject')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="appointments">
        <TabsList>
          <TabsTrigger value="appointments">{t('admin.appts.tab.appointments')} ({appointments.length})</TabsTrigger>
          <TabsTrigger value="devis">{t('admin.appts.tab.devis')} ({requests.length})</TabsTrigger>
        </TabsList>

        {/* Appointments tab */}
        <TabsContent value="appointments" className="space-y-4">
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
                                  setActionDialog({ type: 'appt', item: appt });
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
        </TabsContent>

        {/* Devis tab */}
        <TabsContent value="devis" className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileSearch className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">{t('admin.appts.noDevis')}</p>
              </CardContent>
            </Card>
          ) : (
            <>
              {pendingReqs.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('admin.appts.pending')}</h3>
                  <div className="space-y-3">
                    {pendingReqs.map((req) => (
                      <Card key={req.id} className="border-warning/30 border-2">
                        <CardContent className="p-5">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/10 shrink-0">
                                <FileSearch className="h-5 w-5 text-warning" />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <User className="h-3.5 w-3.5" />
                                  {req.client ? `${req.client.first_name} ${req.client.last_name}` : '—'}
                                  {req.client?.phone && <><Phone className="h-3.5 w-3.5 ml-2" />{req.client.phone}</>}
                                </div>
                                {req.vehicle && (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Car className="h-3.5 w-3.5" />
                                    {req.vehicle.brand} {req.vehicle.model} — {req.vehicle.license_plate}
                                  </div>
                                )}
                                <p className="text-sm text-muted-foreground max-w-md">{req.description}</p>
                              </div>
                            </div>
                            <Button size="sm" onClick={openDevisDialog.bind(null, req)} className="shrink-0">
                              {t('admin.appts.createQuote')}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {processedReqs.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">{t('admin.appts.devisSent')}</h3>
                  <div className="space-y-3">
                    {processedReqs.map((req) => {
                      const items = req.devis_items ?? [];
                      const subtotal = items.reduce((sum, it) => sum + Number(it.line_total), 0);
                      const vat = Math.round(subtotal * VAT_RATE) / 100;
                      const total = subtotal + vat;
                      return (
                        <Card key={req.id} className="border-border/60">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary shrink-0">
                                  <FileSearch className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="space-y-1">
                                  <p className="text-sm text-muted-foreground">{req.client ? `${req.client.first_name} ${req.client.last_name}` : '—'}</p>
                                  <p className="text-sm text-muted-foreground max-w-md">{req.description}</p>
                                  {items.length > 0 && (
                                    <div className="mt-2 rounded-md bg-secondary/50 p-2 text-xs">
                                      {items.map((it) => (
                                        <div key={it.id} className="flex justify-between">
                                          <span>{it.description} (x{it.quantity})</span>
                                          <span className="font-medium">{formatCHF(Number(it.line_total))}</span>
                                        </div>
                                      ))}
                                      <Separator className="my-1" />
                                      <div className="flex justify-between font-bold">
                                        <span>{t('invoices.total')}</span>
                                        <span className="text-primary">{formatCHF(total)}</span>
                                      </div>
                                    </div>
                                  )}
                        {req.status === 'devis_recu' && req.expiry_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('devis.expiresOn')}: {new Date(req.expiry_date).toLocaleDateString('fr-CH')}
                          </p>
                        )}
                        {req.status === 'devis_recu' && req.expiry_date && new Date(req.expiry_date) < new Date() && (
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="destructive" className="text-xs">{t('devis.expired')}</Badge>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleReactivateDevis(req)}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" /> {t('devis.reactivate')}
                            </Button>
                          </div>
                        )}
                        {req.garage_response && (
                          <p className="text-xs text-muted-foreground mt-1">{t('admin.appts.response')}: {req.garage_response}</p>
                        )}
                                </div>
                              </div>
                              <Badge
                                variant={req.status === 'devis_accepte' ? 'default' : req.status === 'devis_refuse' ? 'destructive' : req.status === 'en_attente_validation' ? 'outline' : 'secondary'}
                                className="text-xs"
                              >
                                {req.status === 'en_attente' ? t('admin.appts.pending') : req.status === 'devis_recu' ? t('admin.appts.devisSent') : req.status === 'devis_accepte' ? t('devis.status.accepted') : req.status === 'devis_refuse' ? t('devis.status.refused') : req.status === 'en_attente_validation' ? t('devis.pendingApproval') : DEVIS_STATUS_LABELS[req.status]}
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
        </TabsContent>
      </Tabs>

      {/* Appointment action dialog */}
      <Dialog open={actionDialog?.type === 'appt' ?? false} onOpenChange={(open) => !open && setActionDialog(null)}>
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

      {/* Devis action dialog */}
      <Dialog open={actionDialog?.type === 'devis' ?? false} onOpenChange={(open) => !open && setActionDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('admin.appts.createQuote')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleDevisAction} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('admin.appts.devisItems')}</Label>
              <div className="space-y-2">
                {devisItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <Input
                      className="col-span-6"
                      placeholder={t('admin.appts.itemDesc')}
                      value={item.description}
                      onChange={(e) => updateDevisItem(index, 'description', e.target.value)}
                    />
                    <Input
                      className="col-span-2"
                      type="number"
                      min="1"
                      placeholder={t('admin.appts.qty')}
                      value={item.quantity}
                      onChange={(e) => updateDevisItem(index, 'quantity', e.target.value)}
                    />
                    <Input
                      className="col-span-3"
                      type="number"
                      step="0.05"
                      placeholder={t('admin.appts.unitPrice')}
                      value={item.unit_price}
                      onChange={(e) => updateDevisItem(index, 'unit_price', e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="col-span-1"
                      onClick={() => removeDevisItem(index)}
                      disabled={devisItems.length === 1}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addDevisItem}>
                <Plus className="h-4 w-4 mr-1" /> {t('admin.appts.addItem')}
              </Button>
              {cannedTasks.length > 0 && (
                <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                  <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Select onValueChange={insertCannedTask}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder={t('cannedTasks.pickPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {cannedTasks.map((task) => (
                        <SelectItem key={task.id} value={task.id}>
                          {task.name}{task.default_price != null ? ` — ${formatCHF(task.default_price)}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {devisSubtotal > 0 && (
              <div className="ml-auto max-w-xs space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('invoices.subtotal')}</span>
                  <span>{formatCHF(devisSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('invoices.vat')} ({VAT_RATE}%)</span>
                  <span>{formatCHF(devisVat)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>{t('invoices.total')}</span>
                  <span className="text-primary">{formatCHF(devisTotal)}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="devis-response">{t('admin.appts.clientNote')}</Label>
              <Textarea
                id="devis-response"
                placeholder={t('admin.appts.clientNotePlaceholder')}
                value={devisResponse}
                onChange={(e) => setDevisResponse(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="devis-valid-days">{t('devis.validUntilDays')}</Label>
              <Input
                id="devis-valid-days"
                type="number"
                min="1"
                value={devisValidDays}
                onChange={(e) => setDevisValidDays(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t('devis.validUntilHint')}</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setActionDialog(null)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {profile?.role === 'admin' ? t('admin.appts.sendQuote') : t('devis.submitForApproval')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject devis dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(open) => { if (!open) { setRejectDialog(null); setRejectComment(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('devis.rejectTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('devis.rejectDesc')}</p>
            <div className="space-y-2">
              <Label htmlFor="reject-comment">{t('devis.rejectComment')}</Label>
              <Textarea
                id="reject-comment"
                placeholder={t('devis.rejectCommentPlaceholder')}
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialog(null); setRejectComment(''); }}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={handleRejectDevis} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t('devis.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
