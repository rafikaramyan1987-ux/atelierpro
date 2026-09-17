'use client';

import { useState } from 'react';
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

export default function ChangePasswordPage() {
  const { user, profile, signOut } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error(t('changePassword.tooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('changePassword.mismatch'));
      return;
    }
    setSubmitting(true);

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      toast.error(t('changePassword.error'), { description: updateError.message });
      setSubmitting(false);
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', user?.id);

    if (profileError) {
      toast.error(t('changePassword.error'), { description: profileError.message });
      setSubmitting(false);
      return;
    }

    toast.success(t('changePassword.success'));
    setSubmitting(false);
    router.push('/dashboard');
  }

  async function handleSkip() {
    await signOut();
    router.push('/login');
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
              <CardTitle className="text-xl">{t('changePassword.title')}</CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              {t('changePassword.desc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">{t('changePassword.newPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="pl-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">{t('changePassword.confirmPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm-password"
                    type="password"
                    required
                    minLength={6}
                    placeholder="••••••••"
                    className="pl-10"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('changePassword.saving')}</> : t('changePassword.submit')}
              </Button>
            </form>
            <button
              onClick={handleSkip}
              className="mt-4 w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('changePassword.logoutInstead')}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
