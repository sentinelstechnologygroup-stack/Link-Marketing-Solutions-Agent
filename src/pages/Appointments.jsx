import React, { useEffect, useState } from 'react';
import { EmptyDataTable, EmptyRecordCard } from '@/components/CollectionStructure';
import { Link } from 'react-router-dom';
import { firebaseClient } from '@/api/firebaseClient';
import { useAuth } from '@/lib/AuthContext';
import { buildTenantFilter } from '@/lib/tenantContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const STATUS_COLORS = { booked: 'bg-cyan-100 text-cyan-700', confirmed: 'bg-blue-100 text-blue-700', attended: 'bg-emerald-100 text-emerald-700', canceled: 'bg-rose-100 text-rose-700', no_show: 'bg-amber-100 text-amber-700', outcome_unknown: 'bg-slate-100 text-slate-700' };

export default function Appointments() {
  const { user } = useAuth();
  const [appts, setAppts] = useState([]);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [a, l] = await Promise.all([
          firebaseClient.entities.Appointment.filter(buildTenantFilter(user), 'scheduled_start', 200),
          firebaseClient.entities.Lead.filter(buildTenantFilter(user), '-created_date', 200),
        ]);
        setAppts(a); setLeads(l);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, [user]);

  const leadMap = Object.fromEntries(leads.map(l => [l.id, l]));

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-heading font-semibold tracking-tight">Appointments</h1><p className="text-muted-foreground text-sm mt-1">All scheduled appointments across your brands</p></div>
      {loading ? <Spinner/> : appts.length === 0 ? (
        <EmptyDataTable
          title="Appointment schedule"
          columns={['Prospect', 'Brand', 'Type', 'Scheduled', 'Time zone', 'Status']}
          message="No appointments are scheduled yet. Booked appointments will populate this schedule automatically."
        />
      ) : (
        <div className="space-y-2">
          {appts.map(a => (
            <Card key={a.id}>
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <Link to={`/leads/${a.lead_id}`} className="font-medium hover:underline">{leadMap[a.lead_id]?.first_name} {leadMap[a.lead_id]?.last_name || 'Lead'}</Link>
                  <p className="text-xs text-muted-foreground">{a.appointment_type.replace(/_/g, ' ')} · {new Date(a.scheduled_start).toLocaleString()} · {a.timezone}</p>
                </div>
                <Badge className={`${STATUS_COLORS[a.status] || 'bg-slate-100'} border-0`}>{a.status.replace(/_/g, ' ')}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Spinner() { return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" /></div>; }

