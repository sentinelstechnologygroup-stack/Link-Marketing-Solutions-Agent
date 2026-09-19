import { firebaseClient } from '@/api/firebaseClient';

/**
 * Contract-based API client for Link Marketing Solutions.
 *
 * Every method enforces tenant scope derived from the authenticated user
 * (organization_id + assigned_brand_ids + role) and normalizes list responses
 * to { count, tenant, items }. Authorization failures surface as ApiError
 * with a status code so the UI can show a clear 401/403 state.
 *
 * On firebaseClient this is backed by the SDK; on a self-hosted deployment the same
 * method signatures map 1:1 to the REST endpoints in docs/api-and-webhooks.md
 * with X-Organization-Id / X-Brand-Ids / X-Role / X-User-Id headers.
 */

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status || 500;
  }
}

async function guard(fn) {
  try {
    return await fn();
  } catch (e) {
    const status = e?.status || (e?.response?.status) || 500;
    throw new ApiError(e?.message || 'Request failed', status);
  }
}

function permittedBrandIds(user) {
  if (!user) return [];
  if (user.role === 'admin' || user.role === 'super_admin') return null; // null = all brands in org
  return user.assigned_brand_ids || [];
}

export function getTenantContext(user) {
  const brands = permittedBrandIds(user);
  return {
    organization_id: user?.organization_id || null,
    brand_ids: brands === null ? 'all' : brands,
    role: user?.role || 'unknown',
    user_id: user?.id || null
  };
}

function tenant(user) {
  return getTenantContext(user);
}

function scopeByOrg(user, extra = {}) {
  const f = { ...extra };
  if (user?.organization_id) f.organization_id = user.organization_id;
  return f;
}

function applyBrandScope(user, items) {
  const brands = permittedBrandIds(user);
  if (brands === null) return items;
  if (!brands.length) return [];
  return items.filter(i => brands.includes(i.brand_id));
}

function listResponse(user, items) {
  return { count: items.length, tenant: tenant(user), items };
}

function leadAgeMinutes(lead) {
  if (!lead?.created_date) return 0;
  return Math.round((Date.now() - new Date(lead.created_date).getTime()) / 60000);
}

export const api = {
  // ---------- 1. Agent Workspace ----------
  getAgentWorkspace: (user) => guard(async () => {
    const filter = scopeByOrg(user);
    const [newLeads, callbacks, followUps, brands, campaigns] = await Promise.all([
      firebaseClient.entities.Lead.filter({ ...filter, lead_status: 'new', contact_attempts: 0 }, '-created_date', 100),
      firebaseClient.entities.FollowUpTask.filter({ ...filter, task_type: 'callback_reminder', status: 'pending' }, 'due_date', 100),
      firebaseClient.entities.FollowUpTask.filter({ ...filter, status: 'pending' }, 'due_date', 100),
      firebaseClient.entities.Brand.filter(scopeByOrg(user), '-created_date', 50),
      firebaseClient.entities.Campaign.filter(scopeByOrg(user), '-created_date', 50),
    ]);
    const scopedNew = applyBrandScope(user, newLeads);
    const scopedCb = applyBrandScope(user, callbacks);
    const scopedFu = applyBrandScope(user, followUps);
    const scopedBrands = applyBrandScope(user, brands);
    const scopedCampaigns = applyBrandScope(user, campaigns);
    return {
      tenant: tenant(user),
      agent_status: user?.agent_status || 'offline',
      assigned_brands: scopedBrands,
      assigned_campaigns: scopedCampaigns,
      new_leads: listResponse(user, scopedNew),
      callback_queue: listResponse(user, scopedCb),
      follow_up_queue: listResponse(user, scopedFu),
    };
  }),

  getNewLeads: (user) => guard(async () => {
    const items = applyBrandScope(user, await firebaseClient.entities.Lead.filter(
      { ...scopeByOrg(user), lead_status: 'new', contact_attempts: 0 }, '-created_date', 100));
    return listResponse(user, items);
  }),

  getCallbackQueue: (user) => guard(async () => {
    const items = applyBrandScope(user, await firebaseClient.entities.FollowUpTask.filter(
      { ...scopeByOrg(user), task_type: 'callback_reminder', status: 'pending' }, 'due_date', 100));
    return listResponse(user, items);
  }),

  getFollowUpQueue: (user) => guard(async () => {
    const items = applyBrandScope(user, await firebaseClient.entities.FollowUpTask.filter(
      { ...scopeByOrg(user), status: 'pending' }, 'due_date', 100));
    return listResponse(user, items);
  }),

  // ---------- Lead Inbox ----------
  getLeadInbox: (user, { status, brandId, search } = {}) => guard(async () => {
    let items = applyBrandScope(user, await firebaseClient.entities.Lead.filter(scopeByOrg(user), '-created_date', 300));
    if (status && status !== 'all') items = items.filter(l => l.lead_status === status);
    if (brandId && brandId !== 'all') items = items.filter(l => l.brand_id === brandId);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(l =>
        (l.first_name || '').toLowerCase().includes(q) ||
        (l.last_name || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q) ||
        (l.phone || '').includes(q));
    }
    items.sort((a, b) => (a.priority || 5) - (b.priority || 5) || new Date(a.created_date) - new Date(b.created_date));
    return listResponse(user, items);
  }),

  getLead: (user, leadId) => guard(async () => {
    const lead = await firebaseClient.entities.Lead.get(leadId);
    const brands = permittedBrandIds(user);
    if (brands !== null && !brands.includes(lead.brand_id)) {
      throw new ApiError('Not permitted to access this lead', 403);
    }
    const [brand, campaign] = await Promise.all([
      firebaseClient.entities.Brand.get(lead.brand_id).catch(() => null),
      lead.campaign_id ? firebaseClient.entities.Campaign.get(lead.campaign_id).catch(() => null) : Promise.resolve(null),
    ]);
    let script = null;
    if (campaign?.default_script_id) script = await firebaseClient.entities.Script.get(campaign.default_script_id).catch(() => null);
    if (!script) {
      const s = await firebaseClient.entities.Script.filter({ brand_id: lead.brand_id, status: 'approved' }, '-version_number', 5);
      script = s[0] || null;
    }
    let form = null;
    if (campaign?.default_qualification_form_id) form = await firebaseClient.entities.QualificationForm.get(campaign.default_qualification_form_id).catch(() => null);
    if (!form) {
      const f = await firebaseClient.entities.QualificationForm.filter({ brand_id: lead.brand_id, status: 'active' }, '-created_date', 5);
      form = f[0] || null;
    }
    const [calls, tasks, appointments] = await Promise.all([
      firebaseClient.entities.CallRecord.filter({ lead_id: leadId }, '-call_start', 50),
      firebaseClient.entities.FollowUpTask.filter({ lead_id: leadId }, 'due_date', 50),
      firebaseClient.entities.Appointment.filter({ lead_id: leadId }, 'scheduled_start', 50),
    ]);
    // duplicate detection
    let duplicates = [];
    if (lead.phone || lead.email) {
      const candidates = await firebaseClient.entities.Lead.filter({ brand_id: lead.brand_id }, '-created_date', 200);
      duplicates = candidates.filter(x => x.id !== leadId && (
        (lead.phone && x.phone === lead.phone) || (lead.email && x.email === lead.email && lead.email)
      ));
    }
    return {
      tenant: tenant(user),
      lead, brand, campaign, script, form, calls, tasks, appointments, duplicates,
      lead_age_minutes: leadAgeMinutes(lead),
    };
  }),

  postDisposition: (user, leadId, { disposition, notes, next_action, qualification_data = null, provider_mode = 'mock' }) => guard(async () => {
    const lead = await firebaseClient.entities.Lead.get(leadId);
    const brands = permittedBrandIds(user);
    if (brands !== null && !brands.includes(lead.brand_id)) throw new ApiError('Not permitted', 403);
    const now = new Date().toISOString();
    const call = await firebaseClient.entities.CallRecord.create({
      organization_id: lead.organization_id, brand_id: lead.brand_id, campaign_id: lead.campaign_id,
      lead_id: lead.id, agent_id: user.id, call_direction: 'outbound',
      call_start: now, call_end: now, duration_seconds: 0,
      notes, disposition, next_action, provider_mode,
    });
    const statusMap = { connected: 'connected', qualified: 'qualified', unqualified: 'unqualified', warm_transfer_completed: 'warm_transfer', appointment_booked: 'appointment_scheduled', closed: 'closed', lost: 'lost', duplicate: 'duplicate', do_not_call: 'do_not_call' };
    const updated = await firebaseClient.entities.Lead.update(lead.id, {
      disposition, lead_status: statusMap[disposition] || 'contact_attempted',
      contact_attempts: (lead.contact_attempts || 0) + 1, last_contact_date: now,
      next_action: next_action || null, qualification_data,
    });
    return { call, lead: updated };
  }),

  // ---------- 2. Supervisor ----------
  getSupervisorWorkspace: (user) => guard(async () => {
    const filter = scopeByOrg(user);
    const [leads, tasks, agents] = await Promise.all([
      firebaseClient.entities.Lead.filter(filter, '-created_date', 300),
      firebaseClient.entities.FollowUpTask.filter({ ...filter, status: 'pending' }, 'due_date', 200),
      firebaseClient.entities.User.list(100),
    ]);
    const scopedLeads = applyBrandScope(user, leads);
    const scopedTasks = applyBrandScope(user, tasks);
    const unworked = scopedLeads.filter(l => l.lead_status === 'new' && (l.contact_attempts || 0) === 0);
    const overdue = scopedTasks.filter(t => new Date(t.due_date) < new Date());
    return {
      tenant: tenant(user),
      summary: {
        total_leads: scopedLeads.length,
        unworked: unworked.length,
        overdue_followups: overdue.length,
        connected: scopedLeads.filter(l => l.lead_status === 'connected').length,
        qualified: scopedLeads.filter(l => l.qualification_status === 'qualified').length,
      },
      agents: agents.map(a => ({ id: a.id, name: a.full_name || a.email, role: a.role, agent_status: a.agent_status })),
      unworked, overdue,
    };
  }),

  // ---------- 3. Brands ----------
  getBrands: (user) => guard(async () => {
    const items = applyBrandScope(user, await firebaseClient.entities.Brand.filter(scopeByOrg(user), '-created_date', 100));
    return listResponse(user, items);
  }),
  getCampaigns: (user) => guard(async () => {
    const items = applyBrandScope(user, await firebaseClient.entities.Campaign.filter(scopeByOrg(user), '-created_date', 100));
    return listResponse(user, items);
  }),
  getBrand: (user, brandId) => guard(async () => firebaseClient.entities.Brand.get(brandId)),
  postBrand: (user, payload) => guard(async () => firebaseClient.entities.Brand.create(payload)),
  putBrand: (user, brandId, payload) => guard(async () => firebaseClient.entities.Brand.update(brandId, payload)),
  getBrandDashboard: (user, brandId) => guard(async () => {
    const leads = await firebaseClient.entities.Lead.filter({ brand_id: brandId }, '-created_date', 500);
    return {
      tenant: tenant(user),
      total: leads.length,
      new: leads.filter(l => l.lead_status === 'new').length,
      qualified: leads.filter(l => l.qualification_status === 'qualified').length,
      appointments: leads.filter(l => l.appointment_status === 'booked' || l.appointment_status === 'confirmed').length,
      closed: leads.filter(l => l.lead_status === 'closed').length,
    };
  }),

  // ---------- 4. Scripts ----------
  getScripts: (user) => guard(async () => {
    const items = applyBrandScope(user, await firebaseClient.entities.Script.filter(scopeByOrg(user), '-created_date', 200));
    return listResponse(user, items);
  }),
  getScript: (user, id) => guard(async () => firebaseClient.entities.Script.get(id)),
  postScript: (user, payload) => guard(async () => firebaseClient.entities.Script.create(payload)),
  putScript: (user, id, payload) => guard(async () => firebaseClient.entities.Script.update(id, payload)),
  publishScript: (user, id) => guard(async () => firebaseClient.entities.Script.update(id, {
    status: 'approved', approved_by: user.id, approved_date: new Date().toISOString(), effective_date: new Date().toISOString().slice(0, 10)
  })),
  retireScript: (user, id) => guard(async () => firebaseClient.entities.Script.update(id, { status: 'retired' })),
  getScriptVersions: (user, id) => guard(async () => {
    const script = await firebaseClient.entities.Script.get(id);
    const all = await firebaseClient.entities.Script.filter({ brand_id: script.brand_id, name: script.name }, '-version_number', 50);
    return listResponse(user, all);
  }),

  // ---------- 5. Qualification Forms ----------
  getQualificationForms: (user) => guard(async () => {
    const items = applyBrandScope(user, await firebaseClient.entities.QualificationForm.filter(scopeByOrg(user), '-created_date', 100));
    return listResponse(user, items);
  }),
  getQualificationForm: (user, id) => guard(async () => firebaseClient.entities.QualificationForm.get(id)),
  postQualificationForm: (user, payload) => guard(async () => firebaseClient.entities.QualificationForm.create(payload)),
  putQualificationForm: (user, id, payload) => guard(async () => firebaseClient.entities.QualificationForm.update(id, payload)),
  getFormQuestions: (user, id) => guard(async () => {
    const form = await firebaseClient.entities.QualificationForm.get(id);
    return { tenant: tenant(user), questions: form.questions || [] };
  }),
  postFormQuestion: (user, id, question) => guard(async () => {
    const form = await firebaseClient.entities.QualificationForm.get(id);
    const questions = [...(form.questions || []), { ...question, id: question.id || `q${Date.now()}` }];
    return firebaseClient.entities.QualificationForm.update(id, { questions });
  }),

  // ---------- 6. Routing ----------
  getRoutingRules: (user) => guard(async () => {
    const items = applyBrandScope(user, await firebaseClient.entities.RoutingRule.filter(scopeByOrg(user), '-created_date', 100));
    return listResponse(user, items);
  }),
  getRoutingRule: (user, id) => guard(async () => firebaseClient.entities.RoutingRule.get(id)),
  postRoutingRule: (user, payload) => guard(async () => firebaseClient.entities.RoutingRule.create(payload)),
  postRoutingDecide: (user, { lead_id }) => guard(async () => {
    const lead = await firebaseClient.entities.Lead.get(lead_id);
    const rules = await firebaseClient.entities.RoutingRule.filter({ brand_id: lead.brand_id, status: 'active' }, '-priority', 10);
    const rule = rules[0];
    if (!rule) return { tenant: tenant(user), decision: null, reason: 'No active routing rule for this brand.' };
    let assignee = null;
    if (rule.strategy === 'round_robin' && rule.agent_ids?.length) {
      const next = (rule.last_assigned_position || 0) % rule.agent_ids.length;
      assignee = rule.agent_ids[next];
      await firebaseClient.entities.RoutingRule.update(rule.id, { last_assigned_position: next + 1 });
    } else if (rule.realtor_rotation?.length) {
      const next = (rule.last_assigned_position || 0) % rule.realtor_rotation.length;
      assignee = rule.realtor_rotation[next];
      await firebaseClient.entities.RoutingRule.update(rule.id, { last_assigned_position: rule.start_with_next_in_sequence ? next + 1 : next });
    }
    return { tenant: tenant(user), rule: rule.id, strategy: rule.strategy, assignee };
  }),

  // ---------- 7. Duplicates ----------
  getLeadDuplicates: (user, leadId) => guard(async () => {
    const lead = await firebaseClient.entities.Lead.get(leadId);
    const candidates = await firebaseClient.entities.Lead.filter({ brand_id: lead.brand_id }, '-created_date', 200);
    const matches = candidates.filter(x => x.id !== leadId && (
      (lead.phone && x.phone === lead.phone) || (lead.email && x.email === lead.email && lead.email)
    ));
    return listResponse(user, matches);
  }),
  mergeDuplicate: (user, leadId, matchId) => guard(async () => {
    await firebaseClient.entities.Lead.update(matchId, { duplicate_of_lead_id: leadId, lead_status: 'duplicate' });
    return { merged: matchId, into: leadId };
  }),
  scanDuplicates: (user) => guard(async () => {
    const leads = applyBrandScope(user, await firebaseClient.entities.Lead.filter(scopeByOrg(user), '-created_date', 500));
    const groups = {};
    leads.forEach(l => {
      const key = l.phone || l.email;
      if (!key) return;
      (groups[key] = groups[key] || []).push(l);
    });
    const dupGroups = Object.values(groups).filter(g => g.length > 1);
    return { tenant: tenant(user), duplicate_groups: dupGroups.length, groups: dupGroups };
  }),

  // ---------- 8. Follow-ups ----------
  getFollowUps: (user) => guard(async () => {
    const items = applyBrandScope(user, await firebaseClient.entities.FollowUpTask.filter(scopeByOrg(user), 'due_date', 200));
    return listResponse(user, items);
  }),
  postFollowUp: (user, payload) => guard(async () => firebaseClient.entities.FollowUpTask.create(payload)),
  patchFollowUp: (user, id, payload) => guard(async () => firebaseClient.entities.FollowUpTask.update(id, payload)),

  // ---------- 9. Callbacks ----------
  getCallbacks: (user) => guard(async () => {
    const items = applyBrandScope(user, await firebaseClient.entities.FollowUpTask.filter(
      { ...scopeByOrg(user), task_type: 'callback_reminder' }, 'due_date', 200));
    return listResponse(user, items);
  }),
  postCallback: (user, payload) => guard(async () => firebaseClient.entities.FollowUpTask.create({
    ...payload, task_type: 'callback_reminder', status: 'pending'
  })),

  // ---------- 10. Appointments ----------
  getAppointments: (user) => guard(async () => {
    const items = applyBrandScope(user, await firebaseClient.entities.Appointment.filter(scopeByOrg(user), 'scheduled_start', 200));
    return listResponse(user, items);
  }),
  postAppointment: (user, payload) => guard(async () => {
    return firebaseClient.functions.invoke('appointmentWorkflow', { action: 'create', data: payload });
  }),
  confirmAppointment: (user, id) => guard(async () => firebaseClient.functions.invoke('appointmentWorkflow', { action: 'confirm', appointmentId: id })),
  rescheduleAppointment: (user, id, { scheduled_start }) => guard(async () => firebaseClient.functions.invoke('appointmentWorkflow', { action: 'reschedule', appointmentId: id, data: { scheduled_start } })),
  cancelAppointment: (user, id) => guard(async () => firebaseClient.functions.invoke('appointmentWorkflow', { action: 'cancel', appointmentId: id })),
  attendanceAppointment: (user, id, { status }) => guard(async () => firebaseClient.functions.invoke('appointmentWorkflow', { action: 'attendance', appointmentId: id, data: { status } })),

  // ---------- 11. Notifications (in-app) ----------
  getNotifications: (user) => guard(async () => {
    const items = applyBrandScope(user, await firebaseClient.entities.FollowUpTask.filter(
      { ...scopeByOrg(user), status: 'pending' }, 'due_date', 20));
    return listResponse(user, items.map(t => ({
      id: t.id, brand_id: t.brand_id, lead_id: t.lead_id,
      title: `${t.task_type.replace(/_/g, ' ')} due`, priority: t.priority, due_date: t.due_date
    })));
  }),
  ackNotification: (user, { id }) => guard(async () => firebaseClient.entities.FollowUpTask.update(id, { status: 'completed', completion_time: new Date().toISOString() })),
  getNotificationPreferences: (user) => guard(async () => ({ tenant: tenant(user), preferences: { channels: ['in_app', 'email'], min_priority: 3 } })),
  postNotificationPreferences: (user, prefs) => guard(async () => ({ tenant: tenant(user), saved: prefs })),

  // ---------- 12. Telephony (mock-safe) ----------
  getTelephonyStatus: (user) => guard(async () => {
    const response = await firebaseClient.functions.invoke('communications', { action: 'health_check' });
    return response?.data || response;
  }),
  postCall: (user, { lead_id, to, from = null, twimlUrl = null, record = true }) => guard(async () => {
    const response = await firebaseClient.functions.invoke('communications', {
      action: 'start_call',
      params: { leadId: lead_id, to, from, twimlUrl, record }
    });
    return response?.data || response;
  }),
  endCall: (user, callId) => guard(async () => {
    const response = await firebaseClient.functions.invoke('communications', { action: 'end_call', params: { callId } });
    return response?.data || response;
  }),
  holdCall: (user, callId) => guard(async () => {
    const response = await firebaseClient.functions.invoke('communications', { action: 'hold_call', params: { callId } });
    return response?.data || response;
  }),
  resumeCall: (user, callId) => guard(async () => {
    const response = await firebaseClient.functions.invoke('communications', { action: 'resume_call', params: { callId } });
    return response?.data || response;
  }),
  warmTransfer: (user, callId, { to }) => guard(async () => {
    const response = await firebaseClient.functions.invoke('communications', { action: 'warm_transfer', params: { callId, transferTo: to } });
    return response?.data || response;
  }),

  // ---------- 13a. Campaigns (CRUD) ----------
  postCampaign: (user, payload) => guard(async () => firebaseClient.entities.Campaign.create(payload)),
  putCampaign: (user, id, payload) => guard(async () => firebaseClient.entities.Campaign.update(id, payload)),

  // ---------- 13b. Lead Sources ----------
  getLeadSources: (user) => guard(async () => {
    const items = applyBrandScope(user, await firebaseClient.entities.LeadSource.filter(scopeByOrg(user), '-created_date', 100));
    return listResponse(user, items);
  }),
  postLeadSource: (user, payload) => guard(async () => firebaseClient.entities.LeadSource.create(payload)),
  putLeadSource: (user, id, payload) => guard(async () => firebaseClient.entities.LeadSource.update(id, payload)),

  // ---------- 13c. Admin Telephony Status ----------
  getTelephonyAdminStatus: (user) => guard(async () => {
    const response = await firebaseClient.functions.invoke('communications', { action: 'health_check', adminCheck: true });
    return { ...(response?.data || response), tenant: tenant(user) };
  }),

  // ---------- 13. Phone Numbers ----------
  getPhoneNumbers: (user) => guard(async () => {
    const items = applyBrandScope(user, await firebaseClient.entities.PhoneNumber.filter(scopeByOrg(user), '-created_date', 100));
    return listResponse(user, items);
  }),
  postPhoneNumber: (user, payload) => guard(async () => firebaseClient.entities.PhoneNumber.create(payload)),
  patchPhoneNumber: (user, id, payload) => guard(async () => firebaseClient.entities.PhoneNumber.update(id, payload)),

  // ---------- 3. Admin ----------
  getAdminWorkspace: (user) => guard(async () => {
    const filter = scopeByOrg(user);
    const [leads, brands, agents] = await Promise.all([
      firebaseClient.entities.Lead.filter(filter, '-created_date', 500),
      firebaseClient.entities.Brand.filter(filter, '-created_date', 50),
      firebaseClient.entities.User.list(100),
    ]);
    const scopedLeads = applyBrandScope(user, leads);
    return {
      tenant: tenant(user),
      brands, agents,
      total_leads: scopedLeads.length,
      by_status: {
        new: scopedLeads.filter(l => l.lead_status === 'new').length,
        connected: scopedLeads.filter(l => l.lead_status === 'connected').length,
        qualified: scopedLeads.filter(l => l.qualification_status === 'qualified').length,
        closed: scopedLeads.filter(l => l.lead_status === 'closed').length,
      }
    };
  }),
};
