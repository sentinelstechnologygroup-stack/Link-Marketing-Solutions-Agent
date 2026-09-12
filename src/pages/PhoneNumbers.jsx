import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { buildTenantFilter, canManageBrands } from '@/lib/tenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus } from 'lucide-react';

export default function PhoneNumbers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [numbers, setNumbers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const canManage = canManageBrands(user?.role) || user?.role === 'admin';

  const load = async () => {
    try {
      const [n, b] = await Promise.all([
        base44.entities.PhoneNumber.filter(buildTenantFilter(user), '-created_date', 100),
        base44.entities.Brand.filter(buildTenantFilter(user), '-created_date', 50),
      ]);
      setNumbers(n); setBrands(b);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user]);

  const brandMap = Object.fromEntries(brands.map(b => [b.id, b]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-heading font-semibold tracking-tight">Phone Numbers</h1><p className="text-muted-foreground text-sm mt-1">Dedicated numbers per brand and campaign</p></div>
        {canManage && <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Number</Button>}
      </div>
      {loading ? <Spinner/> : (
        <div className="grid gap-3 md:grid-cols-2">
          {numbers.map(n => (
            <Card key={n.id}><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="font-mono font-medium">{n.phone_number}</p><p className="text-xs text-muted-foreground">{brandMap[n.brand_id]?.display_name} · {n.number_type} · {n.provider}</p></div>
                <Badge variant={n.status === 'active' ? 'default' : 'secondary'}>{n.status}</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                {n.caller_id_name && <p>Caller ID: {n.caller_id_name}</p>}
                <p>Recording: {n.recording_policy.replace(/_/g, ' ')}</p>
                <p>Reputation: {n.reputation_status}</p>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
      {showDialog && <NumberDialog brands={brands} onClose={() => setShowDialog(false)} onSaved={load} />}
    </div>
  );
}

function NumberDialog({ brands, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ brand_id: brands[0]?.id || '', phone_number: '', number_type: 'local', caller_id_name: '', provider: 'twilio', recording_policy: 'record_on_consent', status: 'active' });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.phone_number || !form.brand_id) { toast({ title: 'Number and brand required', variant: 'destructive' }); return; }
    const brand = brands.find(b => b.id === form.brand_id);
    setSaving(true);
    try {
      await base44.entities.PhoneNumber.create({ ...form, organization_id: brand?.organization_id });
      toast({ title: 'Number added' }); onSaved(); onClose();
    } catch (err) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Add Phone Number</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Brand *</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.brand_id} onChange={e => setForm({...form, brand_id: e.target.value})}>{brands.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}</select></div>
        <div><Label>Phone number *</Label><Input value={form.phone_number} onChange={e => setForm({...form, phone_number: e.target.value})} placeholder="+1XXXXXXXXXX" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Type</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.number_type} onChange={e => setForm({...form, number_type: e.target.value})}><option value="local">Local</option><option value="toll_free">Toll-free</option><option value="ported">Ported</option></select></div>
          <div><Label>Provider</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.provider} onChange={e => setForm({...form, provider: e.target.value})}><option value="twilio">Twilio</option><option value="ooma">Ooma</option><option value="other">Other</option></select></div>
        </div>
        <div><Label>Caller ID name</Label><Input value={form.caller_id_name} onChange={e => setForm({...form, caller_id_name: e.target.value})} /></div>
        <div><Label>Recording policy</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.recording_policy} onChange={e => setForm({...form, recording_policy: e.target.value})}><option value="record_all">Record all</option><option value="record_on_consent">Record on consent</option><option value="do_not_record">Do not record</option></select></div>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add'}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

function Spinner() { return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }