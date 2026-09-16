'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { isGarageStaff } from '@/lib/types/database';
import { AppSidebar } from '@/components/app-sidebar';
import { Loader2 } from 'lucide-react';

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
      }
    }
  }, [user, profile, loading, router]);

  if (loading || !user || !profile || !isGarageStaff(profile.role)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
