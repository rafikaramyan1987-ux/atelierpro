'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LanguageSwitcher } from '@/components/language-switcher';
import {
  Wrench,
  LayoutDashboard,
  Package,
  FileText,
  Users,
  UserCircle,
  LogOut,
  Menu,
  X,
  CreditCard,
  CalendarClock,
  Store,
  ShoppingCart,
  ClipboardList,
  CalendarDays,
  CarFront,
  Hammer,
  ListChecks,
  Bell,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { labelKey: 'sidebar.garage.dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['admin', 'mecanicien'] },
  { labelKey: 'sidebar.garage.myInterventions', href: '/mes-interventions', icon: Hammer, roles: ['mecanicien'] },
  { labelKey: 'sidebar.garage.appointments', href: '/rendez-vous', icon: CalendarClock, roles: ['admin', 'mecanicien'] },
  { labelKey: 'sidebar.garage.repairOrders', href: '/ordres-reparation', icon: ClipboardList, roles: ['admin', 'mecanicien'] },
  { labelKey: 'sidebar.garage.planning', href: '/planning', icon: CalendarDays, roles: ['admin', 'mecanicien'] },
  { labelKey: 'sidebar.garage.invoices', href: '/factures', icon: FileText, roles: ['admin', 'mecanicien'] },
  { labelKey: 'sidebar.garage.clients', href: '/clients', icon: Users, roles: ['admin', 'mecanicien'] },
  { labelKey: 'sidebar.garage.stock', href: '/stock', icon: Package, roles: ['admin', 'mecanicien'] },
  { labelKey: 'sidebar.garage.orders', href: '/commandes-pieces', icon: ShoppingCart, roles: ['admin', 'mecanicien'] },
  { labelKey: 'sidebar.garage.loaners', href: '/vehicules-courtoisie', icon: CarFront, roles: ['admin', 'mecanicien'] },
  { labelKey: 'sidebar.garage.cannedTasks', href: '/taches-types', icon: ListChecks, roles: ['admin', 'mecanicien'] },
  { labelKey: 'sidebar.garage.reminders', href: '/rappels', icon: Bell, roles: ['admin', 'mecanicien'] },
  { labelKey: 'sidebar.garage.reports', href: '/rapports', icon: BarChart3, roles: ['admin', 'mecanicien'] },
  { labelKey: 'sidebar.garage.profile', href: '/mon-garage', icon: Store, roles: ['admin', 'mecanicien'] },
  { labelKey: 'sidebar.garage.team', href: '/equipe', icon: UserCircle, roles: ['admin'] },
  { labelKey: 'sidebar.garage.payments', href: '/paiements', icon: CreditCard, roles: ['admin'] },
];

export function AppSidebar({ currentPath }: { currentPath: string }) {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    async function fetchPendingCount() {
      const [apptRes, reqRes] = await Promise.all([
        supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'en_attente'),
        supabase.from('service_requests').select('id', { count: 'exact', head: true }).eq('status', 'en_attente'),
      ]);
      const total = (apptRes.count ?? 0) + (reqRes.count ?? 0);
      setPendingCount(total);
    }
    fetchPendingCount();
  }, [currentPath]);

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
        <span className="font-display text-lg font-bold tracking-tight text-foreground">AtelierPro</span>
      </div>

      <nav className="flex-1 space-y-1 p-4 overflow-y-auto scrollbar-thin">
        {navItems.filter((item) => !item.roles || item.roles.includes(profile?.role ?? '')).map((item) => {
          const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
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
              {item.href === '/rendez-vous' && pendingCount > 0 && (
                <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                  {pendingCount}
                </span>
              )}
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
            <div className="flex items-center gap-1.5">
              <Badge
                variant={profile?.role === 'admin' ? 'default' : 'secondary'}
                className="text-[10px] px-1.5 py-0"
              >
                {profile?.role ? t(`role.${profile.role}`) : ''}
              </Badge>
            </div>
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
            {t('sidebar.garage.signout')}
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
