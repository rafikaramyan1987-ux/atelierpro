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
import { type Client, type Vehicle } from '@/lib/types/database';
import { Plus, Search, Pencil, Trash2, Users, Car, Loader2, Mail, Phone, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/auth-context';

export default function ClientsPage() {
  const [clients, setClients] = useState<(Client & { vehicles?: Vehicle[]; invoice_count?: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const { t } = useI18n();
  const { profile } = useAuth();

  const [form, setForm] = useState({
    company_name: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postal_code: '',
    notes: '',
  });

  const [vehicleForm, setVehicleForm] = useState({
    brand: '',
    model: '',
    license_plate: '',
    vin: '',
    year: '',
    mileage: '',
    notes: '',
  });

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*, vehicles(*)')
      .order('last_name', { ascending: true });

    if (error) {
      toast.error('Erreur lors du chargement des clients');
    } else {
      // Also get invoice counts
      const clientsWithCounts = await Promise.all(
        (data as any[]).map(async (c) => {
          const { count } = await supabase
            .from('invoices')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', c.id);
          return { ...c, invoice_count: count ?? 0 };
        })
      );
      setClients(clientsWithCounts);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  function openCreate() {
    setEditingClient(null);
    setForm({
      company_name: '', first_name: '', last_name: '', email: '', phone: '',
      address: '', city: '', postal_code: '', notes: '',
    });
    setDialogOpen(true);
  }

  function openEdit(client: Client) {
    setEditingClient(client);
    setForm({
      company_name: client.company_name ?? '',
      first_name: client.first_name,
      last_name: client.last_name,
      email: client.email ?? '',
      phone: client.phone,
      address: client.address ?? '',
      city: client.city ?? '',
      postal_code: client.postal_code ?? '',
      notes: client.notes ?? '',
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      company_name: form.company_name || null,
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email || null,
      phone: form.phone,
      address: form.address || null,
      city: form.city || null,
      postal_code: form.postal_code || null,
      notes: form.notes || null,
    };

    if (editingClient) {
      const { error } = await supabase.from('clients').update(payload).eq('id', editingClient.id);
      // garage_id intentionally not updated on edit
      if (error) {
        toast.error('Erreur lors de la modification', { description: error.message });
      } else {
        toast.success('Client modifié');
        setDialogOpen(false);
        fetchClients();
      }
    } else {
      const { error } = await supabase.from('clients').insert({ ...payload, garage_id: profile?.garage_id ?? null });
      if (error) {
        toast.error('Erreur lors de l\'ajout', { description: error.message });
      } else {
        toast.success('Client ajouté');
        setDialogOpen(false);
        fetchClients();
      }
    }
    setSubmitting(false);
  }

  async function handleDelete(client: Client) {
    const { error } = await supabase.from('clients').delete().eq('id', client.id);
    if (error) {
      toast.error('Erreur lors de la suppression', { description: error.message });
    } else {
      toast.success('Client supprimé');
      fetchClients();
    }
  }

  function openVehicleDialog(client: Client) {
    setSelectedClient(client);
    setVehicleForm({
      brand: '', model: '', license_plate: '', vin: '', year: '', mileage: '', notes: '',
    });
    setVehicleDialogOpen(true);
  }

  async function handleAddVehicle(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient) return;
    setSubmitting(true);

    const { error } = await supabase.from('vehicles').insert({
      client_id: selectedClient.id,
      garage_id: profile?.garage_id ?? null,
      brand: vehicleForm.brand,
      model: vehicleForm.model,
      license_plate: vehicleForm.license_plate,
      vin: vehicleForm.vin || null,
      year: vehicleForm.year ? parseInt(vehicleForm.year) : null,
      mileage: vehicleForm.mileage ? parseInt(vehicleForm.mileage) : null,
      notes: vehicleForm.notes || null,
    });

    if (error) {
      toast.error('Erreur lors de l\'ajout du véhicule', { description: error.message });
    } else {
      toast.success('Véhicule ajouté');
      setVehicleDialogOpen(false);
      fetchClients();
    }
    setSubmitting(false);
  }

  async function handleDeleteVehicle(vehicle: Vehicle) {
    const { error } = await supabase.from('vehicles').delete().eq('id', vehicle.id);
    if (error) {
      toast.error('Erreur');
    } else {
      toast.success('Véhicule supprimé');
      fetchClients();
    }
  }

  const filteredClients = clients.filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.first_name.toLowerCase().includes(s) ||
      c.last_name.toLowerCase().includes(s) ||
      (c.company_name ?? '').toLowerCase().includes(s) ||
      c.phone.includes(s) ||
      (c.email ?? '').toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('admin.clients.title')} description={t('admin.clients.desc')}>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t('common.add')}
        </Button>
      </PageHeader>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('common.search')}
          className="pl-10"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Clients grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">{t('admin.clients.none')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <Card key={client.id} className="border-border/60 hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-semibold">
                      {client.first_name[0]}{client.last_name[0]}
                    </div>
                    <div>
                      <p className="font-medium">
                        {client.company_name
                          ? client.company_name
                          : `${client.first_name} ${client.last_name}`}
                      </p>
                      {client.company_name && (
                        <p className="text-xs text-muted-foreground">{client.first_name} {client.last_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(client)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>{t('common.delete')}</DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-muted-foreground">
                          {t('clients.deleteConfirm', { name: `${client.first_name} ${client.last_name}` })}
                        </p>
                        <DialogFooter>
                          <Button variant="outline">{t('common.cancel')}</Button>
                          <Button variant="destructive" onClick={() => handleDelete(client)}>{t('common.delete')}</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {client.phone}
                  </div>
                  {client.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3.5 w-3.5" /> {client.email}
                    </div>
                  )}
                  {(client.address || client.city) && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      {client.postal_code} {client.city}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t('clients.vehicles')} ({client.vehicles?.length ?? 0})
                    </span>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openVehicleDialog(client)}>
                      <Plus className="h-3 w-3 mr-1" /> {t('common.add')}
                    </Button>
                  </div>
                  {client.vehicles && client.vehicles.length > 0 ? (
                    <div className="space-y-1.5">
                      {client.vehicles.map((v) => (
                        <div key={v.id} className="flex items-center justify-between rounded-md bg-secondary/50 px-2.5 py-1.5">
                          <div className="flex items-center gap-2 text-sm">
                            <Car className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{v.brand} {v.model}</span>
                            <Badge variant="outline" className="text-[10px]">{v.license_plate}</Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:text-destructive"
                            onClick={() => handleDeleteVehicle(v)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('clients.noVehicles')}</p>
                  )}
                </div>

                {client.invoice_count !== undefined && client.invoice_count > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <Badge variant="secondary" className="text-xs">
                      {client.invoice_count} {client.invoice_count > 1 ? t('clients.invoicesPlural') : t('clients.invoices')}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Client dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingClient ? t('common.save') : t('common.add')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c-first">{t('clients.firstName')} *</Label>
                <Input id="c-first" required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-last">{t('clients.lastName')} *</Label>
                <Input id="c-last" required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-company">{t('clients.company')} ({t('common.optional')})</Label>
              <Input id="c-company" placeholder="Garage Dupont SA" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c-phone">{t('login.phone')} *</Label>
                <Input id="c-phone" required placeholder="+41 79 555 12 34" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-email">{t('team.email')}</Label>
                <Input id="c-email" type="email" placeholder="client@email.ch" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-address">{t('clients.address')}</Label>
              <Input id="c-address" placeholder="Rue du Rhône 12" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="c-postal">{t('clients.postalCode')}</Label>
                <Input id="c-postal" placeholder="1200" value={form.postal_code} onChange={(e) => setForm({ ...form, postal_code: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="c-city">{t('clients.city')}</Label>
                <Input id="c-city" placeholder="Genève" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-notes">{t('clients.notes')}</Label>
              <Textarea id="c-notes" placeholder="Notes sur le client..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {editingClient ? t('common.save') : t('common.add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Vehicle dialog */}
      <Dialog open={vehicleDialogOpen} onOpenChange={setVehicleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('clients.addVehicleTitle', { name: `${selectedClient?.first_name} ${selectedClient?.last_name}` })}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddVehicle} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="v-brand">{t('clients.brand')} *</Label>
                <Input id="v-brand" required placeholder="Volkswagen" value={vehicleForm.brand} onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-model">{t('clients.model')} *</Label>
                <Input id="v-model" required placeholder="Golf 8" value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="v-plate">{t('clients.plate')} *</Label>
                <Input id="v-plate" required placeholder="VD 123456" value={vehicleForm.license_plate} onChange={(e) => setVehicleForm({ ...vehicleForm, license_plate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-vin">VIN</Label>
                <Input id="v-vin" placeholder="WVWZZZ..." value={vehicleForm.vin} onChange={(e) => setVehicleForm({ ...vehicleForm, vin: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="v-year">{t('clients.year')}</Label>
                <Input id="v-year" type="number" placeholder="2023" value={vehicleForm.year} onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="v-mileage">{t('clients.mileage')}</Label>
                <Input id="v-mileage" type="number" placeholder="45000" value={vehicleForm.mileage} onChange={(e) => setVehicleForm({ ...vehicleForm, mileage: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-notes">{t('clients.notes')}</Label>
              <Textarea id="v-notes" placeholder="Notes sur le véhicule..." value={vehicleForm.notes} onChange={(e) => setVehicleForm({ ...vehicleForm, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setVehicleDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t('common.add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
