'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ROLE_LABELS, type Profile, type UserRole } from '@/lib/types/database';
import { UserCircle, Plus, Loader2, Shield, Wrench, Trash2, Mail, Phone, Briefcase, KeyRound, Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';

export default function EquipePage() {
  const { profile: currentUser } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useI18n();

  const [newMember, setNewMember] = useState({
    email: '',
    full_name: '',
    role: 'mecanicien' as UserRole,
    phone: '',
  });

  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('role', ['admin', 'mecanicien', 'secretaire'])
      .order('created_at', { ascending: false });
    if (error) {
      toast.error(t('team.fetchError'));
    } else {
      setMembers(data as Profile[]);
    }
    setLoading(false);
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    const { data, error } = await supabase.rpc('create_employee', {
      p_email: newMember.email,
      p_full_name: newMember.full_name,
      p_role: newMember.role,
      p_phone: newMember.phone || '',
    });

    if (error) {
      toast.error(t('team.createError'), { description: error.message });
      setSubmitting(false);
      return;
    }

    const password = Array.isArray(data) ? data[0]?.temp_password : (data as any)?.temp_password;
    if (!password) {
      toast.error(t('team.createError'), { description: 'No password returned' });
      setSubmitting(false);
      return;
    }
    setCreatedPassword(password);
    toast.success(t('team.addedToast'));
    setDialogOpen(false);
    setNewMember({ email: '', full_name: '', role: 'mecanicien', phone: '' });
    fetchMembers();
    setSubmitting(false);
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    setResetSubmitting(true);
    const { data, error } = await supabase.rpc('reset_employee_password', {
      p_target_user_id: resetTarget.id,
    });
    if (error) {
      toast.error(t('team.resetError'), { description: error.message });
      setResetSubmitting(false);
      return;
    }
    const password = Array.isArray(data) ? data[0]?.temp_password : (data as any)?.temp_password;
    if (!password) {
      toast.error(t('team.resetError'), { description: 'No password returned' });
      setResetSubmitting(false);
      return;
    }
    setResetPassword(password);
    setResetSubmitting(false);
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function updateRole(member: Profile, role: UserRole) {
    if (!isAdmin) {
      toast.error(t('team.onlyAdmins'));
      return;
    }
    const { error } = await supabase.rpc('change_user_role', {
      p_target_user_id: member.id,
      p_new_role: role,
    });
    if (error) {
      toast.error(t('team.roleUpdateError'), { description: error.message });
    } else {
      toast.success(t('team.roleUpdatedToast'));
      fetchMembers();
    }
  }

  async function toggleActive(member: Profile) {
    if (!isAdmin) return;
    const { error } = await supabase.from('profiles').update({ active: !member.active }).eq('id', member.id);
    if (error) {
      toast.error('Erreur');
    } else {
      toast.success(member.active ? t('team.disabledToast') : t('team.enabledToast'));
      fetchMembers();
    }
  }

  async function handleDelete(member: Profile) {
    if (!isAdmin) return;
    if (member.id === currentUser?.id) {
      toast.error(t('team.cannotDeleteSelf'));
      return;
    }
    const { error } = await supabase.from('profiles').delete().eq('id', member.id);
    if (error) {
      toast.error(t('team.deleteError'));
    } else {
      toast.success(t('team.deletedToast'));
      fetchMembers();
    }
  }

  function getInitials(name: string) {
    return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  }

  const adminCount = members.filter((m) => m.role === 'admin').length;
  const mecanicienCount = members.filter((m) => m.role === 'mecanicien').length;
  const secretaireCount = members.filter((m) => m.role === 'secretaire').length;

  return (
    <div className="p-6 space-y-6">
      <PageHeader title={t('admin.team.title')} description={t('admin.team.desc')}>
        {isAdmin && (
          <Button onClick={() => { setDialogOpen(true); setCreatedPassword(null); }}>
            <Plus className="h-4 w-4 mr-2" />
            {t('common.add')}
          </Button>
        )}
      </PageHeader>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <UserCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('team.totalMembers')}</p>
                <p className="text-xl font-bold">{members.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('team.admins')}</p>
                <p className="text-xl font-bold">{adminCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Wrench className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('team.mechanics')}</p>
                <p className="text-xl font-bold">{mecanicienCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <Briefcase className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t('team.secretaries')}</p>
                <p className="text-xl font-bold">{secretaireCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('team.member')}</TableHead>
                  <TableHead>{t('team.email')}</TableHead>
                  <TableHead>{t('team.phone')}</TableHead>
                  <TableHead>{t('team.role')}</TableHead>
                  <TableHead className="text-center">{t('team.status')}</TableHead>
                  {isAdmin && <TableHead className="text-right">{t('team.actions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id} className="hover:bg-secondary/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                            {getInitials(member.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.full_name}</p>
                          {member.id === currentUser?.id && (
                            <span className="text-xs text-primary">{t('team.you')}</span>
                          )}
                          {member.must_change_password && (
                            <span className="text-xs text-warning ml-1">({t('team.mustChangePwd')})</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{member.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{member.phone ?? '—'}</TableCell>
                    <TableCell>
                      {isAdmin && member.id !== currentUser?.id ? (
                        <Select
                          value={member.role}
                          onValueChange={(v) => updateRole(member, v as UserRole)}
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{t('role.admin')}</SelectItem>
                            <SelectItem value="mecanicien">{t('role.mecanicien')}</SelectItem>
                            <SelectItem value="secretaire">{t('role.secretaire')}</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                          {member.role === 'admin' ? (
                            <><Shield className="h-3 w-3 mr-1" /> {t('role.admin')}</>
                          ) : member.role === 'secretaire' ? (
                            <><Briefcase className="h-3 w-3 mr-1" /> {t('role.secretaire')}</>
                          ) : (
                            <><Wrench className="h-3 w-3 mr-1" /> {t('role.mecanicien')}</>
                          )}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isAdmin && member.id !== currentUser?.id ? (
                        <Switch
                          checked={member.active}
                          onCheckedChange={() => toggleActive(member)}
                        />
                      ) : (
                        <Badge variant={member.active ? 'default' : 'outline'} className={member.active ? 'bg-success' : ''}>
                          {member.active ? t('team.active') : t('team.inactive')}
                        </Badge>
                      )}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {member.id !== currentUser?.id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title={t('team.resetPassword')}
                              onClick={() => { setResetTarget(member); setResetPassword(null); }}
                            >
                              <KeyRound className="h-4 w-4 text-primary" />
                            </Button>
                          )}
                          {member.id !== currentUser?.id && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>{t('common.delete')}</DialogTitle>
                                </DialogHeader>
                                <p className="text-sm text-muted-foreground">
                                  {t('team.deleteConfirm', { name: member.full_name })}
                                </p>
                                <DialogFooter>
                                  <Button variant="outline">{t('common.cancel')}</Button>
                                  <Button variant="destructive" onClick={() => handleDelete(member)}>
                                    {t('common.delete')}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add member dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setCreatedPassword(null); }}>
        <DialogContent onInteractOutside={(e) => { if (createdPassword) e.preventDefault(); }}>
          {createdPassword ? (
            <>
              <DialogHeader>
                <DialogTitle>{t('team.accountCreated')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
                  <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t('team.tempPasswordWarning')}</p>
                    <p className="text-xs text-muted-foreground">{t('team.tempPasswordWarningDesc')}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('team.tempPassword')}</Label>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={createdPassword} className="font-mono" />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(createdPassword)}
                    >
                      {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => { setDialogOpen(false); setCreatedPassword(null); }}>
                  {t('common.close')}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{t('team.addMember')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddMember} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="member-name">{t('team.fullName')} *</Label>
                  <Input
                    id="member-name"
                    required
                    placeholder="Jean Dupont"
                    value={newMember.full_name}
                    onChange={(e) => setNewMember({ ...newMember, full_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="member-email">{t('team.email')} *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="member-email"
                      type="email"
                      required
                      placeholder="membre@atelier.ch"
                      className="pl-10"
                      value={newMember.email}
                      onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="member-phone">{t('team.phone')}</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="member-phone"
                        placeholder="+41 79 555 12 34"
                        className="pl-10"
                        value={newMember.phone}
                        onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="member-role">{t('team.role')}</Label>
                    <Select
                      value={newMember.role}
                      onValueChange={(v) => setNewMember({ ...newMember, role: v as UserRole })}
                    >
                      <SelectTrigger id="member-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mecanicien">{t('role.mecanicien')}</SelectItem>
                        <SelectItem value="secretaire">{t('role.secretaire')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    {t('common.save')}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => { if (!open) { setResetTarget(null); setResetPassword(null); } }}>
        <DialogContent onInteractOutside={(e) => { if (resetPassword) e.preventDefault(); }}>
          {resetTarget && (
            <>
              <DialogHeader>
                <DialogTitle>{t('team.resetPasswordTitle')}</DialogTitle>
              </DialogHeader>
              {resetPassword ? (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
                    <AlertCircle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t('team.tempPasswordWarning')}</p>
                      <p className="text-xs text-muted-foreground">{t('team.tempPasswordWarningDesc')}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('team.tempPassword')}</Label>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={resetPassword} className="font-mono" />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => copyToClipboard(resetPassword)}
                      >
                        {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => { setResetTarget(null); setResetPassword(null); }}>
                      {t('common.close')}
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {t('team.resetConfirm', { name: resetTarget.full_name })}
                  </p>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setResetTarget(null)}>
                      {t('common.cancel')}
                    </Button>
                    <Button onClick={handleResetPassword} disabled={resetSubmitting}>
                      {resetSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <KeyRound className="h-4 w-4 mr-2" />}
                      {t('team.resetPassword')}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
