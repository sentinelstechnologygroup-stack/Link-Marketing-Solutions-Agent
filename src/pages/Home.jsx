// @ts-nocheck
import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { firebaseClient } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { buildTenantFilter } from '@/lib/tenantContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis
} from 'recharts';
import { Inbox, CalendarCheck, TrendingUp, AlertCircle, ArrowRight, MessageSquareText } from 'lucide-react';

const STATUS_COLORS = {
  new: 'bg-[#00838f]/10 text-[#00747d]',
  contact_attempted: 'bg-[#d4af37]/15 text-[#8a6618]',
  connected: 'bg-violet-100 text-violet-700',
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

function MetricCard({ icon: Icon, label, value, detail, gold = false }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[#6b7879]">{label}</p>
            <p className="mt-3 font-body text-3xl font-bold tracking-tight text-[#071b1e]">{value}</p>
          </div>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${gold ? 'bg-[#d4af37]/15 text-[#9a741f]' : 'bg-[#00838f]/10 text-[#00747d]'}`}>
            <Icon className="h-5 w-5" />
          </span>
        </div>
        <p className="mt-3 text-xs text-[#7a8586]">{detail}</p>
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
          firebaseClient.entities.Lead.filter(filter, '-created_date', 200),
          firebaseClient.entities.Brand.filter(buildTenantFilter(user), '-created_date', 50),
        ]);
        setLeads(leadData);
        setBrands(brandData);
      } catch (error) {
        console.error('Dashboard load error', error);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const brandMap = useMemo(() => Object.fromEntries(brands.map(brand => [brand.id, brand])), [brands]);

  const metrics = useMemo(() => {
    const total = leads.length;
    const newLeads = leads.filter(lead => lead.lead_status === 'new').length;
    const qualified = leads.filter(lead => lead.qualification_status === 'qualified').length;
    const connected = leads.filter(lead => ['connected', 'qualified', 'accepted', 'warm_transfer', 'appointment_scheduled', 'closed'].includes(lead.lead_status)).length;
    const appointments = leads.filter(lead => ['booked', 'confirmed'].includes(lead.appointment_status) || ['warm_transfer', 'appointment_scheduled'].includes(lead.lead_status)).length;
    const unworked = leads.filter(lead => lead.lead_status === 'new' && Number(lead.contact_attempts || 0) === 0).length;
    const percent = (part) => total ? Math.round((part / total) * 100) : 0;

    const byBrand = brands.map(brand => ({
      name: brand.display_name?.length > 16 ? brand.display_name.slice(0, 14) + '…' : brand.display_name,
      leads: leads.filter(lead => lead.brand_id === brand.id).length,
    })).filter(item => item.leads > 0).sort((a, b) => b.leads - a.leads).slice(0, 6);

    const activity = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const next = new Date(date);
      next.setDate(next.getDate() + 1);
      const daily = leads.filter(lead => {
        const created = new Date(lead.created_date);
        return created >= date && created < next;
      });
      return {
        day: date.toLocaleDateString(undefined, { weekday: 'short' }),
        received: daily.length,
        qualified: daily.filter(lead => lead.qualification_status === 'qualified').length,
      };
    });

    return { total, newLeads, connected, qualified, appointments, unworked, percent, byBrand, activity };
  }, [leads, brands]);

  const recentLeads = leads.slice(0, 7);

  if (loading) {
    return <div className="flex items-center justify-center py-28"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#00838f]/20 border-t-[#00838f]" /></div>;
  }

  const journey = [
    ['Received', metrics.total, 100],
    ['Connected', metrics.connected, metrics.percent(metrics.connected)],
    ['Qualified', metrics.qualified, metrics.percent(metrics.qualified)],
    ['Handoff', metrics.appointments, metrics.percent(metrics.appointments)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="link-eyebrow">Operations overview</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-[#071b1e] sm:text-4xl">Lead Response Dashboard</h1>
          <p className="mt-2 text-sm leading-6 text-[#647274]">Live visibility across response, qualification, appointments and sales handoff.</p>
        </div>
        <Link to="/workspace" className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#071b1e] px-4 py-3 text-xs font-bold text-white shadow-sm transition hover:bg-[#0b3034]">
          Open agent workspace <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Inbox} label="Leads received" value={metrics.total} detail={`${metrics.newLeads} currently new`} />
        <MetricCard icon={AlertCircle} label="Unworked leads" value={metrics.unworked} detail="Requires immediate response" gold />
        <MetricCard icon={TrendingUp} label="Qualified" value={metrics.qualified} detail={`${metrics.percent(metrics.qualified)}% of received leads`} />
        <MetricCard icon={CalendarCheck} label="Appointments / transfers" value={metrics.appointments} detail={`${metrics.percent(metrics.appointments)}% handoff rate`} gold />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_.65fr]">
        <Card>
          <CardHeader className="border-b border-[#071b1e]/[.08] pb-4">
            <div>
              <p className="link-eyebrow">Seven-day activity</p>
              <CardTitle className="mt-2 font-heading text-xl text-[#071b1e]">Program performance</CardTitle>
              <p className="mt-1 text-xs text-[#788485]">Received leads and qualified opportunities</p>
            </div>
          </CardHeader>
          <CardContent className="h-[300px] px-2 pb-4 pt-5 sm:px-5">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics.activity}>
                <defs>
                  <linearGradient id="crmLeadFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00838f" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#00838f" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e8e3d9" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#718082' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#718082' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#d8d2c6', fontSize: 12 }} />
                <Area type="monotone" dataKey="received" stroke="#00838f" strokeWidth={2.5} fill="url(#crmLeadFill)" />
                <Area type="monotone" dataKey="qualified" stroke="#d4af37" strokeWidth={2.5} fill="transparent" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-[#071b1e]/[.08] pb-4">
            <p className="link-eyebrow">Conversion path</p>
            <CardTitle className="mt-2 font-heading text-xl text-[#071b1e]">Lead journey</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 pt-6">
            {journey.map(([label, value, width], index) => (
              <div key={label}>
                <div className="mb-2 flex justify-between text-xs">
                  <span className="font-semibold text-[#405054]">{label}</span>
                  <span className="text-[#7b8788]">{value} · {width}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#ece8df]">
                  <div className={`h-full rounded-full ${index === journey.length - 1 ? 'bg-[#d4af37]' : 'bg-[#00838f]'}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            ))}
            <div className="rounded-xl bg-[#071b1e] p-4 text-white">
              <p className="text-[10px] uppercase tracking-[.17em] text-[#d4af37]">Operational focus</p>
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold"><MessageSquareText className="h-4 w-4" /> Real conversations, structured results.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between border-b border-[#071b1e]/[.08] pb-4">
            <div><CardTitle className="font-heading text-xl">Recent lead activity</CardTitle><p className="mt-1 text-xs text-[#788485]">Latest conversations and handoffs</p></div>
            <Link to="/leads" className="text-xs font-bold text-[#00747d]">View all</Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentLeads.length === 0 ? (
              <p className="px-6 py-14 text-center text-sm text-muted-foreground">No leads yet. New activity will appear here.</p>
            ) : (
              <div className="divide-y divide-[#071b1e]/[.08]">
                {recentLeads.map(lead => (
                  <Link key={lead.id} to={`/leads/${lead.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-[#faf8f3] sm:px-6">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#243b3e]">{lead.first_name} {lead.last_name || ''}</p>
                      <p className="mt-1 truncate text-xs text-[#7b8788]">{brandMap[lead.brand_id]?.display_name || 'Unknown brand'} · {lead.phone || lead.email || '—'}</p>
                    </div>
                    <Badge className={`${STATUS_COLORS[lead.lead_status] || 'bg-slate-100 text-slate-700'} shrink-0 border-0`}>{lead.lead_status?.replace(/_/g, ' ') || 'new'}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b border-[#071b1e]/[.08] pb-4">
            <CardTitle className="font-heading text-xl">Leads by brand</CardTitle>
            <p className="text-xs text-[#788485]">Current assignment volume</p>
          </CardHeader>
          <CardContent className="h-[300px] px-2 pb-5 pt-5 sm:px-5">
            {metrics.byBrand.length === 0 ? (
              <p className="py-20 text-center text-sm text-muted-foreground">No brand activity yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.byBrand} layout="vertical" margin={{ left: 8, right: 18 }}>
                  <CartesianGrid stroke="#e8e3d9" strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: '#718082' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={88} tick={{ fontSize: 10, fill: '#4b5d60' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: '#d8d2c6', fontSize: 12 }} />
                  <Bar dataKey="leads" fill="#00838f" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

