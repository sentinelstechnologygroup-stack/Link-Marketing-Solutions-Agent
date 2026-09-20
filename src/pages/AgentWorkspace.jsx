import React, { useEffect, useState } from 'react';
import { EmptyDataTable, EmptyRecordCard } from '@/components/CollectionStructure';
import { api, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { AuthError, ErrorState, EmptyState, ContextChips, TenantBadge } from '@/components/ContractState';
import { Phone, Clock, AlertCircle, Headphones, Volume2, PhoneCall, PhoneOff, Pause, Play, ArrowRightLeft } from 'lucide-react';

const DISPOSITIONS = ['attempted', 'no_answer', 'voicemail_left', 'connected', 'qualified', 'unqualified', 'duplicate', 'wrong_number', 'do_not_call', 'warm_transfer_completed', 'appointment_booked', 'follow_up_required', 'closed', 'lost'];

function ageLabel(min) {
  if (min < 60) return `${min}m`;
  if (min < 1440) return `${Math.floor(min / 60)}h`;
  return `${Math.floor(min / 1440)}d`;
}

export default function AgentWorkspace() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLeadId, setSelectedLeadId] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const ws = await api.getAgentWorkspace(user);
      setData(ws);
      if (!selectedLeadId && ws.new_leads.items[0]) setSelectedLeadId(ws.new_leads.items[0].id);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  if (loading) return <Spinner />;
  if (error) return error instanceof ApiError && (error.status === 401 || error.status === 403)
    ? <AuthError error={error} onRetry={load} /> : <ErrorState error={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Agent Workspace</h1>
          <p className="text-muted-foreground text-sm mt-1">Unified lead response across all assigned brands</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-emerald-100 text-emerald-700 border-0 capitalize">{data.agent_status.replace(/_/g, ' ')}</Badge>
          <TenantBadge tenant={data.tenant} />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard label="New Leads" value={data.new_leads.count} icon={AlertCircle} accent="bg-blue-50 text-blue-600" />
        <StatCard label="Callbacks Due" value={data.callback_queue.count} icon={Clock} accent="bg-amber-50 text-amber-600" />
        <StatCard label="Follow-ups" value={data.follow_up_queue.count} icon={Phone} accent="bg-purple-50 text-purple-600" />
        <StatCard label="Assigned Brands" value={data.assigned_brands.length} icon={Headphones} accent="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Queue list */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">New Leads</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.new_leads.count === 0 ? (
              <EmptyDataTable
                title="Lead queue"
                columns={['Priority', 'Prospect', 'Contact', 'Received']}
                message="No new leads are waiting. Assigned leads will appear here automatically."
                rows={2}
              />
            ) :
              data.new_leads.items.map(lead => (
                <button key={lead.id} onClick={() => setSelectedLeadId(lead.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${selectedLeadId === lead.id ? 'border-primary bg-accent/50' : 'border-border hover:bg-accent/30'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{lead.first_name} {lead.last_name || ''}</span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{ageLabel(Math.round((Date.now() - new Date(lead.created_date)) / 60000))}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-xs">P{lead.priority || 5}</Badge>
                    <span className="text-xs text-muted-foreground truncate">{lead.phone || lead.email || '—'}</span>
                  </div>
                </button>
              ))}
          </CardContent>
        </Card>

        {/* Lead context + disposition */}
        <div className="lg:col-span-3">
          {selectedLeadId ? (
            <LeadContextPanel leadId={selectedLeadId} onSaved={load} />
          ) : (
            <Card><CardContent className="py-16"><EmptyState message="Select a lead to view pre-call context." /></CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}

function LeadContextPanel({ leadId, onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ctx, setCtx] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [disposition, setDisposition] = useState('attempted');
  const [notes, setNotes] = useState('');
  const [nextAction, setNextAction] = useState('');
  const [saving, setSaving] = useState(false);
  const [call, setCall] = useState(null);
  const [callLoading, setCallLoading] = useState(false);
  const [telephony, setTelephony] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const c = await api.getLead(user, leadId);
      setCtx(c);
      setDisposition(c.lead.disposition || 'attempted');
    } catch (e) { setError(e); } finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    api.getTelephonyStatus(user).then(setTelephony).catch(() => setTelephony({ mode: 'unavailable', healthy: false, warning: 'Telephony status could not be verified. Calls are disabled until the CRM backend is connected.' }));
  }, [leadId]);

  const startCall = async () => {
    if (!ctx?.lead?.phone) return;
    setCallLoading(true);
    try {
      const result = await api.postCall(user, { lead_id: leadId, to: ctx.lead.phone });
      setCall(result);
      toast({
        title: result.mode === 'mock' ? 'Test call started' : 'Call started',
        description: result.mode === 'mock' ? 'Mock mode — no real call was placed.' : 'The call is now being handled by Twilio.'
      });
    } catch (e) {
      toast({ title: 'Call could not start', description: e.message, variant: 'destructive' });
    } finally { setCallLoading(false); }
  };

  const endCall = async () => {
    if (!call?.callId) return;
    const result = await api.endCall(user, call.callId);
    setCall({ ...call, ...result, status: result.status || 'completed' });
  };

  const toggleHold = async () => {
    if (!call?.callId) return;
    const result = call.status === 'on_hold'
      ? await api.resumeCall(user, call.callId)
      : await api.holdCall(user, call.callId);
    setCall({ ...call, ...result });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.postDisposition(user, leadId, { disposition, notes, next_action: nextAction, provider_mode: call?.mode || telephony?.mode || 'mock' });
      toast({ title: 'Disposition saved' });
      setNotes(''); setNextAction('');
      onSaved?.(); load();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (loading) return <Spinner />;
  if (error) return error instanceof ApiError && (error.status === 401 || error.status === 403)
    ? <Card><CardContent className="py-8"><AuthError error={error} onRetry={load} /></CardContent></Card>
    : <Card><CardContent className="py-8"><ErrorState error={error} onRetry={load} /></CardContent></Card>;
  if (!ctx) return null;

  const { lead, brand, campaign, script, form, calls, duplicates, lead_age_minutes } = ctx;

  return (
    <div className="space-y-4">
      {/* Pre-call context banner */}
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-4 space-y-3">
          <ContextChips brand={brand} campaign={campaign} extra={[`Age ${ageLabel(lead_age_minutes)}`, `Priority ${lead.priority || 5}`]} />
          <h2 className="text-xl font-heading font-semibold">{lead.first_name} {lead.last_name || ''}</h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{lead.phone}</span>}
            {lead.email && <span>{lead.email}</span>}
            {lead.location && <span>{lead.location}</span>}
          </div>
          {brand?.default_greeting && (
            <div className="text-sm p-2 rounded bg-muted"><span className="font-medium">Required greeting: </span>{brand.default_greeting}</div>
          )}
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Volume2 className="h-3.5 w-3.5" /><span className="font-medium">Whisper:</span> {brand?.display_name || '—'}, {campaign?.name || '—'} lead.</div>
        </CardContent>
      </Card>

      {duplicates?.length > 0 && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="p-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Possible duplicate — {duplicates.length} matching lead(s) found.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Required Script</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            {script ? <>
              <p className="font-medium">{script.name} (v{script.version_number})</p>
              {script.opening_statement && <div className="p-2 rounded bg-muted">{script.opening_statement}</div>}
              {script.qualification_questions && <div className="whitespace-pre-wrap text-xs">{script.qualification_questions}</div>}
              {script.transfer_language && <div className="p-2 rounded bg-muted text-xs">{script.transfer_language}</div>}
            </> : <EmptyState message="No approved script configured." />}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Required Qualification Form</CardTitle></CardHeader>
          <CardContent className="text-sm">
            {form ? <><p className="font-medium">{form.name}</p><p className="text-xs text-muted-foreground mt-1">{form.questions?.length || 0} questions · threshold {form.qualification_threshold}</p></> : <EmptyState message="No form configured." />}
          </CardContent>
        </Card>
      </div>

      <Card className={telephony?.mode === 'production' ? 'border-emerald-300' : telephony?.mode === 'unavailable' ? 'border-rose-300 bg-rose-50' : 'border-amber-300'}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2"><PhoneCall className="h-4 w-4" /> CRM calling</span>
            <Badge variant="outline" className={telephony?.mode === 'production' ? 'text-emerald-700' : telephony?.mode === 'unavailable' ? 'border-rose-300 bg-rose-100 text-rose-800' : 'text-amber-700'}>
              {telephony?.mode === 'production' ? 'Twilio live' : telephony?.mode === 'unavailable' ? 'Unavailable' : 'Test mode'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {call ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{call.status || 'in_progress'}</Badge>
              <Button size="sm" variant="outline" onClick={toggleHold}>
                {call.status === 'on_hold' ? <Play className="h-3.5 w-3.5 mr-1" /> : <Pause className="h-3.5 w-3.5 mr-1" />}
                {call.status === 'on_hold' ? 'Resume' : 'Hold'}
              </Button>
              <Button size="sm" variant="destructive" onClick={endCall}><PhoneOff className="h-3.5 w-3.5 mr-1" />End call</Button>
              <Button size="sm" variant="outline" onClick={() => toast({ title: 'Warm transfer ready', description: 'Select a destination after the live Flex workspace is connected.' })}><ArrowRightLeft className="h-3.5 w-3.5 mr-1" />Warm transfer</Button>
            </div>
          ) : (
            <Button onClick={startCall} disabled={callLoading || !lead.phone || telephony?.mode === 'unavailable'}>
              <PhoneCall className="h-4 w-4 mr-2" />{callLoading ? 'Starting…' : 'Call ' + lead.first_name}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">{telephony?.mode === 'production' ? 'Calls are routed through Twilio. Recording and webhook status will attach to this lead.' : telephony?.mode === 'unavailable' ? telephony.warning : 'Test mode is active. No real call is placed until the Twilio secret store is configured.'}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Log Disposition</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div><Label>Disposition</Label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={disposition} onChange={e => setDisposition(e.target.value)}>
                {DISPOSITIONS.map(d => <option key={d} value={d}>{d.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div><Label>Next action</Label><Input value={nextAction} onChange={e => setNextAction(e.target.value)} /></div>
          </div>
          <div><Label>Notes</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save Disposition'}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Call History</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          {calls?.length === 0 ? <EmptyState message="No calls yet." /> :
            calls.map(c => <div key={c.id} className="flex justify-between border border-border rounded p-2"><Badge variant="outline">{c.disposition.replace(/_/g, ' ')}</Badge><span className="text-xs text-muted-foreground">{new Date(c.call_start).toLocaleString()}</span></div>)}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, accent }) {
  return (
    <Card><CardContent className="p-4 flex items-center justify-between">
      <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-heading font-semibold mt-1">{value}</p></div>
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${accent}`}><Icon className="h-5 w-5" /></div>
    </CardContent></Card>
  );
}

function Spinner() { return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }



