'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  formatCHF,
  VAT_RATE,
  type Vehicle,
  type ServiceRequest,
  type DevisItem,
} from '@/lib/types/database';
import { FileSearch, Plus, Loader2, CheckCircle2, XCircle, Clock, FileText, Pen } from 'lucide-react';
import { toast } from 'sonner';
import { sendEmail, newDevisEmail } from '@/lib/email';
import { SignaturePad } from '@/components/signature-pad';

export default function ClientDevisPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [requests, setRequests] = useState<(ServiceRequest & { vehicle?: Vehicle; devis_items?: DevisItem[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [detailDevis, setDetailDevis] = useState<(ServiceRequest & { devis_items?: DevisItem[] }) | null>(null);

  const [form, setForm] = useState({
    vehicle_id: '',
    description: '',
  });

  const fetchData = useCallback(async () => {
    if (!profile?.client_id) return;
    setLoading(true);
    const [vRes, rRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('client_id', profile.client_id).order('created_at', { ascending: false }),
      supabase.from('service_requests').select('*, vehicle:vehicles(*), devis_items(*)').eq('client_id', profile.client_id).order('created_at', { ascending: false }),
    ]);
    setVehicles(vRes.data as Vehicle[] ?? []);
    setRequests(rRes.data as any ?? []);
    setLoading(false);
  }, [profile?.client_id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.client_id) return;
    if (!form.description.trim()) {
      toast.error(t('devis.descRequired'));
      return;
    }
    setSubmitting(true);

    const { error } = await supabase.from('service_requests').insert({
      client_id: profile.client_id,
      vehicle_id: form.vehicle_id || null,
      type: 'demande_devis',
      description: form.description,
    });

    if (error) {
      toast.error(t('toast.error'), { description: error.message });
    } else {
      toast.success(t('devis.toast.sent'), { description: t('devis.toast.sentDesc') });

      const { data: staffProfiles } = await supabase.from('profiles').select('email').in('role', ['admin', 'mecanicien']).eq('active', true);
      const vehicleLabel = vehicles.find((v) => v.id === form.vehicle_id);
      const email = newDevisEmail(profile?.full_name || 'Client', form.description, vehicleLabel ? `${vehicleLabel.brand} ${vehicleLabel.model} — ${vehicleLabel.license_plate}` : undefined);
      (staffProfiles as any[] ?? []).forEach((p) => { if (p.email) sendEmail(p.email, email.subject, email.html, email.text); });
      setDialogOpen(false);
      setForm({ vehicle_id: '', description: '' });
      fetchData();
    }
    setSubmitting(false);
  }

  async function handleAcceptDevis(reqId: string) {
    const { data: updatedData, error } = await supabase.from('service_requests').update({ status: 'devis_accepte' }).eq('id', reqId).select();
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
      return;
    }
    if (!updatedData || updatedData.length === 0) {
      toast.error(t('toast.error'), { description: 'Update failed (permission denied or record not found)' });
      return;
    }
    toast.success(t('devis.toast.accepted'), { description: t('devis.toast.acceptedDesc') });
    fetchData();
    setDetailDevis(null);
  }

  async function handleRefuseDevis(reqId: string) {
    const { data: updatedData, error } = await supabase.from('service_requests').update({ status: 'devis_refuse' }).eq('id', reqId).select();
    if (error) {
      toast.error(t('toast.error'), { description: error.message });
      return;
    }
    if (!updatedData || updatedData.length === 0) {
      toast.error(t('toast.error'), { description: 'Update failed (permission denied or record not found)' });
      return;
    }
    toast.success(t('devis.toast.refused'));
    fetchData();
    setDetailDevis(null);
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusConfig: Record<string, { icon: any; color: string; bg: string }> = {
    en_attente: { icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
    devis_recu: { icon: FileText, color: 'text-primary', bg: 'bg-primary/10' },
    devis_accepte: { icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
    devis_refuse: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10' },
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('devis.title')} description={t('devis.desc')}>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          {t('devis.new')}
        </Button>
      </PageHeader>

      {requests.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileSearch className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">{t('devis.none')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const sc = statusConfig[req.status] ?? statusConfig.en_attente;
            const StatusIcon = sc.icon;
            const items = req.devis_items ?? [];
            const itemsSubtotal = items.reduce((sum, it) => sum + Number(it.line_total), 0);
            const itemsVat = Math.round(itemsSubtotal * VAT_RATE) / 100;
            const itemsTotal = itemsSubtotal + itemsVat;

            return (
              <Card key={req.id} className="border-border/60 hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${sc.bg} shrink-0`}>
                        <StatusIcon className={`h-5 w-5 ${sc.color}`} />
                      </div>
                      <div className="flex-1">
                        {req.vehicle && (
                          <p className="text-sm text-muted-foreground">{req.vehicle.brand} {req.vehicle.model} — {req.vehicle.license_plate}</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1 max-w-md">{req.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(req.created_at).toLocaleDateString('fr-CH')}</p>

                        {req.status === 'devis_recu' && items.length > 0 && (
                          <div className="mt-3 rounded-lg border border-border/60 bg-secondary/30 p-3">
                            <p className="text-xs font-medium text-foreground mb-2">{t('devis.quoteFromGarage')}</p>
                            <div className="space-y-1">
                              {items.map((it) => (
                                <div key={it.id} className="flex justify-between text-xs">
                                  <span>{it.description} (x{it.quantity})</span>
                                  <span className="font-medium">{formatCHF(Number(it.line_total))}</span>
                                </div>
                              ))}
                            </div>
                            <Separator className="my-2" />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{t('invoices.subtotal')}</span>
                              <span>{formatCHF(itemsSubtotal)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>{t('invoices.vat')} ({VAT_RATE}%)</span>
                              <span>{formatCHF(itemsVat)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold mt-1">
                              <span>{t('invoices.total')}</span>
                              <span className="text-primary">{formatCHF(itemsTotal)}</span>
                            </div>
                            {req.garage_response && (
                              <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/40">
                                {t('devis.garageNote')} {req.garage_response}
                              </p>
                            )}
                          </div>
                        )}

                        {req.status === 'devis_refuse' && req.garage_response && (
                          <div className="mt-2 rounded-md bg-destructive/5 p-2 text-xs">
                            <span className="font-medium">{t('devis.refused')}: </span>{req.garage_response}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge
                        variant={req.status === 'devis_accepte' ? 'default' : req.status === 'devis_refuse' ? 'destructive' : req.status === 'devis_recu' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {req.status === 'devis_accepte' ? t('devis.status.accepted') : req.status === 'devis_refuse' ? t('devis.status.refused') : req.status === 'devis_recu' ? t('devis.status.received') : t('devis.status.pending')}
                      </Badge>
                      {req.status === 'devis_recu' && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="hover:text-destructive" onClick={() => handleRefuseDevis(req.id)}>
                            <XCircle className="h-3.5 w-3.5 mr-1" /> {t('devis.refuse')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setDetailDevis(req)}>
                            <Pen className="h-3.5 w-3.5 mr-1" /> {t('sig.title')}
                          </Button>
                          <Button size="sm" onClick={() => handleAcceptDevis(req.id)}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> {t('devis.accept')}
                          </Button>
                        </div>
                      )}
                      {req.status === 'devis_accepte' && req.signature_data && (
                        <Badge variant="outline" className="text-xs text-success border-success/30">
                          <CheckCircle2 className="h-3 w-3 mr-1" /> {t('sig.signed')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Signature dialog */}
      <Dialog open={!!detailDevis && detailDevis?.status === 'devis_recu'} onOpenChange={(v) => !v && setDetailDevis(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('sig.title')}</DialogTitle>
          </DialogHeader>
          {detailDevis && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">{t('sig.confirmDesc')}</p>
              {detailDevis.devis_items && detailDevis.devis_items.length > 0 && (
                <div className="rounded-lg border border-border/60 p-3 space-y-1">
                  {detailDevis.devis_items.map((it) => (
                    <div key={it.id} className="flex justify-between text-sm">
                      <span>{it.description} ×{it.quantity}</span>
                      <span className="font-medium">{formatCHF(Number(it.line_total))}</span>
                    </div>
                  ))}
                </div>
              )}
              <SignaturePad
                onSave={async (dataUrl) => {
                  const { data: sigData, error } = await supabase.from('service_requests').update({
                    signature_data: dataUrl,
                    signature_date: new Date().toISOString(),
                    status: 'devis_accepte',
                  }).eq('id', detailDevis.id).select();
                  if (error) { toast.error(t('toast.error'), { description: error.message }); return; }
                  if (!sigData || sigData.length === 0) { toast.error(t('toast.error'), { description: 'Update failed (permission denied)' }); return; }
                  toast.success(t('sig.saved'), { description: t('sig.savedDesc') });
                  toast.success(t('devis.toast.accepted'), { description: t('devis.toast.acceptedDesc') });
                  setDetailDevis(null);
                  fetchData();
                }}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('devis.new')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="devis-vehicle">{t('devis.vehicle')}</Label>
              <Select value={form.vehicle_id || 'none'} onValueChange={(v) => setForm({ ...form, vehicle_id: v === 'none' ? '' : v })}>
                <SelectTrigger id="devis-vehicle">
                  <SelectValue placeholder={t('devis.vehicle')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('devis.noVehicle')}</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} — {v.license_plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="devis-desc">{t('devis.description')} *</Label>
              <Textarea
                id="devis-desc"
                required
                placeholder={t('devis.descPlaceholder')}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={5}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t('devis.send')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
