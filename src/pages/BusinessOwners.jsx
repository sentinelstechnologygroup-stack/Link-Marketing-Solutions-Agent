import React, { useEffect, useState } from 'react';
import { EmptyRecordCard } from '@/components/CollectionStructure';
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
import { Plus } from 'lucide-react';

export default function BusinessOwners() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [owners, setOwners] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const canManage = canManageBrands(user?.role) || user?.role === 'admin';

  const load = async () => {
    try {
      const [o, b] = await Promise.all([
        firebaseClient.entities.BusinessOwner.filter(buildTenantFilter(user), '-created_date', 100),
        firebaseClient.entities.Brand.filter(buildTenantFilter(user), '-created_date', 50),
      ]);
      setOwners(o); setBrands(b);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user]);

  const brandMap = Object.fromEntries(brands.map(b => [b.id, b]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-heading font-semibold tracking-tight">Client Contacts</h1><p className="text-muted-foreground text-sm mt-1">Authorized recipients for warm transfers, appointments, and lead handoffs</p></div>
        {canManage && <Button onClick={() => setShowDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add</Button>}
      </div>
      {loading ? <Spinner/> : (
        <div className="grid gap-3 md:grid-cols-2">
                  {owners.length === 0 && (
          <EmptyRecordCard
            title="Client contact"
            fields={['Name', 'Organization', 'Phone', 'Status']}
            message="No client contacts are configured yet. Use Add Client Contact to create one."
          />
        )}
        {owners.map(o => (
            <Card key={o.id}><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="font-medium">{o.name}</p><p className="text-xs text-muted-foreground">{brandMap[o.brand_id]?.display_name} · {o.role_type.replace(/_/g, ' ')}</p></div>
                <Badge variant={o.status === 'active' ? 'default' : 'secondary'}>{o.status}</Badge>
              </div>
              <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                {o.phone && <p>{o.phone}</p>}{o.email && <p>{o.email}</p>}
                {o.license_number && <p>License: {o.license_number} ({o.license_state})</p>}
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
      {showDialog && <OwnerDialog brands={brands} onClose={() => setShowDialog(false)} onSaved={load} />}
    </div>
  );
}

function OwnerDialog({ brands, onClose, onSaved }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ brand_id: brands[0]?.id || '', name: '', email: '', phone: '', role_type: 'business_owner', license_number: '', license_state: '', status: 'active' });
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.brand_id) { toast({ title: 'Name and brand required', variant: 'destructive' }); return; }
    const brand = brands.find(b => b.id === form.brand_id);
    setSaving(true);
    try {
      await firebaseClient.entities.BusinessOwner.create({ ...form, organization_id: brand?.organization_id });
      toast({ title: 'Client contact added' }); onSaved(); onClose();
    } catch (err) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); } finally { setSaving(false); }
  };
  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Add Client Contact</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div><Label>Brand *</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.brand_id} onChange={e => setForm({...form, brand_id: e.target.value})}>{brands.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}</select></div>
        <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Role type</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.role_type} onChange={e => setForm({...form, role_type: e.target.value})}>
              <option value="business_owner">Business owner</option>
              <option value="primary_contact">Primary contact</option>
              <option value="administrator">Administrator</option>
              <option value="manager">Manager / supervisor</option>
              <option value="practitioner">Practitioner / provider</option>
              <option value="sales_contact">Sales contact</option>
              <option value="operations_contact">Operations contact</option>
              <option value="billing_contact">Billing contact</option>
              <option value="licensed_professional">Licensed professional</option>
              <option value="other">Other</option>
            </select></div>
          <div><Label>Credential state / region</Label><Input value={form.license_state} onChange={e => setForm({...form, license_state: e.target.value})} /></div>
        </div>
        <div><Label>Credential / license number</Label><Input value={form.license_number} onChange={e => setForm({...form, license_number: e.target.value})} /></div>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add'}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

function Spinner() { return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }



