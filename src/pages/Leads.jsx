import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { buildTenantFilter } from '@/lib/tenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, Clock } from 'lucide-react';
import LeadFormDialog from '@/components/leads/LeadFormDialog';

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

const STATUS_OPTIONS = ['new', 'contact_attempted', 'connected', 'qualified', 'unqualified', 'accepted', 'warm_transfer', 'appointment_scheduled', 'closed', 'lost', 'duplicate', 'do_not_call'];

function leadAgeMinutes(lead) {
  const created = new Date(lead.created_date).getTime();
  return Math.round((Date.now() - created) / 60000);
}

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState([]);
  const [brands, setBrands] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const loadAll = async () => {
    try {
      const filter = buildTenantFilter(user);
      const [leadData, brandData, campaignData] = await Promise.all([
        base44.entities.Lead.filter(filter, '-created_date', 300),
        base44.entities.Brand.filter(buildTenantFilter(user), '-created_date', 50),
        base44.entities.Campaign.filter(buildTenantFilter(user), '-created_date', 50),
      ]);
      setLeads(leadData);
      setBrands(brandData);
      setCampaigns(campaignData);
    } catch (e) {
      console.error('Leads load error', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [user]);

  const brandMap = useMemo(() => Object.fromEntries(brands.map(b => [b.id, b])), [brands]);
  const campaignMap = useMemo(() => Object.fromEntries(campaigns.map(c => [c.id, c])), [campaigns]);

  const filtered = useMemo(() => {
    return leads
      .filter(l => statusFilter === 'all' || l.lead_status === statusFilter)
      .filter(l => brandFilter === 'all' || l.brand_id === brandFilter)
      .filter(l => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (l.first_name || '').toLowerCase().includes(q) ||
               (l.last_name || '').toLowerCase().includes(q) ||
               (l.email || '').toLowerCase().includes(q) ||
               (l.phone || '').includes(q);
      })
      .sort((a, b) => (a.priority || 5) - (b.priority || 5) || new Date(a.created_date) - new Date(b.created_date));
  }, [leads, search, statusFilter, brandFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Lead Inbox</h1>
          <p className="text-muted-foreground text-sm mt-1">Sorted by priority then freshness</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Lead
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="all">All statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="all">All brands</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No leads match your filters.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => {
            const age = leadAgeMinutes(lead);
            const ageLabel = age < 60 ? `${age}m` : age < 1440 ? `${Math.floor(age / 60)}h` : `${Math.floor(age / 1440)}d`;
            return (
              <Link key={lead.id} to={`/leads/${lead.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground w-7 text-center">{lead.priority || 5}</span>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />{ageLabel}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{lead.first_name} {lead.last_name || ''}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {brandMap[lead.brand_id]?.display_name || '—'} · {campaignMap[lead.campaign_id]?.name || '—'} · {lead.phone || lead.email || '—'}
                      </p>
                    </div>
                    <Badge className={`${STATUS_COLORS[lead.lead_status] || 'bg-slate-100 text-slate-700'} border-0`}>{lead.lead_status.replace(/_/g, ' ')}</Badge>
                    {lead.qualification_status === 'qualified' && <Badge className="bg-emerald-100 text-emerald-700 border-0">Qualified</Badge>}
                    {lead.appointment_status !== 'none' && <Badge className="bg-cyan-100 text-cyan-700 border-0">Appt: {lead.appointment_status}</Badge>}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <LeadFormDialog open={showCreate} onClose={() => setShowCreate(false)} brands={brands} campaigns={campaigns} onSaved={loadAll} />
    </div>
  );
}