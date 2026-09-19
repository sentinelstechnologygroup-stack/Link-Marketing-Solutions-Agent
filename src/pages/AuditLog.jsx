import React, { useEffect, useState } from 'react';
import { firebaseClient } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SEVERITY_COLORS = { info: 'bg-blue-100 text-blue-700', warning: 'bg-amber-100 text-amber-700', critical: 'bg-rose-100 text-rose-700' };

export default function AuditLog() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await firebaseClient.entities.AuditLog.list('-created_date', 200);
        setLogs(data);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [user]);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-heading font-semibold tracking-tight">Audit Log</h1><p className="text-muted-foreground text-sm mt-1">System activity and access records</p></div>
      {loading ? <Spinner/> : logs.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-muted-foreground">No audit entries yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {logs.map(l => (
            <Card key={l.id}><CardContent className="p-3 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-medium">{l.action}</p>
                <p className="text-xs text-muted-foreground">{l.actor_email || 'system'} · {l.entity_type}{l.entity_id ? `:${l.entity_id.slice(-6)}` : ''}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{new Date(l.created_date).toLocaleString()}</span>
                <Badge className={`${SEVERITY_COLORS[l.severity] || SEVERITY_COLORS.info} border-0`}>{l.severity}</Badge>
              </div>
            </CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Spinner() { return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }
