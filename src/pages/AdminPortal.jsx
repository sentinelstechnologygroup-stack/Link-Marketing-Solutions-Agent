import { Link } from 'react-router-dom';
import {
  ArrowUpRight, Building2, FileText, GitBranch, Megaphone, Phone,
  Radio, Settings, ShieldCheck, Users
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { isAdminRole } from '@/lib/tenantContext';

const ADMIN_LINKS = [
  { to: '/brands', label: 'Brands', detail: 'Manage brand profiles and operating scope.', icon: Building2 },
  { to: '/campaigns', label: 'Campaigns', detail: 'Review campaigns and their program settings.', icon: Megaphone },
  { to: '/lead-sources', label: 'Lead sources', detail: 'Configure and review lead acquisition sources.', icon: Radio },
  { to: '/scripts', label: 'Scripts & forms', detail: 'Maintain approved scripts and qualification forms.', icon: FileText },
  { to: '/routing-rules', label: 'Routing rules', detail: 'Review lead distribution and approved routing.', icon: GitBranch },
  { to: '/phone-numbers', label: 'Phone numbers', detail: 'Review communication number configuration.', icon: Phone },
  { to: '/business-owners', label: 'Business owners', detail: 'Maintain approved owner and representative records.', icon: Users },
  { to: '/settings', label: 'Portal settings', detail: 'Review CRM and communications settings.', icon: Settings },
  { to: '/audit-log', label: 'Audit log', detail: 'Review recorded administrative and operational activity.', icon: ShieldCheck },
];

export default function AdminPortal() {
  const { user } = useAuth();
  if (!isAdminRole(user?.role)) return null;
  return (
    <div className="space-y-6 p-5 sm:p-8">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#88702d]">Link Marketing Solutions</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-[#071b1e]">Admin Portal</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#647274]">One administrator permission tier for platform configuration and oversight.</p>
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
    </div>
  );
}

