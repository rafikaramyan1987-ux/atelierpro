'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { isGarageStaff } from '@/lib/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase/client';
import { Wrench, Mail, Lock, User, Loader2, ArrowRight, Car, Phone, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { LanguageSwitcher } from '@/components/language-switcher';
import { toast } from 'sonner';

export default function LoginPage() {
  const { user, profile, loading, registering, setRegistering, signIn, signUp, refreshProfile } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('signin');

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'client' || tab === 'signup' || tab === 'signin') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const [clientFirstName, setClientFirstName] = useState('');
  const [clientLastName, setClientLastName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [clientPlate, setClientPlate] = useState('');
  const [clientBrand, setClientBrand] = useState('');
  const [clientModel, setClientModel] = useState('');

  useEffect(() => {
    if (registering) return;
    if (!loading && user && profile) {
      if (profile.role === 'super_admin') {
        router.push('/admin');
      } else if (isGarageStaff(profile.role)) {
        router.push('/dashboard');
      } else if (profile.role === 'client') {
        router.push('/portal');
      }
    }
  }, [user, profile, loading, registering, router]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(signInEmail, signInPassword);
    if (error) {
      toast.error(t('login.toast.signinFailed'), { description: error });
    }
    setSubmitting(false);
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (signUpPassword.length < 6) {
      toast.error(t('login.toast.passwordShort'), { description: t('login.toast.passwordShortDesc') });
      return;
    }
    setSubmitting(true);
    const { error, session } = await signUp(signUpEmail, signUpPassword, signUpName);
    if (error) {
      toast.error(t('login.toast.signupFailed'), { description: error });
    } else if (session) {
      toast.success(t('login.toast.accountCreated'), { description: t('login.toast.welcome') });
    } else {
      toast.success(t('login.toast.accountCreated'), { description: t('login.toast.canLogin') });
      setSignInEmail(signUpEmail);
      setSignInPassword('');
      setSignUpName('');
      setSignUpEmail('');
      setSignUpPassword('');
      setActiveTab('signin');
    }
    setSubmitting(false);
  }

  async function handleClientRegister(e: React.FormEvent) {
    e.preventDefault();
    if (clientPassword.length < 6) {
      toast.error(t('login.toast.passwordShort'), { description: t('login.toast.passwordShortDesc') });
      return;
    }
    setSubmitting(true);

    try {
      setRegistering(true);
      const { error: signUpError, session } = await signUp(
        clientEmail,
        clientPassword,
        `${clientFirstName} ${clientLastName}`,
        { data: { account_type: 'client', first_name: clientFirstName, last_name: clientLastName, phone: clientPhone, brand: clientBrand, model: clientModel, plate: clientPlate } },
      );

      if (signUpError) {
        toast.error(t('login.toast.accountError'), { description: signUpError });
        setRegistering(false);
        setSubmitting(false);
        return;
      }

      if (session) {
        // Session active immediately — call register_client now
        const { error: regError } = await supabase.rpc('register_client', {
          p_first_name: clientFirstName,
          p_last_name: clientLastName,
          p_phone: clientPhone,
          p_brand: clientBrand || null,
          p_model: clientModel || null,
          p_plate: clientPlate || null,
        });

        if (regError) {
          toast.error(t('login.toast.regError'), { description: regError.message });
          setRegistering(false);
          setSubmitting(false);
          return;
        }

        await refreshProfile();
        setRegistering(false);
        toast.success(t('login.toast.clientCreated'), { description: t('login.toast.welcome') });
        router.push('/portal');
      } else {
        // No session (email confirmation on) — register_client will be
        // called automatically on first login via user_metadata.
        setRegistering(false);
        toast.success(t('login.toast.accountCreated'), { description: t('login.toast.canLogin') });
        setSignInEmail(clientEmail);
        setSignInPassword('');
        setActiveTab('signin');
      }
    } catch (err: any) {
      setRegistering(false);
      toast.error(t('login.toast.regError'), { description: err.message });
    }
    setSubmitting(false);
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setResetSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/reinitialiser-mot-de-passe`,
    });
    if (error) {
      toast.error(t('login.toast.regError'), { description: error.message });
    } else {
      setResetSent(true);
      toast.success(t('login.resetSent'), { description: t('login.resetSentDesc', { email: resetEmail }).split('.')[0] + '.' });
    }
    setResetSending(false);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-card">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-violet-600/5 blur-[100px]" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
              <Wrench className="h-7 w-7 text-primary-foreground" />
            </div>
            <span className="font-display text-2xl font-bold tracking-tight text-foreground">AtelierPro</span>
          </div>
          <div className="space-y-6">
            <h1 className="font-display text-4xl font-bold leading-tight text-foreground">
              {t('login.brandTitle').split('\n').map((line, i) => (
                <span key={i}>{i > 0 && <br />}{line}</span>
              ))}
            </h1>
            <p className="text-lg text-muted-foreground max-w-md leading-relaxed">
              {t('login.brandDesc').split('\n').map((line, i) => (
                <span key={i}>{i > 0 && <br />}{line}</span>
              ))}
            </p>
            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{t('login.forGarages')}</p>
                {[t('login.feature.invoicing'), t('login.feature.qrBill'), t('login.feature.stock')].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ArrowRight className="h-3 w-3 text-primary" /> {f}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">{t('login.forDrivers')}</p>
                {[t('login.feature.appointments'), t('login.feature.history'), t('login.feature.payment')].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ArrowRight className="h-3 w-3 text-primary" /> {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground/60">© 2026 AtelierPro</p>
            <LanguageSwitcher />
          </div>
        </div>
      </div>

      {/* Right panel — auth */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
                <Wrench className="h-7 w-7 text-primary-foreground" />
              </div>
              <span className="font-display text-2xl font-bold tracking-tight text-foreground">AtelierPro</span>
            </div>
            <LanguageSwitcher />
          </div>

          <Card className="border-border/40 bg-card shadow-2xl">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-foreground">{t('login.welcome')}</CardTitle>
              <CardDescription className="text-muted-foreground">{t('login.welcomeDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="signin">{t('login.tab.signin')}</TabsTrigger>
                  <TabsTrigger value="signup">{t('login.tab.signup')}</TabsTrigger>
                  <TabsTrigger value="client">{t('login.tab.client')}</TabsTrigger>
                </TabsList>

                <TabsContent value="signin">
                  <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signin-email">{t('login.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signin-email" type="email" placeholder="vous@atelier.ch" className="pl-10" value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="signin-password">{t('login.password')}</Label>
                        <button
                          type="button"
                          onClick={() => { setResetDialogOpen(true); setResetSent(false); setResetEmail(signInEmail); }}
                          className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                          {t('login.forgotPassword')}
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signin-password" type="password" placeholder="••••••••" className="pl-10" value={signInPassword} onChange={(e) => setSignInPassword(e.target.value)} required />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('login.signingIn')}</> : t('login.signinBtn')}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup">
                  <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-primary shrink-0" />
                    <p className="text-xs text-muted-foreground">{t('login.signupNote')}</p>
                  </div>
                  <form onSubmit={handleSignUp} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">{t('login.fullName')}</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signup-name" type="text" placeholder="Jean Dupont" className="pl-10" value={signUpName} onChange={(e) => setSignUpName(e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">{t('login.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signup-email" type="email" placeholder="vous@atelier.ch" className="pl-10" value={signUpEmail} onChange={(e) => setSignUpEmail(e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">{t('login.password')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="signup-password" type="password" placeholder="Min. 6" className="pl-10" value={signUpPassword} onChange={(e) => setSignUpPassword(e.target.value)} required minLength={6} />
                      </div>
                      <p className="text-xs text-muted-foreground">{t('login.passwordHint')}</p>
                    </div>
                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('login.creating')}</> : t('login.signupBtn')}
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="client">
                  <div className="mb-4 rounded-lg border border-success/20 bg-success/5 p-3 flex items-center gap-2">
                    <Car className="h-4 w-4 text-success shrink-0" />
                    <p className="text-xs text-muted-foreground">{t('login.clientNote')}</p>
                  </div>
                  <form onSubmit={handleClientRegister} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="client-first">{t('login.firstName')} *</Label>
                        <Input id="client-first" required value={clientFirstName} onChange={(e) => setClientFirstName(e.target.value)} placeholder="Sophie" />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="client-last">{t('login.lastName')} *</Label>
                        <Input id="client-last" required value={clientLastName} onChange={(e) => setClientLastName(e.target.value)} placeholder="Rochat" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="client-email">{t('login.email')} *</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="client-email" type="email" required className="pl-10" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="sophie@email.ch" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="client-phone">{t('login.phone')} *</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="client-phone" required className="pl-10" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+41 79 555 12 34" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="client-password">{t('login.password')} *</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="client-password" type="password" required minLength={6} className="pl-10" value={clientPassword} onChange={(e) => setClientPassword(e.target.value)} placeholder="Min. 6" />
                      </div>
                      <p className="text-xs text-muted-foreground">{t('login.passwordHint')}</p>
                    </div>
                    <div className="pt-2 border-t border-border/40">
                      <p className="text-xs font-medium text-muted-foreground mb-2">{t('login.yourVehicle')}</p>
                      <div className="grid grid-cols-3 gap-2">
                        <Input placeholder={t('vehicles.brand')} value={clientBrand} onChange={(e) => setClientBrand(e.target.value)} />
                        <Input placeholder={t('vehicles.model')} value={clientModel} onChange={(e) => setClientModel(e.target.value)} />
                        <Input placeholder="VD 123 456" value={clientPlate} onChange={(e) => setClientPlate(e.target.value)} />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('login.creating')}</> : t('login.clientBtn')}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 items-center">
              <p className="text-xs text-muted-foreground text-center">
                {t('login.terms').split('\n').map((line, i) => (
                  <span key={i}>{i > 0 && <br />}{line}</span>
                ))}
              </p>
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3 w-3" />
                {t('login.backHome')}
              </button>
            </CardFooter>
          </Card>
        </div>
      </div>

      {/* Password reset dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('login.resetTitle')}</DialogTitle>
          </DialogHeader>
          {resetSent ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/5 p-4">
                <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">{t('login.resetSent')}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('login.resetSentDesc', { email: resetEmail })}
                  </p>
                </div>
              </div>
              <Button className="w-full" onClick={() => setResetDialogOpen(false)}>
                {t('common.close')}
              </Button>
            </div>
          ) : (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {t('login.resetDesc')}
              </p>
              <div className="space-y-2">
                <Label htmlFor="reset-email">{t('login.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="reset-email" type="email" required className="pl-10" placeholder="vous@email.ch" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResetDialogOpen(false)}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={resetSending}>
                  {resetSending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t('login.resetSending')}</> : t('login.resetSendBtn')}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
