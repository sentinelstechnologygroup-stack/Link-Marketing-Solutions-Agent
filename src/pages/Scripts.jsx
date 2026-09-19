import React, { useEffect, useState } from 'react';
import { firebaseClient } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { buildTenantFilter, canManageScripts } from '@/lib/tenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Pencil, CheckCircle } from 'lucide-react';

const STATUS_COLORS = { draft: 'bg-slate-100 text-slate-700', in_review: 'bg-amber-100 text-amber-700', approved: 'bg-emerald-100 text-emerald-700', retired: 'bg-rose-100 text-rose-700' };

export default function Scripts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scripts, setScripts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const canManage = canManageScripts(user?.role) || user?.role === 'admin';

  const load = async () => {
    try {
      const [s, b] = await Promise.all([
        firebaseClient.entities.Script.filter(buildTenantFilter(user), '-created_date', 200),
        firebaseClient.entities.Brand.filter(buildTenantFilter(user), '-created_date', 50),
      ]);
      setScripts(s); setBrands(b);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user]);

  const brandMap = Object.fromEntries(brands.map(b => [b.id, b]));

  const approve = async (s) => {
    try {
      await firebaseClient.entities.Script.update(s.id, { status: 'approved', approved_by: user.id, approved_date: new Date().toISOString(), effective_date: new Date().toISOString().slice(0, 10) });
      toast({ title: 'Script approved' }); load();
    } catch (e) { toast({ title: 'Error', description: e.message, variant: 'destructive' }); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-heading font-semibold tracking-tight">Scripts</h1><p className="text-muted-foreground text-sm mt-1">Version-controlled, approved scripts per brand</p></div>
        {canManage && <Button onClick={() => { setEditing(null); setShowDialog(true); }}><Plus className="h-4 w-4 mr-2" /> New Script</Button>}
      </div>
      {loading ? <Spinner/> : (
        <div className="space-y-3">
          {scripts.map(s => (
            <Card key={s.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-medium">{s.name} <span className="text-xs text-muted-foreground">v{s.version_number}</span></h3>
                    <p className="text-xs text-muted-foreground">{brandMap[s.brand_id]?.display_name || '—'} · {s.purpose} · {s.language}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`${STATUS_COLORS[s.status]} border-0`}>{s.status.replace(/_/g, ' ')}</Badge>
                    {canManage && s.status !== 'approved' && <Button size="sm" variant="outline" onClick={() => approve(s)}><CheckCircle className="h-3.5 w-3.5 mr-1" />Approve</Button>}
                    {canManage && <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setShowDialog(true); }}><Pencil className="h-3.5 w-3.5" /></Button>}
                  </div>
                </div>
                {s.opening_statement && <p className="text-sm mt-2 p-2 rounded bg-muted">{s.opening_statement}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {showDialog && <ScriptDialog script={editing} brands={brands} onClose={() => setShowDialog(false)} onSaved={load} />}
    </div>
  );
}

function ScriptDialog({ script, brands, onClose, onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    organization_id: script?.organization_id || brands[0]?.organization_id || '',
    brand_id: script?.brand_id || brands[0]?.id || '',
    name: script?.name || '',
    purpose: script?.purpose || 'outbound',
    language: script?.language || 'en',
    version_number: script?.version_number || 1,
    status: script?.status || 'draft',
    opening_statement: script?.opening_statement || '',
    qualification_questions: script?.qualification_questions || '',
    objection_responses: script?.objection_responses || '',
    transfer_language: script?.transfer_language || '',
    appointment_language: script?.appointment_language || '',
    opt_out_language: script?.opt_out_language || '',
    escalation_instructions: script?.escalation_instructions || '',
  });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.brand_id) { toast({ title: 'Name and brand required', variant: 'destructive' }); return; }
    const brand = brands.find(b => b.id === form.brand_id);
    const payload = { ...form, organization_id: brand?.organization_id };
    setSaving(true);
    try {
      if (script) { await firebaseClient.entities.Script.update(script.id, payload); toast({ title: 'Script updated' }); }
      else { await firebaseClient.entities.Script.create(payload); toast({ title: 'Script created' }); }
      onSaved(); onClose();
    } catch (err) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{script ? 'Edit Script' : 'New Script'}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Brand *</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.brand_id} onChange={e => setForm({...form, brand_id: e.target.value})}>{brands.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}</select></div>
          <div><Label>Purpose</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={form.purpose} onChange={e => setForm({...form, purpose: e.target.value})}><option value="outbound">Outbound</option><option value="inbound">Inbound</option><option value="callback">Callback</option><option value="warm_transfer">Warm transfer</option><option value="appointment_confirm">Appointment confirm</option></select></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div><Label>Version</Label><Input type="number" value={form.version_number} onChange={e => setForm({...form, version_number: Number(e.target.value)})} /></div>
          <div><Label>Language</Label><Input value={form.language} onChange={e => setForm({...form, language: e.target.value})} /></div>
        </div>
        <div><Label>Opening statement</Label><Textarea rows={2} value={form.opening_statement} onChange={e => setForm({...form, opening_statement: e.target.value})} /></div>
        <div><Label>Qualification questions</Label><Textarea rows={3} value={form.qualification_questions} onChange={e => setForm({...form, qualification_questions: e.target.value})} /></div>
        <div><Label>Objection responses</Label><Textarea rows={3} value={form.objection_responses} onChange={e => setForm({...form, objection_responses: e.target.value})} /></div>
        <div><Label>Transfer language</Label><Textarea rows={2} value={form.transfer_language} onChange={e => setForm({...form, transfer_language: e.target.value})} /></div>
        <div><Label>Appointment language</Label><Textarea rows={2} value={form.appointment_language} onChange={e => setForm({...form, appointment_language: e.target.value})} /></div>
        <div><Label>Opt-out language</Label><Textarea rows={2} value={form.opt_out_language} onChange={e => setForm({...form, opt_out_language: e.target.value})} /></div>
        <div><Label>Escalation instructions</Label><Textarea rows={2} value={form.escalation_instructions} onChange={e => setForm({...form, escalation_instructions: e.target.value})} /></div>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

function Spinner() { return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }
