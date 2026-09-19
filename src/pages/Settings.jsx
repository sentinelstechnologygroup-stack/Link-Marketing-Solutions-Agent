import React, { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AuthError, ErrorState, TenantBadge } from '@/components/ContractState';
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, RefreshCw, PhoneOff, PhoneCall } from 'lucide-react';

export default function Settings() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const result = await api.getTelephonyAdminStatus(user);
      setStatus(result);
    } catch (e) { setError(e); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [user]);

  if (loading) return <Spinner />;
  if (error) return error instanceof ApiError && (error.status === 401 || error.status === 403)
    ? <AuthError error={error} onRetry={load} /> : <ErrorState error={error} onRetry={load} />;
  if (!status) return null;

  const isMock = status.mode === 'mock';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Admin Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Telephony mode, production readiness, and system configuration</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5 mr-1" />Refresh</Button>
          <TenantBadge tenant={status.tenant} />
        </div>
      </div>

      {/* Telephony mode banner */}
      <Card className={isMock ? 'border-amber-300 bg-amber-50' : 'border-emerald-300 bg-emerald-50'}>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            {isMock ? (
              <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <PhoneOff className="h-6 w-6 text-amber-600" />
              </div>
            ) : (
              <div className="h-12 w-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <PhoneCall className="h-6 w-6 text-emerald-600" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-heading font-semibold">
                  {isMock ? 'Twilio is OFF — Test Mode' : 'Twilio is LIVE — Production Mode'}
                </h2>
                <Badge className={isMock ? 'bg-amber-200 text-amber-800 border-0' : 'bg-emerald-200 text-emerald-800 border-0'}>
                  {status.mode?.toUpperCase()}
                </Badge>
              </div>
              <p className="text-sm mt-1 text-muted-foreground">
                {isMock
                  ? 'No real calls or SMS are being made. All telephony actions return simulated responses. You will not incur any Twilio charges.'
                  : 'Calls and SMS are routed through Twilio. Recording and webhook status will attach to leads. Charges will apply.'}
              </p>
              {isMock && status.warning && (
                <p className="text-xs mt-2 text-amber-700">{status.warning}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Production checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Production Readiness Checklist
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Twilio stays in test mode until every item below is configured. The system will not place real calls until all secrets are present.
          </p>
          <div className="space-y-2">
            {status.checklist?.map(item => (
              <div key={item.name} className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
                <div className="flex items-center gap-3">
                  {item.set
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    : <XCircle className="h-4 w-4 text-muted-foreground" />}
                  <code className="text-sm font-mono">{item.name}</code>
                </div>
                <Badge variant={item.set ? 'default' : 'outline'} className={item.set ? 'bg-emerald-100 text-emerald-700 border-0' : ''}>
                  {item.set ? 'Configured' : 'Missing'}
                </Badge>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-muted text-sm">
            <p className="font-medium mb-1">How to go live (when you're ready):</p>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Add the missing secrets above (TWILIO_VOICE_TWIML_URL, callback URLs, signing secret).</li>
              <li>Configure your TwiML application and webhook URLs in Twilio Console.</li>
              <li>Return here and refresh — the mode will switch to Production automatically.</li>
              <li>To turn it off again, remove any of the missing secrets and the system reverts to test mode.</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* Supported actions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Supported Telephony Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {status.supportedActions?.map(a => (
              <Badge key={a} variant="outline" className="font-mono text-xs">{a}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Credentials summary (no values shown) */}
      <Card>
        <CardHeader><CardTitle className="text-base">Credential Summary</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <CredRow label="Credentials configured" value={status.credentials_configured} />
          <CredRow label="Call config configured" value={status.call_configured} />
          <CredRow label="Workspace SID" value={status.workspace_sid ? 'Set' : 'Not set'} />
          <CredRow label="Flex Flow SID" value={status.flex_flow_sid ? 'Set' : 'Not set'} />
          <CredRow label="Task Router SID" value={status.task_router_sid ? 'Set' : 'Not set'} />
          <CredRow label="Default From Number" value={status.default_from_number || 'Not set'} />
        </CardContent>
      </Card>
    </div>
  );
}

function CredRow({ label, value }) {
  const ok = value === true || value === 'Set';
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
        <span className="text-sm font-medium">{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : value}</span>
      </div>
    </div>
  );
}

function Spinner() { return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }
