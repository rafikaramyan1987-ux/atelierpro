'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { isGarageStaff } from '@/lib/types/database';
import {
  Wrench,
  FileText,
  Package,
  Users,
  CreditCard,
  ArrowRight,
  CheckCircle2,
  Shield,
  QrCode,
  Smartphone,
  MapPin,
  Network,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';

export default function GaragePage() {
  const { user, profile, loading } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!loading && user && profile) {
      if (isGarageStaff(profile.role)) {
        router.push('/dashboard');
      }
    }
  }, [user, profile, loading, router]);

  if (loading && user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Wrench className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const valueProps = [
    {
      icon: FileText,
      title: t('garagePage.value1.title'),
      desc: t('garagePage.value1.desc'),
    },
    {
      icon: Package,
      title: t('garagePage.value2.title'),
      desc: t('garagePage.value2.desc'),
    },
    {
      icon: Users,
      title: t('garagePage.value3.title'),
      desc: t('garagePage.value3.desc'),
    },
    {
      icon: CreditCard,
      title: t('garagePage.value4.title'),
      desc: t('garagePage.value4.desc'),
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ── Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <button onClick={() => router.push('/')} className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
              <Wrench className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-foreground">AtelierPro</span>
          </button>
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
      <section className="relative pt-36 pb-20 px-6">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-primary/8 blur-[140px]" />
          <div className="absolute top-20 left-1/4 w-[400px] h-[400px] rounded-full bg-blue-600/5 blur-[120px]" />
        </div>

        <div className="mx-auto max-w-4xl text-center">
          <div className={`inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 mb-8 ${mounted ? 'animate-fade-up' : 'opacity-0'}`}>
            <Wrench className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary">{t('garagePage.badge')}</span>
          </div>

          <h1 className={`font-display text-5xl sm:text-6xl font-extrabold tracking-tight text-foreground leading-[1.05] mb-6 ${mounted ? 'animate-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
            {t('garagePage.hero.title')}
          </h1>

          <p className={`text-xl sm:text-2xl font-semibold text-foreground/80 mb-10 leading-relaxed max-w-3xl mx-auto ${mounted ? 'animate-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }}>
            {t('garagePage.hero.desc')}
          </p>

          <div className={`flex flex-col sm:flex-row items-center justify-center gap-4 ${mounted ? 'animate-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0.3s' }}>
            <button
              onClick={() => router.push('/login?tab=signup')}
              className="group inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:brightness-110"
            >
              <Wrench className="h-5 w-5" />
              {t('garagePage.cta.signup')}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => router.push('/login')}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-border/60 bg-secondary/40 px-6 py-3.5 text-base font-semibold text-foreground hover:bg-secondary hover:border-border transition-all"
            >
              {t('garagePage.cta.login')}
            </button>
          </div>

          <div className={`flex flex-wrap items-center justify-center gap-6 mt-12 ${mounted ? 'animate-fade-in-slow' : 'opacity-0'}`} style={{ animationDelay: '0.5s' }}>
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

      {/* ── Value proposition cards ── */}
      <section className="py-20 px-6 border-t border-border/30">
        <div className="mx-auto max-w-6xl">
          <div className="grid sm:grid-cols-2 gap-6">
            {valueProps.map((item, i) => (
              <div
                key={i}
                className={`rounded-2xl border border-border/40 bg-card p-8 hover:border-primary/30 transition-colors ${mounted ? 'animate-fade-up' : 'opacity-0'}`}
                style={{ animationDelay: `${0.1 * (i + 1)}s` }}
              >
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-6">
                  <item.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-display text-lg font-bold text-foreground mb-3">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section className="py-12 px-6 border-t border-border/30 bg-secondary/10">
        <div className="mx-auto max-w-5xl text-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-primary/20 bg-primary/5 px-6 py-3">
            <Network className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">{t('garagePage.trust.badge')}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-6 mt-8">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="font-semibold">TVA 8.1%</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="font-semibold">{t('invoices.qrBill')}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="font-semibold">Twint</span>
            </div>
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
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight mb-4 leading-tight">
            {t('garagePage.cta.title')}
          </h2>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('garagePage.cta.desc')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push('/login?tab=signup')}
              className="group inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-primary px-7 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl transition-all hover:brightness-110"
            >
              <Wrench className="h-5 w-5" />
              {t('garagePage.cta.signup')}
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => router.push('/login')}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-border/60 bg-secondary/40 px-6 py-3.5 text-base font-semibold text-foreground hover:bg-secondary hover:border-border transition-all"
            >
              {t('garagePage.cta.login')}
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
              <button onClick={() => router.push('/')} className="hover:text-foreground transition-colors">{t('garagePage.nav.back')}</button>
              <button onClick={() => router.push('/login')} className="hover:text-foreground transition-colors">{t('landing.nav.login')}</button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
