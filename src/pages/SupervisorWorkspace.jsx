import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuthError, ErrorState, EmptyState, TenantBadge } from '@/components/ContractState';
import { Users, AlertCircle, Clock, TrendingUp } from 'lucide-react';

export default function SupervisorWorkspace() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await api.getSupervisorWorkspace(user)); }
    catch (e) { setError(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user]);

  if (loading) return <Spinner />;
  if (error) return error instanceof ApiError && (error.status === 401 || error.status === 403)
    ? <AuthError error={error} onRetry={load} /> : <ErrorState error={error} onRetry={load} />;
  if (!data) return null;

  const s = data.summary;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-heading font-semibold tracking-tight">Supervisor Workspace</h1><p className="text-muted-foreground text-sm mt-1">Agent availability, coverage gaps, and overdue work</p></div>
        <TenantBadge tenant={data.tenant} />
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Leads" value={s.total_leads} icon={Users} accent="bg-blue-50 text-blue-600" />
        <StatCard label="Unworked" value={s.unworked} icon={AlertCircle} accent="bg-amber-50 text-amber-600" />
        <StatCard label="Overdue Follow-ups" value={s.overdue_followups} icon={Clock} accent="bg-rose-50 text-rose-600" />
        <StatCard label="Qualified" value={s.qualified} icon={TrendingUp} accent="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Agent Availability</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.agents.length === 0 ? <EmptyState message="No agents." /> :
              data.agents.map(a => (
                <div key={a.id} className="flex items-center justify-between border border-border rounded p-2">
                  <span className="text-sm font-medium">{a.name}</span>
                  <Badge variant="outline" className="capitalize">{(a.agent_status || 'offline').replace(/_/g, ' ')}</Badge>
                </div>
              ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Overdue Follow-ups</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.overdue.length === 0 ? <EmptyState message="No overdue follow-ups." /> :
              data.overdue.slice(0, 10).map(t => (
                <Link key={t.id} to={`/leads/${t.lead_id}`} className="flex items-center justify-between border border-border rounded p-2 hover:bg-accent/30">
                  <span className="text-sm">{t.task_type.replace(/_/g, ' ')}</span>
                  <span className="text-xs text-muted-foreground">{new Date(t.due_date).toLocaleString()}</span>
                </Link>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <Card><CardContent className="p-4 flex items-center justify-between">
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-heading font-semibold mt-1">{value}</p></div>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent}`}><Icon className="h-5 w-5" /></div>
    </CardContent></Card>
  );
}

function Spinner() { return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }
