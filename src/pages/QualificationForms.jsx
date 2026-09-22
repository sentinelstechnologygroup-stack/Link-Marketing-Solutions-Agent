import React, { useEffect, useState } from 'react';
import { EmptyRecordCard } from '@/components/CollectionStructure';
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
import { Plus, Pencil, Trash2 } from 'lucide-react';

const FIELD_TYPES = ['text', 'multiple_choice', 'yes_no', 'numeric', 'date_time', 'budget', 'geographic'];

export default function QualificationForms() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [forms, setForms] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const canManage = canManageScripts(user?.role) || user?.role === 'admin';

  const load = async () => {
    try {
      const [f, b] = await Promise.all([
        firebaseClient.entities.QualificationForm.filter(buildTenantFilter(user), '-created_date', 100),
        firebaseClient.entities.Brand.filter(buildTenantFilter(user), '-created_date', 50),
      ]);
      setForms(f); setBrands(b);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user]);

  const brandMap = Object.fromEntries(brands.map(b => [b.id, b]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-heading font-semibold tracking-tight">Qualification Forms</h1><p className="text-muted-foreground text-sm mt-1">Reusable question builders with scoring and thresholds</p></div>
        {canManage && <Button onClick={() => { setEditing(null); setShowDialog(true); }}><Plus className="h-4 w-4 mr-2" /> New Form</Button>}
      </div>
      {loading ? <Spinner/> : (
        <div className="space-y-3">
                  {forms.length === 0 && (
          <EmptyRecordCard
            title="Qualification form"
            fields={['Form name', 'Brand', 'Questions', 'Threshold']}
            message="No qualification forms are configured yet. Use New Form to create one."
          />
        )}
        {forms.map(f => (
            <Card key={f.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div><h3 className="font-medium">{f.name}</h3><p className="text-xs text-muted-foreground">{brandMap[f.brand_id]?.display_name} · {f.questions?.length || 0} questions · threshold {f.qualification_threshold}</p></div>
                  <div className="flex items-center gap-2">
                    <Badge variant={f.status === 'active' ? 'default' : 'secondary'}>{f.status}</Badge>
                    {canManage && <Button size="sm" variant="ghost" onClick={() => { setEditing(f); setShowDialog(true); }}><Pencil className="h-3.5 w-3.5" /></Button>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {showDialog && <FormDialog form={editing} brands={brands} onClose={() => setShowDialog(false)} onSaved={load} />}
    </div>
  );
}

function FormDialog({ form, brands, onClose, onSaved }) {
  const { toast } = useToast();
  const [name, setName] = useState(form?.name || '');
  const [brandId, setBrandId] = useState(form?.brand_id || brands[0]?.id || '');
  const [description, setDescription] = useState(form?.description || '');
  const [threshold, setThreshold] = useState(form?.qualification_threshold || 0);
  const [status, setStatus] = useState(form?.status || 'draft');
  const [questions, setQuestions] = useState(form?.questions || []);
  const [saving, setSaving] = useState(false);

  const addQ = () => setQuestions([...questions, { id: `q${Date.now()}`, label: '', field_type: 'text', required: false, options: [], customer_facing: true, internal_only: false, score_weight: 0 }]);
  const updateQ = (i, key, val) => setQuestions(questions.map((q, idx) => idx === i ? { ...q, [key]: val } : q));
  const removeQ = (i) => setQuestions(questions.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    if (!name || !brandId) { toast({ title: 'Name and brand required', variant: 'destructive' }); return; }
    const brand = brands.find(b => b.id === brandId);
    setSaving(true);
    try {
      const payload = { name, brand_id: brandId, organization_id: brand?.organization_id, description, qualification_threshold: Number(threshold), status, questions };
      if (form) { await firebaseClient.entities.QualificationForm.update(form.id, payload); toast({ title: 'Form updated' }); }
      else { await firebaseClient.entities.QualificationForm.create(payload); toast({ title: 'Form created' }); }
      onSaved(); onClose();
    } catch (err) { toast({ title: 'Error', description: err.message, variant: 'destructive' }); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}><DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{form ? 'Edit Form' : 'New Qualification Form'}</DialogTitle></DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Name *</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Brand *</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={brandId} onChange={e => setBrandId(e.target.value)}>{brands.map(b => <option key={b.id} value={b.id}>{b.display_name}</option>)}</select></div>
        </div>
        <div><Label>Description</Label><Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><Label>Qualification threshold (score)</Label><Input type="number" value={threshold} onChange={e => setThreshold(e.target.value)} /></div>
          <div><Label>Status</Label><select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={status} onChange={e => setStatus(e.target.value)}><option value="draft">Draft</option><option value="active">Active</option><option value="retired">Retired</option></select></div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between"><Label>Questions</Label><Button type="button" size="sm" variant="outline" onClick={addQ}><Plus className="h-3.5 w-3.5 mr-1" />Add</Button></div>
          {questions.map((q, i) => (
            <div key={q.id} className="border border-border rounded-lg p-3 space-y-2">
              <div className="flex gap-2">
                <Input placeholder="Question label" value={q.label} onChange={e => updateQ(i, 'label', e.target.value)} />
                <select className="rounded-md border border-input bg-background px-2 py-2 text-sm" value={q.field_type} onChange={e => updateQ(i, 'field_type', e.target.value)}>{FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select>
                <Button type="button" size="sm" variant="ghost" onClick={() => removeQ(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-1"><input type="checkbox" checked={q.required} onChange={e => updateQ(i, 'required', e.target.checked)} /> Required</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={q.customer_facing} onChange={e => updateQ(i, 'customer_facing', e.target.checked)} /> Customer-facing</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={q.internal_only} onChange={e => updateQ(i, 'internal_only', e.target.checked)} /> Internal only</label>
                <label className="flex items-center gap-1">Score weight <input type="number" className="w-16 rounded border border-input px-1 py-0.5" value={q.score_weight} onChange={e => updateQ(i, 'score_weight', Number(e.target.value))} /></label>
              </div>
              {(q.field_type === 'multiple_choice') && (
                <Input placeholder="Options (comma separated)" value={(q.options || []).join(', ')} onChange={e => updateQ(i, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
              )}
            </div>
          ))}
        </div>
        <DialogFooter><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogFooter>
      </form>
    </DialogContent></Dialog>
  );
}

function Spinner() { return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }


