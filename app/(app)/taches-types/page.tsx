'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  ClipboardList, Plus, Pencil, Trash2, Clock, Loader2, CalendarClock, Gauge, Sun, Snowflake, Ban, Package, Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';
import { formatCHF, type CannedTask, type ReminderType } from '@/lib/types/database';

const MONTHS = [
  { value: 1, key: 'month.jan' }, { value: 2, key: 'month.feb' }, { value: 3, key: 'month.mar' },
  { value: 4, key: 'month.apr' }, { value: 5, key: 'month.may' }, { value: 6, key: 'month.jun' },
  { value: 7, key: 'month.jul' }, { value: 8, key: 'month.aug' }, { value: 9, key: 'month.sep' },
  { value: 10, key: 'month.oct' }, { value: 11, key: 'month.nov' }, { value: 12, key: 'month.dec' },
];

export default function CannedTasksPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [tasks, setTasks] = useState<CannedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CannedTask | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');
  const [laborHours, setLaborHours] = useState('');
  const [reminderType, setReminderType] = useState<ReminderType>('none');
  const [intervalMonths, setIntervalMonths] = useState('');
  const [intervalKm, setIntervalKm] = useState('');
  const [seasonalMonths, setSeasonalMonths] = useState<number[]>([]);
  const [serviceGroup, setServiceGroup] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('canned_tasks')
      .select('*')
      .order('name', { ascending: true });
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    }
    setTasks(data as CannedTask[] ?? []);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openCreate() {
    setEditingTask(null);
    setName('');
    setDescription('');
    setDuration('');
    setPrice('');
    setLaborHours('');
    setReminderType('none');
    setIntervalMonths('');
    setIntervalKm('');
    setSeasonalMonths([]);
    setServiceGroup('');
    setDialogOpen(true);
  }

  function openEdit(task: CannedTask) {
    setEditingTask(task);
    setName(task.name);
    setDescription(task.description ?? '');
    setDuration(task.estimated_duration_minutes?.toString() ?? '');
    setPrice(task.default_price?.toString() ?? '');
    setLaborHours(task.default_labor_hours?.toString() ?? '');
    setReminderType(task.reminder_type ?? 'none');
    setIntervalMonths(task.interval_months?.toString() ?? '');
    setIntervalKm(task.interval_km?.toString() ?? '');
    setSeasonalMonths(task.seasonal_months ?? []);
    setServiceGroup(task.service_group ?? '');
    setDialogOpen(true);
  }

  function toggleSeasonalMonth(month: number) {
    setSeasonalMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month].sort((a, b) => a - b)
    );
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error(t('cannedTasks.nameRequired'));
      return;
    }
    setSubmitting(true);
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      estimated_duration_minutes: duration ? parseInt(duration) : null,
      default_price: price ? parseFloat(price) : null,
      default_labor_hours: laborHours ? parseFloat(laborHours) : null,
      reminder_type: reminderType,
      interval_months: reminderType === 'interval' && intervalMonths ? parseInt(intervalMonths) : null,
      interval_km: reminderType === 'interval' && intervalKm ? parseInt(intervalKm) : null,
      seasonal_months: reminderType === 'seasonal' ? seasonalMonths : [],
      service_group: serviceGroup.trim() || null,
      garage_id: profile?.garage_id ?? null,
    };

    if (editingTask) {
      const { error } = await supabase.from('canned_tasks').update(payload).eq('id', editingTask.id);
      if (error) {
        toast.error(t('toast.error'), { description: error.message });
      } else {
        toast.success(t('cannedTasks.updated'));
        setDialogOpen(false);
        fetchData();
      }
    } else {
      const { error } = await supabase.from('canned_tasks').insert({ ...payload, garage_id: profile?.garage_id ?? null });
      if (error) {
        toast.error(t('toast.error'), { description: error.message });
      } else {
        toast.success(t('cannedTasks.created'));
        setDialogOpen(false);
        fetchData();
      }
    }
    setSubmitting(false);
  }

  async function handleDelete(task: CannedTask) {
    const { error } = await supabase.from('canned_tasks').delete().eq('id', task.id);
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(t('cannedTasks.deleted'));
      fetchData();
    }
  }

  function reminderBadge(task: CannedTask) {
    switch (task.reminder_type) {
      case 'interval':
        return <Badge variant="secondary" className="text-xs gap-1"><CalendarClock className="h-3 w-3" />{t('cannedTasks.type.interval')}</Badge>;
      case 'seasonal':
        return <Badge variant="secondary" className="text-xs gap-1"><Sun className="h-3 w-3" />{t('cannedTasks.type.seasonal')}</Badge>;
      default:
        return <Badge variant="outline" className="text-xs gap-1"><Ban className="h-3 w-3" />{t('cannedTasks.type.none')}</Badge>;
    }
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
      <PageHeader title={t('cannedTasks.title')} description={t('cannedTasks.desc')}>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('cannedTasks.add')}
        </Button>
      </PageHeader>

      {tasks.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="p-8 text-center text-muted-foreground">
            {t('cannedTasks.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task) => (
            <Card key={task.id} className="border-border/60">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{task.name}</p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(task)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(task)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {reminderBadge(task)}
                  {task.service_group && (
                    <Badge variant="outline" className="text-xs gap-1"><Package className="h-3 w-3" />{task.service_group}</Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {task.estimated_duration_minutes != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {task.estimated_duration_minutes} min
                    </span>
                  )}
                  {task.default_price != null && (
                    <span className="font-medium text-foreground">{formatCHF(task.default_price)}</span>
                  )}
                  {task.default_labor_hours != null && (
                    <span className="flex items-center gap-1">
                      <Wrench className="h-3 w-3" />
                      {task.default_labor_hours}h
                    </span>
                  )}
                  {task.reminder_type === 'interval' && task.interval_months != null && (
                    <span className="flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {task.interval_months} {t('cannedTasks.months')}
                    </span>
                  )}
                  {task.reminder_type === 'interval' && task.interval_km != null && (
                    <span className="flex items-center gap-1">
                      <Gauge className="h-3 w-3" />
                      {task.interval_km.toLocaleString('fr-CH')} km
                    </span>
                  )}
                  {task.reminder_type === 'seasonal' && task.seasonal_months.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Sun className="h-3 w-3" />
                      {task.seasonal_months.map((m) => t(MONTHS.find((mo) => mo.value === m)?.key ?? '')).join(', ')}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTask ? t('cannedTasks.edit') : t('cannedTasks.add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>{t('cannedTasks.name')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ph.taskLabel')} />
            </div>
            <div className="space-y-2">
              <Label>{t('cannedTasks.description')}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('ph.notes')} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>{t('cannedTasks.duration')}</Label>
                <Input type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder={t('ph.taskDuration')} />
              </div>
              <div className="space-y-2">
                <Label>{t('cannedTasks.price')}</Label>
                <Input type="number" step="0.05" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t('ph.taskPrice')} />
              </div>
              <div className="space-y-2">
                <Label>{t('cannedTasks.laborHours')}</Label>
                <Input type="number" step="0.25" min="0" value={laborHours} onChange={(e) => setLaborHours(e.target.value)} placeholder={t('ph.hours')} />
              </div>
            </div>

            {/* Reminder type selector */}
            <div className="space-y-2">
              <Label>{t('cannedTasks.reminderType')}</Label>
              <Select value={reminderType} onValueChange={(v) => setReminderType(v as ReminderType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('cannedTasks.type.none')}</SelectItem>
                  <SelectItem value="interval">{t('cannedTasks.type.interval')}</SelectItem>
                  <SelectItem value="seasonal">{t('cannedTasks.type.seasonal')}</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{t('cannedTasks.reminderTypeHint')}</p>
            </div>

            {/* Interval fields */}
            {reminderType === 'interval' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>{t('cannedTasks.intervalMonths')}</Label>
                    <Input type="number" min="1" value={intervalMonths} onChange={(e) => setIntervalMonths(e.target.value)} placeholder={t('ph.intervalMonths')} />
                  </div>
                  <div className="space-y-2">
                    <Label>{t('cannedTasks.intervalKm')}</Label>
                    <Input type="number" min="100" value={intervalKm} onChange={(e) => setIntervalKm(e.target.value)} placeholder={t('ph.intervalKm')} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{t('cannedTasks.intervalHint')}</p>
              </>
            )}

            {/* Seasonal month selector */}
            {reminderType === 'seasonal' && (
              <div className="space-y-2">
                <Label>{t('cannedTasks.seasonalMonths')}</Label>
                <div className="grid grid-cols-6 gap-2">
                  {MONTHS.map((m) => (
                    <Button
                      key={m.value}
                      type="button"
                      variant={seasonalMonths.includes(m.value) ? 'default' : 'outline'}
                      size="sm"
                      className="h-9 px-0 text-xs"
                      onClick={() => toggleSeasonalMonth(m.value)}
                    >
                      {t(m.key)}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{t('cannedTasks.seasonalHint')}</p>
              </div>
            )}

            {/* Service group */}
            <div className="space-y-2">
              <Label>{t('cannedTasks.serviceGroup')}</Label>
              <Input value={serviceGroup} onChange={(e) => setServiceGroup(e.target.value)} placeholder={t('cannedTasks.serviceGroupPlaceholder')} />
              <p className="text-xs text-muted-foreground">{t('cannedTasks.serviceGroupHint')}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingTask ? t('common.save') : t('cannedTasks.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
