import { getApp, getApps, initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { normalizeEntityRow, normalizeEntityWrite } from './firebaseEntityContract';

const env = (name) => import.meta.env?.[name] || '';
const firebaseConfig = {
  apiKey: env('VITE_FIREBASE_AGENT_CRM_API_KEY') || env('VITE_FIREBASE_CUSTOMER_PORTAL_API_KEY'),
  authDomain: env('VITE_FIREBASE_AGENT_CRM_AUTH_DOMAIN') || env('VITE_FIREBASE_CUSTOMER_PORTAL_AUTH_DOMAIN'),
  projectId: env('VITE_FIREBASE_AGENT_CRM_PROJECT_ID') || 'linkmarketing-agent-portal-crm',
  storageBucket: env('VITE_FIREBASE_AGENT_CRM_STORAGE_BUCKET') || env('VITE_FIREBASE_CUSTOMER_PORTAL_STORAGE_BUCKET'),
  messagingSenderId: env('VITE_FIREBASE_AGENT_CRM_MESSAGING_SENDER_ID') || env('VITE_FIREBASE_CUSTOMER_PORTAL_MESSAGING_SENDER_ID'),
  appId: env('VITE_FIREBASE_AGENT_CRM_APP_ID') || env('VITE_FIREBASE_CUSTOMER_PORTAL_APP_ID'),
};
const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
const appCheckSiteKey = env('VITE_FIREBASE_AGENT_CRM_APP_CHECK_SITE_KEY');
if (appCheckSiteKey && typeof window !== 'undefined') {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}
const auth = getAuth(firebaseApp);
const functions = getFunctions(firebaseApp, 'us-central1');
let profile = null;

const ENTITY_COLLECTIONS = {
  Organization: 'organizations', Brand: 'brands', Campaign: 'campaigns', LeadSource: 'leadSources',
  Lead: 'leads', FollowUpTask: 'followUpTasks', CommunicationAlert: 'communicationAlerts',
  CallRecord: 'callRecords', CallTranscript: 'callTranscripts', CallQualityReview: 'callQualityReviews',
  Appointment: 'appointments', BusinessOwner: 'businessOwners', Script: 'scripts',
  QualificationForm: 'qualificationForms', RoutingRule: 'routingRules', PhoneNumber: 'phoneNumbers',
  Report: 'reports', AuditLog: 'auditLogs', User: 'members',
};
const roleMap = { admin: 'super_admin', lms_super_admin: 'super_admin', supervisor: 'supervisor', agent: 'lead_response_agent', auditor: 'auditor' };
const agentRoles = new Set(['super_admin', 'supervisor', 'lead_response_agent', 'auditor']);
const ACTIVE_TENANT_KEY = 'lms-agent-active-tenant';
const getTenantId = () => profile?.organization_id || null;

function selectAssignment(assignments) {
  const activeAssignments = (assignments || []).filter((item) => item.status === 'active' && item.tenantStatus !== 'disabled');
  const storedTenantId = window.localStorage.getItem(ACTIVE_TENANT_KEY);
  const selected = activeAssignments.find((item) => item.tenantId === storedTenantId) || activeAssignments[0] || null;
  if (selected?.tenantId) window.localStorage.setItem(ACTIVE_TENANT_KEY, selected.tenantId);
  return { activeAssignments, selected };
}

function applyAssignment(raw, claimedRole, assignments, selected) {
  const assignedBrandIds = Array.isArray(selected?.brandIds) && selected.brandIds.length
    ? selected.brandIds
    : selected?.brandId ? [selected.brandId] : [];
  return {
    ...raw,
    id: raw.uid,
    role: claimedRole,
    organization_id: selected?.tenantId || null,
    tenantId: selected?.tenantId || null,
    tenant_name: selected?.tenantName || selected?.tenantId || null,
    assigned_brand_ids: assignedBrandIds,
    agentAssignments: assignments,
    tenantOptions: assignments.map((item) => ({
      tenantId: item.tenantId,
      name: item.tenantName || item.tenantId,
      industry: item.industry || 'general',
      role: item.role,
      status: item.status,
    })),
  };
}

async function getProfile() {
  const raw = (await httpsCallable(functions, 'getMyProfile')()).data || {};
  const token = await auth.currentUser?.getIdTokenResult();
  const { activeAssignments, selected } = selectAssignment(raw.agentAssignments);
  const assignmentRole = roleMap[selected?.role] || selected?.role;
  const claimedRole = raw.lmsSuperAdmin ? 'super_admin' : roleMap[token?.claims?.role] || token?.claims?.role || assignmentRole;
  if (!agentRoles.has(claimedRole)) {
    throw Object.assign(new Error('This account is not authorized for the Agent CRM.'), { status: 403 });
  }
  if (!selected) {
    throw Object.assign(new Error('This Agent CRM account does not have an active tenant assignment.'), { status: 403 });
  }
  profile = applyAssignment(raw, claimedRole, activeAssignments, selected);
  return profile;
}

async function entityRows(entityName, filter = {}, sort = '', pageSize = 200) {
  const collectionName = ENTITY_COLLECTIONS[entityName];
  if (!collectionName || collectionName === 'members') return [];
  const result = await httpsCallable(functions, 'getAgentCollection')({ tenantId: getTenantId(), collectionName, limit: pageSize });
  let rows = (result.data?.rows || []).map((row) => normalizeEntityRow(collectionName, row));
  rows = rows.filter((row) => Object.entries(filter || {}).every(([key, expected]) => expected && typeof expected === 'object' && '$in' in expected ? expected.$in.includes(row[key]) : expected == null || row[key] === expected));
  const field = String(sort || '').replace(/^-/, '');
  if (field) rows.sort((a, b) => String(a[field] || '').localeCompare(String(b[field] || '')) * (String(sort).startsWith('-') ? -1 : 1));
  return rows.slice(0, pageSize);
}

function entityApi(entityName) {
  const collectionName = ENTITY_COLLECTIONS[entityName];
  return {
    list: (limit) => entityRows(entityName, {}, '', limit || 200),
    filter: (filter, sort, limit) => entityRows(entityName, filter, sort, limit || 200),
    get: async (id) => (await entityRows(entityName, {}, '', 500)).find((row) => row.id === id) || null,
    create: async (data) => normalizeEntityRow(collectionName, (await httpsCallable(functions, 'createAgentRecord')({ tenantId: getTenantId(), collectionName, data: normalizeEntityWrite(collectionName, data) })).data),
    update: async (id, data) => normalizeEntityRow(collectionName, (await httpsCallable(functions, 'updateAgentRecord')({ tenantId: getTenantId(), collectionName, recordId: id, data: normalizeEntityWrite(collectionName, data) })).data),
    delete: async () => { throw new Error('CRM deletion requires an approved server workflow.'); },
  };
}

export const firebaseClient = {
  app: { getPublicSettings: async () => ({ id: 'firebase-agent-crm', public_settings: { backend: 'firebase' } }) },
  auth: {
    loginViaEmailPassword: async (email, password) => { await signInWithEmailAndPassword(auth, email.trim(), password); return getProfile(); },
    me: async () => {
      await auth.authStateReady();
      if (auth.currentUser) return getProfile();
      throw Object.assign(new Error('Authentication required'), { status: 401 });
    },
    switchTenant: async (tenantId) => {
      const assignment = profile?.agentAssignments?.find((item) => item.tenantId === tenantId && item.status === 'active');
      if (!assignment) throw Object.assign(new Error('This tenant is not assigned to your Agent CRM account.'), { status: 403 });
      window.localStorage.setItem(ACTIVE_TENANT_KEY, tenantId);
      profile = applyAssignment(profile, profile.role, profile.agentAssignments, assignment);
      return profile;
    },
    logout: async () => { profile = null; await signOut(auth); },
    redirectToLogin: () => { window.location.assign('/login'); },
    resetPasswordRequest: async (email) => sendPasswordResetEmail(auth, email.trim()),
    resetPassword: async () => { throw new Error('Use the Firebase password-reset link.'); },
    register: async () => { throw new Error('CRM access is invitation-only.'); },
    verifyOtp: async () => { throw new Error('CRM access is invitation-only.'); },
    resendOtp: async () => { throw new Error('CRM access is invitation-only.'); },
    loginWithProvider: async () => { throw new Error('Use the approved CRM sign-in method.'); },
  },
  entities: new Proxy({}, { get: (_target, entityName) => entityApi(entityName) }),
  functions: { invoke: async (name, data) => (await httpsCallable(functions, name)({ ...data, tenantId: getTenantId() })).data },
};

