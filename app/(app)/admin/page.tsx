'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useI18n } from '@/lib/i18n/context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from '@/components/page-header';
import { Building2, Users, UserCircle, DollarSign, ShieldCheck, ShieldOff, Loader2, Bell, Clock } from 'lucide-react';
import { formatCHF } from '@/lib/types/database';

interface GarageAggregate {
  id: string;
  name: string;
  created_at: string;
  subscription_status: 'active' | 'suspended' | 'trial';
  employee_count: number;
  client_count: number;
  total_revenue: number;
}

interface SupportRequest {
  id: string;
  garage_id: string;
  garage_name: string;
  reason: string | null;
  status: string;
  created_at: string;
  requested_by_name: string;
}

export default function AdminPage() {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();
  const [garages, setGarages] = useState<GarageAggregate[]>([]);
  const [supportRequests, setSupportRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);

    const [statsRes, garagesRes, supportRes] = await Promise.all([
      supabase.rpc('admin_garage_stats'),
      supabase.from('garages').select('id, name').order('created_at', { ascending: false }),
      supabase.from('support_access_requests').select('id, garage_id, reason, status, created_at, requested_by').order('created_at', { ascending: false }),
    ]);

    const statsRows = (statsRes.data ?? []) as any[];
    const garageNameMap = new Map((garagesRes.data ?? []).map((g: any) => [g.id, g.name]));
    const allSupport = (supportRes.data ?? []) as any[];

    const aggregates: GarageAggregate[] = statsRows.map((row) => ({
      id: row.garage_id,
      name: row.garage_name,
      created_at: row.created_at,
      subscription_status: row.subscription_status,
      employee_count: Number(row.employee_count),
      client_count: Number(row.client_count),
      total_revenue: Number(row.total_revenue),
    }));

    setGarages(aggregates);

    const requesterIds = Array.from(new Set(allSupport.map((s) => s.requested_by)));
    const { data: requesterProfiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', requesterIds);

    const requesterMap = new Map((requesterProfiles ?? []).map((p: any) => [p.id, p.full_name]));

    const supportData: SupportRequest[] = allSupport.map((s) => ({
      id: s.id,
      garage_id: s.garage_id,
      garage_name: garageNameMap.get(s.garage_id) ?? 'Unknown',
      reason: s.reason,
      status: s.status,
      created_at: s.created_at,
      requested_by_name: requesterMap.get(s.requested_by) ?? 'Unknown',
    }));

    setSupportRequests(supportData);
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function toggleSubscription(garageId: string, currentStatus: string) {
    setActionLoading(garageId);
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const { error } = await supabase
      .from('garages')
      .update({ subscription_status: newStatus, subscription_updated_at: new Date().toISOString() })
      .eq('id', garageId);

    if (error) {
      console.error('Failed to update subscription:', error.message);
    } else {
      fetchData();
    }
    setActionLoading(null);
  }

  async function grantSupport(requestId: string) {
    setActionLoading(requestId);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 4);

    const { error: updateError } = await supabase
      .from('support_access_requests')
      .update({ status: 'granted', granted_at: new Date().toISOString(), expires_at: expiresAt.toISOString() })
      .eq('id', requestId);

    if (updateError) {
      console.error('Failed to grant support:', updateError.message);
    } else {
      fetchData();
    }
    setActionLoading(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeCount = garages.filter((g) => g.subscription_status === 'active').length;
  const suspendedCount = garages.filter((g) => g.subscription_status === 'suspended').length;
  const trialCount = garages.filter((g) => g.subscription_status === 'trial').length;
  const totalRevenue = garages.reduce((sum, g) => sum + g.total_revenue, 0);
  const pendingSupport = supportRequests.filter((s) => s.status === 'pending');

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{t('admin.panel.title')}</h1>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            {t('sidebar.garage.signout')}
          </Button>
        </div>
      </div>

      <div className="p-6 space-y-6">
        <PageHeader title={t('admin.panel.garagesTitle')} description={t('admin.panel.garagesDesc')} />

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                  <ShieldCheck className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('admin.panel.active')}</p>
                  <p className="text-xl font-bold">{activeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                  <Clock className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('admin.panel.trial')}</p>
                  <p className="text-xl font-bold">{trialCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                  <ShieldOff className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('admin.panel.suspended')}</p>
                  <p className="text-xl font-bold">{suspendedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('admin.panel.totalRevenue')}</p>
                  <p className="text-xl font-bold">{formatCHF(totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('admin.panel.garageName')}</TableHead>
                  <TableHead>{t('admin.panel.status')}</TableHead>
                  <TableHead className="text-center">{t('admin.panel.employees')}</TableHead>
                  <TableHead className="text-center">{t('admin.panel.clients')}</TableHead>
                  <TableHead className="text-right">{t('admin.panel.revenue')}</TableHead>
                  <TableHead>{t('admin.panel.created')}</TableHead>
                  <TableHead className="text-right">{t('admin.panel.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {garages.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {g.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={g.subscription_status === 'active' ? 'default' : g.subscription_status === 'trial' ? 'secondary' : 'destructive'}
                        className={g.subscription_status === 'active' ? 'bg-success' : ''}
                      >
                        {t(`admin.panel.status.${g.subscription_status}`)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="flex items-center justify-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        {g.employee_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="flex items-center justify-center gap-1">
                        <UserCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        {g.client_count}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCHF(g.total_revenue)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(g.created_at).toLocaleDateString('fr-CH')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant={g.subscription_status === 'active' ? 'destructive' : 'default'}
                        size="sm"
                        disabled={actionLoading === g.id}
                        onClick={() => toggleSubscription(g.id, g.subscription_status)}
                      >
                        {actionLoading === g.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : g.subscription_status === 'active' ? (
                          t('admin.panel.suspend')
                        ) : (
                          t('admin.panel.activate')
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {pendingSupport.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-warning" />
              <h2 className="text-base font-semibold">{t('admin.panel.supportRequests')} ({pendingSupport.length})</h2>
            </div>
            <Card className="border-warning/30 border-2">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.panel.garageName')}</TableHead>
                      <TableHead>{t('admin.panel.requestedBy')}</TableHead>
                      <TableHead>{t('admin.panel.reason')}</TableHead>
                      <TableHead>{t('admin.panel.requestDate')}</TableHead>
                      <TableHead className="text-right">{t('admin.panel.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingSupport.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.garage_name}</TableCell>
                        <TableCell>{s.requested_by_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{s.reason ?? '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(s.created_at).toLocaleDateString('fr-CH')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            disabled={actionLoading === s.id}
                            onClick={() => grantSupport(s.id)}
                          >
                            {actionLoading === s.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              t('admin.panel.grantAccess')
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
