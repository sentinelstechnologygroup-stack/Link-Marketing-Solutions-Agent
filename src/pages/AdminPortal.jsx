import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight, Building2, FileText, GitBranch, Megaphone, Phone,
  Plus, Radio, Settings, ShieldCheck, Users, X
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isAdminRole } from '@/lib/tenantContext';
import { firebaseClient } from '@/api/firebaseClient';

const ADMIN_LINKS = [
  { to: '/brands', label: 'Brands', detail: 'Manage brand profiles and operating scope.', icon: Building2 },
  { to: '/campaigns', label: 'Campaigns', detail: 'Review campaigns and their program settings.', icon: Megaphone },
  { to: '/lead-sources', label: 'Lead sources', detail: 'Configure and review lead acquisition sources.', icon: Radio },
  { to: '/scripts', label: 'Scripts & forms', detail: 'Maintain approved scripts and qualification forms.', icon: FileText },
  { to: '/routing-rules', label: 'Routing rules', detail: 'Review lead distribution and approved routing.', icon: GitBranch },
  { to: '/phone-numbers', label: 'Phone numbers', detail: 'Review communication number configuration.', icon: Phone },
  { to: '/business-owners', label: 'Client contacts', detail: 'Maintain approved client contacts, representatives, and service recipients.', icon: Users },
  { to: '/settings', label: 'Portal settings', detail: 'Review CRM and communications settings.', icon: Settings },
  { to: '/audit-log', label: 'Audit log', detail: 'Review recorded administrative and operational activity.', icon: ShieldCheck },
];

export default function AdminPortal() {
  const { user } = useAuth();
  const [showProvisioning, setShowProvisioning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ clientName: '', tenantSlug: '', brandName: '', brandSlug: '', industryId: 'general', adminEmail: '', domain: '', routeKey: '', assignedAgentUids: '', retentionDays: '2555' });
  if (!isAdminRole(user?.role)) return null;
  const isSuperAdmin = ['lms_super_admin', 'super_admin'].includes(user?.role);
  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  const provision = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const result = await firebaseClient.functions.invoke('provisionClient', {
        ...form,
        status: 'active',
        assignedAgentUids: form.assignedAgentUids.split(',').map((item) => item.trim()).filter(Boolean),
        retentionDays: Number(form.retentionDays) || 2555,
        notificationChannels: ['in_app', 'email'],
      });
      setMessage(`Client ready: ${result.tenantId} / ${result.brandId}. ${result.invitationPending ? 'Administrator invitation is pending.' : 'Administrator membership is active.'}`);
      setForm({ clientName: '', tenantSlug: '', brandName: '', brandSlug: '', industryId: 'general', adminEmail: '', domain: '', routeKey: '', assignedAgentUids: '', retentionDays: '2555' });
    } catch (error) {
      setMessage(error?.message || 'Client provisioning failed.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-6 p-5 sm:p-8">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#88702d]">Link Marketing Solutions</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-[#071b1e]">Admin Portal</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#647274]">Shared multi-industry platform configuration, client provisioning, and tenant oversight.</p>
        {isSuperAdmin && <button type="button" onClick={() => setShowProvisioning(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#082c36] px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0b3b48]"><Plus className="h-4 w-4" /> Provision client</button>}
      </header>
      <section className="rounded-2xl border border-[#d4af37]/35 bg-white p-5 shadow-sm">
        <div className="flex gap-3">
          <span className="rounded-xl bg-[#f7f0d8] p-3 text-[#80671f]"><ShieldCheck className="h-5 w-5" /></span>
          <div>
            <h2 className="text-sm font-semibold text-[#173c3a]">Administrator session</h2>
            <p className="mt-1 text-sm text-[#667775]">{user?.full_name || user?.email || 'Signed-in administrator'}</p>
            <p className="mt-2 text-xs leading-5 text-[#788784]">This portal uses the authenticated user role. Production authorization must be enforced by the trusted backend; the browser role is only for navigation and display.</p>
          </div>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ADMIN_LINKS.map(({ to, label, detail, icon: Icon }) => (
          <Link key={to} to={to} className="group rounded-xl border border-[#071b1e]/10 bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#00838f]/45 hover:shadow-md">
            <div className="flex items-start justify-between">
              <span className="rounded-lg bg-[#edf5f4] p-2 text-[#00747d]"><Icon className="h-5 w-5" /></span>
              <ArrowUpRight className="h-4 w-4 text-[#93a09c] group-hover:text-[#00747d]" />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-[#173c3a]">{label}</h2>
            <p className="mt-1 text-xs leading-5 text-[#71807c]">{detail}</p>
          </Link>
        ))}
      </section>
      {message && <div role="status" className="rounded-xl border border-[#00838f]/30 bg-[#edf8f7] px-4 py-3 text-sm text-[#174b4c]">{message}</div>}
      {showProvisioning && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#071b1e]/70 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="provision-client-title">
          <form onSubmit={provision} className="my-6 w-full max-w-3xl rounded-2xl bg-[#fbfaf6] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#88702d]">LMS Super Admin</p><h2 id="provision-client-title" className="mt-1 font-heading text-2xl font-semibold text-[#071b1e]">Provision a client organization</h2><p className="mt-2 text-sm text-[#647274]">Creates the tenant, Brand, workflow policies, protected route, initial administrator invitation, and Agent CRM assignments together.</p></div>
              <button type="button" onClick={() => setShowProvisioning(false)} className="rounded-lg p-2 text-[#647274] hover:bg-black/5" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ['clientName', 'Client organization', 'Golden Cross Realty'], ['tenantSlug', 'Tenant identifier', 'golden-cross-beta'],
                ['brandName', 'Brand name', 'Golden Cross Realty'], ['brandSlug', 'Brand identifier', 'golden-cross-realty'],
                ['industryId', 'Industry', 'real-estate'], ['adminEmail', 'Initial client administrator', 'name@company.com'],
                ['domain', 'Client domain', 'example.com'], ['routeKey', 'Server route key', 'golden-cross-beta'],
                ['assignedAgentUids', 'Assigned agent UIDs', 'uid-one, uid-two'], ['retentionDays', 'Retention days', '2555'],
              ].map(([field, label, placeholder]) => <label key={field} className="text-sm font-semibold text-[#173c3a]">{label}{!['domain', 'assignedAgentUids'].includes(field) && ' *'}<input required={!['domain', 'assignedAgentUids'].includes(field)} value={form[field]} onChange={update(field)} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-[#071b1e]/15 bg-white px-3 py-3 font-normal text-[#071b1e] outline-none focus:border-[#00838f]" /></label>)}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={() => setShowProvisioning(false)} className="rounded-xl border border-[#071b1e]/15 bg-white px-4 py-3 text-sm font-semibold text-[#173c3a]">Cancel</button><button disabled={saving} className="rounded-xl bg-[#00838f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Provisioning...' : 'Create client workspace'}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

