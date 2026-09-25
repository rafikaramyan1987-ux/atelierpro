'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCHF, type Part } from '@/lib/types/database';
import { Plus, Search, Pencil, Trash2, Package, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import { FieldHint } from '@/components/ui/field-hint';

export default function StockPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useI18n();

  const CATEGORIES = [t('stock.catEngine'), t('stock.catBrakes'), t('stock.catSuspension'), t('stock.catElectrical'), t('stock.catBodywork'), t('stock.catTires'), t('stock.catFluids'), t('stock.catTools'), t('stock.catOther')];

  const [form, setForm] = useState({
    reference: '',
    name: '',
    description: '',
    category: 'Pièces moteur',
    unit_price: '',
    stock_quantity: '',
    min_stock_threshold: '5',
    supplier: '',
    location: '',
  });

  const fetchParts = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('parts').select('*').order('name', { ascending: true });

    if (search) {
      query = query.or(`name.ilike.%${search}%,reference.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) {
      toast.error(t('stock.loadError'));
    } else {
      setParts(data as Part[]);
    }
    setLoading(false);
  }, [search]);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  function openCreate() {
    setEditingPart(null);
    setForm({
      reference: '',
      name: '',
      description: '',
      category: 'Pièces moteur',
      unit_price: '',
      stock_quantity: '',
      min_stock_threshold: '5',
      supplier: '',
      location: '',
    });
    setDialogOpen(true);
  }

  function openEdit(part: Part) {
    setEditingPart(part);
    setForm({
      reference: part.reference,
      name: part.name,
      description: part.description ?? '',
      category: part.category ?? 'Pièces moteur',
      unit_price: part.unit_price.toString(),
      stock_quantity: part.stock_quantity.toString(),
      min_stock_threshold: part.min_stock_threshold.toString(),
      supplier: part.supplier ?? '',
      location: part.location ?? '',
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      reference: form.reference,
      name: form.name,
      description: form.description || null,
      category: form.category,
      unit_price: parseFloat(form.unit_price) || 0,
      stock_quantity: parseInt(form.stock_quantity) || 0,
      min_stock_threshold: parseInt(form.min_stock_threshold) || 5,
      supplier: form.supplier || null,
      location: form.location || null,
    };

    if (editingPart) {
      const { error } = await supabase.from('parts').update(payload).eq('id', editingPart.id);
      if (error) {
        toast.error(t('stock.editError'), { description: error.message });
      } else {
        toast.success(t('stock.editSuccess'));
        setDialogOpen(false);
        fetchParts();
      }
    } else {
      const { error } = await supabase.from('parts').insert(payload);
      if (error) {
        toast.error(t('stock.addError'), { description: error.message });
      } else {
        toast.success(t('stock.addSuccess'));
        setDialogOpen(false);
        fetchParts();
      }
    }
    setSubmitting(false);
  }

  async function handleDelete(part: Part) {
    const { error } = await supabase.from('parts').delete().eq('id', part.id);
    if (error) {
      toast.error(t('stock.deleteError'));
    } else {
      toast.success(t('stock.deleteSuccess'));
      fetchParts();
    }
  }

  const filteredParts = parts.filter((p) => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    return true;
  });

  const totalValue = parts.reduce((sum, p) => sum + p.unit_price * p.stock_quantity, 0);
  const lowStockCount = parts.filter((p) => p.stock_quantity <= p.min_stock_threshold).length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('admin.stock.title')} description={t('admin.stock.desc')}>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('common.add')}
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('stock.partsInStock')}</p>
                <p className="text-xl font-bold">{parts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <span className="text-lg">₣</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('stock.totalValue')}</p>
                <p className="text-xl font-bold">{formatCHF(totalValue)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('stock.lowStock')}</p>
                <p className="text-xl font-bold">{lowStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('ph.partName')}
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48" placeholder={t('ph.select')}>
            <SelectValue placeholder={t('stock.category')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('stock.allCategories')}</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredParts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">{t('admin.stock.none')}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('stock.reference')}</TableHead>
                  <TableHead>{t('stock.name')}</TableHead>
                  <TableHead>{t('stock.category')}</TableHead>
                  <TableHead className="text-right">{t('stock.unitPrice')}</TableHead>
                  <TableHead className="text-center">{t('stock.stockCol')}</TableHead>
                  <TableHead className="text-center">{t('stock.minCol')}</TableHead>
                  <TableHead>{t('stock.supplier')}</TableHead>
                  <TableHead className="text-right">{t('team.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParts.map((part) => {
                  const isLowStock = part.stock_quantity <= part.min_stock_threshold;
                  return (
                    <TableRow key={part.id} className="hover:bg-secondary/50">
                      <TableCell className="font-mono text-xs">{part.reference}</TableCell>
                      <TableCell className="font-medium">{part.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{part.category ?? '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatCHF(part.unit_price)}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-semibold ${isLowStock ? 'text-warning' : ''}`}>
                          {part.stock_quantity}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{part.min_stock_threshold}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{part.supplier ?? '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(part)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{t('common.delete')}</DialogTitle>
                              </DialogHeader>
                              <p className="text-sm text-muted-foreground">
                                {t('stock.deleteConfirm', { name: part.name })}
                              </p>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => {}}>
                                  {t('common.cancel')}
                                </Button>
                                <Button variant="destructive" onClick={() => handleDelete(part)}>
                                  {t('common.delete')}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPart ? t('common.save') : t('common.add')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reference">{t('stock.refLabel')} *</Label>
                <Input
                  id="reference"
                  required
                  placeholder={t('ph.partRef')}
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{t('stock.nameLabel')} *</Label>
                <Input
                  id="name"
                  required
                  placeholder={t('ph.partName')}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{t('stock.description')}</Label>
              <Textarea
                id="description"
                placeholder={t('ph.notes')}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">{t('stock.category')}</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger id="category" placeholder={t('ph.select')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit_price">{t('stock.unitPriceChf')} *</Label>
                <Input
                  id="unit_price"
                  type="number"
                  step="0.05"
                  required
                  placeholder={t('ph.salePrice')}
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="stock_quantity">{t('stock.quantity')}</Label>
                <Input
                  id="stock_quantity"
                  type="number"
                  placeholder={t('ph.quantity')}
                  value={form.stock_quantity}
                  onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="min_stock_threshold">{t('stock.minThreshold')}</Label>
                <Input
                  id="min_stock_threshold"
                  type="number"
                  placeholder="5"
                  value={form.min_stock_threshold}
                  onChange={(e) => setForm({ ...form, min_stock_threshold: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">{t('stock.location')}</Label>
                <Input
                  id="location"
                  placeholder={t('ph.partName')}
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier">{t('stock.supplier')}</Label>
              <Input
                id="supplier"
                placeholder={t('ph.supplier')}
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {editingPart ? t('common.save') : t('common.add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
