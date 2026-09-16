'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Wrench,
  CheckCircle2,
  Loader2,
  User,
  Car,
  CarFront,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import {
  TIME_SLOTS,
  type Appointment,
  type RepairOrder,
  type Client,
  type Vehicle,
  type Profile,
  type AppointmentStatus,
  type RepairOrderStatus,
} from '@/lib/types/database';

interface PlanningItem {
  id: string;
  type: 'appointment' | 'repair_order';
  client_name: string;
  vehicle_label: string;
  service_type: string;
  status: string;
  date: string;
  time: string;
  mechanic_id: string | null;
  mechanic_name: string | null;
  workspace_name: string | null;
  raw: any;
}

export default function PlanningPage() {
  const { t } = useI18n();
  const [view, setView] = useState<'day' | 'week'>('day');
  const [groupBy, setGroupBy] = useState<'mechanic' | 'workspace'>('mechanic');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mechanics, setMechanics] = useState<Profile[]>([]);
  const [appointments, setAppointments] = useState<(Appointment & { client?: Client; vehicle?: Vehicle })[]>([]);
  const [orders, setOrders] = useState<(RepairOrder & { client?: Client; vehicle?: Vehicle; assigned_mechanic?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [reassignDialog, setReassignDialog] = useState<PlanningItem | null>(null);
  const [reassignTo, setReassignTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [mechRes, apptRes, orRes] = await Promise.all([
      supabase.from('profiles').select('*').in('role', ['admin', 'mecanicien']).eq('active', true),
      supabase.from('appointments').select('*, client:clients(*), vehicle:vehicles(*)').in('status', ['confirme', 'termine']).order('scheduled_date'),
      supabase.from('repair_orders').select('*, client:clients(*), vehicle:vehicles(*), assigned_mechanic:profiles!assigned_mechanic_id(*)').in('status', ['en_cours', 'termine']).order('created_at'),
    ]);
    setMechanics(mechRes.data as Profile[] ?? []);
    setAppointments(apptRes.data as any ?? []);
    setOrders(orRes.data as any ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const planningItems: PlanningItem[] = useMemo(() => {
    const items: PlanningItem[] = [];

    appointments.forEach((a) => {
      if (a.status === 'confirme' || a.status === 'termine') {
        const date = a.scheduled_date || a.requested_date;
        const time = a.scheduled_time || a.requested_time;
        const mech = mechanics.find((m) => m.id === a.assigned_to);
        items.push({
          id: a.id,
          type: 'appointment',
          client_name: a.client ? `${a.client.first_name} ${a.client.last_name}` : '—',
          vehicle_label: a.vehicle ? `${a.vehicle.brand} ${a.vehicle.model}` : '—',
          service_type: a.service_type,
          status: a.status,
          date,
          time,
          mechanic_id: a.assigned_to,
          mechanic_name: mech?.full_name ?? null,
          workspace_name: null,
          raw: a,
        });
      }
    });

    orders.forEach((o) => {
      const date = o.start_time ? o.start_time.split('T')[0] : '';
      const time = o.start_time ? new Date(o.start_time).toTimeString().slice(0, 5) : '08:00';
      items.push({
        id: o.id,
        type: 'repair_order',
        client_name: o.client ? `${o.client.first_name} ${o.client.last_name}` : '—',
        vehicle_label: o.vehicle ? `${o.vehicle.brand} ${o.vehicle.model}` : '—',
        service_type: o.or_number,
        status: o.status,
        date,
        time,
        mechanic_id: o.assigned_mechanic_id,
        mechanic_name: o.assigned_mechanic?.full_name ?? null,
        workspace_name: o.workspace_name,
        raw: o,
      });
    });

    return items;
  }, [appointments, orders, mechanics]);

  const workspaces = useMemo(() => {
    const names = new Set<string>();
    orders.forEach((o) => { if (o.workspace_name) names.add(o.workspace_name); });
    return Array.from(names).sort();
  }, [orders]);

  const groupByColumns = groupBy === 'mechanic'
    ? mechanics.map((m) => ({ id: m.id, label: m.full_name, sublabel: t(`role.${m.role}`), icon: Wrench }))
    : workspaces.map((w) => ({ id: w, label: w, sublabel: null, icon: CarFront }));

  function getItemColumnId(item: PlanningItem): string | null {
    if (groupBy === 'mechanic') return item.mechanic_id;
    return item.workspace_name;
  }

  const dateStr = useMemo(() => {
    const y = currentDate.getFullYear();
    const m = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    const d = currentDate.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [currentDate]);

  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    const monday = new Date(currentDate);
    const day = monday.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    monday.setDate(monday.getDate() + diff);
    for (let i = 0; i < 6; i++) {
      const d = new Date(monday);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [currentDate]);

  function formatDateStr(d: Date): string {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function navigate(direction: -1 | 1) {
    const newDate = new Date(currentDate);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else {
      newDate.setDate(newDate.getDate() + direction * 7);
    }
    setCurrentDate(newDate);
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  async function handleReassign() {
    if (!reassignDialog) return;
    const table = reassignDialog.type === 'appointment' ? 'appointments' : 'repair_orders';
    const column = reassignDialog.type === 'appointment' ? 'assigned_to' : 'assigned_mechanic_id';
    const { error } = await supabase.from(table).update({
      [column]: reassignTo || null,
    }).eq('id', reassignDialog.id);
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(t('planning.reassigned'));
      setReassignDialog(null);
      setReassignTo('');
      fetchData();
    }
  }

  function getStatusColor(status: string): { bg: string; text: string; label: string } {
    if (status === 'confirme') return { bg: 'bg-blue-500/15', text: 'text-blue-600', label: t('planning.statusConfirmed') };
    if (status === 'en_cours') return { bg: 'bg-primary/15', text: 'text-primary', label: t('planning.statusInProgress') };
    if (status === 'termine' || status === 'completed') return { bg: 'bg-success/15', text: 'text-success', label: t('planning.statusCompleted') };
    return { bg: 'bg-muted', text: 'text-muted-foreground', label: status };
  }

  function ItemCard({ item }: { item: PlanningItem }) {
    const sc = getStatusColor(item.status);
    return (
      <div
        className={`rounded-lg border border-border/40 ${sc.bg} p-2.5 cursor-pointer hover:border-border hover:shadow-sm transition-all`}
        onClick={() => { setReassignDialog(item); setReassignTo(item.mechanic_id ?? 'none'); }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-semibold ${sc.text}`}>{item.time}</span>
          <Badge variant="outline" className={`text-[10px] h-5 ${sc.text}`}>{sc.label}</Badge>
        </div>
        <p className="text-xs font-medium truncate">{item.client_name}</p>
        <p className="text-xs text-muted-foreground truncate">{item.vehicle_label}</p>
        <p className="text-xs text-muted-foreground truncate">{item.service_type}</p>
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
      <PageHeader title={t('planning.title')} description={t('planning.desc')} />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            {t('planning.today')}
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant={view === 'day' ? 'default' : 'outline'} size="sm" onClick={() => setView('day')}>
            {t('planning.day')}
          </Button>
          <Button variant={view === 'week' ? 'default' : 'outline'} size="sm" onClick={() => setView('week')}>
            {t('planning.week')}
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant={groupBy === 'mechanic' ? 'default' : 'outline'} size="sm" onClick={() => setGroupBy('mechanic')}>
            <Wrench className="h-3.5 w-3.5 mr-1" />
            {t('planning.byMechanic')}
          </Button>
          <Button variant={groupBy === 'workspace' ? 'default' : 'outline'} size="sm" onClick={() => setGroupBy('workspace')}>
            <CarFront className="h-3.5 w-3.5 mr-1" />
            {t('planning.byWorkspace')}
          </Button>
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          {view === 'day'
            ? currentDate.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            : `${weekDates[0].toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' })} — ${weekDates[5].toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        </p>
      </div>

      {groupByColumns.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="p-8 text-center text-muted-foreground">
            {groupBy === 'mechanic' ? t('planning.noMechanic') : t('planning.noWorkspace')}
          </CardContent>
        </Card>
      ) : view === 'day' ? (
        /* Day view: columns per group */
        <div className="overflow-x-auto">
          <div className="min-w-max space-y-2">
            {/* Header row */}
            <div className="flex gap-3">
              <div className="w-20 shrink-0" />
              {groupByColumns.map((col) => (
                <div key={col.id} className="w-64 shrink-0">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <col.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{col.label}</p>
                      {col.sublabel && <p className="text-xs text-muted-foreground">{col.sublabel}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Time slots */}
            <div className="space-y-1">
              {TIME_SLOTS.map((slot) => (
                <div key={slot} className="flex gap-3">
                  <div className="w-20 shrink-0 flex items-center justify-end pr-2">
                    <span className="text-xs text-muted-foreground font-medium">{slot}</span>
                  </div>
                  {groupByColumns.map((col) => {
                    const items = planningItems.filter(
                      (it) => getItemColumnId(it) === col.id && it.date === dateStr && it.time === slot
                    );
                    return (
                      <div key={col.id} className="w-64 shrink-0 min-h-[3rem] rounded-lg border border-border/20 bg-secondary/20 p-1.5 space-y-1.5">
                        {items.map((it) => <ItemCard key={it.id} item={it} />)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Week view: rows per group, columns per day */
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Header row */}
            <div className="flex gap-2 mb-2">
              <div className="w-40 shrink-0" />
              {weekDates.map((d) => (
                <div key={formatDateStr(d)} className="w-44 shrink-0 text-center">
                  <div className={`rounded-lg p-2 ${formatDateStr(d) === dateStr ? 'bg-primary/10' : 'bg-secondary/40'}`}>
                    <p className="text-xs text-muted-foreground">{d.toLocaleDateString('fr-CH', { weekday: 'short' })}</p>
                    <p className="text-sm font-semibold">{d.getDate()}</p>
                  </div>
                </div>
              ))}
            </div>
            {/* Group rows */}
            {groupByColumns.map((col) => (
              <div key={col.id} className="flex gap-2 mb-2">
                <div className="w-40 shrink-0 flex items-center gap-2 p-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                    <col.icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-medium truncate">{col.label}</span>
                </div>
                {weekDates.map((d) => {
                  const items = planningItems.filter(
                    (it) => getItemColumnId(it) === col.id && it.date === formatDateStr(d)
                  );
                  return (
                    <div key={formatDateStr(d)} className="w-44 shrink-0 min-h-[5rem] rounded-lg border border-border/20 bg-secondary/20 p-1.5 space-y-1.5">
                      {items.map((it) => <ItemCard key={it.id} item={it} />)}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t('planning.dragHint')}</p>

      {/* Reassign Dialog */}
      <Dialog open={!!reassignDialog} onOpenChange={(v) => !v && setReassignDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('planning.reassign')}</DialogTitle>
          </DialogHeader>
          {reassignDialog && (
            <div className="space-y-3 py-2">
              <div className="rounded-lg border border-border/60 p-3 space-y-1 text-sm">
                <p className="font-medium">{reassignDialog.client_name}</p>
                <p className="text-muted-foreground">{reassignDialog.vehicle_label}</p>
                <p className="text-muted-foreground">{reassignDialog.service_type}</p>
                <p className="text-muted-foreground">{reassignDialog.date} {reassignDialog.time}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('planning.reassignTo')}</label>
                <Select value={reassignTo} onValueChange={setReassignTo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('or.noMechanic')}</SelectItem>
                    {mechanics.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialog(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleReassign}>{t('planning.reassign')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
