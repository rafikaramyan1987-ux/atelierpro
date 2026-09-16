'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
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
  SERVICE_TYPES,
  TIME_SLOTS,
  type Vehicle,
  type Appointment,
  type GarageReview,
} from '@/lib/types/database';
import { CalendarClock, Plus, Loader2, CheckCircle2, XCircle, Clock, Star, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { sendEmail, newAppointmentEmail } from '@/lib/email';

export default function ClientRendezVousPage() {
  const { profile } = useAuth();
  const { t } = useI18n();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [appointments, setAppointments] = useState<(Appointment & { vehicle?: Vehicle })[]>([]);
  const [reviews, setReviews] = useState<Record<string, GarageReview>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Review dialog state
  const [reviewDialogAppt, setReviewDialogAppt] = useState<Appointment | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);

  const [form, setForm] = useState({
    vehicle_id: '',
    requested_date: '',
    requested_time: '09:00',
    service_type: 'Vidange',
    description: '',
  });

  useEffect(() => {
    if (!profile?.client_id) return;
    fetchData();
  }, [profile]);

  async function fetchData() {
    setLoading(true);
    const [vRes, aRes] = await Promise.all([
      supabase.from('vehicles').select('*').eq('client_id', profile!.client_id).order('created_at', { ascending: false }),
      supabase.from('appointments').select('*, vehicle:vehicles(*)').eq('client_id', profile!.client_id).order('created_at', { ascending: false }),
    ]);
    setVehicles(vRes.data as Vehicle[] ?? []);
    const appts = (aRes.data as any) ?? [];
    setAppointments(appts);

    // Fetch reviews for completed appointments
    if (appts.length > 0) {
      const apptIds = appts.map((a: Appointment) => a.id);
      const { data: reviewData } = await supabase
        .from('garage_reviews')
        .select('*')
        .in('appointment_id', apptIds);
      const reviewMap: Record<string, GarageReview> = {};
      (reviewData as GarageReview[] ?? []).forEach((r) => {
        if (r.appointment_id) reviewMap[r.appointment_id] = r;
      });
      setReviews(reviewMap);
    }

    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile?.client_id) return;
    setSubmitting(true);

    const { error } = await supabase.from('appointments').insert({
      client_id: profile.client_id,
      vehicle_id: form.vehicle_id || null,
      requested_date: form.requested_date,
      requested_time: form.requested_time,
      service_type: form.service_type,
      description: form.description || null,
    });

    if (error) {
      toast.error(t('toast.bookingError'), { description: error.message });
    } else {
      toast.success(t('toast.apptRequested'), { description: t('toast.apptRequestedDesc') });

      const { data: staffProfiles } = await supabase.from('profiles').select('email').in('role', ['admin', 'mecanicien']).eq('active', true);
      const vehicleLabel = vehicles.find((v) => v.id === form.vehicle_id);
      const email = newAppointmentEmail(profile?.full_name || 'Client', form.service_type, form.requested_date, form.requested_time, vehicleLabel ? `${vehicleLabel.brand} ${vehicleLabel.model} — ${vehicleLabel.license_plate}` : undefined);
      (staffProfiles as any[] ?? []).forEach((p) => { if (p.email) sendEmail(p.email, email.subject, email.html, email.text); });
      setDialogOpen(false);
      setForm({ vehicle_id: '', requested_date: '', requested_time: '09:00', service_type: 'Vidange', description: '' });
      fetchData();
    }
    setSubmitting(false);
  }

  async function cancelAppointment(appt: Appointment) {
    const { error } = await supabase.from('appointments').update({ status: 'annule' }).eq('id', appt.id);
    if (error) {
      toast.error(t('toast.error'));
    } else {
      toast.success(t('toast.apptCancelled'));
      fetchData();
    }
  }

  function openReviewDialog(appt: Appointment) {
    const existing = reviews[appt.id];
    setReviewDialogAppt(appt);
    setReviewRating(existing ? existing.rating : 5);
    setReviewComment(existing?.comment ?? '');
  }

  async function submitReview() {
    if (!reviewDialogAppt || !profile?.client_id) return;
    setReviewSubmitting(true);

    const existing = reviews[reviewDialogAppt.id];
    const reviewerName = profile.full_name || 'Client';

    if (existing) {
      const { error } = await supabase
        .from('garage_reviews')
        .update({ rating: reviewRating, comment: reviewComment || null })
        .eq('id', existing.id);
      if (error) {
        toast.error(t('review.toast.error'), { description: error.message });
      } else {
        toast.success(t('review.toast.updated'));
        setReviews({ ...reviews, [reviewDialogAppt.id]: { ...existing, rating: reviewRating, comment: reviewComment || null } });
        setReviewDialogAppt(null);
      }
    } else {
      const { data, error } = await supabase
        .from('garage_reviews')
        .insert({
          garage_id: reviewDialogAppt.garage_id,
          client_id: profile.client_id,
          appointment_id: reviewDialogAppt.id,
          rating: reviewRating,
          comment: reviewComment || null,
          reviewer_name: reviewerName,
        })
        .select()
        .single();

      if (error) {
        toast.error(t('review.toast.error'), { description: error.message });
      } else {
        toast.success(t('review.toast.published'), { description: t('review.toast.publishedDesc') });
        setReviews({ ...reviews, [reviewDialogAppt.id]: data as GarageReview });
        setReviewDialogAppt(null);
      }
    }
    setReviewSubmitting(false);
  }

  async function deleteReview(apptId: string) {
    const existing = reviews[apptId];
    if (!existing) return;
    const { error } = await supabase.from('garage_reviews').delete().eq('id', existing.id);
    if (error) {
      toast.error(t('review.toast.error'), { description: error.message });
    } else {
      toast.success(t('review.toast.deleted'));
      const newReviews = { ...reviews };
      delete newReviews[apptId];
      setReviews(newReviews);
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const statusConfig: Record<string, { icon: any; color: string }> = {
    en_attente: { icon: Clock, color: 'text-warning' },
    confirme: { icon: CheckCircle2, color: 'text-success' },
    refuse: { icon: XCircle, color: 'text-destructive' },
    termine: { icon: CheckCircle2, color: 'text-muted-foreground' },
    annule: { icon: XCircle, color: 'text-muted-foreground' },
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('appts.title')} description={t('appts.desc')}>
        <Button onClick={() => setDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4 mr-2" />
          {t('appts.requestAppt')}
        </Button>
      </PageHeader>

      {appointments.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CalendarClock className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">{t('appts.noAppts')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((appt) => {
            const StatusIcon = statusConfig[appt.status]?.icon ?? Clock;
            const hasReview = !!reviews[appt.id];
            const review = reviews[appt.id];
            return (
              <Card key={appt.id} className="border-border/60 hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                        <StatusIcon className={`h-5 w-5 ${statusConfig[appt.status]?.color ?? 'text-muted-foreground'}`} />
                      </div>
                      <div>
                        <p className="font-medium">{appt.service_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {appt.vehicle ? `${appt.vehicle.brand} ${appt.vehicle.model} — ${appt.vehicle.license_plate}` : t('garages.noVehicle')}
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{t('clientAppt.requested')} {new Date(appt.requested_date).toLocaleDateString('fr-CH')} {t('clientAppt.at')} {appt.requested_time}</span>
                          {appt.scheduled_date && (
                            <span className="text-success font-medium">
                              {t('clientAppt.confirmed')} {new Date(appt.scheduled_date).toLocaleDateString('fr-CH')} {t('clientAppt.at')} {appt.scheduled_time}
                            </span>
                          )}
                        </div>
                        {appt.description && (
                          <p className="text-sm text-muted-foreground mt-2 max-w-md">{appt.description}</p>
                        )}
                        {appt.garage_notes && (
                          <div className="mt-2 rounded-md bg-secondary/50 p-2 text-xs">
                            <span className="font-medium">{t('clientAppt.garageNote')} </span>
                            {appt.garage_notes}
                          </div>
                        )}
                        {hasReview && (
                          <div className="mt-3 rounded-lg border border-border/40 bg-secondary/20 p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={cn(
                                      'h-3.5 w-3.5',
                                      i < review.rating ? 'fill-amber-400 text-amber-400' : 'fill-muted text-muted-foreground/30'
                                    )}
                                  />
                                ))}
                              </div>
                              <span className="text-xs font-medium">{t('review.yourReview')}</span>
                            </div>
                            {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge
                        variant={appt.status === 'confirme' ? 'default' : appt.status === 'refuse' || appt.status === 'annule' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {appt.status === 'confirme' ? t('appts.status.confirmed') : appt.status === 'refuse' ? t('appts.status.refused') : appt.status === 'termine' ? t('appts.status.completed') : appt.status === 'annule' ? t('appts.status.cancelled') : t('appts.status.pending')}
                      </Badge>
                      {(appt.status === 'en_attente' || appt.status === 'confirme') && (
                        <Button variant="ghost" size="sm" className="text-xs hover:text-destructive" onClick={() => cancelAppointment(appt)}>
                          {t('common.cancel')}
                        </Button>
                      )}
                      {appt.status === 'termine' && (
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => openReviewDialog(appt)}
                          >
                            {hasReview ? (
                              <>
                                <MessageSquare className="h-3.5 w-3.5 mr-1" />
                                {t('review.edit')}
                              </>
                            ) : (
                              <>
                                <Star className="h-3.5 w-3.5 mr-1" />
                                {t('review.leaveReview')}
                              </>
                            )}
                          </Button>
                          {hasReview && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs hover:text-destructive"
                              onClick={() => deleteReview(appt.id)}
                            >
                              {t('review.delete')}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Booking dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('appts.requestAppt')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appt-vehicle">{t('garages.vehicle')}</Label>
              <Select value={form.vehicle_id || 'none'} onValueChange={(v) => setForm({ ...form, vehicle_id: v === 'none' ? '' : v })}>
                <SelectTrigger id="appt-vehicle">
                  <SelectValue placeholder={t('garages.vehicle')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('garages.noVehicle')}</SelectItem>
                  {vehicles.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.brand} {v.model} — {v.license_plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {vehicles.length === 0 && (
                <p className="text-xs text-muted-foreground">{t('clientAppt.addVehicleHint')}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="appt-date">{t('appts.date')} *</Label>
                <Input id="appt-date" type="date" required min={new Date().toISOString().split('T')[0]} value={form.requested_date} onChange={(e) => setForm({ ...form, requested_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appt-time">{t('clientAppt.desiredSlot')}</Label>
                <Select value={form.requested_time} onValueChange={(v) => setForm({ ...form, requested_time: v })}>
                  <SelectTrigger id="appt-time">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_SLOTS.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appt-service">{t('appts.service')}</Label>
              <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
                <SelectTrigger id="appt-service">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appt-desc">{t('appts.description')}</Label>
              <Textarea id="appt-desc" placeholder={t('appts.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {t('appts.requestAppt')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Review dialog */}
      <Dialog open={!!reviewDialogAppt} onOpenChange={(open) => { if (!open) setReviewDialogAppt(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('review.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{t('review.desc')}</p>
            <div className="space-y-2">
              <Label>{t('review.rating')}</Label>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const value = i + 1;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setReviewRating(value)}
                      onMouseEnter={() => setHoverRating(value)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="p-1"
                    >
                      <Star
                        className={cn(
                          'h-8 w-8 transition-colors',
                          value <= (hoverRating || reviewRating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-muted text-muted-foreground/30'
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-comment">{t('review.comment')}</Label>
              <Textarea
                id="review-comment"
                placeholder={t('review.commentPlaceholder')}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReviewDialogAppt(null)}>{t('common.cancel')}</Button>
            <Button
              type="button"
              disabled={reviewSubmitting}
              onClick={submitReview}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {reviewSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Star className="h-4 w-4 mr-2" />}
              {reviewSubmitting ? t('review.submitting') : t('review.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
