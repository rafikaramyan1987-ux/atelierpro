'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  ClipboardList,
  Wrench,
  CheckCircle2,
  FileText,
  Loader2,
  Car,
  User,
  Clock,
  Plus,
  Play,
  Square,
  FileCheck,
  CarFront,
  AlertTriangle,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';
import {
  formatCHF,
  calculateVAT,
  VAT_RATE,
  type RepairOrder,
  type RepairOrderItem,
  type ServiceRequest,
  type Client,
  type Vehicle,
  type Profile,
  type RepairOrderStatus,
  type LoanerVehicle,
  type LoanerAssignment,
  type CannedTask,
  type DevisItem,
  type ItemType,
} from '@/lib/types/database';
import { SignaturePad } from '@/components/signature-pad';
import { OrPhotosSection } from '@/components/or-photos';
import { localDateStr, localDateStrPlusDays, formatQty } from '@/lib/utils';

export default function RepairOrdersPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [orders, setOrders] = useState<(RepairOrder & {
    client?: Client;
    vehicle?: Vehicle;
    assigned_mechanic?: Profile;
    repair_order_items?: RepairOrderItem[];
    service_request?: ServiceRequest;
  })[]>([]);
  const [acceptedDevis, setAcceptedDevis] = useState<(ServiceRequest & { client?: Client; vehicle?: Vehicle; devis_items?: any[] })[]>([]);
  const [mechanics, setMechanics] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [selectedDevisId, setSelectedDevisId] = useState('');
  const [selectedMechanicId, setSelectedMechanicId] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [createMode, setCreateMode] = useState<'devis' | 'direct'>('devis');
  const [directClients, setDirectClients] = useState<Client[]>([]);
  const [directVehicles, setDirectVehicles] = useState<Vehicle[]>([]);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [directDescription, setDirectDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [convertDialog, setConvertDialog] = useState<RepairOrder | null>(null);
  const [detailsDialog, setDetailsDialog] = useState<RepairOrder | null>(null);
  const [payerType, setPayerType] = useState<'client' | 'assurance' | 'flotte'>('client');
  const [loanerVehicles, setLoanerVehicles] = useState<LoanerVehicle[]>([]);
  const [loanerAssignments, setLoanerAssignments] = useState<LoanerAssignment[]>([]);
  const [selectedLoanerId, setSelectedLoanerId] = useState('');
  const [loanerStartDate, setLoanerStartDate] = useState(localDateStr());
  const [loanerEndDate, setLoanerEndDate] = useState(localDateStrPlusDays(3));
  const [cannedTasks, setCannedTasks] = useState<CannedTask[]>([]);
  const [hourlyRate, setHourlyRate] = useState(120);
  const [vatRate, setVatRate] = useState(8.1);
  const [vatLiable, setVatLiable] = useState(true);
  const effectiveVatRate = vatLiable ? vatRate : 0;
  const [extraItems, setExtraItems] = useState<{ description: string; quantity: number; unit_price: number; item_type: ItemType }[]>([]);
  const [devisItems, setDevisItems] = useState<DevisItem[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [orRes, devisRes, mechRes, lvRes, laRes, tasksRes, garageRes] = await Promise.all([
      supabase.from('repair_orders').select('*, client:clients(*), vehicle:vehicles(*), assigned_mechanic:profiles!assigned_mechanic_id(*), repair_order_items(*), service_request:service_requests(*)').order('created_at', { ascending: false }),
      supabase.from('service_requests').select('*, client:clients(*), vehicle:vehicles(*), devis_items(*)').eq('status', 'devis_accepte').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').in('role', ['admin', 'mecanicien']).eq('active', true).eq('garage_id', profile?.garage_id ?? ''),
      supabase.from('loaner_vehicles').select('*').eq('status', 'available').order('make'),
      supabase.from('loaner_assignments').select('*, loaner_vehicle:loaner_vehicles(*), client:clients(*)').eq('status', 'active'),
      supabase.from('canned_tasks').select('*').order('name', { ascending: true }),
      supabase.from('garages').select('hourly_rate, vat_rate, vat_liable').eq('id', profile?.garage_id ?? '').maybeSingle(),
    ]);
    const orData = orRes.data as any ?? [];
    const usedSrIds = new Set(orData.map((o: any) => o.service_request_id).filter(Boolean));
    const devisData = (devisRes.data as any ?? []).filter((d: any) => !usedSrIds.has(d.id));
    setOrders(orData);
    setAcceptedDevis(devisData);
    setMechanics(mechRes.data as Profile[] ?? []);
    setLoanerVehicles(lvRes.data as LoanerVehicle[] ?? []);
    setLoanerAssignments(laRes.data as LoanerAssignment[] ?? []);
    setCannedTasks(tasksRes.data as CannedTask[] ?? []);
    setHourlyRate((garageRes.data as any)?.hourly_rate ?? 120);
    setVatRate((garageRes.data as any)?.vat_rate ?? 8.1);
    setVatLiable((garageRes.data as any)?.vat_liable ?? true);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (createDialog && createMode === 'direct' && directClients.length === 0) {
      supabase.from('clients').select('*').order('last_name').then(({ data }) => {
        setDirectClients(data as Client[] ?? []);
      });
    }
  }, [createDialog, createMode]);

  useEffect(() => {
    if (selectedClientId) {
      supabase.from('vehicles').select('*').eq('client_id', selectedClientId).order('brand').then(({ data }) => {
        setDirectVehicles(data as Vehicle[] ?? []);
      });
    } else {
      setDirectVehicles([]);
    }
    setSelectedVehicleId('');
  }, [selectedClientId]);

  async function handleCreateOR() {
    if (!selectedDevisId) {
      toast.error(t('or.selectDevis'));
      return;
    }
    setSubmitting(true);
    const devis = acceptedDevis.find((d) => d.id === selectedDevisId);
    if (!devis) {
      toast.error(t('toast.error'));
      setSubmitting(false);
      return;
    }

    const { data: orNumber } = await supabase.rpc('generate_or_number');

    const { data: newOR, error: orError } = await supabase.from('repair_orders').insert({
      or_number: orNumber,
      service_request_id: devis.id,
      client_id: devis.client_id,
      vehicle_id: devis.vehicle_id,
      assigned_mechanic_id: selectedMechanicId || null,
      workspace_name: workspaceName.trim() || null,
      status: 'en_cours',
      garage_id: profile?.garage_id ?? null,
      created_by: profile?.id ?? null,
    }).select().single();

    if (orError) {
      toast.error(t('toast.error'), { description: orError.message });
      setSubmitting(false);
      return;
    }

    const items = (devis.devis_items ?? []).map((item: any) => ({
      repair_order_id: newOR.id,
      garage_id: profile?.garage_id ?? null,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      item_type: item.item_type ?? 'piece',
    }));

    if (items.length > 0) {
      const { error: itemsError } = await supabase.from('repair_order_items').insert(items);
      if (itemsError) {
        toast.error(t('toast.error'), { description: itemsError.message });
        setSubmitting(false);
        return;
      }
    }

    if (extraItems.length > 0) {
      const extraPayload = extraItems.map((it) => ({
        repair_order_id: newOR.id,
        garage_id: profile?.garage_id ?? null,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        line_total: it.quantity * it.unit_price,
        item_type: it.item_type,
      }));
      const { error: extraError } = await supabase.from('repair_order_items').insert(extraPayload);
      if (extraError) {
        toast.error(t('toast.error'), { description: extraError.message });
        setSubmitting(false);
        return;
      }
    }

    toast.success(t('or.created'), { description: t('or.createdDesc') });
    setCreateDialog(false);
    setSelectedDevisId('');
    setSelectedMechanicId('');
    setWorkspaceName('');
    setExtraItems([]);
    fetchData();
    setSubmitting(false);
  }

  async function handleCreateDirectOR() {
    if (!selectedClientId || !selectedVehicleId || !directDescription.trim()) {
      toast.error(t('toast.error'));
      return;
    }
    setSubmitting(true);
    const { data: orNumber } = await supabase.rpc('generate_or_number');
    const { data: newOR, error: orError } = await supabase.from('repair_orders').insert({
      or_number: orNumber,
      service_request_id: null,
      client_id: selectedClientId,
      vehicle_id: selectedVehicleId,
      assigned_mechanic_id: selectedMechanicId || null,
      workspace_name: workspaceName.trim() || null,
      notes: directDescription.trim(),
      status: 'en_cours',
      garage_id: profile?.garage_id ?? null,
      created_by: profile?.id ?? null,
    }).select().single();
    if (orError) {
      toast.error(t('toast.error'), { description: orError.message });
      setSubmitting(false);
      return;
    }
    toast.success(t('or.created'), { description: t('or.createdDesc') });
    setCreateDialog(false);
    setSelectedClientId('');
    setSelectedVehicleId('');
    setDirectDescription('');
    setSelectedMechanicId('');
    setWorkspaceName('');
    setExtraItems([]);
    fetchData();
    setSubmitting(false);
  }

  async function handleStartWork(order: RepairOrder) {
    const { error } = await supabase.from('repair_orders').update({
      start_time: new Date().toISOString(),
    }).eq('id', order.id);
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(t('or.workStarted'));
      fetchData();
    }
  }

  async function handleEndWork(order: RepairOrder) {
    const { error } = await supabase.from('repair_orders').update({
      end_time: new Date().toISOString(),
      status: 'termine',
    }).eq('id', order.id);
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(t('or.workEnded'));
      fetchData();
    }
  }

  async function handleConvertToInvoice() {
    if (!convertDialog) return;

    if (convertDialog.invoice_id || convertDialog.status === 'facture') {
      toast.error(t('or.alreadyInvoiced'));
      return;
    }

    setSubmitting(true);

    const { data: currentOR } = await supabase.from('repair_orders')
      .select('invoice_id, status')
      .eq('id', convertDialog.id)
      .maybeSingle();
    if (currentOR?.invoice_id || currentOR?.status === 'facture') {
      toast.error(t('or.alreadyInvoiced'));
      setSubmitting(false);
      return;
    }

    const items = convertDialog.repair_order_items ?? [];
    const subtotal = items.reduce((sum, it) => sum + it.line_total, 0);
    const { vat, total } = calculateVAT(subtotal, effectiveVatRate);

    const { data: invoiceNumber } = await supabase.rpc('generate_invoice_number', {
      p_garage_id: profile?.garage_id ?? null,
    });

    if (!invoiceNumber) {
      toast.error(t('toast.error'), { description: 'Failed to generate invoice number' });
      setSubmitting(false);
      return;
    }

    const { data: invoice, error: invError } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      client_id: convertDialog.client_id,
      vehicle_id: convertDialog.vehicle_id,
      garage_id: profile?.garage_id ?? null,
      status: 'brouillon',
      subtotal: Math.round(subtotal * 100) / 100,
      vat_rate: effectiveVatRate,
      vat_amount: vat,
      total,
      issue_date: localDateStr(),
      due_date: localDateStrPlusDays(30),
      payer_type: payerType,
    }).select().single();

    if (invError) {
      toast.error(t('toast.error'), { description: invError.message });
      setSubmitting(false);
      return;
    }

    if (items.length > 0) {
      const itemPayload = items.map((it) => ({
        invoice_id: invoice.id,
        garage_id: profile?.garage_id ?? null,
        description: it.description,
        quantity: it.quantity,
        unit_price: it.unit_price,
        line_total: it.line_total,
        item_type: it.item_type ?? 'piece',
      }));
      const { error: itemsError } = await supabase.from('invoice_items').insert(itemPayload);
      if (itemsError) {
        await supabase.from('invoices').delete().eq('id', invoice.id);
        toast.error(t('toast.error'), { description: itemsError.message });
        setSubmitting(false);
        return;
      }
    }

    const { error: orError } = await supabase.from('repair_orders').update({
      status: 'facture',
      invoice_id: invoice.id,
    }).eq('id', convertDialog.id);

    if (orError) {
      await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);
      await supabase.from('invoices').delete().eq('id', invoice.id);
      toast.error(t('toast.error'), { description: orError.message });
      setSubmitting(false);
      return;
    }

    toast.success(t('or.convertedToInvoice'), { description: t('or.convertedToInvoiceDesc') });
    setConvertDialog(null);
    setPayerType('client');
    fetchData();
    setSubmitting(false);
  }

  async function handleReassignMechanic(orderId: string, mechanicId: string) {
    const { error } = await supabase.from('repair_orders').update({
      assigned_mechanic_id: mechanicId || null,
    }).eq('id', orderId);
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(t('or.statusUpdated'));
      fetchData();
    }
  }

  function openDetailsDialog(order: RepairOrder) {
    setDetailsDialog(order);
    setSelectedLoanerId('');
    if (order.service_request_id) {
      supabase.from('devis_items').select('*').eq('devis_id', order.service_request_id).then(({ data }) => {
        setDevisItems(data as DevisItem[] ?? []);
      });
    } else {
      setDevisItems([]);
    }
  }

  const activeOrders = orders.filter((o) => o.status === 'en_cours');
  const completedOrders = orders.filter((o) => o.status === 'termine');
  const invoicedOrders = orders.filter((o) => o.status === 'facture');

  const statusConfig: Record<RepairOrderStatus, { icon: any; color: string; bg: string }> = {
    en_cours: { icon: Wrench, color: 'text-primary', bg: 'bg-primary/10' },
    termine: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
    facture: { icon: FileText, color: 'text-muted-foreground', bg: 'bg-muted' },
  };

  function formatDuration(startTime: string | null, endTime: string | null): string {
    if (!startTime) return '—';
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const minutes = Math.round((end - start) / 60000);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
  }

  function OrderCard({ order }: { order: typeof orders[0] }) {
    const sc = statusConfig[order.status];
    const Icon = sc.icon;
    return (
      <Card className="border-border/60">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${sc.bg}`}>
                <Icon className={`h-5 w-5 ${sc.color}`} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm">{order.or_number}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {order.client ? `${order.client.first_name} ${order.client.last_name}` : '—'}
                  </span>
                  <span className="flex items-center gap-1">
                    <Car className="h-3 w-3" />
                    {order.vehicle ? `${order.vehicle.brand} ${order.vehicle.model}` : '—'}
                  </span>
                  {order.assigned_mechanic && (
                    <span className="flex items-center gap-1">
                      <Wrench className="h-3 w-3" />
                      {order.assigned_mechanic.full_name}
                    </span>
                  )}
                  {order.workspace_name && (
                    <span className="flex items-center gap-1">
                      <CarFront className="h-3 w-3" />
                      {order.workspace_name}
                    </span>
                  )}
                </div>
                {order.start_time && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {t('or.duration')}: {formatDuration(order.start_time, order.end_time)}
                  </p>
                )}
              </div>
            </div>
            <Badge variant="secondary" className={sc.color}>
              {t(`or.${order.status === 'en_cours' ? 'active' : order.status === 'termine' ? 'completed' : 'invoiced'}`)}
            </Badge>
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Select
              value={order.assigned_mechanic_id ?? 'none'}
              onValueChange={(v) => handleReassignMechanic(order.id, v === 'none' ? '' : v)}
            >
              <SelectTrigger className="h-8 w-auto text-xs">
                <SelectValue placeholder={t('or.assignMechanic')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('or.noMechanic')}</SelectItem>
                {mechanics.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {order.status === 'en_cours' && !order.start_time && (
              <Button size="sm" variant="outline" onClick={() => handleStartWork(order)}>
                <Play className="h-3.5 w-3.5 mr-1" />
                {t('or.startWork')}
              </Button>
            )}
            {order.status === 'en_cours' && order.start_time && (
              <Button size="sm" variant="outline" onClick={() => handleEndWork(order)}>
                <Square className="h-3.5 w-3.5 mr-1" />
                {t('or.endWork')}
              </Button>
            )}
            {order.status === 'termine' && !order.invoice_id && (profile?.role === 'admin' || profile?.role === 'secretaire') && (
              <Button size="sm" onClick={() => { setPayerType('client'); setConvertDialog(order); }}>
                <FileCheck className="h-3.5 w-3.5 mr-1" />
                {t('or.convertToInvoice')}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => openDetailsDialog(order)}>
              {t('or.viewDetails')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('or.title')} description={t('or.desc')}>
        <Button onClick={() => { setCreateMode(acceptedDevis.length === 0 ? 'direct' : 'devis'); setCreateDialog(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          {t('or.createFromDevis')}
        </Button>
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('or.active')}</p>
                <p className="text-xl font-bold">{activeOrders.length}</p>
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
                <p className="text-sm text-muted-foreground">{t('or.completed')}</p>
                <p className="text-xl font-bold">{completedOrders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('or.invoiced')}</p>
                <p className="text-xl font-bold">{invoicedOrders.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">{t('or.active')} ({activeOrders.length})</TabsTrigger>
          <TabsTrigger value="completed">{t('or.completed')} ({completedOrders.length})</TabsTrigger>
          <TabsTrigger value="invoiced">{t('or.invoiced')} ({invoicedOrders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3">
          {activeOrders.length === 0 ? (
            <Card className="border-border/60"><CardContent className="p-8 text-center text-muted-foreground">{t('or.noOR')}</CardContent></Card>
          ) : activeOrders.map((order) => <OrderCard key={order.id} order={order} />)}
        </TabsContent>
        <TabsContent value="completed" className="space-y-3">
          {completedOrders.length === 0 ? (
            <Card className="border-border/60"><CardContent className="p-8 text-center text-muted-foreground">{t('or.noOR')}</CardContent></Card>
          ) : completedOrders.map((order) => <OrderCard key={order.id} order={order} />)}
        </TabsContent>
        <TabsContent value="invoiced" className="space-y-3">
          {invoicedOrders.length === 0 ? (
            <Card className="border-border/60"><CardContent className="p-8 text-center text-muted-foreground">{t('or.noOR')}</CardContent></Card>
          ) : invoicedOrders.map((order) => <OrderCard key={order.id} order={order} />)}
        </TabsContent>
      </Tabs>

      {/* Create OR Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('or.createFromDevis')}</DialogTitle>
          </DialogHeader>
          <Tabs value={createMode} onValueChange={(v) => setCreateMode(v as 'devis' | 'direct')}>
            <TabsList className="w-full">
              <TabsTrigger value="devis" className="flex-1">{t('or.tabFromDevis')}</TabsTrigger>
              <TabsTrigger value="direct" className="flex-1">{t('or.tabDirectClient')}</TabsTrigger>
            </TabsList>
            <TabsContent value="devis" className="space-y-4 py-2">
              {acceptedDevis.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('or.noAcceptedDevis')}</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('or.selectDevis')}</label>
                    <Select value={selectedDevisId} onValueChange={setSelectedDevisId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('or.selectDevis')} />
                      </SelectTrigger>
                      <SelectContent>
                        {acceptedDevis.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.client ? `${d.client.first_name} ${d.client.last_name}` : '—'} — {d.description.slice(0, 40)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('or.assignMechanic')}</label>
                    <Select value={selectedMechanicId} onValueChange={setSelectedMechanicId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('or.assignMechanic')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('or.noMechanic')}</SelectItem>
                        {mechanics.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t('or.workspace')}</label>
                    <Input
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder={t('or.workspacePlaceholder')}
                    />
                  </div>
                  {cannedTasks.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('cannedTasks.pickTask')}</label>
                      <Select onValueChange={(taskId) => {
                        const task = cannedTasks.find((t2) => t2.id === taskId);
                        if (task) {
                          if (task.default_labor_hours != null) {
                            setExtraItems([...extraItems, {
                              description: task.name,
                              quantity: task.default_labor_hours,
                              unit_price: hourlyRate,
                              item_type: 'main_oeuvre' as ItemType,
                            }]);
                          } else {
                            setExtraItems([...extraItems, {
                              description: task.name,
                              quantity: 1,
                              unit_price: task.default_price ?? 0,
                              item_type: 'piece' as ItemType,
                            }]);
                          }
                        }
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder={t('cannedTasks.pickPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {cannedTasks.map((task) => (
                            <SelectItem key={task.id} value={task.id}>
                              {task.name}{task.default_labor_hours != null ? ` — ${task.default_labor_hours}h` : task.default_price != null ? ` — ${formatCHF(task.default_price)}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {extraItems.length > 0 && (
                        <div className="space-y-1">
                          {extraItems.map((it, i) => (
                            <div key={i} className="flex items-center justify-between text-sm rounded-lg border border-border/40 px-2 py-1.5">
                              <span>{it.description} ×{formatQty(Number(it.quantity))}</span>
                              <span className="font-medium">{formatCHF(it.quantity * it.unit_price)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
            <TabsContent value="direct" className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('or.selectClient')}</label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('or.selectClient')} />
                  </SelectTrigger>
                  <SelectContent>
                    {directClients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {directClients.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t('or.noClients')}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('or.selectVehicle')}</label>
                <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId} disabled={!selectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('or.selectVehicle')} />
                  </SelectTrigger>
                  <SelectContent>
                    {directVehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} — {v.license_plate}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedClientId && directVehicles.length === 0 && (
                  <p className="text-xs text-muted-foreground">{t('or.noVehicles')}</p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('or.assignMechanic')}</label>
                <Select value={selectedMechanicId} onValueChange={setSelectedMechanicId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('or.assignMechanic')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('or.noMechanic')}</SelectItem>
                    {mechanics.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('or.workspace')}</label>
                <Input
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  placeholder={t('or.workspacePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('or.description')}</label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={directDescription}
                  onChange={(e) => setDirectDescription(e.target.value)}
                  placeholder={t('ph.problemDesc')}
                  rows={3}
                />
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>{t('common.cancel')}</Button>
            {createMode === 'devis' ? (
              <Button onClick={handleCreateOR} disabled={submitting || !selectedDevisId}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                {t('or.create')}
              </Button>
            ) : (
              <Button onClick={handleCreateDirectOR} disabled={submitting || !selectedClientId || !selectedVehicleId || !directDescription.trim()}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                {t('or.create')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Invoice Dialog */}
      <Dialog open={!!convertDialog} onOpenChange={(v) => !v && setConvertDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('or.convertToInvoice')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{t('or.confirmConvertDesc')}</p>
            {convertDialog?.repair_order_items && convertDialog.repair_order_items.length > 0 && (
              <div className="rounded-lg border border-border/60 p-3 space-y-1">
                {convertDialog.repair_order_items.map((it) => (
                  <div key={it.id} className="flex justify-between text-sm">
                    <span>{it.description} ×{formatQty(Number(it.quantity))}</span>
                    <span className="font-medium">{formatCHF(it.line_total)}</span>
                  </div>
                ))}
                {(() => {
                  const sub = convertDialog.repair_order_items.reduce((s, it) => s + it.line_total, 0);
                  const { vat, total } = calculateVAT(sub, effectiveVatRate);
                  return (
                    <>
                      <div className="flex justify-between text-sm pt-1 border-t">
                        <span className="text-muted-foreground">{t('invoices.subtotal')}</span>
                        <span>{formatCHF(sub)}</span>
                      </div>
                      {effectiveVatRate > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t('invoices.vat')} ({effectiveVatRate}%)</span>
                          <span>{formatCHF(vat)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold pt-1 border-t">
                        <span>{t('invoices.total')}</span>
                        <span className="text-primary">{formatCHF(total)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('or.payerType')}</label>
              <Select value={payerType} onValueChange={(v: any) => setPayerType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">{t('or.payerClient')}</SelectItem>
                  <SelectItem value="assurance">{t('or.payerAssurance')}</SelectItem>
                  <SelectItem value="flotte">{t('or.payerFlotte')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialog(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleConvertToInvoice} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}
              {t('or.convertToInvoice')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={!!detailsDialog} onOpenChange={(v) => !v && setDetailsDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailsDialog?.or_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto">
            {detailsDialog && (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t('or.client')}</p>
                    <p className="font-medium">{detailsDialog.client ? `${detailsDialog.client.first_name} ${detailsDialog.client.last_name}` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('or.vehicle')}</p>
                    <p className="font-medium">{detailsDialog.vehicle ? `${detailsDialog.vehicle.brand} ${detailsDialog.vehicle.model} — ${detailsDialog.vehicle.license_plate}` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('or.mechanic')}</p>
                    <p className="font-medium">{detailsDialog.assigned_mechanic?.full_name ?? t('or.noMechanic')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('or.workspace')}</p>
                    <p className="font-medium">{detailsDialog.workspace_name ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('or.status')}</p>
                    <Badge variant="secondary">{t(`or.${detailsDialog.status === 'en_cours' ? 'active' : detailsDialog.status === 'termine' ? 'completed' : 'invoiced'}`)}</Badge>
                  </div>
                  {detailsDialog.start_time && (
                    <div>
                      <p className="text-muted-foreground">{t('or.startTime')}</p>
                      <p className="font-medium">{new Date(detailsDialog.start_time).toLocaleString('fr-CH')}</p>
                    </div>
                  )}
                  {detailsDialog.end_time && (
                    <div>
                      <p className="text-muted-foreground">{t('or.endTime')}</p>
                      <p className="font-medium">{new Date(detailsDialog.end_time).toLocaleString('fr-CH')}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold mb-2">{t('or.items')}</p>
                  {detailsDialog.repair_order_items && detailsDialog.repair_order_items.length > 0 ? (
                    <div className="rounded-lg border border-border/60 divide-y divide-border/40">
                      {(() => {
                        const roItems = detailsDialog.repair_order_items ?? [];
                        const laborItems = roItems.filter((it) => it.item_type === 'main_oeuvre');
                        const partItems = roItems.filter((it) => (it.item_type ?? 'piece') === 'piece');
                        return (
                          <>
                            {laborItems.length > 0 && (
                              <div className="p-2.5">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t('items.labor')}</p>
                                {laborItems.map((it) => (
                                  <div key={it.id} className="flex justify-between text-sm py-0.5">
                                    <span>{it.description} ×{formatQty(Number(it.quantity))}</span>
                                    <span className="font-medium">{formatCHF(it.line_total)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between text-sm pt-1 border-t border-border/30">
                                  <span className="text-muted-foreground">{t('items.laborSubtotal')}</span>
                                  <span className="font-medium">{formatCHF(laborItems.reduce((s, it) => s + it.line_total, 0))}</span>
                                </div>
                              </div>
                            )}
                            {partItems.length > 0 && (
                              <div className="p-2.5">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t('items.parts')}</p>
                                {partItems.map((it) => (
                                  <div key={it.id} className="flex justify-between text-sm py-0.5">
                                    <span>{it.description} ×{formatQty(Number(it.quantity))}</span>
                                    <span className="font-medium">{formatCHF(it.line_total)}</span>
                                  </div>
                                ))}
                                <div className="flex justify-between text-sm pt-1 border-t border-border/30">
                                  <span className="text-muted-foreground">{t('items.partsSubtotal')}</span>
                                  <span className="font-medium">{formatCHF(partItems.reduce((s, it) => s + it.line_total, 0))}</span>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('or.noItems')}</p>
                  )}
                </div>

                {detailsDialog.service_request_id && (() => {
                  const roSubtotal = (detailsDialog.repair_order_items ?? []).reduce((s, it) => s + it.line_total, 0);
                  const devisSubtotal = devisItems.reduce((s, it) => s + it.line_total, 0);
                  const diff = roSubtotal - devisSubtotal;
                  const overPct = devisSubtotal > 0 ? (diff / devisSubtotal) * 100 : 0;
                  const isOverrun = diff > 0.01;
                  const isWarning = overPct > 10;
                  if (devisItems.length === 0) return null;
                  return (
                    <div className="rounded-lg border border-border/60 p-3 space-y-2">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        {isWarning && <AlertTriangle className="h-4 w-4 text-warning" />}
                        {t('or.comparison.title')}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-secondary/40 p-2.5">
                          <p className="text-xs text-muted-foreground">{t('or.comparison.devisTotal')}</p>
                          <p className="text-sm font-bold">{formatCHF(devisSubtotal)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{devisItems.length} {t('or.comparison.items')}</p>
                        </div>
                        <div className={`rounded-lg p-2.5 ${isWarning ? 'bg-warning/10' : 'bg-secondary/40'}`}>
                          <p className="text-xs text-muted-foreground">{t('or.comparison.finalTotal')}</p>
                          <p className={`text-sm font-bold ${isWarning ? 'text-warning' : ''}`}>{formatCHF(roSubtotal)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{(detailsDialog.repair_order_items ?? []).length} {t('or.comparison.items')}</p>
                        </div>
                      </div>
                      <div className={`flex items-center justify-between rounded-lg p-2.5 text-sm ${isWarning ? 'bg-warning/10 text-warning' : isOverrun ? 'bg-secondary/40' : 'bg-success/10 text-success'}`}>
                        <span className="font-medium">{t('or.comparison.difference')}</span>
                        <span className="font-bold">{diff > 0 ? '+' : ''}{formatCHF(diff)}</span>
                      </div>
                      {isWarning && (
                        <p className="text-xs text-warning">{t('or.comparison.overrunWarning', { pct: Math.round(overPct) })}</p>
                      )}
                    </div>
                  );
                })()}

                {detailsDialog.notes && (
                  <div>
                    <p className="text-sm font-semibold mb-1">{t('or.notes')}</p>
                    <p className="text-sm text-muted-foreground">{detailsDialog.notes}</p>
                  </div>
                )}

                {/* Loaner vehicle assignment */}
                <div>
                  <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><CarFront className="h-4 w-4" /> {t('loaner.assignLoaner')}</p>
                  {(() => {
                    const activeAssign = loanerAssignments.find((a) => a.repair_order_id === detailsDialog.id);
                    if (activeAssign) {
                      return (
                        <div className="rounded-lg border border-border/60 bg-secondary/30 p-3 space-y-1">
                          <p className="text-sm font-medium">{activeAssign.loaner_vehicle?.make} {activeAssign.loaner_vehicle?.model} — {activeAssign.loaner_vehicle?.license_plate}</p>
                          <p className="text-xs text-muted-foreground">{activeAssign.start_date} → {activeAssign.end_date}</p>
                          <Button size="sm" variant="outline" className="mt-1 h-7 text-xs" onClick={async () => {
                            await supabase.from('loaner_assignments').update({ status: 'returned' }).eq('id', activeAssign.id);
                            await supabase.from('loaner_vehicles').update({ status: 'available' }).eq('id', activeAssign.loaner_vehicle_id);
                            toast.success(t('loaner.returned'));
                            fetchData();
                          }}>{t('loaner.returnVehicle')}</Button>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        <Select value={selectedLoanerId} onValueChange={setSelectedLoanerId}>
                          <SelectTrigger><SelectValue placeholder={t('loaner.selectLoaner')} /></SelectTrigger>
                          <SelectContent>
                            {loanerVehicles.map((lv) => (
                              <SelectItem key={lv.id} value={lv.id}>{lv.make} {lv.model} — {lv.license_plate}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {loanerVehicles.length === 0 && <p className="text-xs text-muted-foreground">{t('loaner.noAvailable')}</p>}
                        {selectedLoanerId && (
                          <div className="grid grid-cols-2 gap-2">
                            <Input type="date" value={loanerStartDate} onChange={(e) => setLoanerStartDate(e.target.value)} className="text-xs h-8" />
                            <Input type="date" value={loanerEndDate} onChange={(e) => setLoanerEndDate(e.target.value)} className="text-xs h-8" />
                          </div>
                        )}
                        {selectedLoanerId && (
                          <Button size="sm" variant="outline" onClick={async () => {
                            const { error } = await supabase.from('loaner_assignments').insert({
                              loaner_vehicle_id: selectedLoanerId,
                              garage_id: profile?.garage_id ?? null,
                              client_id: detailsDialog.client_id,
                              repair_order_id: detailsDialog.id,
                              start_date: loanerStartDate,
                              end_date: loanerEndDate,
                              status: 'active',
                            });
                            if (error) { toast.error(t('toast.error'), { description: error.message }); return; }
                            await supabase.from('loaner_vehicles').update({ status: 'in_use' }).eq('id', selectedLoanerId);
                            toast.success(t('loaner.assigned'));
                            setSelectedLoanerId('');
                            fetchData();
                          }}>{t('loaner.assign')}</Button>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Photos */}
                {detailsDialog && (
                  <OrPhotosSection
                    repairOrderId={detailsDialog.id}
                    garageId={detailsDialog.garage_id ?? profile?.garage_id ?? ''}
                  />
                )}

                {/* Signature */}
                <div>
                  <p className="text-sm font-semibold mb-2">{t('sig.title')}</p>
                  <SignaturePad
                    existingSignature={detailsDialog.signature_data}
                    signatureDate={detailsDialog.signature_date}
                    onSave={async (dataUrl) => {
                      const { error } = await supabase.from('repair_orders').update({
                        signature_data: dataUrl,
                        signature_date: new Date().toISOString(),
                      }).eq('id', detailsDialog.id);
                      if (error) { toast.error(t('toast.error')); return; }
                      toast.success(t('sig.saved'), { description: t('sig.savedDesc') });
                      fetchData();
                    }}
                  />
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
