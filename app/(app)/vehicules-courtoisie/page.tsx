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
  CarFront,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  Wrench,
  KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';
import {
  type LoanerVehicle,
  type LoanerVehicleStatus,
  type LoanerAssignment,
  type Client,
} from '@/lib/types/database';

export default function LoanerVehiclesPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [vehicles, setVehicles] = useState<(LoanerVehicle & { loaner_assignments?: LoanerAssignment[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialog, setAddDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ make: '', model: '', license_plate: '', status: 'available' as LoanerVehicleStatus, notes: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('loaner_vehicles')
      .select('*, loaner_assignments(*, client:clients(*))')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      setVehicles(data as any ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAdd() {
    if (!form.make || !form.model || !form.license_plate) {
      toast.error(t('toast.error'));
      return;
    }
    setSubmitting(true);
    if (editId) {
      const { error } = await supabase.from('loaner_vehicles').update({
        make: form.make,
        model: form.model,
        license_plate: form.license_plate,
        status: form.status,
        notes: form.notes || null,
      }).eq('id', editId);
      if (error) {
        toast.error(t('toast.error'), { description: error.message });
      } else {
        toast.success(t('loaner.updated'));
        setAddDialog(false);
        setEditId(null);
        fetchData();
      }
    } else {
      const { error } = await supabase.from('loaner_vehicles').insert({
        make: form.make,
        model: form.model,
        license_plate: form.license_plate,
        status: form.status,
        notes: form.notes || null,
        garage_id: profile?.garage_id ?? null,
      });
      if (error) {
        toast.error(t('toast.error'), { description: error.message });
      } else {
        toast.success(t('loaner.added'));
        setAddDialog(false);
        fetchData();
      }
    }
    setForm({ make: '', model: '', license_plate: '', status: 'available', notes: '' });
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('loaner_vehicles').delete().eq('id', id);
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(t('loaner.deleted'));
      fetchData();
    }
  }

  async function handleReturnAssignment(assignmentId: string, vehicleId: string) {
    const { error: assignError } = await supabase.from('loaner_assignments').update({ status: 'returned' }).eq('id', assignmentId);
    if (assignError) {
      toast.error(t('toast.error'), { description: assignError.message });
      return;
    }
    const { error: vehError } = await supabase.from('loaner_vehicles').update({ status: 'available' }).eq('id', vehicleId);
    if (vehError) {
      toast.error(t('toast.error'), { description: vehError.message });
      return;
    }
    toast.success(t('loaner.returned'));
    fetchData();
  }

  function openEdit(v: LoanerVehicle) {
    setEditId(v.id);
    setForm({ make: v.make, model: v.model, license_plate: v.license_plate, status: v.status, notes: v.notes ?? '' });
    setAddDialog(true);
  }

  function openAdd() {
    setEditId(null);
    setForm({ make: '', model: '', license_plate: '', status: 'available', notes: '' });
    setAddDialog(true);
  }

  const statusConfig: Record<LoanerVehicleStatus, { icon: any; color: string; bg: string }> = {
    available: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
    in_use: { icon: KeyRound, color: 'text-primary', bg: 'bg-primary/10' },
    maintenance: { icon: Wrench, color: 'text-warning', bg: 'bg-warning/10' },
  };

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('loaner.title')} description={t('loaner.desc')}>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          {t('loaner.add')}
        </Button>
      </PageHeader>

      {vehicles.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CarFront className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">{t('loaner.noVehicles')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((v) => {
            const sc = statusConfig[v.status];
            const Icon = sc.icon;
            const activeAssignment = v.loaner_assignments?.find((a) => a.status === 'active');
            return (
              <Card key={v.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${sc.bg}`}>
                        <Icon className={`h-5 w-5 ${sc.color}`} />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{v.make} {v.model}</p>
                        <p className="text-xs text-muted-foreground">{v.license_plate}</p>
                      </div>
                    </div>
                    <Badge variant="secondary" className={sc.color}>
                      {t(`loaner.${v.status === 'available' ? 'available' : v.status === 'in_use' ? 'inUse' : 'maintenance'}`)}
                    </Badge>
                  </div>

                  {v.notes && <p className="text-xs text-muted-foreground mt-2">{v.notes}</p>}

                  {activeAssignment && (
                    <div className="mt-3 rounded-lg border border-border/40 bg-secondary/30 p-2.5">
                      <p className="text-xs font-medium">{t('loaner.currentAssignment')}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {activeAssignment.client ? `${activeAssignment.client.first_name} ${activeAssignment.client.last_name}` : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activeAssignment.start_date} → {activeAssignment.end_date}
                      </p>
                      <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" onClick={() => handleReturnAssignment(activeAssignment.id, v.id)}>
                        {t('loaner.returnVehicle')}
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => openEdit(v)}>
                      {t('common.save')}
                    </Button>
                    <Button size="sm" variant="ghost" className="hover:text-destructive" onClick={() => handleDelete(v.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? t('common.save') : t('loaner.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('loaner.make')} *</Label>
                <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>{t('loaner.model')} *</Label>
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('loaner.plate')} *</Label>
              <Input value={form.license_plate} onChange={(e) => setForm({ ...form, license_plate: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t('loaner.status')}</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">{t('loaner.available')}</SelectItem>
                  <SelectItem value="in_use">{t('loaner.inUse')}</SelectItem>
                  <SelectItem value="maintenance">{t('loaner.maintenance')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('loaner.notes')}</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
