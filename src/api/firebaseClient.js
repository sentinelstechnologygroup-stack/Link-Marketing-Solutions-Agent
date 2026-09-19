import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

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
const roleMap = { admin: 'super_admin', supervisor: 'supervisor', agent: 'lead_response_agent', auditor: 'auditor', customer: 'business_owner' };
const getTenantId = () => profile?.memberships?.find((item) => item.active !== false)?.tenantId || null;

async function getProfile() {
  const raw = (await httpsCallable(functions, 'getMyProfile')()).data || {};
  const membership = raw.memberships?.[0] || {};
  profile = { ...raw, id: raw.uid, role: roleMap[membership.role] || membership.role, organization_id: membership.tenantId, tenantId: membership.tenantId, assigned_brand_ids: membership.brandIds || [], memberships: raw.memberships || [] };
  return profile;
}

async function entityRows(entityName, filter = {}, sort = '', pageSize = 200) {
  const collectionName = ENTITY_COLLECTIONS[entityName];
  if (!collectionName || collectionName === 'members') return [];
  const result = await httpsCallable(functions, 'getAgentCollection')({ tenantId: getTenantId(), collectionName, limit: pageSize });
  let rows = result.data?.rows || [];
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
    create: async (data) => (await httpsCallable(functions, 'createAgentRecord')({ tenantId: getTenantId(), collectionName, data })).data,
    update: async (id, data) => (await httpsCallable(functions, 'updateAgentRecord')({ tenantId: getTenantId(), collectionName, recordId: id, data })).data,
    delete: async () => { throw new Error('CRM deletion requires an approved server workflow.'); },
  };
}

export const firebaseClient = {
  app: { getPublicSettings: async () => ({ id: 'firebase-agent-crm', public_settings: { backend: 'firebase' } }) },
  auth: {
    loginViaEmailPassword: async (email, password) => { await signInWithEmailAndPassword(auth, email.trim(), password); return getProfile(); },
    me: async () => auth.currentUser ? getProfile() : (() => { throw Object.assign(new Error('Authentication required'), { status: 401 }); })(),
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

