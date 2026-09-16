'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { isGarageStaff } from '@/lib/types/database';
import { Loader2, Wrench, Car, CalendarClock, FileText, CreditCard, Package, Users, ArrowRight, CheckCircle2, Shield, Network, MapPin, Zap, QrCode, Smartphone, Eye } from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';

export default function Home() {
  const { user, profile, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!loading && user && profile) {
      if (isGarageStaff(profile.role)) {
        router.push('/dashboard');
      } else if (profile.role === 'client') {
        router.push('/portal');
      }
    }
  }, [user, profile, loading, router]);

  if (loading && user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Wrench className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-foreground">AtelierPro</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => {
              const el = document.getElementById('conducteurs');
              el?.scrollIntoView({ behavior: 'smooth' });
            }} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t('landing.nav.forDrivers')}</button>
            <button onClick={() => {
              const el = document.getElementById('garages');
              el?.scrollIntoView({ behavior: 'smooth' });
            }} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t('landing.nav.forGarages')}</button>
            <button onClick={() => {
              const el = document.getElementById('pourquoi');
              el?.scrollIntoView({ behavior: 'smooth' });
            }} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t('landing.nav.why')}</button>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button
              onClick={() => router.push('/login')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-4 py-2 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
            >
              {t('landing.nav.login')}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-36 pb-24 px-6">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-primary/8 blur-[140px]" />
          <div className="absolute top-20 left-1/4 w-[400px] h-[400px] rounded-full bg-blue-600/5 blur-[120px]" />
          <div className="absolute top-40 right-1/4 w-[350px] h-[350px] rounded-full bg-violet-600/4 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-5xl text-center">
          <div className={`inline-flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-4 py-1.5 mb-8 ${mounted ? 'animate-fade-up' : 'opacity-0'}`}>
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="text-xs font-medium text-muted-foreground">{t('landing.badge')}</span>
          </div>

          <h1 className={`font-display text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-foreground leading-[1.05] mb-6 ${mounted ? 'animate-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
            {t('landing.hero.title')}
          </h1>

          <p className={`text-xl sm:text-2xl font-semibold text-foreground/80 mb-5 ${mounted ? 'animate-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }}>
            {t('landing.hero.subtitle').split('\n').map((line, i) => (
              <span key={i}>{i > 0 && <br className="hidden sm:block" />}{line}</span>
            ))}
          </p>

          <p className={`text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed ${mounted ? 'animate-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0.3s' }}>
            {t('landing.hero.desc')}
          </p>

          <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 ${mounted ? 'animate-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0.4s' }}>
            <button
              onClick={() => router.push('/login?tab=client')}
              className="group inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:brightness-110"
            >
              <Car className="h-5 w-5" />
              {t('landing.hero.driverBtn')}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => router.push('/pour-garages')}
              className="group inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl border border-border/60 bg-secondary/40 px-7 py-3.5 text-base font-semibold text-foreground hover:bg-secondary hover:border-border transition-all"
            >
              <Wrench className="h-5 w-5" />
              {t('landing.hero.garageBtn')}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className={`flex flex-wrap items-center justify-center gap-6 mt-12 ${mounted ? 'animate-fade-in-slow' : 'opacity-0'}`} style={{ animationDelay: '0.6s' }}>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-success" />
              {t('landing.hero.vatCompliant')}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <QrCode className="h-4 w-4 text-primary" />
              {t('landing.hero.qrBill')}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4 text-primary" />
              {t('landing.hero.twint')}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {t('landing.hero.madeInSwitzerland')}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pour les conducteurs ── */}
      <section id="conducteurs" className="py-24 px-6 border-t border-border/30">
        <div className="mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 mb-6">
                <Car className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">{t('landing.drivers.badge')}</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-5 leading-tight">
                {t('landing.drivers.title')}
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed mb-8">
                {t('landing.drivers.desc')}
              </p>
              <div className="space-y-5">
                {[
                  { icon: CalendarClock, title: t('landing.drivers.feature1.title'), desc: t('landing.drivers.feature1.desc') },
                  { icon: FileText, title: t('landing.drivers.feature2.title'), desc: t('landing.drivers.feature2.desc') },
                  { icon: CreditCard, title: t('landing.drivers.feature3.title'), desc: t('landing.drivers.feature3.desc') },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => router.push('/login?tab=client')}
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all"
              >
                {t('landing.drivers.cta')}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute inset-0 -z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/6 blur-[100px]" />
              </div>
              <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/20 p-6 flex flex-col items-center justify-center text-center min-h-[400px]">
                <Eye className="h-10 w-10 text-muted-foreground/40 mb-4" />
                <p className="text-sm text-muted-foreground max-w-xs">{t('landing.preview.desc')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pour les garages ── */}
      <section id="garages" className="py-24 px-6 border-t border-border/30">
        <div className="mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="relative hidden lg:block lg:order-2">
              <div className="absolute inset-0 -z-10">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-primary/6 blur-[100px]" />
              </div>
              <div className="rounded-2xl border border-dashed border-border/60 bg-secondary/20 p-6 flex flex-col items-center justify-center text-center min-h-[400px]">
                <Eye className="h-10 w-10 text-muted-foreground/40 mb-4" />
                <p className="text-sm text-muted-foreground max-w-xs">{t('landing.preview.desc')}</p>
              </div>
            </div>

            <div className="lg:order-1">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 mb-6">
                <Wrench className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">{t('landing.garages.badge')}</span>
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-5 leading-tight">
                {t('landing.garages.title')}
              </h2>
              <p className="text-muted-foreground text-base leading-relaxed mb-8">
                {t('landing.garages.desc')}
              </p>
              <div className="space-y-5">
                {[
                  { icon: FileText, title: t('landing.garages.feature1.title'), desc: t('landing.garages.feature1.desc') },
                  { icon: Package, title: t('landing.garages.feature2.title'), desc: t('landing.garages.feature2.desc') },
                  { icon: Users, title: t('landing.garages.feature3.title'), desc: t('landing.garages.feature3.desc') },
                  { icon: Zap, title: t('landing.garages.feature4.title'), desc: t('landing.garages.feature4.desc') },
                ].map((item) => (
                  <div key={item.title} className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => router.push('/pour-garages')}
                className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:brightness-110 transition-all"
              >
                {t('landing.garages.cta')}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Aperçu de l'espace ── */}
      <section className="py-24 px-6 border-t border-border/30 bg-secondary/10">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 mb-4">
              <Eye className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">{t('landing.preview.badge')}</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight mb-3">
              {t('landing.preview.title')}
            </h2>
            <p className="text-muted-foreground text-base max-w-2xl mx-auto leading-relaxed">
              {t('landing.preview.desc')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Aperçu: Espace conducteur */}
            <div className="relative">
              <div className="absolute -top-3 left-6 z-10">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-md">
                  <Eye className="h-3 w-3" />
                  {t('landing.preview.badge')}
                </span>
              </div>
              <div className="rounded-2xl border border-dashed border-border/60 bg-card p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Car className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{t('landing.preview.driverLabel')}</span>
                  </div>
                  <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">{t('landing.drivers.free')}</span>
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg border border-border/40 bg-secondary/30 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarClock className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-foreground">{t('landing.drivers.nextAppt')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{t('landing.drivers.sampleAppt')}</p>
                  </div>
                  <div className="rounded-lg border border-border/40 bg-secondary/30 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-foreground">{t('landing.drivers.lastInvoice')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{t('landing.drivers.sampleInvoice')}</p>
                    <div className="mt-2 flex gap-2">
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{t('invoices.qrBill')}</span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">Twint</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/40 bg-secondary/30 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Car className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-foreground">{t('landing.drivers.myVehicle')}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{t('landing.drivers.sampleVehicle')}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t('landing.drivers.sampleMileage')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Aperçu: Espace garage */}
            <div className="relative">
              <div className="absolute -top-3 left-6 z-10">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-md">
                  <Eye className="h-3 w-3" />
                  {t('landing.preview.badge')}
                </span>
              </div>
              <div className="rounded-2xl border border-dashed border-border/60 bg-card p-6 shadow-lg">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Wrench className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{t('landing.preview.garageLabel')}</span>
                  </div>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">SaaS</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/40 bg-secondary/30 p-4">
                    <FileText className="h-4 w-4 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground">{t('landing.garages.invoicesMonth')}</p>
                    <p className="text-lg font-bold text-foreground">CHF 12'400</p>
                  </div>
                  <div className="rounded-lg border border-border/40 bg-secondary/30 p-4">
                    <CalendarClock className="h-4 w-4 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground">{t('landing.garages.appointments')}</p>
                    <p className="text-lg font-bold text-foreground">8</p>
                  </div>
                  <div className="rounded-lg border border-border/40 bg-secondary/30 p-4">
                    <Package className="h-4 w-4 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground">{t('landing.garages.stock')}</p>
                    <p className="text-lg font-bold text-foreground">3</p>
                  </div>
                  <div className="rounded-lg border border-border/40 bg-secondary/30 p-4">
                    <Users className="h-4 w-4 text-primary mb-2" />
                    <p className="text-xs text-muted-foreground">{t('landing.garages.team')}</p>
                    <p className="text-lg font-bold text-foreground">4</p>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-border/40 bg-secondary/30 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <span className="text-xs font-medium text-foreground">{t('landing.garages.newRequests')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{t('landing.garages.sampleRequests')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pourquoi AtelierPro ── */}
      <section id="pourquoi" className="py-24 px-6 border-t border-border/30">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">{t('landing.why.label')}</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              {t('landing.why.title')}
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-border/40 bg-card p-8 hover:border-primary/30 transition-colors">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-6">
                <Network className="h-7 w-7 text-primary" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-muted-foreground">01</span>
                <h3 className="font-display text-lg font-bold text-foreground">{t('landing.why.pillar1.title')}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('landing.why.pillar1.desc')}
              </p>
            </div>

            <div className="rounded-2xl border border-border/40 bg-card p-8 hover:border-primary/30 transition-colors">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-6">
                <Wrench className="h-7 w-7 text-primary" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-muted-foreground">02</span>
                <h3 className="font-display text-lg font-bold text-foreground">{t('landing.why.pillar2.title')}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('landing.why.pillar2.desc')}
              </p>
            </div>

            <div className="rounded-2xl border border-border/40 bg-card p-8 hover:border-primary/30 transition-colors">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-6">
                <MapPin className="h-7 w-7 text-primary" />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-bold text-muted-foreground">03</span>
                <h3 className="font-display text-lg font-bold text-foreground">{t('landing.why.pillar3.title')}</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t('landing.why.pillar3.desc')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section className="py-10 px-6 border-t border-border/30">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-12">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600">
                <span className="text-white font-bold text-sm">+</span>
              </div>
              <span className="font-display text-base font-semibold text-foreground">{t('landing.trust.madeFor')}</span>
            </div>
            <div className="hidden sm:block h-8 w-px bg-border" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono font-bold text-primary">CHF</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="font-semibold">TVA 8.1%</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="font-semibold">{t('invoices.qrBill')}</span>
              <span className="text-muted-foreground/50">·</span>
              <span className="font-semibold">Twint</span>
            </div>
            <div className="hidden sm:block h-8 w-px bg-border" />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>{t('landing.trust.compliant')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative py-24 px-6 overflow-hidden border-t border-border/30">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-primary/6 blur-[140px]" />
        </div>
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight mb-4 leading-tight">
            {t('landing.cta.title').split('\n').map((line, i) => (
              <span key={i}>{i > 0 && <br className="hidden sm:block" />}{line}</span>
            ))}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('landing.cta.desc')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push('/login?tab=client')}
              className="group inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl transition-all hover:brightness-110"
            >
              <Car className="h-5 w-5" />
              {t('landing.cta.driverBtn')}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => router.push('/pour-garages')}
              className="group inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl border border-border/60 bg-secondary/40 px-7 py-3.5 text-base font-semibold text-foreground hover:bg-secondary hover:border-border transition-all"
            >
              <Wrench className="h-5 w-5" />
              {t('landing.cta.garageBtn')}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/30 py-10 px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Wrench className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display text-sm font-bold text-foreground">AtelierPro</span>
              <span className="text-xs text-muted-foreground ml-2">{t('landing.footer.copyright')}</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <button onClick={() => router.push('/login')} className="hover:text-foreground transition-colors">{t('landing.nav.login')}</button>
              <button onClick={() => router.push('/login?tab=client')} className="hover:text-foreground transition-colors">{t('landing.footer.clientPortal')}</button>
              <button onClick={() => router.push('/pour-garages')} className="hover:text-foreground transition-colors">{t('landing.footer.garageSpace')}</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
