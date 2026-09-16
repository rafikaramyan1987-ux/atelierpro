'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Square, Car, User, ClipboardList, Clock, Wrench, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { type RepairOrder, type RepairOrderStatus } from '@/lib/types/database';

type Intervention = RepairOrder & {
  client?: { first_name: string; last_name: string };
  vehicle?: { brand: string; model: string; license_plate: string | null };
};

export default function MesInterventionsPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [orders, setOrders] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('repair_orders')
      .select('*, client:clients(*), vehicle:vehicles(*)')
      .eq('assigned_mechanic_id', profile.id)
      .in('status', ['en_cours', 'termine'])
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      setOrders(data as Intervention[] ?? []);
    }
    setLoading(false);
  }, [profile?.id, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleStart(order: Intervention) {
    setUpdating(order.id);
    const { data, error } = await supabase
      .from('repair_orders')
      .update({ start_time: new Date().toISOString(), status: 'en_cours' })
      .eq('id', order.id)
      .select();
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else if (!data || data.length === 0) {
      toast.error(t('toast.error'), { description: t('mesInterventions.updateFailed') });
    } else {
      toast.success(t('mesInterventions.started'));
      fetchData();
    }
    setUpdating(null);
  }

  async function handleFinish(order: Intervention) {
    setUpdating(order.id);
    const { data, error } = await supabase
      .from('repair_orders')
      .update({ end_time: new Date().toISOString(), status: 'termine' })
      .eq('id', order.id)
      .select();
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else if (!data || data.length === 0) {
      toast.error(t('toast.error'), { description: t('mesInterventions.updateFailed') });
    } else {
      toast.success(t('mesInterventions.finished'));
      fetchData();
    }
    setUpdating(null);
  }

  function formatDuration(start: string | null, end: string | null): string {
    if (!start) return '—';
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const mins = Math.round((e - s) / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
  }

  const statusConfig: Record<RepairOrderStatus, { icon: typeof Wrench; color: string; bg: string; label: string }> = {
    en_cours: { icon: Wrench, color: 'text-primary', bg: 'bg-primary/10', label: t('mesInterventions.inProgress') },
    termine: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10', label: t('mesInterventions.completed') },
    facture: { icon: CheckCircle2, color: 'text-muted-foreground', bg: 'bg-muted', label: 'Facturé' },
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('mesInterventions.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('mesInterventions.desc')}</p>
      </div>

      {orders.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ClipboardList className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-sm text-muted-foreground">{t('mesInterventions.empty')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const sc = statusConfig[order.status];
            const Icon = sc.icon;
            const isUpdating = updating === order.id;
            const canStart = order.status === 'en_cours' && !order.start_time;
            const canFinish = order.status === 'en_cours' && !!order.start_time;
            return (
              <Card key={order.id} className="border-border/60 overflow-hidden">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${sc.bg}`}>
                        <Icon className={`h-5 w-5 ${sc.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm">{order.or_number}</p>
                        <Badge variant="secondary" className={`text-xs mt-1 ${sc.bg} ${sc.color} border-0`}>
                          {sc.label}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {order.client ? `${order.client.first_name} ${order.client.last_name}` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Car className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {order.vehicle ? `${order.vehicle.brand} ${order.vehicle.model}` : '—'}
                        {order.vehicle?.license_plate && ` · ${order.vehicle.license_plate}`}
                      </span>
                    </div>
                    {order.notes && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <ClipboardList className="h-4 w-4 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{order.notes}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4 shrink-0" />
                      <span>{formatDuration(order.start_time, order.end_time)}</span>
                    </div>
                  </div>

                  {(canStart || canFinish) && (
                    <div className="flex gap-3 pt-1">
                      {canStart && (
                        <Button
                          onClick={() => handleStart(order)}
                          disabled={isUpdating}
                          className="flex-1 h-12 text-base font-semibold"
                        >
                          {isUpdating ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Play className="h-5 w-5 mr-2" />}
                          {t('mesInterventions.start')}
                        </Button>
                      )}
                      {canFinish && (
                        <Button
                          onClick={() => handleFinish(order)}
                          disabled={isUpdating}
                          variant="default"
                          className="flex-1 h-12 text-base font-semibold bg-success hover:bg-success/90"
                        >
                          {isUpdating ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Square className="h-5 w-5 mr-2" />}
                          {t('mesInterventions.finish')}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
