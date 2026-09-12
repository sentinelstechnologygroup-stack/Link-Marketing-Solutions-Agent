import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { buildTenantFilter } from '@/lib/tenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Inbox, CalendarCheck, TrendingUp, AlertCircle } from 'lucide-react';

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700',
  contact_attempted: 'bg-amber-100 text-amber-700',
  connected: 'bg-purple-100 text-purple-700',
  qualified: 'bg-emerald-100 text-emerald-700',
  unqualified: 'bg-rose-100 text-rose-700',
  accepted: 'bg-emerald-100 text-emerald-700',
  warm_transfer: 'bg-indigo-100 text-indigo-700',
  appointment_scheduled: 'bg-cyan-100 text-cyan-700',
  closed: 'bg-slate-100 text-slate-700',
  lost: 'bg-rose-100 text-rose-700',
  duplicate: 'bg-orange-100 text-orange-700',
  do_not_call: 'bg-red-100 text-red-700',
};

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-3xl font-heading font-semibold mt-1">{value}</p>
          </div>
          <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${accent}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const filter = buildTenantFilter(user);
        const [leadData, brandData] = await Promise.all([
          base44.entities.Lead.filter(filter, '-created_date', 200),
          base44.entities.Brand.filter(buildTenantFilter(user), '-created_date', 50),
        ]);
        setLeads(leadData);
        setBrands(brandData);
      } catch (e) {
        console.error('Dashboard load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const metrics = useMemo(() => {
    const total = leads.length;
    const newLeads = leads.filter(l => l.lead_status === 'new').length;
    const qualified = leads.filter(l => l.qualification_status === 'qualified').length;
    const appointments = leads.filter(l => l.appointment_status === 'booked' || l.appointment_status === 'confirmed').length;
    const unworked = leads.filter(l => l.lead_status === 'new' && l.contact_attempts === 0).length;
    const byBrand = {};
    leads.forEach(l => {
      byBrand[l.brand_id] = (byBrand[l.brand_id] || 0) + 1;
    });
    return { total, newLeads, qualified, appointments, unworked, byBrand };
  }, [leads]);

  const brandMap = useMemo(() => {
    const m = {};
    brands.forEach(b => { m[b.id] = b; });
    return m;
  }, [brands]);

  const recentLeads = leads.slice(0, 8);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Lead response overview across your assigned brands</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Inbox} label="Total Leads" value={metrics.total} accent="bg-blue-50 text-blue-600" />
        <StatCard icon={AlertCircle} label="Unworked Leads" value={metrics.unworked} accent="bg-amber-50 text-amber-600" />
        <StatCard icon={TrendingUp} label="Qualified" value={metrics.qualified} accent="bg-emerald-50 text-emerald-600" />
        <StatCard icon={CalendarCheck} label="Appointments" value={metrics.appointments} accent="bg-cyan-50 text-cyan-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Leads</CardTitle>
            <Link to="/leads" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            {recentLeads.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No leads yet. Leads will appear here once they arrive.</p>
            ) : (
              <div className="space-y-2">
                {recentLeads.map(lead => (
                  <Link key={lead.id} to={`/leads/${lead.id}`} className="flex items-center justify-between rounded-lg border border-border px-4 py-3 hover:bg-accent/50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{lead.first_name} {lead.last_name || ''}</p>
                      <p className="text-xs text-muted-foreground truncate">{brandMap[lead.brand_id]?.display_name || 'Unknown brand'} · {lead.phone || lead.email || '—'}</p>
                    </div>
                    <Badge className={`${STATUS_COLORS[lead.lead_status] || 'bg-slate-100 text-slate-700'} border-0`}>{lead.lead_status.replace(/_/g, ' ')}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads by Brand</CardTitle>
          </CardHeader>
          <CardContent>
            {brands.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No brands configured.</p>
            ) : (
              <div className="space-y-3">
                {brands.map(brand => (
                  <div key={brand.id} className="flex items-center justify-between">
                    <span className="text-sm truncate">{brand.display_name}</span>
                    <span className="text-sm font-semibold">{metrics.byBrand[brand.id] || 0}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}