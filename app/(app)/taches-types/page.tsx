'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ClipboardList,
  Plus,
  Pencil,
  Trash2,
  Clock,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';
import { formatCHF, type CannedTask } from '@/lib/types/database';

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
    setDialogOpen(true);
  }

  function openEdit(task: CannedTask) {
    setEditingTask(task);
    setName(task.name);
    setDescription(task.description ?? '');
    setDuration(task.estimated_duration_minutes?.toString() ?? '');
    setPrice(task.default_price?.toString() ?? '');
    setDialogOpen(true);
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
      const { error } = await supabase.from('canned_tasks').insert(payload);
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
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {task.estimated_duration_minutes != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {task.estimated_duration_minutes} min
                    </span>
                  )}
                  {task.default_price != null && (
                    <span className="font-medium text-foreground">{formatCHF(task.default_price)}</span>
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
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('cannedTasks.name')}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('cannedTasks.namePlaceholder')} />
            </div>
            <div className="space-y-2">
              <Label>{t('cannedTasks.description')}</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('cannedTasks.descriptionPlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('cannedTasks.duration')}</Label>
                <Input type="number" min="0" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>{t('cannedTasks.price')}</Label>
                <Input type="number" step="0.05" min="0" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" />
              </div>
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
