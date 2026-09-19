import React, { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { AuthError, ErrorState, EmptyState, TenantBadge } from '@/components/ContractState';
import { Plus, Pencil, Megaphone } from 'lucide-react';

const STATUS_COLORS = {
  draft: 'bg-slate-100 text-slate-700',
  active: 'bg-emerald-100 text-emerald-700',
  paused: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
};

export default function Campaigns() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [campaigns, brands] = await Promise.all([
        api.getCampaigns(user),
        api.getBrands(user),
      ]);
      setData({ campaigns, brands });
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user]);

  if (loading) return <Spinner />;
  if (error) return error instanceof ApiError && (error.status === 401 || error.status === 403)
    ? <AuthError error={error} onRetry={load} /> : <ErrorState error={error} onRetry={load} />;
  if (!data) return null;

  const brandMap = Object.fromEntries(data.brands.items.map(b => [b.id, b]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground text-sm mt-1">Organize lead generation by brand and campaign</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => { setEditing(null); setShowDialog(true); }}><Plus className="h-4 w-4 mr-2" />New Campaign</Button>
          <TenantBadge tenant={data.campaigns.tenant} />
        </div>
      </div>

      {data.campaigns.count === 0 ? (
        <Card><CardContent className="py-16"><EmptyState message="No campaigns yet. Create one to start organizing leads." /></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.campaigns.items.map(c => (
            <Card key={c.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Megaphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold">{c.name}</h3>
                      <p className="text-xs text-muted-foreground">{brandMap[c.brand_id]?.display_name || '—'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${STATUS_COLORS[c.status] || 'bg-slate-100'} border-0`}>{c.status}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(c); setShowDialog(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {c.description && <p className="text-sm text-muted-foreground mt-3">{c.description}</p>}
                <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                  {c.calling_hours_start && <span>Hours: {c.calling_hours_start}–{c.calling_hours_end}</span>}
                  <span>Priority: {c.priority}</span>
                  <span>{c.timezone}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showDialog && (
        <CampaignDialog
          campaign={editing}
          brands={data.brands.items}
          onClose={() => setShowDialog(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}

function CampaignDialog({ campaign, brands, onClose, onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    organization_id: campaign?.organization_id || user?.organization_id || brands[0]?.organization_id || '',
    brand_id: campaign?.brand_id || brands[0]?.id || '',
    name: campaign?.name || '',
    description: campaign?.description || '',
    status: campaign?.status || 'draft',
    priority: campaign?.priority || 5,
    calling_hours_start: campaign?.calling_hours_start || '09:00',
    calling_hours_end: campaign?.calling_hours_end || '17:00',
    timezone: campaign?.timezone || 'America/Chicago',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.brand_id) { toast({ title: 'Name and brand required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (campaign) { await api.putCampaign(user, campaign.id, form); toast({ title: 'Campaign updated' }); }
      else { await api.postCampaign(user, form); toast({ title: 'Campaign created' }); }
      onSaved(); onClose();
    } catch (err) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{campaign ? 'Edit Campaign' : 'New Campaign'}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Brand *</Label>
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.brand_id} onChange={e => setForm({ ...form, brand_id: e.target.value, organization_id: brands.find(b => b.id === e.target.value)?.organization_id || form.organization_id })}>
            {brands.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
          </select>
        </div>
        <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Status</Label>
            <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option>
            </select>
          </div>
          <div><Label>Priority (1=highest)</Label><Input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div><Label>Hours start</Label><Input value={form.calling_hours_start} onChange={e => setForm({ ...form, calling_hours_start: e.target.value })} placeholder="09:00" /></div>
          <div><Label>Hours end</Label><Input value={form.calling_hours_end} onChange={e => setForm({ ...form, calling_hours_end: e.target.value })} placeholder="17:00" /></div>
          <div><Label>Timezone</Label><Input value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })} /></div>
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

function Spinner() { return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }
