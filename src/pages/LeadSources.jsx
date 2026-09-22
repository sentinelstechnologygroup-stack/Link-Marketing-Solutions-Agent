import React, { useEffect, useState } from 'react';
import { EmptyDataTable } from '@/components/CollectionStructure';
import { api, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { AuthError, ErrorState, TenantBadge } from '@/components/ContractState';
import { Plus, Pencil, Radio } from 'lucide-react';

const SOURCE_TYPES = ['website_form', 'landing_page', 'ppc', 'social_media', 'crm_integration', 'phone_call', 'sms_reply', 'manual_entry', 'api_webhook'];

export default function LeadSources() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const [sources, brands] = await Promise.all([
        api.getLeadSources(user),
        api.getBrands(user),
      ]);
      setData({ sources, brands });
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
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Lead Sources</h1>
          <p className="text-muted-foreground text-sm mt-1">Track where leads originate for each brand</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => { setEditing(null); setShowDialog(true); }}><Plus className="h-4 w-4 mr-2" />New Source</Button>
          <TenantBadge tenant={data.sources.tenant} />
        </div>
      </div>

      {data.sources.count === 0 ? (
        <EmptyDataTable
          title="Lead sources"
          columns={['Source', 'Brand', 'Channel', 'Campaign', 'Status', 'Updated']}
          message="No lead sources are configured yet. Use New Source to connect the first source."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.sources.items.map(s => (
            <Card key={s.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Radio className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-heading font-semibold text-sm">{s.name}</h3>
                      <p className="text-xs text-muted-foreground">{brandMap[s.brand_id]?.display_name || '—'}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setShowDialog(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge variant="outline" className="text-xs">{s.source_type.replace(/_/g, ' ')}</Badge>
                  <Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="text-xs">{s.status}</Badge>
                </div>
                {s.default_landing_page && <p className="text-xs text-muted-foreground mt-2 truncate">{s.default_landing_page}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showDialog && (
        <SourceDialog source={editing} brands={data.brands.items} onClose={() => setShowDialog(false)} onSaved={load} />
      )}
    </div>
  );
}

function SourceDialog({ source, brands, onClose, onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    organization_id: source?.organization_id || user?.organization_id || brands[0]?.organization_id || '',
    brand_id: source?.brand_id || brands[0]?.id || '',
    campaign_id: source?.campaign_id || '',
    name: source?.name || '',
    source_type: source?.source_type || 'website_form',
    default_landing_page: source?.default_landing_page || '',
    status: source?.status || 'active',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.brand_id) { toast({ title: 'Name and brand required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (source) { await api.putLeadSource(user, source.id, form); toast({ title: 'Source updated' }); }
      else { await api.postLeadSource(user, form); toast({ title: 'Source created' }); }
      onSaved(); onClose();
    } catch (err) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{source ? 'Edit Lead Source' : 'New Lead Source'}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Brand *</Label>
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.brand_id} onChange={e => setForm({ ...form, brand_id: e.target.value, organization_id: brands.find(b => b.id === e.target.value)?.organization_id || form.organization_id })}>
            {brands.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
          </select>
        </div>
        <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Source type</Label>
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.source_type} onChange={e => setForm({ ...form, source_type: e.target.value })}>
            {SOURCE_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
        <div><Label>Default landing page URL</Label><Input value={form.default_landing_page} onChange={e => setForm({ ...form, default_landing_page: e.target.value })} placeholder="https://..." /></div>
        <div><Label>Status</Label>
          <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option><option value="inactive">Inactive</option>
          </select>
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

function Spinner() { return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }

