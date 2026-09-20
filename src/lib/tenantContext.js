import { firebaseClient } from '@/api/firebaseClient';

/**
 * Tenant context helpers.
 * Centralizes organization/brand scoping so tenant filtering is consistent
 * across the UI. Backend functions and RLS enforce the real security boundary;
 * these helpers only shape queries for the current user's permitted scope.
 */

export const ROLE_LABELS = {
  admin: 'Administrator',
  super_admin: 'Administrator',
  org_admin: 'Administrator',
  brand_admin: 'Administrator',
  supervisor: 'Supervisor',
  lead_response_agent: 'Lead Response Agent',
  business_owner: 'Business Owner',
  realtor: 'Licensed Professional',
  reporting_only: 'Reporting Only',
  auditor: 'Auditor',
  disabled: 'Disabled'
};

export const ROLE_HIERARCHY = {
  admin: 100,
  super_admin: 100,
  org_admin: 100,
  brand_admin: 100,
  supervisor: 70,
  lead_response_agent: 50,
  business_owner: 40,
  realtor: 40,
  reporting_only: 20,
  auditor: 20,
  disabled: 0
};

export function isAdminRole(role) {
  return ['admin', 'super_admin', 'org_admin', 'brand_admin'].includes(role);
}

export function canManageScripts(role) {
  return isAdminRole(role) || role === 'supervisor';
}

export function canManageBrands(role) {
  return isAdminRole(role);
}

export function canViewAuditLog(role) {
  return isAdminRole(role) || role === 'auditor';
}

/**
 * Returns the list of brand ids the current user is permitted to access.
 * super_admin / org_admin see all brands for their organization.
 */
export function getPermittedBrandIds(user) {
  if (!user) return [];
  if (user.role === 'super_admin') return null; // null = no filter
  if (user.assigned_brand_ids && user.assigned_brand_ids.length) {
    return user.assigned_brand_ids;
  }
  return [];
}

/**
 * Builds a filter object scoped to the current user's tenant access.
 * Pass the entity name so we know which field to scope.
 */
export function buildTenantFilter(user, extra = {}) {
  const filter = { ...extra };
  if (!user) return filter;
  if (user.role === 'super_admin') return filter;
  if (user.organization_id) {
    filter.organization_id = user.organization_id;
  }
  const brandIds = getPermittedBrandIds(user);
  if (brandIds && brandIds.length) {
    filter.brand_id = { $in: brandIds };
  }
  return filter;
}

