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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  formatCHF,
  calculateVAT,
  VAT_RATE,
  type Client,
  type Vehicle,
  type Part,
  type ServiceRequest,
  type DevisItem,
  type Garage,
  type CannedTask,
  type ItemType,
} from '@/lib/types/database';
import { Plus, Trash2, Loader2, FileDown, Check, X, FilePlus2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';
import { localDateStrPlusDays } from '@/lib/utils';
import { generateDevisPDF, garageToPdfInfo } from '@/lib/pdf';

interface FormItem {
  id: string;
  part_id: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  item_type: ItemType;
}

type TabKey = 'pending' | 'sent' | 'accepted' | 'refused';

function emptyItem(): FormItem {
  return { id: crypto.randomUUID(), part_id: null, description: '', quantity: '1', unit_price: '', item_type: 'piece' };
}

export default function DevisPage() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [devisList, setDevisList] = useState<ServiceRequest[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [cannedTasks, setCannedTasks] = useState<CannedTask[]>([]);
  const [garage, setGarage] = useState<Garage | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('pending');

  const [createOpen, setCreateOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [description, setDescription] = useState('');
  const [validUntil, setValidUntil] = useState(localDateStrPlusDays(30));
  const [items, setItems] = useState<FormItem[]>([emptyItem()]);

  const [editOpen, setEditOpen] = useState(false);
  const [editingDevis, setEditingDevis] = useState<ServiceRequest | null>(null);
  const [editItems, setEditItems] = useState<FormItem[]>([]);

  const garageId = profile?.garage_id ?? null;
  const isPrivileged = profile?.role === 'admin' || profile?.role === 'secretaire';
  const hourlyRate = garage?.hourly_rate ?? 120;

  const fetchDevis = useCallback(async () => {
    if (!garageId) return;
    const { data } = await supabase
      .from('service_requests')
      .select('*, client:clients(*), vehicle:vehicles(*), devis_items(*)')
      .eq('garage_id', garageId)
      .order('created_at', { ascending: false });
    setDevisList((data as ServiceRequest[]) ?? []);
  }, [garageId]);

  useEffect(() => {
    async function fetchData() {
      if (!garageId) return;
      const [clientsRes, partsRes, garageRes, tasksRes] = await Promise.all([
        supabase.from('clients').select('*').eq('garage_id', garageId).order('last_name'),
        supabase.from('parts').select('*').eq('garage_id', garageId).order('name'),
        supabase.from('garages').select('*').eq('id', garageId).maybeSingle(),
        supabase.from('canned_tasks').select('*').eq('garage_id', garageId).order('name'),
      ]);
      setClients(clientsRes.data as Client[] ?? []);
      setParts(partsRes.data as Part[] ?? []);
      setGarage(garageRes.data as Garage ?? null);
      setCannedTasks(tasksRes.data as CannedTask[] ?? []);
      await fetchDevis();
      setLoading(false);
    }
    fetchData();
  }, [garageId, fetchDevis]);

  useEffect(() => {
    if (clientId) {
      supabase.from('vehicles').select('*').eq('client_id', clientId).then(({ data }) => {
        setVehicles(data as Vehicle[] ?? []);
        setVehicleId('');
      });
    } else {
      setVehicles([]);
      setVehicleId('');
    }
  }, [clientId]);

  function addItem() {
    setItems([...items, emptyItem()]);
  }

  function removeItem(id: string) {
    if (items.length > 1) {
      setItems(items.filter((i) => i.id !== id));
    }
  }

  function applyCannedTask(itemList: FormItem[], id: string, taskId: string): FormItem[] {
    const task = cannedTasks.find((t2) => t2.id === taskId);
    if (!task) return itemList;
    return itemList.map((i) => {
      if (i.id !== id) return i;
      if (task.default_labor_hours != null) {
        return {
          ...i,
          part_id: null,
          description: task.name,
          quantity: String(task.default_labor_hours),
          unit_price: String(hourlyRate),
          item_type: 'main_oeuvre' as ItemType,
        };
      }
      return {
        ...i,
        part_id: null,
        description: task.name,
        quantity: '1',
        unit_price: task.default_price != null ? String(task.default_price) : '',
        item_type: 'piece' as ItemType,
      };
    });
  }

  function updateItem(id: string, field: keyof FormItem, value: string) {
    setItems(items.map((i) => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      if (field === 'part_id' && value) {
        const part = parts.find((p) => p.id === value);
        if (part) {
          updated.description = part.name;
          updated.unit_price = part.unit_price.toString();
          updated.item_type = 'piece' as ItemType;
        }
      }
      if (field === 'item_type' && value === 'main_oeuvre' && !updated.unit_price) {
        updated.unit_price = String(hourlyRate);
      }
      return updated;
    }));
  }

  function updateEditItem(id: string, field: keyof FormItem, value: string) {
    setEditItems(editItems.map((i) => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      if (field === 'part_id' && value) {
        const part = parts.find((p) => p.id === value);
        if (part) {
          updated.description = part.name;
          updated.unit_price = part.unit_price.toString();
          updated.item_type = 'piece' as ItemType;
        }
      }
      if (field === 'item_type' && value === 'main_oeuvre' && !updated.unit_price) {
        updated.unit_price = String(hourlyRate);
      }
      return updated;
    }));
  }

  const subtotal = items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
  }, 0);
  const { vat, total } = calculateVAT(subtotal);

  const editSubtotal = editItems.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
  }, 0);
  const editCalc = calculateVAT(editSubtotal);

  function resetForm() {
    setClientId('');
    setVehicleId('');
    setDescription('');
    setValidUntil(localDateStrPlusDays(30));
    setItems([emptyItem()]);
  }

  async function handleCreate() {
    if (!clientId) { toast.error(t('devisPage.noClient')); return; }
    if (items.some((i) => !i.description || !i.unit_price)) { toast.error(t('devisPage.noItems')); return; }

    setSubmitting(true);
    try {
      const { data: devisNumber } = await supabase.rpc('generate_devis_number', {
        p_garage_id: garageId,
      });

      const status = isPrivileged ? 'devis_recu' : 'en_attente_validation';

      const { data: devis, error } = await supabase.from('service_requests').insert({
        type: 'demande_devis',
        garage_id: garageId,
        client_id: clientId,
        vehicle_id: vehicleId || null,
        description,
        status,
        devis_number: devisNumber,
        created_by: profile?.id ?? null,
        quoted_price: Math.round(total * 100) / 100,
        expiry_date: validUntil,
      }).select().single();

      if (error) throw error;

      const itemPayload = items.map((item) => ({
        devis_id: devis.id,
        garage_id: garageId,
        description: item.description,
        quantity: parseFloat(item.quantity) || 1,
        unit_price: parseFloat(item.unit_price) || 0,
        line_total: Math.round((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0) * 100) / 100,
        item_type: item.item_type,
      }));

      const { error: itemsError } = await supabase.from('devis_items').insert(itemPayload);
      if (itemsError) throw itemsError;

      toast.success(t('devisPage.created'), { description: t('devisPage.createdDesc') });
      setCreateOpen(false);
      resetForm();
      await fetchDevis();
    } catch (err: any) {
      toast.error(t('devisPage.error'), { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(devis: ServiceRequest) {
    setEditingDevis(devis);
    setEditItems(
      (devis.devis_items ?? []).map((di: DevisItem) => ({
        id: di.id,
        part_id: null,
        description: di.description,
        quantity: String(di.quantity),
        unit_price: String(di.unit_price),
        item_type: (di.item_type ?? 'piece') as ItemType,
      })),
    );
    if ((devis.devis_items ?? []).length === 0) {
      setEditItems([emptyItem()]);
    }
    setEditOpen(true);
  }

  async function handleValidate() {
    if (!editingDevis) return;
    if (editItems.some((i) => !i.description || !i.unit_price)) { toast.error(t('devisPage.noItems')); return; }

    setSubmitting(true);
    try {
      const { error: delError } = await supabase
        .from('devis_items')
        .delete()
        .eq('devis_id', editingDevis.id);
      if (delError) throw delError;

      const itemPayload = editItems.map((item) => ({
        devis_id: editingDevis.id,
        garage_id: garageId,
        description: item.description,
        quantity: parseFloat(item.quantity) || 1,
        unit_price: parseFloat(item.unit_price) || 0,
        line_total: Math.round((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0) * 100) / 100,
        item_type: item.item_type,
      }));

      const { error: itemsError } = await supabase.from('devis_items').insert(itemPayload);
      if (itemsError) throw itemsError;

      const newTotal = editCalc.total;
      const { error: updError } = await supabase
        .from('service_requests')
        .update({ status: 'devis_recu', quoted_price: Math.round(newTotal * 100) / 100 })
        .eq('id', editingDevis.id);
      if (updError) throw updError;

      toast.success(t('devisPage.validated'));
      setEditOpen(false);
      setEditingDevis(null);
      await fetchDevis();
    } catch (err: any) {
      toast.error(t('devisPage.validateError'), { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefuseDevis() {
    if (!editingDevis) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('service_requests')
        .update({ status: 'devis_refuse' })
        .eq('id', editingDevis.id);
      if (error) throw error;

      toast.success(t('devisPage.refused'));
      setEditOpen(false);
      setEditingDevis(null);
      await fetchDevis();
    } catch (err: any) {
      toast.error(t('devisPage.validateError'), { description: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStaffRespond(devis: ServiceRequest, accept: boolean) {
    try {
      const { error } = await supabase.rpc('staff_respond_devis', {
        p_request_id: devis.id,
        p_accept: accept,
      });
      if (error) throw error;
      toast.success(accept ? t('devisPage.clientAccepted') : t('devisPage.clientRefused'));
      await fetchDevis();
    } catch (err: any) {
      toast.error(t('devisPage.respondError'), { description: err.message });
    }
  }

  async function handleDownloadPdf(devis: ServiceRequest) {
    try {
      let itemsData = devis.devis_items ?? [];
      if (itemsData.length === 0) {
        const { data } = await supabase
          .from('devis_items')
          .select('*')
          .eq('devis_id', devis.id);
        itemsData = (data as DevisItem[]) ?? [];
      }
      const client = devis.client ?? null;
      const vehicle = devis.vehicle ?? null;
      await generateDevisPDF(devis, client, vehicle, itemsData, garageToPdfInfo(garage));
    } catch (err: any) {
      toast.error('PDF error', { description: err.message });
    }
  }

  const filteredDevis = devisList.filter((d) => {
    if (activeTab === 'pending') return d.status === 'en_attente_validation';
    if (activeTab === 'sent') return d.status === 'devis_recu';
    if (activeTab === 'accepted') return d.status === 'devis_accepte';
    if (activeTab === 'refused') return d.status === 'devis_refuse';
    return false;
  });

  const statusBadge = (status: string) => {
    if (status === 'en_attente_validation') return <Badge variant="secondary">{t('devisPage.tabPending')}</Badge>;
    if (status === 'devis_recu') return <Badge variant="default">{t('devisPage.tabSent')}</Badge>;
    if (status === 'devis_accepte') return <Badge className="bg-success text-success-foreground">{t('devisPage.tabAccepted')}</Badge>;
    if (status === 'devis_refuse') return <Badge variant="destructive">{t('devisPage.tabRefused')}</Badge>;
    return null;
  };

  function renderGroupedItems(devisItems: DevisItem[]) {
    const laborItems = devisItems.filter((i) => i.item_type === 'main_oeuvre');
    const partItems = devisItems.filter((i) => (i.item_type ?? 'piece') === 'piece');
    const laborSub = laborItems.reduce((s, i) => s + Number(i.line_total), 0);
    const partSub = partItems.reduce((s, i) => s + Number(i.line_total), 0);
    const dSubtotal = laborSub + partSub;
    const dCalc = calculateVAT(dSubtotal);

    const renderRow = (item: DevisItem) => (
      <div key={item.id} className="px-2 py-1.5 text-sm">
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-6">{item.description}</div>
          <div className="col-span-2 text-center hidden sm:block">{item.quantity}</div>
          <div className="col-span-2 text-right hidden sm:block">{formatCHF(item.unit_price)}</div>
          <div className="col-span-2 text-right font-medium hidden sm:block">{formatCHF(item.line_total)}</div>
        </div>
        <div className="sm:hidden mt-1 space-y-0.5">
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">{t('clientInv.qty')}</span>
            <span>{item.quantity}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">{t('clientInv.unitPrice')}</span>
            <span>{formatCHF(item.unit_price)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-muted-foreground">{t('clientInv.totalCol')}</span>
            <span className="font-medium">{formatCHF(item.line_total)}</span>
          </div>
        </div>
      </div>
    );

    return (
      <div className="border-t pt-2 space-y-2">
        {laborItems.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-1">{t('items.labor')}</p>
            <div className="hidden sm:grid grid-cols-12 gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
              <div className="col-span-6">{t('clientInv.description')}</div>
              <div className="col-span-2 text-center">{t('clientInv.qty')}</div>
              <div className="col-span-2 text-right">{t('clientInv.unitPrice')}</div>
              <div className="col-span-2 text-right">{t('clientInv.totalCol')}</div>
            </div>
            {laborItems.map(renderRow)}
            <div className="flex justify-between px-2 py-1 text-sm">
              <span className="text-muted-foreground">{t('items.laborSubtotal')}</span>
              <span className="font-medium">{formatCHF(laborSub)}</span>
            </div>
          </div>
        )}
        {partItems.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 mb-1">{t('items.parts')}</p>
            <div className="hidden sm:grid grid-cols-12 gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
              <div className="col-span-6">{t('clientInv.description')}</div>
              <div className="col-span-2 text-center">{t('clientInv.qty')}</div>
              <div className="col-span-2 text-right">{t('clientInv.unitPrice')}</div>
              <div className="col-span-2 text-right">{t('clientInv.totalCol')}</div>
            </div>
            {partItems.map(renderRow)}
            <div className="flex justify-between px-2 py-1 text-sm">
              <span className="text-muted-foreground">{t('items.partsSubtotal')}</span>
              <span className="font-medium">{formatCHF(partSub)}</span>
            </div>
          </div>
        )}
        <div className="px-2 pt-2 border-t space-y-1 max-w-xs ml-auto">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('devisPage.subtotal')}</span>
            <span>{formatCHF(dSubtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t('devisPage.vat')}</span>
            <span>{formatCHF(dCalc.vat)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>{t('devisPage.total')}</span>
            <span>{formatCHF(dCalc.total)}</span>
          </div>
        </div>
      </div>
    );
  }

  function renderItemEditor(
    item: FormItem,
    index: number,
    onUpdate: (id: string, field: keyof FormItem, value: string) => void,
    onRemove: (id: string) => void,
    onAddTask: (id: string, taskId: string) => void,
    canRemove: boolean,
  ) {
    const isLabor = item.item_type === 'main_oeuvre';
    return (
      <div key={item.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
        <div className="flex-1 min-w-0 space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t('devisPage.items')} {index + 1}</Label>
          <div className="flex gap-2">
            <Select
              value={item.item_type}
              onValueChange={(v) => onUpdate(item.id, 'item_type', v)}
            >
              <SelectTrigger className="w-36 shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="piece">{t('items.piece')}</SelectItem>
                <SelectItem value="main_oeuvre">{t('items.labor')}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={item.part_id ?? 'custom'}
              onValueChange={(v) => {
                if (v === 'custom') {
                  onUpdate(item.id, 'part_id', '');
                } else if (v.startsWith('task-')) {
                  onAddTask(item.id, v.slice(5));
                } else {
                  onUpdate(item.id, 'part_id', v);
                }
              }}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t('invNew.selectTask')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">{t('invNew.itemDesc')}</SelectItem>
                {parts.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.reference} — {p.name} ({formatCHF(p.unit_price)})
                  </SelectItem>
                ))}
                {cannedTasks.length > 0 && <SelectItem value="__tasks__" disabled>{t('cannedTasks.pickTask')}</SelectItem>}
                {cannedTasks.map((task) => (
                  <SelectItem key={task.id} value={`task-${task.id}`}>
                    {task.name}{task.default_labor_hours != null ? ` — ${task.default_labor_hours}h` : task.default_price != null ? ` (${formatCHF(task.default_price)})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder={t('invNew.itemDesc')}
            value={item.description}
            onChange={(e) => onUpdate(item.id, 'description', e.target.value)}
          />
        </div>
        <div className="w-20 space-y-1.5">
          <Label className="text-xs text-muted-foreground">{isLabor ? t('items.hours') : t('admin.appts.qty')}</Label>
          <Input
            type="number"
            step="0.25"
            value={item.quantity}
            onChange={(e) => onUpdate(item.id, 'quantity', e.target.value)}
            onFocus={(e) => e.target.select()}
          />
        </div>
        <div className="w-32 space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t('admin.appts.unitPrice')}</Label>
          <Input
            type="number"
            step="0.05"
            placeholder="0.00"
            value={item.unit_price}
            onChange={(e) => onUpdate(item.id, 'unit_price', e.target.value)}
          />
        </div>
        <div className="w-28 space-y-1.5">
          <Label className="text-xs text-muted-foreground">{t('invNew.lineTotal')}</Label>
          <div className="h-10 flex items-center px-3 rounded-md border bg-muted/50 text-sm font-medium">
            {formatCHF((parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0))}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="mt-5 shrink-0 hover:text-destructive"
          onClick={() => onRemove(item.id)}
          disabled={!canRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
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
      <PageHeader title={t('devisPage.title')} description={t('devisPage.desc')}>
        <Button onClick={() => setCreateOpen(true)}>
          <FilePlus2 className="h-4 w-4 mr-2" />
          {t('devisPage.new')}
        </Button>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList>
          <TabsTrigger value="pending">{t('devisPage.tabPending')}</TabsTrigger>
          <TabsTrigger value="sent">{t('devisPage.tabSent')}</TabsTrigger>
          <TabsTrigger value="accepted">{t('devisPage.tabAccepted')}</TabsTrigger>
          <TabsTrigger value="refused">{t('devisPage.tabRefused')}</TabsTrigger>
        </TabsList>

        {(['pending', 'sent', 'accepted', 'refused'] as TabKey[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="space-y-3">
            {filteredDevis.length === 0 ? (
              <Card className="border-border/60">
                <CardContent className="py-8 text-center text-muted-foreground">
                  {tab === 'pending' && t('devisPage.emptyPending')}
                  {tab === 'sent' && t('devisPage.emptySent')}
                  {tab === 'accepted' && t('devisPage.emptyAccepted')}
                  {tab === 'refused' && t('devisPage.emptyRefused')}
                </CardContent>
              </Card>
            ) : (
              filteredDevis.map((devis) => {
                const clientName = devis.client
                  ? devis.client.company_name
                    ? `${devis.client.company_name} (${devis.client.first_name} ${devis.client.last_name})`
                    : `${devis.client.first_name} ${devis.client.last_name}`
                  : '';
                const vehicleInfo = devis.vehicle
                  ? `${devis.vehicle.brand} ${devis.vehicle.model} — ${devis.vehicle.license_plate}`
                  : '';
                const hasPortal = devis.client?.auth_user_id != null;
                const devisItems = devis.devis_items ?? [];
                const dSubtotal = devisItems.reduce((s, i) => s + Number(i.line_total), 0);
                const dCalc = calculateVAT(dSubtotal);

                return (
                  <Card key={devis.id} className="border-border/60">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{devis.devis_number || ''}</span>
                            {statusBadge(devis.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">{clientName}</p>
                          {vehicleInfo && <p className="text-xs text-muted-foreground">{vehicleInfo}</p>}
                          {devis.expiry_date && (
                            <p className="text-xs text-muted-foreground">
                              {t('devisPage.validUntilLabel')}: {new Date(devis.expiry_date).toLocaleDateString('fr-CH')}
                            </p>
                          )}
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-sm font-medium">{formatCHF(dCalc.total)}</p>
                          <div className="flex gap-2 flex-wrap justify-end">
                            <Button size="sm" variant="outline" onClick={() => handleDownloadPdf(devis)}>
                              <FileDown className="h-3.5 w-3.5 mr-1" />
                              {t('devisPage.downloadPdf')}
                            </Button>
                            {devis.status === 'en_attente_validation' && isPrivileged && (
                              <Button size="sm" onClick={() => openEdit(devis)}>
                                {t('devisPage.editItems')}
                              </Button>
                            )}
                            {devis.status === 'devis_recu' && !hasPortal && isPrivileged && (
                              <>
                                <Button size="sm" onClick={() => handleStaffRespond(devis, true)}>
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  {t('devisPage.clientAccepted')}
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleStaffRespond(devis, false)}>
                                  <X className="h-3.5 w-3.5 mr-1" />
                                  {t('devisPage.clientRefused')}
                                </Button>
                              </>
                            )}
                          </div>
                          {devis.status === 'devis_recu' && (
                            <p className="text-xs text-muted-foreground">
                              {hasPortal ? t('devisPage.clientOnline') : t('devisPage.clientOffline')}
                            </p>
                          )}
                        </div>
                      </div>

                      {devisItems.length > 0 && renderGroupedItems(devisItems)}

                      {devis.description && (
                        <div className="border-t pt-2">
                          <p className="text-xs text-muted-foreground">{devis.description}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('devisPage.new')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('devisPage.selectClient')}</Label>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger><SelectValue placeholder={t('devisPage.selectClient')} /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name ? `${c.company_name} (${c.first_name} ${c.last_name})` : `${c.first_name} ${c.last_name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('devisPage.selectVehicle')}</Label>
                <Select value={vehicleId} onValueChange={setVehicleId} disabled={!clientId}>
                  <SelectTrigger><SelectValue placeholder={t('devisPage.selectVehicle')} /></SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.brand} {v.model} — {v.license_plate}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('devisPage.description')}</Label>
              <Textarea
                placeholder={t('devisPage.descriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('devisPage.validUntilLabel')}</Label>
              <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">{t('devisPage.items')}</Label>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" /> {t('common.add')}
                </Button>
              </div>
              {items.map((item, index) => renderItemEditor(
                item, index, updateItem, removeItem,
                (id, taskId) => setItems(applyCannedTask(items, id, taskId)),
                items.length > 1,
              ))}
            </div>

            <div className="space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('devisPage.subtotal')}</span>
                <span className="font-medium">{formatCHF(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('devisPage.vat')}</span>
                <span className="font-medium">{formatCHF(vat)}</span>
              </div>
              <div className="flex justify-between text-lg pt-2 border-t">
                <span className="font-bold">{t('devisPage.total')}</span>
                <span className="font-bold text-primary">{formatCHF(total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t('devisPage.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit / validate dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('devisPage.editItems')} — {editingDevis?.devis_number}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {editItems.map((item, index) => renderItemEditor(
              item, index, updateEditItem,
              (id) => { if (editItems.length > 1) setEditItems(editItems.filter((i) => i.id !== id)); },
              (id, taskId) => setEditItems(applyCannedTask(editItems, id, taskId)),
              editItems.length > 1,
            ))}
            <Button size="sm" variant="outline" onClick={() => setEditItems([...editItems, emptyItem()])}>
              <Plus className="h-4 w-4 mr-1" /> {t('common.add')}
            </Button>

            <div className="space-y-2 max-w-xs ml-auto">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('devisPage.subtotal')}</span>
                <span className="font-medium">{formatCHF(editSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('devisPage.vat')}</span>
                <span className="font-medium">{formatCHF(editCalc.vat)}</span>
              </div>
              <div className="flex justify-between text-lg pt-2 border-t">
                <span className="font-bold">{t('devisPage.total')}</span>
                <span className="font-bold text-primary">{formatCHF(editCalc.total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="destructive" onClick={handleRefuseDevis} disabled={submitting}>
              <X className="h-4 w-4 mr-2" />
              {t('devisPage.refuse')}
            </Button>
            <Button onClick={handleValidate} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Check className="h-4 w-4 mr-2" />
              {t('devisPage.validate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
