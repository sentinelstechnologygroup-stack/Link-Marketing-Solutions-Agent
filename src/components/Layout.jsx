import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { ROLE_LABELS, isAdminRole, canManageScripts, canManageBrands, canViewAuditLog } from '@/lib/tenantContext';
import { base44 } from '@/api/base44Client';
import {
  LayoutDashboard, Inbox, Building2, FileText, GitBranch, Calendar,
  Phone, ShieldCheck, LogOut, Menu, X, Users, ClipboardList
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard, roles: null },
  { label: 'Lead Inbox', path: '/leads', icon: Inbox, roles: null },
  { label: 'Appointments', path: '/appointments', icon: Calendar, roles: null },
  { label: 'Brands', path: '/brands', icon: Building2, roles: null },
  { label: 'Scripts', path: '/scripts', icon: FileText, roles: null },
  { label: 'Qualification Forms', path: '/qualification-forms', icon: ClipboardList, roles: null },
  { label: 'Routing Rules', path: '/routing-rules', icon: GitBranch, roles: null },
  { label: 'Phone Numbers', path: '/phone-numbers', icon: Phone, roles: null },
  { label: 'Business Owners', path: '/business-owners', icon: Users, roles: null },
  { label: 'Audit Log', path: '/audit-log', icon: ShieldCheck, roles: ['admin', 'super_admin', 'org_admin', 'supervisor', 'auditor'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const role = user?.role || 'lead_response_agent';
  const roleLabel = ROLE_LABELS[role] || role;

  const visibleItems = NAV_ITEMS.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(role);
  });

  const handleLogout = () => {
    logout(false);
    navigate('/login');
  };

  const NavList = () => (
    <nav className="flex flex-col gap-1 px-3">
      {visibleItems.map(item => {
        const Icon = item.icon;
        const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
        return (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-sidebar py-6">
        <div className="px-6 mb-8">
          <h1 className="font-heading text-lg font-semibold tracking-tight">Link Marketing</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Lead Response CRM</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList />
        </div>
        <div className="px-3 mt-4 pt-4 border-t border-sidebar-border">
          <div className="px-3 mb-2">
            <p className="text-sm font-medium truncate">{user?.full_name || user?.email || 'User'}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground w-full transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between border-b border-border bg-sidebar px-4 py-3">
        <h1 className="font-heading text-base font-semibold">Link Marketing</h1>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 rounded-lg hover:bg-accent">
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-20 bg-black/40" onClick={() => setMobileOpen(false)}>
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar py-6 pt-16" onClick={e => e.stopPropagation()}>
            <NavList />
            <div className="px-3 mt-4 pt-4 border-t border-sidebar-border">
              <p className="text-sm font-medium px-3 mb-2 truncate">{user?.full_name || user?.email}</p>
              <p className="text-xs text-muted-foreground px-3 mb-2">{roleLabel}</p>
              <button onClick={handleLogout} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent w-full">
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 lg:pt-0 pt-14 overflow-x-hidden">
        <div className="px-4 sm:px-6 lg:px-10 py-6 lg:py-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}