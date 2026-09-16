'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { isGarageStaff } from '@/lib/types/database';
import {
  Loader2, Wrench, Car, CalendarClock, FileText, CreditCard, Package,
  Users, ArrowRight, CheckCircle2, Shield, Network, MapPin, Zap,
  QrCode, Smartphone, Eye, ClipboardList, ArrowLeftRight,
} from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';

/* ── Scroll reveal hook (Intersection Observer) ── */
function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('reveal-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return ref;
}

function Reveal({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useReveal<HTMLDivElement>();
  const delayClass = delay > 0 ? `reveal-delay-${delay}` : '';
  return (
    <div ref={ref} className={`reveal ${delayClass} ${className}`}>
      {children}
    </div>
  );
}

/* ── Hero illustration: car + wrench composition (SVG) ── */
function HeroIllustration() {
  return (
    <div className="relative mx-auto max-w-md lg:max-w-lg">
      <div className="absolute inset-0 -z-10 flex items-center justify-center">
        <div className="h-72 w-72 rounded-full bg-primary/12 blur-[100px]" />
      </div>
      <svg viewBox="0 0 400 280" className="w-full h-auto drop-shadow-2xl" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="20" width="360" height="240" rx="24" fill="hsl(230 14% 11%)" stroke="hsl(230 12% 18%)" strokeWidth="1.5" />
        <line x1="20" y1="100" x2="380" y2="100" stroke="hsl(230 12% 16%)" strokeWidth="1" />
        <line x1="20" y1="180" x2="380" y2="180" stroke="hsl(230 12% 16%)" strokeWidth="1" />
        {/* Car silhouette */}
        <g transform="translate(70, 90)">
          <path d="M0 50 Q5 20 35 18 L75 18 Q95 18 110 28 L150 28 Q170 28 180 40 L190 50 L190 62 Q190 70 180 72 L10 72 Q0 70 0 62 Z" fill="hsl(211 100% 56%)" opacity="0.9" />
          <path d="M35 22 L72 22 Q88 22 100 30 L108 38 L40 38 Q32 38 30 30 Z" fill="hsl(230 14% 14%)" opacity="0.7" />
          <path d="M112 30 L142 30 Q158 30 168 38 L112 38 Z" fill="hsl(230 14% 14%)" opacity="0.7" />
          <circle cx="45" cy="72" r="14" fill="hsl(230 14% 10%)" stroke="hsl(211 100% 56%)" strokeWidth="2" />
          <circle cx="45" cy="72" r="6" fill="hsl(230 12% 20%)" />
          <circle cx="150" cy="72" r="14" fill="hsl(230 14% 10%)" stroke="hsl(211 100% 56%)" strokeWidth="2" />
          <circle cx="150" cy="72" r="6" fill="hsl(230 12% 20%)" />
          <circle cx="183" cy="48" r="4" fill="hsl(38 92% 52%)" />
        </g>
        {/* Wrench overlay */}
        <g transform="translate(250, 130) rotate(45)">
          <rect x="0" y="-4" width="80" height="8" rx="4" fill="hsl(211 100% 56%)" opacity="0.85" />
          <path d="M-8 -12 L-8 -4 L-16 -4 L-16 4 L-8 4 L-8 12 L4 8 L4 -8 Z" fill="hsl(211 100% 56%)" opacity="0.85" />
          <circle cx="78" cy="0" r="10" fill="none" stroke="hsl(211 100% 56%)" strokeWidth="3" opacity="0.85" />
          <circle cx="78" cy="0" r="5" fill="hsl(230 14% 11%)" />
        </g>
        {/* Floating badges */}
        <g className="animate-float" style={{ animationDelay: '0.5s' }}>
          <rect x="30" y="35" width="90" height="28" rx="14" fill="hsl(230 14% 14%)" stroke="hsl(211 100% 56% / 0.3)" strokeWidth="1" />
          <circle cx="44" cy="49" r="4" fill="hsl(142 64% 48%)" />
          <text x="54" y="53" fontSize="11" fill="hsl(210 20% 65%)" fontFamily="sans-serif">Booking</text>
        </g>
        <g className="animate-float" style={{ animationDelay: '1.5s' }}>
          <rect x="280" y="200" width="90" height="28" rx="14" fill="hsl(230 14% 14%)" stroke="hsl(211 100% 56% / 0.3)" strokeWidth="1" />
          <circle cx="294" cy="214" r="4" fill="hsl(38 92% 52%)" />
          <text x="304" y="218" fontSize="11" fill="hsl(210 20% 65%)" fontFamily="sans-serif">Invoice</text>
        </g>
      </svg>
    </div>
  );
}

/* ── B2B2C flow diagram ── */
function FlowDiagram() {
  return (
    <div className="flex flex-col items-center gap-4 lg:flex-row lg:justify-center lg:gap-2">
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/50 bg-card/80 px-6 py-5 w-full sm:w-48">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <Car className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm font-semibold text-foreground">Driver</p>
        <p className="text-xs text-muted-foreground text-center">Books appointment</p>
      </div>
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1 text-primary">
          <div className="h-px w-8 bg-primary/40 hidden lg:block" />
          <ArrowRight className="h-5 w-5" />
          <div className="h-px w-8 bg-primary/40 hidden lg:block" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/50 bg-card/80 px-6 py-5 w-full sm:w-48">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
          <ClipboardList className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm font-semibold text-foreground">Garage</p>
        <p className="text-xs text-muted-foreground text-center">Receives &amp; manages</p>
      </div>
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1 text-primary">
          <div className="h-px w-8 bg-primary/40 hidden lg:block" />
          <ArrowRight className="h-5 w-5" />
          <div className="h-px w-8 bg-primary/40 hidden lg:block" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-border/50 bg-card/80 px-6 py-5 w-full sm:w-48">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10 border border-success/20">
          <CheckCircle2 className="h-6 w-6 text-success" />
        </div>
        <p className="text-sm font-semibold text-foreground">Done</p>
        <p className="text-xs text-muted-foreground text-center">Invoice &amp; payment</p>
      </div>
    </div>
  );
}

/* ── Dashboard mockup (garage side) ── */
function GarageMockup() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Wrench className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold text-foreground">AtelierPro</span>
        </div>
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
          <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-lg border border-border/40 bg-secondary/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <FileText className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] text-muted-foreground">Revenue</span>
          </div>
          <p className="text-base font-bold text-foreground">CHF 12&apos;400</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-secondary/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] text-muted-foreground">Appts</span>
          </div>
          <p className="text-base font-bold text-foreground">8</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-secondary/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Package className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] text-muted-foreground">Stock</span>
          </div>
          <p className="text-base font-bold text-foreground">3</p>
        </div>
        <div className="rounded-lg border border-border/40 bg-secondary/30 p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Users className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] text-muted-foreground">Team</span>
          </div>
          <p className="text-base font-bold text-foreground">4</p>
        </div>
      </div>
      <div className="rounded-lg border border-border/40 bg-secondary/30 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Zap className="h-3.5 w-3.5 text-warning" />
          <span className="text-[10px] font-medium text-foreground">New request</span>
        </div>
        <p className="text-xs text-muted-foreground">Oil change — VW Golf 7</p>
      </div>
    </div>
  );
}

/* ── Portal mockup (driver side) ── */
function DriverMockup() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-2xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <Car className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-bold text-foreground">My Portal</span>
        </div>
        <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">Free</span>
      </div>
      <div className="rounded-lg border border-border/40 bg-secondary/30 p-3 mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <CalendarClock className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-medium text-foreground">Next appointment</span>
        </div>
        <p className="text-xs text-muted-foreground">Fri, 20 Sep — 14:00</p>
      </div>
      <div className="rounded-lg border border-border/40 bg-secondary/30 p-3 mb-3">
        <div className="flex items-center gap-1.5 mb-1">
          <FileText className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-medium text-foreground">Last invoice</span>
        </div>
        <p className="text-xs text-muted-foreground">CHF 320.00</p>
        <div className="mt-1.5 flex gap-1.5">
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">QR-bill</span>
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">Twint</span>
        </div>
      </div>
      <div className="rounded-lg border border-border/40 bg-secondary/30 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Car className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] font-medium text-foreground">My vehicle</span>
        </div>
        <p className="text-xs text-muted-foreground">VW Golf 7 · 45&apos;000 km</p>
      </div>
    </div>
  );
}

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

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

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
            <button onClick={() => scrollTo('conducteurs')} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t('landing.nav.forDrivers')}</button>
            <button onClick={() => scrollTo('garages')} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t('landing.nav.forGarages')}</button>
            <button onClick={() => scrollTo('pourquoi')} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">{t('landing.nav.why')}</button>
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
      <section className="relative pt-36 pb-20 px-6">
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] rounded-full bg-primary/8 blur-[140px]" />
          <div className="absolute top-20 left-1/4 w-[400px] h-[400px] rounded-full bg-blue-600/5 blur-[120px]" />
        </div>
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
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
              <p className={`text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed ${mounted ? 'animate-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0.3s' }}>
                {t('landing.hero.desc')}
              </p>
              <div className={`flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 ${mounted ? 'animate-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0.4s' }}>
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
              <div className={`flex flex-wrap items-center justify-center lg:justify-start gap-6 mt-12 ${mounted ? 'animate-fade-in-slow' : 'opacity-0'}`} style={{ animationDelay: '0.6s' }}>
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
            <div className={`hidden lg:block ${mounted ? 'animate-fade-up' : 'opacity-0'}`} style={{ animationDelay: '0.3s' }}>
              <HeroIllustration />
            </div>
          </div>
        </div>
      </section>

      {/* ── B2B2C Flow ── */}
      <section className="py-20 px-6 border-t border-border/30 bg-secondary/5">
        <div className="mx-auto max-w-5xl">
          <Reveal>
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 mb-4">
                <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary">B2B2C</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground tracking-tight mb-3">
                {t('landing.hero.subtitle').split('\n').map((line, i) => (
                  <span key={i}>{i > 0 && <br className="hidden sm:block" />}{line}</span>
                ))}
              </h2>
            </div>
          </Reveal>
          <Reveal delay={2}>
            <FlowDiagram />
          </Reveal>
        </div>
      </section>

      {/* ── Pour les conducteurs ── */}
      <section id="conducteurs" className="py-24 px-6 border-t border-border/30">
        <div className="mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Reveal>
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
                  ].map((item, i) => (
                    <Reveal key={item.title} delay={i + 1}>
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                          <item.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.title}</p>
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    </Reveal>
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
            </Reveal>
            <Reveal delay={2} className="hidden lg:block">
              <DriverMockup />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Pour les garages ── */}
      <section id="garages" className="py-24 px-6 border-t border-border/30 bg-secondary/5">
        <div className="mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <Reveal delay={2} className="hidden lg:block lg:order-2">
              <GarageMockup />
            </Reveal>
            <Reveal className="lg:order-1">
              <div>
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
                  ].map((item, i) => (
                    <Reveal key={item.title} delay={i + 1}>
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
                          <item.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{item.title}</p>
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    </Reveal>
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
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Aperçu de l'espace (side-by-side mockups) ── */}
      <section className="py-24 px-6 border-t border-border/30">
        <div className="mx-auto max-w-6xl">
          <Reveal>
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
          </Reveal>
          <div className="grid md:grid-cols-2 gap-8">
            <Reveal delay={1}>
              <div className="relative">
                <div className="absolute -top-3 left-6 z-10">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-md">
                    <Car className="h-3 w-3" />
                    {t('landing.preview.driverLabel')}
                  </span>
                </div>
                <DriverMockup />
              </div>
            </Reveal>
            <Reveal delay={2}>
              <div className="relative">
                <div className="absolute -top-3 left-6 z-10">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-md">
                    <Wrench className="h-3 w-3" />
                    {t('landing.preview.garageLabel')}
                  </span>
                </div>
                <GarageMockup />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Pourquoi AtelierPro ── */}
      <section id="pourquoi" className="py-24 px-6 border-t border-border/30 bg-secondary/5">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">{t('landing.why.label')}</p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                {t('landing.why.title')}
              </h2>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Network, num: '01', title: t('landing.why.pillar1.title'), desc: t('landing.why.pillar1.desc') },
              { icon: Wrench, num: '02', title: t('landing.why.pillar2.title'), desc: t('landing.why.pillar2.desc') },
              { icon: MapPin, num: '03', title: t('landing.why.pillar3.title'), desc: t('landing.why.pillar3.desc') },
            ].map((item, i) => (
              <Reveal key={item.num} delay={i + 1}>
                <div className="rounded-2xl border border-border/40 bg-card p-8 hover:border-primary/30 transition-colors h-full">
                  <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mb-6">
                    <item.icon className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-muted-foreground">{item.num}</span>
                    <h3 className="font-display text-lg font-bold text-foreground">{item.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust strip ── */}
      <section className="py-10 px-6 border-t border-border/30">
        <div className="mx-auto max-w-5xl">
          <Reveal>
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
          </Reveal>
        </div>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="relative py-24 px-6 overflow-hidden border-t border-border/30">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-primary/6 blur-[140px]" />
        </div>
        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
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
          </Reveal>
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
