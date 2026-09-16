'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { LanguageSwitcher } from '@/components/language-switcher';
import {
  Wrench,
  LayoutDashboard,
  CalendarClock,
  Car,
  FileText,
  FileSearch,
  MapPin,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { labelKey: 'sidebar.client.home', href: '/portal', icon: LayoutDashboard },
  { labelKey: 'sidebar.client.vehicles', href: '/portal/vehicules', icon: Car },
  { labelKey: 'sidebar.client.appointments', href: '/portal/rendez-vous', icon: CalendarClock },
  { labelKey: 'sidebar.client.invoices', href: '/portal/factures', icon: FileText },
  { labelKey: 'sidebar.client.devis', href: '/portal/devis', icon: FileSearch },
  { labelKey: 'sidebar.client.garages', href: '/portal/garages', icon: MapPin },
];

export function ClientSidebar({ currentPath }: { currentPath: string }) {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = profile?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '??';

  function handleNavigate(href: string) {
    router.push(href);
    setMobileOpen(false);
  }

  async function handleSignOut() {
    await signOut();
    router.push('/login');
  }

  const sidebarContent = (
    <div className="flex h-full flex-col bg-card">
      <div className="flex h-16 items-center gap-3 border-b border-border/40 px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <Wrench className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <span className="font-display text-lg font-bold tracking-tight text-foreground">AtelierPro</span>
          <p className="text-[10px] text-muted-foreground leading-none">{t('sidebar.client.clientLabel')}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4 overflow-y-auto scrollbar-thin">
        {navItems.map((item) => {
          const isActive = currentPath === item.href || (item.href !== '/portal' && currentPath.startsWith(item.href + '/'));
          const Icon = item.icon;
          return (
            <button
              key={item.href}
              onClick={() => handleNavigate(item.href)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              {t(item.labelKey)}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-border/40 p-4">
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{profile?.full_name}</p>
            <p className="text-xs text-muted-foreground">{t('sidebar.client.clientLabel')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <Button
            variant="ghost"
            size="sm"
            className="flex-1 justify-start text-muted-foreground hover:text-destructive"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t('sidebar.client.signout')}
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b border-border/40 bg-card px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Wrench className="h-4.5 w-4.5 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground">AtelierPro</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 top-14 z-40 bg-background/80 backdrop-blur-sm" onClick={() => setMobileOpen(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border/40 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}

      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border/40 bg-card">
        {sidebarContent}
      </aside>

      <div className="lg:hidden h-14" />
    </>
  );
}
