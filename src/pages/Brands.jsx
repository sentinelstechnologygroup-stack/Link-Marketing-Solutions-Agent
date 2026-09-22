import React, { useEffect, useState } from 'react';
import { EmptyRecordCard } from '@/components/CollectionStructure';
import { firebaseClient } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { buildTenantFilter, canManageBrands } from '@/lib/tenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Pencil } from 'lucide-react';

export default function Brands() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [brands, setBrands] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const canManage = canManageBrands(user?.role) || user?.role === 'admin';

  const load = async () => {
    try {
      const [b, o] = await Promise.all([
        firebaseClient.entities.Brand.filter(buildTenantFilter(user), '-created_date', 100),
        firebaseClient.entities.Organization.list(50),
      ]);
      setBrands(b); setOrgs(o);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user]);

  const openCreate = () => { setEditing(null); setShowDialog(true); };
  const openEdit = (b) => { setEditing(b); setShowDialog(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-heading font-semibold tracking-tight">Brands</h1><p className="text-muted-foreground text-sm mt-1">Configure each company's caller ID, greetings, and policies</p></div>
        {canManage && <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> New Brand</Button>}
      </div>
      {loading ? <Spinner /> : (
        <div className="grid gap-4 md:grid-cols-2">
                  {brands.length === 0 && (
          <EmptyRecordCard
            title="Brand profile"
            fields={['Display name', 'Industry', 'Default greeting', 'Status']}
            message="No brands are configured yet. Use New Brand to add the first client brand."
          />
        )}
        {brands.map(b => (
            <Card key={b.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-heading font-semibold">{b.display_name}</h3>
                    <p className="text-xs text-muted-foreground">{b.legal_name || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={b.status === 'active' ? 'default' : 'secondary'}>{b.status}</Badge>
                    {canManage && <Button size="sm" variant="ghost" onClick={() => openEdit(b)}><Pencil className="h-3.5 w-3.5" /></Button>}
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {b.caller_id_display_name && <p>Caller ID: {b.caller_id_display_name}</p>}
                  {b.business_hours_start && <p>Hours: {b.business_hours_start}–{b.business_hours_end} {b.timezone || ''}</p>}
                  {b.after_hours_rule && <p>After hours: {b.after_hours_rule.replace(/_/g, ' ')}</p>}
                  {b.consent_language && <p className="truncate">Consent: {b.consent_language}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {showDialog && <BrandDialog brand={editing} orgs={orgs} onClose={() => setShowDialog(false)} onSaved={load} />}
    </div>
  );
}

function BrandDialog({ brand, orgs, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    organization_id: brand?.organization_id || orgs[0]?.id || '',
    legal_name: brand?.legal_name || '',
    display_name: brand?.display_name || '',
    description: brand?.description || '',
    caller_id_display_name: brand?.caller_id_display_name || '',
    default_greeting: brand?.default_greeting || '',
    after_hours_greeting: brand?.after_hours_greeting || '',
    business_hours_start: brand?.business_hours_start || '09:00',
    business_hours_end: brand?.business_hours_end || '17:00',
    timezone: brand?.timezone || 'America/Chicago',
    after_hours_rule: brand?.after_hours_rule || 'voicemail',
    consent_language: brand?.consent_language || '',
    opt_out_procedure: brand?.opt_out_procedure || '',
    recording_retention_days: brand?.recording_retention_days || 365,
    appointment_buffer_minutes: brand?.appointment_buffer_minutes || 30,
    status: brand?.status || 'active',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.display_name || !form.organization_id) { toast({ title: 'Name and organization required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      if (brand) { await firebaseClient.entities.Brand.update(brand.id, form); toast({ title: 'Brand updated' }); }
      else { await firebaseClient.entities.Brand.create(form); toast({ title: 'Brand created' }); }
      onSaved(); onClose();
    } catch (err) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{brand ? 'Edit Brand' : 'New Brand'}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Organization *</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.organization_id} onChange={e => setForm({...form, organization_id: e.target.value})}>{orgs.map(o => <option key={o.id} value={o.id}>{o.display_name}</option>)}</select></div>
          <div><Label>Status</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.status} onChange={e => setForm({...form, status: e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Display name *</Label><Input value={form.display_name} onChange={e => setForm({...form, display_name: e.target.value})} /></div>
          <div><Label>Legal name</Label><Input value={form.legal_name} onChange={e => setForm({...form, legal_name: e.target.value})} /></div>
        </div>
        <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Caller ID display name</Label><Input value={form.caller_id_display_name} onChange={e => setForm({...form, caller_id_display_name: e.target.value})} /></div>
          <div><Label>Timezone</Label><Input value={form.timezone} onChange={e => setForm({...form, timezone: e.target.value})} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Business hours start</Label><Input value={form.business_hours_start} onChange={e => setForm({...form, business_hours_start: e.target.value})} placeholder="09:00" /></div>
          <div><Label>Business hours end</Label><Input value={form.business_hours_end} onChange={e => setForm({...form, business_hours_end: e.target.value})} placeholder="17:00" /></div>
        </div>
        <div><Label>Default greeting</Label><Textarea rows={2} value={form.default_greeting} onChange={e => setForm({...form, default_greeting: e.target.value})} /></div>
        <div><Label>After-hours greeting</Label><Textarea rows={2} value={form.after_hours_greeting} onChange={e => setForm({...form, after_hours_greeting: e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>After-hours rule</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.after_hours_rule} onChange={e => setForm({...form, after_hours_rule: e.target.value})}><option value="voicemail">Voicemail</option><option value="callback_request">Callback request</option><option value="overflow_queue">Overflow queue</option></select></div>
          <div><Label>Recording retention (days)</Label><Input type="number" value={form.recording_retention_days} onChange={e => setForm({...form, recording_retention_days: Number(e.target.value)})} /></div>
        </div>
        <div><Label>Consent language</Label><Textarea rows={2} value={form.consent_language} onChange={e => setForm({...form, consent_language: e.target.value})} /></div>
        <div><Label>Opt-out procedure</Label><Textarea rows={2} value={form.opt_out_procedure} onChange={e => setForm({...form, opt_out_procedure: e.target.value})} /></div>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

function Spinner() { return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }


