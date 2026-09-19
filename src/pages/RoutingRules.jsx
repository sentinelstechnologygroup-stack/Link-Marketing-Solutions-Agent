import React, { useEffect, useState } from 'react';
import { firebaseClient } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { buildTenantFilter, canManageBrands } from '@/lib/tenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Pencil } from 'lucide-react';

const STRATEGIES = ['round_robin', 'sequential', 'first_acceptance', 'geographic', 'campaign', 'skill', 'language', 'business_hours', 'availability', 'manual', 'escalation'];

export default function RoutingRules() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rules, setRules] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const canManage = canManageBrands(user?.role) || user?.role === 'admin';

  const load = async () => {
    try {
      const [r, b] = await Promise.all([
        firebaseClient.entities.RoutingRule.filter(buildTenantFilter(user), '-created_date', 100),
        firebaseClient.entities.Brand.filter(buildTenantFilter(user), '-created_date', 50),
      ]);
      setRules(r); setBrands(b);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user]);

  const brandMap = Object.fromEntries(brands.map(b => [b.id, b]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-heading font-semibold tracking-tight">Routing Rules</h1><p className="text-muted-foreground text-sm mt-1">Lead assignment and realtor rotation strategies</p></div>
        {canManage && <Button onClick={() => { setEditing(null); setShowDialog(true); }}><Plus className="h-4 w-4 mr-2" /> New Rule</Button>}
      </div>
      {loading ? <Spinner/> : (
        <div className="space-y-3">
          {rules.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{r.name}</h3>
                    <p className="text-xs text-muted-foreground">{brandMap[r.brand_id]?.display_name} · {r.strategy.replace(/_/g, ' ')} · {r.realtor_rotation?.length || 0} in rotation</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={r.status === 'active' ? 'default' : 'secondary'}>{r.status}</Badge>
                    {canManage && <Button size="sm" variant="ghost" onClick={() => { setEditing(r); setShowDialog(true); }}><Pencil className="h-3.5 w-3.5" /></Button>}
                  </div>
                </div>
                {r.realtor_rotation?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.realtor_rotation.map((rp, i) => <Badge key={i} variant="outline">{i + 1}. {rp.name || rp.business_owner_id}</Badge>)}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">Acceptance period: {r.acceptance_period_minutes} min · Next-in-sequence: {r.start_with_next_in_sequence ? 'Yes' : 'No'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {showDialog && <RuleDialog rule={editing} brands={brands} onClose={() => setShowDialog(false)} onSaved={load} />}
    </div>
  );
}

function RuleDialog({ rule, brands, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    organization_id: rule?.organization_id || brands[0]?.organization_id || '',
    brand_id: rule?.brand_id || brands[0]?.id || '',
    name: rule?.name || '',
    strategy: rule?.strategy || 'round_robin',
    acceptance_period_minutes: rule?.acceptance_period_minutes || 15,
    start_with_next_in_sequence: rule?.start_with_next_in_sequence ?? true,
    status: rule?.status || 'active',
  });
  const [rotation, setRotation] = useState(rule?.realtor_rotation || []);
  const [saving, setSaving] = useState(false);

  const addRotation = () => setRotation([...rotation, { position: rotation.length + 1, business_owner_id: '', name: '', phone: '' }]);
  const updateRotation = (i, key, val) => setRotation(rotation.map((r, idx) => idx === i ? { ...r, [key]: val } : r));
  const removeRotation = (i) => setRotation(rotation.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, position: idx + 1 })));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.brand_id) { toast({ title: 'Name and brand required', variant: 'destructive' }); return; }
    const brand = brands.find(b => b.id === form.brand_id);
    setSaving(true);
    try {
      const payload = { ...form, organization_id: brand?.organization_id, realtor_rotation: rotation };
      if (rule) { await firebaseClient.entities.RoutingRule.update(rule.id, payload); toast({ title: 'Rule updated' }); }
      else { await firebaseClient.entities.RoutingRule.create(payload); toast({ title: 'Rule created' }); }
      onSaved(); onClose();
    } catch (err) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{rule ? 'Edit Routing Rule' : 'New Routing Rule'}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div><Label>Brand *</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.brand_id} onChange={e => setForm({...form, brand_id: e.target.value})}>{brands.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}</select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Strategy</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.strategy} onChange={e => setForm({...form, strategy: e.target.value})}>{STRATEGIES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}</select></div>
          <div><Label>Acceptance period (min)</Label><Input type="number" value={form.acceptance_period_minutes} onChange={e => setForm({...form, acceptance_period_minutes: Number(e.target.value)})} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.start_with_next_in_sequence} onChange={e => setForm({...form, start_with_next_in_sequence: e.target.checked})} /> Start next lead with next realtor in sequence</label>
        <div className="space-y-2">
          <div className="flex items-center justify-between"><Label>Realtor rotation</Label><Button type="button" size="sm" variant="outline" onClick={addRotation}><Plus className="h-3.5 w-3.5 mr-1" />Add</Button></div>
          {rotation.map((rp, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Badge variant="outline">{i + 1}</Badge>
              <Input placeholder="Name" value={rp.name} onChange={e => updateRotation(i, 'name', e.target.value)} />
              <Input placeholder="Phone" value={rp.phone} onChange={e => updateRotation(i, 'phone', e.target.value)} />
              <Button type="button" size="sm" variant="ghost" onClick={() => removeRotation(i)}>×</Button>
            </div>
          ))}
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

function Spinner() { return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }
