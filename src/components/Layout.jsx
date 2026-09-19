import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { ROLE_LABELS } from '@/lib/tenantContext';
import BrandMark from '@/components/BrandMark';
import {
  LayoutDashboard, Inbox, Building2, FileText, GitBranch, Calendar,
  Phone, ShieldCheck, LogOut, Menu, X, Users, ClipboardList, Headphones, Eye,
  Megaphone, Radio, Settings as SettingsIcon, Bell, Sparkles, UserCog
} from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'Work',
    items: [
      { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: null },
      { label: 'Agent Workspace', path: '/workspace', icon: Headphones, roles: null },
      { label: 'Lead Inbox', path: '/leads', icon: Inbox, roles: null },
      { label: 'Supervisor', path: '/supervisor', icon: Eye, roles: ['admin', 'super_admin', 'org_admin', 'brand_admin', 'supervisor'] },
      { label: 'Appointments', path: '/appointments', icon: Calendar, roles: null },
    ],
  },
  {
    label: 'Programs',
    items: [
      { label: 'Campaigns', path: '/campaigns', icon: Megaphone, roles: null },
      { label: 'Lead Sources', path: '/lead-sources', icon: Radio, roles: null },
      { label: 'Brands', path: '/brands', icon: Building2, roles: null },
      { label: 'Scripts', path: '/scripts', icon: FileText, roles: null },
      { label: 'Qualification Forms', path: '/qualification-forms', icon: ClipboardList, roles: null },
      { label: 'Routing Rules', path: '/routing-rules', icon: GitBranch, roles: null },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Admin Portal', path: '/admin', icon: UserCog, roles: ['admin', 'super_admin', 'org_admin', 'brand_admin'] },
      { label: 'Phone Numbers', path: '/phone-numbers', icon: Phone, roles: null },
      { label: 'Business Owners', path: '/business-owners', icon: Users, roles: null },
      { label: 'Audit Log', path: '/audit-log', icon: ShieldCheck, roles: ['admin', 'super_admin', 'org_admin', 'supervisor', 'auditor'] },
      { label: 'Settings', path: '/settings', icon: SettingsIcon, roles: ['admin', 'super_admin', 'org_admin', 'brand_admin'] },
    ],
  },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = user?.role || 'lead_response_agent';
  const roleLabel = ROLE_LABELS[role] || role;
  const isPreviewAccess = import.meta.env.DEV || import.meta.env.VERCEL_ENV === 'preview' || import.meta.env.VITE_AGENT_CRM_BYPASS_AUTH === 'true';

  const canSee = (item) => !item.roles || item.roles.includes(role);
  const isActive = (item) => location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
  const currentItem = NAV_GROUPS.flatMap(group => group.items).find(isActive);
  const initials = (user?.full_name || user?.email || 'Link Agent').split(/[\s@]+/).slice(0, 2).map(part => part[0]?.toUpperCase()).join('');

  const handleLogout = () => {
    logout(false);
    navigate('/login');
  };

  const Navigation = () => (
    <nav className="flex-1 overflow-y-auto px-3 pb-5" aria-label="CRM navigation">
      {NAV_GROUPS.map(group => {
        const items = group.items.filter(canSee);
        if (!items.length) return null;
        return (
          <div key={group.label} className="mb-5">
            <p className="mb-2 px-3 text-[9px] font-bold uppercase tracking-[.22em] text-[#d4af37]/75">{group.label}</p>
            <div className="space-y-1">
              {items.map(item => {
                const Icon = item.icon;
                const active = isActive(item);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex min-h-10 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${active ? 'bg-white/10 text-white shadow-sm' : 'text-white/55 hover:bg-white/[.06] hover:text-white'}`}
                  >
                    <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-[#d4af37]' : ''}`} />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );

  const Sidebar = ({ mobile = false }) => (
    <aside className={`${mobile ? 'flex' : 'hidden lg:flex'} h-full w-[278px] shrink-0 flex-col border-r border-white/[.08] bg-[#071b1e] text-white`}>
      <div className="flex h-[78px] shrink-0 items-center border-b border-white/[.08] px-6">
        <BrandMark />
      </div>
      <div className="px-4 py-4">
        <Link to="/workspace" onClick={() => setMobileOpen(false)} className="flex w-full items-center gap-3 rounded-xl border border-[#d4af37]/25 bg-[#d4af37]/10 px-4 py-3 text-xs font-bold text-[#ead486] transition hover:bg-[#d4af37]/15">
          <Sparkles className="h-4 w-4" /> Open agent workspace
        </Link>
      </div>
      <Navigation />
      <div className="shrink-0 border-t border-white/[.08] p-3">
        <div className="flex items-center gap-3 rounded-xl px-3 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#d4af37] text-xs font-bold text-[#071b1e]">{initials}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user?.full_name || user?.email || 'Link Agent'}</p>
            <p className="truncate text-[10px] text-white/42">{roleLabel}</p>
          </div>
          <button onClick={handleLogout} className="rounded-lg p-2 text-white/45 transition hover:bg-white/[.06] hover:text-white" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#f4f1ea]">
      <Sidebar />

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
          <div className="relative h-full">
            <Sidebar mobile />
            <button onClick={() => setMobileOpen(false)} className="absolute right-3 top-3 rounded-lg p-2 text-white/70 hover:bg-white/10" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[70px] shrink-0 items-center justify-between border-b border-[#071b1e]/10 bg-[#fbfaf7]/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="rounded-lg border border-[#071b1e]/10 bg-white p-2 shadow-sm lg:hidden" aria-label="Open CRM navigation">
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#243b3e]">{currentItem?.label || 'Link CRM'}</p>
              <p className="hidden text-[10px] text-[#879192] sm:block">Lead response, qualification and routing operations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isPreviewAccess && <span className="items-center gap-2 rounded-full border border-rose-300 bg-rose-100 px-3 py-1.5 text-[10px] font-bold text-rose-800 sm:inline-flex">Preview access only</span>}
            <button className="relative rounded-lg border border-[#071b1e]/10 bg-white p-2.5 shadow-sm" aria-label="Notifications">
              <Bell className="h-4 w-4 text-[#334a4d]" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#d4af37]" />
            </button>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#071b1e] text-[10px] font-bold text-white">{initials}</span>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
            {isPreviewAccess && <div role="status" className="mb-5 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-900">PREVIEW ONLY: CRM data and actions are not confirmed live. Do not enter real customer information.</div>}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

