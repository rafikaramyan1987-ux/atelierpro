'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ClientSidebar } from '@/components/client-sidebar';
import { ChatWidget } from '@/components/chat-widget';
import { Loader2 } from 'lucide-react';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (profile && profile.role === 'super_admin') {
        router.push('/admin');
      } else if (profile && profile.role !== 'client') {
        router.push('/dashboard');
      }
    }
  }, [user, profile, loading, router]);

  if (loading || !user || !profile || profile.role !== 'client') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <ClientSidebar currentPath={pathname} />
      <main className="flex-1 overflow-auto scrollbar-thin">
        <div className="animate-fade-in">
          {children}
        </div>
      </main>
      <ChatWidget />
    </div>
  );
}
