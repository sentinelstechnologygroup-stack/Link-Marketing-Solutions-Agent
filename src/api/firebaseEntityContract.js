const READ_ALIASES = {
  tenantId: ['organization_id'],
  brandId: ['brand_id'],
  campaignId: ['campaign_id'],
  sourceId: ['source_id'],
  leadId: ['lead_id'],
  assignedTo: ['assigned_to'],
  agentUid: ['agent_id'],
  qualificationStatus: ['qualification_status'],
  routingProfileId: ['routing_profile_id'],
  workflowVersion: ['workflow_version'],
  scriptSetId: ['script_set_id'],
  qualificationFormId: ['qualification_form_id'],
  consentPolicyId: ['consent_policy_id'],
  retentionPolicyId: ['retention_policy_id'],
  notificationProfileId: ['notification_profile_id'],
  scheduledStart: ['scheduled_start'],
  scheduledEnd: ['scheduled_end'],
  calendarProvider: ['calendar_provider'],
  phoneNumber: ['phone_number'],
  roleType: ['role_type'],
  routingEligible: ['routing_eligible'],
  storagePath: ['storage_path'],
  contentType: ['content_type'],
  sizeBytes: ['size_bytes'],
  periodStart: ['period_start'],
  periodEnd: ['period_end'],
  startedAt: ['call_start'],
  endedAt: ['call_end'],
  dueAt: ['due_date'],
};

const WRITE_ALIASES = {
  organization_id: 'tenantId',
  brand_id: 'brandId',
  campaign_id: 'campaignId',
  source_id: 'sourceId',
  lead_id: 'leadId',
  assigned_to: 'assignedTo',
  agent_id: 'agentUid',
  qualification_status: 'qualificationStatus',
  routing_profile_id: 'routingProfileId',
  workflow_version: 'workflowVersion',
  script_set_id: 'scriptSetId',
  qualification_form_id: 'qualificationFormId',
  consent_policy_id: 'consentPolicyId',
  retention_policy_id: 'retentionPolicyId',
  notification_profile_id: 'notificationProfileId',
  scheduled_start: 'scheduledStart',
  scheduled_end: 'scheduledEnd',
  calendar_provider: 'calendarProvider',
  phone_number: 'phoneNumber',
  role_type: 'roleType',
  routing_eligible: 'routingEligible',
  storage_path: 'storagePath',
  content_type: 'contentType',
  size_bytes: 'sizeBytes',
  period_start: 'periodStart',
  period_end: 'periodEnd',
  call_start: 'startedAt',
  call_end: 'endedAt',
  due_date: 'dueAt',
};

function asIsoDate(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  const seconds = value.seconds ?? value._seconds;
  if (Number.isFinite(seconds)) return new Date(seconds * 1000).toISOString();
  return null;
}

export function normalizeEntityRow(collectionName, value) {
  const row = value && typeof value === 'object' ? { ...value } : {};
  Object.entries(READ_ALIASES).forEach(([canonical, aliases]) => {
    const canonicalValue = row[canonical] ?? aliases.map((alias) => row[alias]).find((item) => item !== undefined);
    if (canonicalValue === undefined) return;
    row[canonical] ??= canonicalValue;
    aliases.forEach((alias) => { row[alias] ??= canonicalValue; });
  });

  row.created_date ??= asIsoDate(row.createdAt) || row.created_date;
  row.updated_date ??= asIsoDate(row.updatedAt) || row.updated_date;
  row.received_date ??= asIsoDate(row.receivedAt) || row.received_date;
  row.lead_status ??= row.status;
  row.first_name ??= row.firstName;
  row.last_name ??= row.lastName;

  if (collectionName === 'brands') {
    row.display_name ??= row.displayName || row.name;
    row.name ??= row.display_name;
  }
  if (collectionName === 'leadSources') row.source_type ??= row.type;
  if (collectionName === 'campaigns') {
    row.start_date ??= row.startDate;
    row.end_date ??= row.endDate;
  }
  return row;
}

export function normalizeEntityWrite(collectionName, value) {
  const data = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
  Object.entries(WRITE_ALIASES).forEach(([legacy, canonical]) => {
    if (data[canonical] === undefined && data[legacy] !== undefined) data[canonical] = data[legacy];
  });
  if (data.firstName === undefined && data.first_name !== undefined) data.firstName = data.first_name;
  if (data.lastName === undefined && data.last_name !== undefined) data.lastName = data.last_name;
  if (collectionName === 'brands' && data.name === undefined && data.display_name !== undefined) data.name = data.display_name;
  if (collectionName === 'leadSources' && data.type === undefined && data.source_type !== undefined) data.type = data.source_type;
  if (collectionName === 'campaigns') {
    if (data.startDate === undefined && data.start_date !== undefined) data.startDate = data.start_date;
    if (data.endDate === undefined && data.end_date !== undefined) data.endDate = data.end_date;
  }
  if (data.version === undefined && data.version_number !== undefined) data.version = data.version_number;
  return data;
}
