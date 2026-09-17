'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isGarageStaff, canAccess, type UserRole } from '@/lib/types/database';
import { AppSidebar } from '@/components/app-sidebar';
import { Loader2 } from 'lucide-react';

const PASSWORD_CHANGE_PATH = '/changer-mot-de-passe';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (profile && !isGarageStaff(profile.role)) {
        router.push('/portal');
      } else if (profile && isGarageStaff(profile.role)) {
        if (profile.must_change_password && pathname !== PASSWORD_CHANGE_PATH) {
          router.push(PASSWORD_CHANGE_PATH);
        } else if (!profile.must_change_password && pathname === PASSWORD_CHANGE_PATH) {
          router.push('/dashboard');
        } else if (!profile.must_change_password && !canAccess(profile.role, pathname)) {
          router.push('/dashboard');
        }
      }
    }
  }, [user, profile, loading, router, pathname]);

  if (loading || !user || !profile || !isGarageStaff(profile.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
