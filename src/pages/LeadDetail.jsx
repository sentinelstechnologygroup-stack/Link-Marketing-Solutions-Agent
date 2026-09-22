import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { firebaseClient } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { ArrowLeft, Phone, Calendar, FileText, ClipboardList, AlertTriangle } from 'lucide-react';

const DISPOSITIONS = ['attempted', 'no_answer', 'voicemail_left', 'connected', 'qualified', 'unqualified', 'duplicate', 'wrong_number', 'do_not_call', 'warm_transfer_completed', 'appointment_booked', 'appointment_completed', 'contact_accepted', 'contact_declined', 'contact_unavailable', 'follow_up_required', 'closed', 'lost'];

const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700', qualified: 'bg-emerald-100 text-emerald-700',
  unqualified: 'bg-rose-100 text-rose-700', closed: 'bg-slate-100 text-slate-700', lost: 'bg-rose-100 text-rose-700',
};

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [lead, setLead] = useState(null);
  const [brand, setBrand] = useState(null);
  const [campaign, setCampaign] = useState(null);
  const [script, setScript] = useState(null);
  const [qualForm, setQualForm] = useState(null);
  const [calls, setCalls] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [duplicate, setDuplicate] = useState(null);

  // disposition + note form
  const [disposition, setDisposition] = useState('attempted');
  const [callNotes, setCallNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [savingCall, setSavingCall] = useState(false);

  // qualification answers
  const [qualAnswers, setQualAnswers] = useState({});

  // appointment form
  const [apptDate, setApptDate] = useState('');
  const [apptType, setApptType] = useState('call_back');
  const [savingAppt, setSavingAppt] = useState(false);

  const loadAll = async () => {
    try {
      const l = await firebaseClient.entities.Lead.get(id);
      setLead(l);
      setDisposition(l.disposition || 'attempted');
      setQualAnswers(l.qualification_data || {});

      const [brandData, campaignData] = await Promise.all([
        firebaseClient.entities.Brand.get(l.brand_id).catch(() => null),
        l.campaign_id ? firebaseClient.entities.Campaign.get(l.campaign_id).catch(() => null) : Promise.resolve(null),
      ]);
      setBrand(brandData);
      setCampaign(campaignData);

      // Load approved script for campaign/brand
      let scriptData = null;
      const scriptId = campaignData?.default_script_id || campaignData?.defaultScriptId || l.script_set_id || l.scriptSetId;
      if (scriptId) {
        scriptData = await firebaseClient.entities.Script.get(scriptId).catch(() => null);
      }
      if (!scriptData) {
        const scripts = await firebaseClient.entities.Script.filter({ brand_id: l.brand_id, status: 'approved' }, '-version_number', 5);
        scriptData = scripts[0] || null;
      }
      setScript(scriptData);

      // Load qualification form
      let form = null;
      const qualificationFormId = campaignData?.default_qualification_form_id || campaignData?.defaultQualificationFormId || l.qualification_form_id || l.qualificationFormId;
      if (qualificationFormId) {
        form = await firebaseClient.entities.QualificationForm.get(qualificationFormId).catch(() => null);
      }
      if (!form) {
        const forms = await firebaseClient.entities.QualificationForm.filter({ brand_id: l.brand_id, status: 'active' }, '-created_date', 5);
        form = forms[0] || null;
      }
      setQualForm(form);

      // Calls, tasks, appointments
      const [callData, taskData, apptData] = await Promise.all([
        firebaseClient.entities.CallRecord.filter({ lead_id: id }, '-call_start', 50),
        firebaseClient.entities.FollowUpTask.filter({ lead_id: id }, 'due_date', 50),
        firebaseClient.entities.Appointment.filter({ lead_id: id }, 'scheduled_start', 50),
      ]);
      setCalls(callData);
      setTasks(taskData);
      setAppointments(apptData);

      // Duplicate detection
      if (l.phone || l.email) {
        const dupFilter = { brand_id: l.brand_id };
        const dupCandidates = await firebaseClient.entities.Lead.filter(dupFilter, '-created_date', 200);
        const dup = dupCandidates.find(x => x.id !== id && (
          (l.phone && x.phone === l.phone) || (l.email && x.email === l.email && l.email)
        ));
        setDuplicate(dup || null);
      }
    } catch (e) {
      console.error('Lead detail error', e);
      toast({ title: 'Error loading lead', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, [id]);

  const handleSaveCall = async () => {
    setSavingCall(true);
    try {
      const now = new Date().toISOString();
      await firebaseClient.entities.CallRecord.create({
        organization_id: lead.organization_id,
        brand_id: lead.brand_id,
        campaign_id: lead.campaign_id,
        lead_id: lead.id,
        agent_id: user.id,
        call_direction: 'outbound',
        call_start: now,
        call_end: now,
        duration_seconds: 0,
        notes: callNotes,
        disposition,
        next_action: nextAction,
        provider_mode: 'mock',
      });
      await firebaseClient.entities.Lead.update(lead.id, {
        disposition,
        lead_status: mapDispositionToStatus(disposition),
        contact_attempts: (lead.contact_attempts || 0) + 1,
        last_contact_date: now,
        next_action: nextAction || null,
        qualification_data: qualAnswers,
        qualification_status: computeQualStatus(qualForm, qualAnswers),
      });
      toast({ title: 'Call record saved', description: `Disposition: ${disposition.replace(/_/g, ' ')}` });
      setCallNotes('');
      setNextAction('');
      loadAll();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingCall(false);
    }
  };

  const handleSaveAppointment = async () => {
    if (!apptDate) { toast({ title: 'Pick a date', variant: 'destructive' }); return; }
    setSavingAppt(true);
    try {
      await firebaseClient.entities.Appointment.create({
        organization_id: lead.organization_id,
        brand_id: lead.brand_id,
        campaign_id: lead.campaign_id,
        lead_id: lead.id,
        agent_id: user.id,
        appointment_type: apptType,
        scheduled_start: new Date(apptDate).toISOString(),
        timezone: 'America/Chicago',
        status: 'booked',
      });
      await firebaseClient.entities.Lead.update(lead.id, { appointment_status: 'booked', lead_status: 'appointment_scheduled' });
      toast({ title: 'Appointment booked' });
      setApptDate('');
      loadAll();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingAppt(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>;
  }

  if (!lead) {
    return <div className="text-center py-20"><p className="text-muted-foreground">Lead not found or you don't have access.</p><Link to="/leads" className="text-primary hover:underline">Back to inbox</Link></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/leads')}><ArrowLeft className="h-4 w-4 mr-1" /> Inbox</Button>
      </div>

      {/* Pre-call context banner */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-primary text-primary-foreground border-0">{brand?.display_name || 'Unknown brand'}</Badge>
            <Badge variant="outline">{campaign?.name || 'No campaign'}</Badge>
            <Badge variant="outline">{lead.lead_source_id ? 'Tracked source' : 'Manual'}</Badge>
          </div>
          <h2 className="text-xl font-heading font-semibold mt-2">{lead.first_name} {lead.last_name || ''}</h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{lead.phone}</span>}
            {lead.email && <span>{lead.email}</span>}
            {lead.location && <span>{lead.location}</span>}
          </div>
          {brand?.default_greeting && (
            <p className="text-sm mt-2 p-2 rounded bg-muted"><span className="font-medium">Required greeting: </span>{brand.default_greeting}</p>
          )}
        </CardContent>
      </Card>

      {duplicate && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Possible duplicate detected</p>
              <p className="text-amber-700">A lead with matching phone/email already exists. <Link to={`/leads/${duplicate.id}`} className="underline">View original lead</Link></p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Script */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Approved Script</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {script ? (
              <>
                <div><span className="text-muted-foreground">Script:</span> {script.name} (v{script.version_number})</div>
                {script.opening_statement && <div className="p-3 rounded bg-muted"><span className="font-medium">Opening: </span>{script.opening_statement}</div>}
                {script.qualification_questions && <div><span className="text-muted-foreground">Qualification questions:</span><p className="whitespace-pre-wrap mt-1">{script.qualification_questions}</p></div>}
                {script.objection_responses && <div><span className="text-muted-foreground">Objection responses:</span><p className="whitespace-pre-wrap mt-1">{script.objection_responses}</p></div>}
                {script.transfer_language && <div className="p-3 rounded bg-muted"><span className="font-medium">Transfer: </span>{script.transfer_language}</div>}
                {script.opt_out_language && <div className="p-3 rounded bg-rose-50 text-rose-800"><span className="font-medium">Opt-out: </span>{script.opt_out_language}</div>}
                <p className="text-xs text-muted-foreground">Status: {script.status} · Effective {script.effective_date || '—'}</p>
              </>
            ) : <p className="text-muted-foreground">No approved script configured for this brand/campaign.</p>}
          </CardContent>
        </Card>

        {/* Qualification form */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Qualification Form</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {qualForm && qualForm.questions?.length ? (
              qualForm.questions.map(q => <QualField key={q.id} q={q} value={qualAnswers[q.id]} onChange={v => setQualAnswers(prev => ({ ...prev, [q.id]: v }))} />)
            ) : <p className="text-muted-foreground">No qualification form configured.</p>}
          </CardContent>
        </Card>
      </div>

      {/* Disposition + call log */}
      <Card>
        <CardHeader><CardTitle className="text-base">Log Call & Disposition</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Disposition *</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={disposition} onChange={e => setDisposition(e.target.value)}>
                {DISPOSITIONS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <Label>Next action</Label>
              <Input value={nextAction} onChange={e => setNextAction(e.target.value)} placeholder="e.g. Callback tomorrow 10am" />
            </div>
          </div>
          <div>
            <Label>Call notes</Label>
            <Textarea rows={3} value={callNotes} onChange={e => setCallNotes(e.target.value)} placeholder="Conversation summary..." />
          </div>
          <Button onClick={handleSaveCall} disabled={savingCall}>{savingCall ? 'Saving...' : 'Save Call Record'}</Button>
        </CardContent>
      </Card>

      {/* Appointment */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4" /> Schedule Appointment</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div>
            <Label>Date & time</Label>
            <Input type="datetime-local" value={apptDate} onChange={e => setApptDate(e.target.value)} />
          </div>
          <div>
            <Label>Type</Label>
            <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={apptType} onChange={e => setApptType(e.target.value)}>
              <option value="call_back">Callback</option>
              <option value="property_viewing">Property viewing</option>
              <option value="consultation">Consultation</option>
              <option value="discovery_call">Discovery call</option>
            </select>
          </div>
          <Button onClick={handleSaveAppointment} disabled={savingAppt}>{savingAppt ? 'Booking...' : 'Book Appointment'}</Button>
        </CardContent>
      </Card>

      {/* History */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Call History</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {calls.length === 0 ? <p className="text-muted-foreground">No calls yet.</p> :
              calls.map(c => <div key={c.id} className="border border-border rounded p-2"><div className="flex justify-between"><Badge variant="outline">{c.disposition.replace(/_/g, ' ')}</Badge><span className="text-xs text-muted-foreground">{new Date(c.call_start).toLocaleString()}</span></div>{c.notes && <p className="mt-1 text-xs">{c.notes}</p>}</div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Follow-up Tasks</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {tasks.length === 0 ? <p className="text-muted-foreground">No tasks.</p> :
              tasks.map(t => <div key={t.id} className="border border-border rounded p-2"><div className="flex justify-between"><span className="font-medium">{t.task_type.replace(/_/g, ' ')}</span><Badge variant="outline">{t.status}</Badge></div><span className="text-xs text-muted-foreground">Due {new Date(t.due_date).toLocaleString()}</span></div>)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Appointments</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {appointments.length === 0 ? <p className="text-muted-foreground">No appointments.</p> :
              appointments.map(a => <div key={a.id} className="border border-border rounded p-2"><div className="flex justify-between"><span className="font-medium">{a.appointment_type.replace(/_/g, ' ')}</span><Badge variant="outline">{a.status}</Badge></div><span className="text-xs text-muted-foreground">{new Date(a.scheduled_start).toLocaleString()}</span></div>)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QualField({ q, value, onChange }) {
  if (q.field_type === 'yes_no') {
    return (
      <div>
        <Label className="text-xs">{q.label}{q.required && ' *'}</Label>
        <div className="flex gap-2 mt-1">
          <Button type="button" size="sm" variant={value === 'yes' ? 'default' : 'outline'} onClick={() => onChange('yes')}>Yes</Button>
          <Button type="button" size="sm" variant={value === 'no' ? 'default' : 'outline'} onClick={() => onChange('no')}>No</Button>
        </div>
      </div>
    );
  }
  if (q.field_type === 'multiple_choice') {
    return (
      <div>
        <Label className="text-xs">{q.label}{q.required && ' *'}</Label>
        <select className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm mt-1" value={value || ''} onChange={e => onChange(e.target.value)}>
          <option value="">Select...</option>
          {(q.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    );
  }
  if (q.field_type === 'numeric' || q.field_type === 'budget') {
    return <div><Label className="text-xs">{q.label}{q.required && ' *'}</Label><Input type="number" className="mt-1" value={value || ''} onChange={e => onChange(e.target.value)} /></div>;
  }
  if (q.field_type === 'date_time') {
    return <div><Label className="text-xs">{q.label}{q.required && ' *'}</Label><Input type="datetime-local" className="mt-1" value={value || ''} onChange={e => onChange(e.target.value)} /></div>;
  }
  return <div><Label className="text-xs">{q.label}{q.required && ' *'}</Label><Input className="mt-1" value={value || ''} onChange={e => onChange(e.target.value)} /></div>;
}

function mapDispositionToStatus(d) {
  const map = { connected: 'connected', qualified: 'qualified', unqualified: 'unqualified', warm_transfer_completed: 'warm_transfer', appointment_booked: 'appointment_scheduled', closed: 'closed', lost: 'lost', duplicate: 'duplicate', do_not_call: 'do_not_call' };
  return map[d] || 'contact_attempted';
}

function computeQualStatus(form, answers) {
  if (!form || !form.questions) return 'pending';
  const required = form.questions.filter(q => q.required);
  const allAnswered = required.every(q => answers[q.id]);
  if (!allAnswered) return 'in_progress';
  let score = 0;
  form.questions.forEach(q => { if (answers[q.id] === 'yes') score += (q.score_weight || 0); });
  return score >= (form.qualification_threshold || 0) ? 'qualified' : 'unqualified';
}
