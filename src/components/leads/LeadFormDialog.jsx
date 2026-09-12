import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export default function LeadFormDialog({ open, onClose, brands, campaigns, onSaved, lead }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const isEdit = !!lead;

  const brandOptions = brands || [];
  const campaignOptions = (campaigns || []).filter(c => !formBrand || c.brand_id === formBrand);

  const [form, setForm] = useState({
    first_name: lead?.first_name || '',
    last_name: lead?.last_name || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    location: lead?.location || '',
    priority: lead?.priority || 5,
    brand_id: lead?.brand_id || (brandOptions[0]?.id || ''),
    campaign_id: lead?.campaign_id || '',
    lead_source_id: '',
  });
  const [formBrand, setFormBrand] = useState(form.brand_id);

  const update = (k, v) => {
    setForm(prev => ({ ...prev, [k]: v }));
    if (k === 'brand_id') setFormBrand(v);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.brand_id || !form.campaign_id) {
      toast({ title: 'Missing fields', description: 'Name, brand, and campaign are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const brand = brandOptions.find(b => b.id === form.brand_id);
      const payload = {
        ...form,
        organization_id: brand?.organization_id || user?.organization_id,
        consent_recorded: true,
        consent_language_version: brand?.consent_language_version || '1.0',
      };
      if (isEdit) {
        await base44.entities.Lead.update(lead.id, payload);
        toast({ title: 'Lead updated' });
      } else {
        await base44.entities.Lead.create(payload);
        toast({ title: 'Lead created' });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Lead' : 'New Lead'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First name *</Label>
              <Input value={form.first_name} onChange={e => update('first_name', e.target.value)} />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={form.last_name} onChange={e => update('last_name', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => update('phone', e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => update('email', e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Location</Label>
            <Input value={form.location} onChange={e => update('location', e.target.value)} placeholder="City, State" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Brand *</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.brand_id} onChange={e => update('brand_id', e.target.value)}>
                <option value="">Select brand</option>
                {brandOptions.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}
              </select>
            </div>
            <div>
              <Label>Campaign *</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.campaign_id} onChange={e => update('campaign_id', e.target.value)}>
                <option value="">Select campaign</option>
                {campaignOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <Label>Priority (1 highest)</Label>
            <Input type="number" min={1} max={10} value={form.priority} onChange={e => update('priority', Number(e.target.value))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : (isEdit ? 'Save' : 'Create Lead')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}