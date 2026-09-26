'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function ResetPasswordPage() {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [waiting, setWaiting] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setWaiting(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error(t('resetPassword.tooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('resetPassword.mismatch'));
      return;
    }
    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      const msg = updateError.message;
      if (msg.toLowerCase().includes('should be different')) {
        toast.error(t('resetPassword.shouldBeDifferent'));
      } else {
        toast.error(t('resetPassword.error'), { description: msg });
      }
      setSubmitting(false);
      return;
    }

    if (profile?.must_change_password) {
      await supabase
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', user?.id);
    }

    toast.success(t('resetPassword.success'));
    setSubmitting(false);

    if (profile?.role === 'super_admin') {
      router.push('/admin');
    } else if (profile?.role === 'client') {
      router.push('/portal');
    } else {
      router.push('/dashboard');
    }
  }

  if (waiting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <Card className="border-border/40 bg-card shadow-2xl">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">{t('common.loading')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="w-full max-w-md">
          <Card className="border-border/40 bg-card shadow-2xl">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                </div>
                <CardTitle className="text-xl">{t('resetPassword.invalidLink')}</CardTitle>
              </div>
              <CardDescription className="text-muted-foreground">
                {t('resetPassword.invalidLinkDesc')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => router.push('/login')} className="w-full">
                {t('resetPassword.backToLogin')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Card className="border-border/40 bg-card shadow-2xl">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <CardTitle className="text-xl">{t('resetPassword.title')}</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              {t('resetPassword.desc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t('resetPassword.newPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    required
                    minLength={8}
                    placeholder={t('ph.password')}
                    className="pl-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('resetPassword.confirmPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={8}
                    placeholder={t('ph.password')}
                    className="pl-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('resetPassword.saving')}</> : t('resetPassword.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
