'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isGarageStaff, canAccess } from '@/lib/types/database';
import { AppSidebar } from '@/components/app-sidebar';
import { Loader2, ShieldOff } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/context';
import { Button } from '@/components/ui/button';

const PASSWORD_CHANGE_PATH = '/changer-mot-de-passe';
const GARAGE_SETUP_PATH = '/mon-garage';
const ADMIN_PATH = '/admin';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useI18n();
  const [garageStatus, setGarageStatus] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (profile && profile.role === 'super_admin') {
        if (pathname !== ADMIN_PATH && !pathname.startsWith(ADMIN_PATH + '/')) {
          router.push(ADMIN_PATH);
        }
      } else if (profile && !isGarageStaff(profile.role)) {
        router.push('/portal');
      } else if (profile && isGarageStaff(profile.role)) {
        if (profile.must_change_password && pathname !== PASSWORD_CHANGE_PATH) {
          router.push(PASSWORD_CHANGE_PATH);
        } else if (!profile.must_change_password) {
          if (pathname === PASSWORD_CHANGE_PATH) {
            router.push('/dashboard');
          } else if (!profile.garage_id && pathname !== GARAGE_SETUP_PATH) {
            router.push(GARAGE_SETUP_PATH);
          } else if (profile.garage_id && !canAccess(profile.role, pathname)) {
            router.push('/dashboard');
          }
        }
      }
    }
  }, [user, profile, loading, router, pathname]);

  useEffect(() => {
    async function fetchGarageStatus() {
      if (profile?.garage_id && isGarageStaff(profile.role)) {
        const { data } = await supabase
          .from('garages')
          .select('subscription_status')
          .eq('id', profile.garage_id)
          .maybeSingle();
        setGarageStatus(data?.subscription_status ?? 'active');
      }
      setStatusLoading(false);
    }
    fetchGarageStatus();
  }, [profile?.garage_id]);

  if (loading || !user || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (profile.role === 'super_admin') {
    if (pathname === ADMIN_PATH || pathname.startsWith(ADMIN_PATH + '/')) {
      return (
        <div className="min-h-screen bg-background">
          {children}
        </div>
      );
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isGarageStaff(profile.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (profile.active === false) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md px-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mx-auto mb-4">
            <ShieldOff className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">{t('login.accountDisabled')}</h1>
          <p className="text-sm text-muted-foreground mb-6">{t('login.accountDisabledDesc')}</p>
          <Button variant="outline" onClick={() => signOut()}>
            {t('sidebar.garage.signout')}
          </Button>
        </div>
      </div>
    );
  }

  if (profile.must_change_password && pathname !== PASSWORD_CHANGE_PATH) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (profile.must_change_password && pathname === PASSWORD_CHANGE_PATH) {
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    );
  }

  if (!profile.garage_id && pathname === GARAGE_SETUP_PATH) {
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    );
  }

  if (!profile.garage_id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canAccess(profile.role, pathname)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground mb-2">Access denied</p>
          <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
        </div>
      </div>
    );
  }

  if (!statusLoading && garageStatus === 'suspended' && pathname !== PASSWORD_CHANGE_PATH) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center max-w-md px-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 mx-auto mb-4">
            <ShieldOff className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">{t('admin.panel.subscriptionInactive')}</h1>
          <p className="text-sm text-muted-foreground mb-6">{t('admin.panel.subscriptionInactiveDesc')}</p>
          <Button variant="outline" onClick={() => signOut()}>
            {t('sidebar.garage.signout')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar currentPath={pathname} />
      <main className="flex-1 overflow-auto scrollbar-thin">
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
