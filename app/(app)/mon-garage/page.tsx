'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { type Garage, SERVICE_TYPES } from '@/lib/types/database';
import { Wrench, Save, Loader2, MapPin, Phone, Mail, Star, CheckCircle2, Store, Snowflake, Eye, AlertCircle, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { FieldHint } from '@/components/ui/field-hint';

const SERVICE_KEY: Record<string, string> = {
  'Vidange': 'service.vidange', 'Freinage': 'service.freinage', 'Pneus': 'service.pneus',
  'Diagnostic': 'service.diagnostic', 'Révision générale': 'service.revision',
  'Suspension': 'service.suspension', 'Électricité': 'service.electricite',
  'Carrosserie': 'service.carrosserie', 'Autre': 'service.autre',
};

export default function MonGaragePage() {
  const { profile, createGarageAsAdmin } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  const [garage, setGarage] = useState<Garage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [gardiennageEnabled, setGardiennageEnabled] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [iban, setIban] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [hourlyRate, setHourlyRate] = useState('120');
  const [ibanError, setIbanError] = useState('');
  const [seedingTasks, setSeedingTasks] = useState(false);

  useEffect(() => {
    async function fetchGarage() {
      if (!profile?.garage_id) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('garages')
        .select('*')
        .eq('id', profile.garage_id)
        .maybeSingle();
      if (data) {
        setGarage(data as Garage);
        setName(data.name || '');
        setDescription(data.description || '');
        setAddress(data.address || '');
        setCity(data.city || '');
        setPostalCode(data.postal_code || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setLogoUrl(data.logo_url || '');
        setServices(data.services_offered || []);
        setGardiennageEnabled((data as any).gardiennage_enabled ?? false);
        setIsPublished((data as any).is_published ?? false);
        setIban((data as any).iban ?? '');
        setVatNumber((data as any).vat_number ?? '');
        setHourlyRate(String((data as any).hourly_rate ?? 120));
        if (!data.address || !data.city) {
          setJustCreated(true);
        }
      }
      setLoading(false);
    }
    fetchGarage();
  }, [profile]);

  function toggleService(service: string) {
    setServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  }

  function normalizeIban(value: string): string {
    return value.replace(/\s/g, '').toUpperCase();
  }

  function validateIban(value: string): boolean {
    const cleaned = normalizeIban(value);
    if (!cleaned) return true;
    if (!/^(CH|LI)/.test(cleaned)) return false;
    if (cleaned.length !== 21) return false;
    return true;
  }

  async function handleSave() {
    if (!garage) return;
    const normalizedIban = normalizeIban(iban);
    if (normalizedIban && !validateIban(normalizedIban)) {
      setIbanError(t('garageProfile.ibanError'));
      return;
    }
    setIbanError('');
    setSaving(true);
    const { error } = await supabase
      .from('garages')
      .update({
        name,
        description: description || null,
        address,
        city,
        postal_code: postalCode,
        phone,
        email: email || null,
        logo_url: logoUrl || null,
        services_offered: services,
        gardiennage_enabled: gardiennageEnabled,
        is_published: isPublished,
        iban: normalizedIban || null,
        vat_number: vatNumber || null,
        hourly_rate: parseFloat(hourlyRate) || 120,
      })
      .eq('id', garage.id);

    if (error) {
      toast.error(t('garageProfile.toast.error'), { description: error.message });
    } else {
      toast.success(t('garageProfile.toast.saved'));
      setGarage({ ...garage, name, description, address, city, postal_code: postalCode, phone, email, logo_url: logoUrl, services_offered: services, gardiennage_enabled: gardiennageEnabled, is_published: isPublished, iban: normalizeIban(iban) || null, vat_number: vatNumber || null, hourly_rate: parseFloat(hourlyRate) || 120 } as Garage);
      if (justCreated) {
        setJustCreated(false);
        router.push('/dashboard');
      }
    }
    setSaving(false);
  }

  async function handleCreate() {
    setCreating(true);
    const { error, garageId } = await createGarageAsAdmin(
      profile?.full_name ? `Garage ${profile.full_name}` : 'Mon garage',
      profile?.phone || '',
      profile?.email || '',
    );

    if (error || !garageId) {
      toast.error(t('garageProfile.toast.error'), { description: error ?? 'Unknown error' });
      setCreating(false);
      return;
    }

    setJustCreated(true);

    const { data: garageData } = await supabase
      .from('garages')
      .select('*')
      .eq('id', garageId)
      .single();

    setGarage(garageData as Garage);
    setName(garageData?.name ?? '');
    setPhone(garageData?.phone ?? '');
    setEmail(garageData?.email ?? '');
    setCreating(false);
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!garage) {
    return (
      <div className="p-6 space-y-6">
        <PageHeader title={t('garageProfile.title')} description={t('garageProfile.desc')} />
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Store className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-sm text-muted-foreground mb-2 max-w-md">{t('garageProfile.createDesc')}</p>
            <Button onClick={handleCreate} disabled={creating} className="mt-4">
              {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Store className="h-4 w-4 mr-2" />}
              {t('garageProfile.createGarage')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('garageProfile.title')} description={t('garageProfile.desc')} />

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/60">
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('garageProfile.name')} *</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ph.garageName')} />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('garageProfile.description')}</label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('ph.garageDescription')}
                  rows={4}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('garageProfile.address')}</label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('ph.garageAddress')} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('garageProfile.postalCode')}</label>
                  <Input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder={t('ph.garagePostalCode')} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('garageProfile.city')}</label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('ph.garageCity')} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('garageProfile.phone')}</label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('ph.garagePhone')} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('garageProfile.email')}</label>
                  <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('ph.garageEmail')} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('garageProfile.logoUrl')}</label>
                  <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder={t('garageProfile.logoPlaceholder')} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('garageProfile.iban')}</label>
                  <Input
                    value={iban}
                    onChange={(e) => {
                      setIban(e.target.value);
                      if (ibanError) setIbanError('');
                    }}
                    placeholder={t('ph.garageIban')}
                    className={ibanError ? 'border-destructive' : ''}
                  />
                  {ibanError && <p className="text-xs text-destructive">{ibanError}</p>}
                  <FieldHint>{t('hint.iban')}</FieldHint>
                  <div className="flex items-start gap-2 rounded-lg bg-warning/5 border border-warning/20 p-3 text-sm">
                    <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-muted-foreground">{t('garageProfile.ibanWarning')}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('garageProfile.vatNumber')}</label>
                  <Input value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder={t('ph.garageVat')} />
                  <FieldHint>{t('hint.vatNumber')}</FieldHint>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('garageProfile.hourlyRate')}</label>
                  <Input type="number" min="0" step="0.5" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder={t('ph.garageHourlyRate')} />
                  <FieldHint>{t('hint.hourlyRate')}</FieldHint>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Sparkles className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t('garageProfile.seedTasks')}</p>
                    <p className="text-xs text-muted-foreground">{t('garageProfile.seedTasksHint')}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={async () => {
                  setSeedingTasks(true);
                  const { data, error } = await supabase.rpc('seed_default_canned_tasks', { p_garage_id: garage.id });
                  if (error) {
                    toast.error(t('toast.error'), { description: error.message });
                  } else {
                    toast.success(t('garageProfile.seedTasksDone'), { description: `${data} ${t('garageProfile.tasksAdded')}` });
                  }
                  setSeedingTasks(false);
                }} disabled={seedingTasks}>
                  {seedingTasks ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  {t('garageProfile.seedTasksBtn')}
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('garageProfile.services')}</label>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_TYPES.filter((s) => s !== 'Autre').map((service) => (
                    <button
                      key={service}
                      type="button"
                      onClick={() => toggleService(service)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                        services.includes(service)
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-secondary text-muted-foreground hover:bg-secondary/80'
                      )}
                    >
                      {SERVICE_KEY[service] ? t(SERVICE_KEY[service]) : service}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gardiennage toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning/10">
                    <Snowflake className="h-4.5 w-4.5 text-warning" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t('garageProfile.gardiennage')}</p>
                    <p className="text-xs text-muted-foreground">{t('garageProfile.gardiennageHint')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={gardiennageEnabled}
                  onClick={() => setGardiennageEnabled(!gardiennageEnabled)}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    gardiennageEnabled ? 'bg-primary' : 'bg-muted'
                  )}
                >
                  <span className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    gardiennageEnabled ? 'translate-x-6' : 'translate-x-1'
                  )} />
                </button>
              </div>

              {/* Publication toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Eye className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t('garageProfile.published')}</p>
                    <p className="text-xs text-muted-foreground">{t('garageProfile.publishedHint')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isPublished}
                  disabled={!address || !city}
                  onClick={() => {
                    if (!address || !city) return;
                    setIsPublished(!isPublished);
                  }}
                  className={cn(
                    'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                    isPublished ? 'bg-primary' : 'bg-muted',
                    (!address || !city) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                    isPublished ? 'translate-x-6' : 'translate-x-1'
                  )} />
                </button>
              </div>
              {(!address || !city) && (
                <div className="flex items-start gap-2 rounded-lg bg-warning/5 border border-warning/20 p-3 text-sm">
                  <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <p className="text-muted-foreground">{t('garageProfile.publishedWarning')}</p>
                </div>
              )}

              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {saving ? t('garageProfile.saving') : t('garageProfile.save')}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Public preview */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{t('garageProfile.preview')}</h3>
          <Card className="border-border/60 overflow-hidden">
            <CardContent className="p-0">
              <div className="flex items-start gap-3 p-5 border-b border-border/40">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  {logoUrl ? (
                    <img src={logoUrl} alt={name} className="h-12 w-12 rounded-xl object-cover" />
                  ) : (
                    <Wrench className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{name || '—'}</p>
                  {address && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {address}, {postalCode} {city}
                    </div>
                  )}
                </div>
              </div>

              {garage.rating > 0 && (
                <div className="flex items-center gap-2 px-5 py-3 border-b border-border/40">
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'h-3.5 w-3.5',
                          i < Math.floor(garage.rating)
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-muted text-muted-foreground/30'
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-sm font-medium">{garage.rating.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">({garage.review_count})</span>
                </div>
              )}

              {description && (
                <p className="text-sm text-muted-foreground px-5 py-3 border-b border-border/40 leading-relaxed">{description}</p>
              )}

              {services.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-5 py-3 border-b border-border/40">
                  {services.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              )}

              <div className="px-5 py-3 space-y-2">
                {phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    {phone}
                  </div>
                )}
                {email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    {email}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
          <div className="flex items-start gap-2 rounded-lg bg-success/5 border border-success/20 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
            <p className="text-muted-foreground">{t('garageProfile.savedDesc')}</p>
          </div>
          {!iban && (
            <div className="flex items-start gap-2 rounded-lg bg-warning/5 border border-warning/20 p-3 text-sm">
              <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-muted-foreground">{t('garageProfile.ibanHint')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
