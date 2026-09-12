import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';
import { handleCommunication, resolveProviderMode, productionChecklist, COMMUNICATIONS_ACTIONS } from '../../shared/communicationsProvider.ts';

/**
 * Communications backend function.
 *
 * Exposes the provider abstraction to the frontend. The frontend never sees
 * Twilio credentials — it sends an `action` + bounded params and receives a
 * structured response. In mock mode all responses are clearly labeled as tests.
 *
 * Payload: { action: string, params?: object, adminCheck?: boolean }
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const params = body.params || {};

    // Health is safe for agents; the detailed checklist remains admin-only.
    if (action === 'health_check' || body.adminCheck) {
      if (body.adminCheck && user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'org_admin') {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
      const mode = resolveProviderMode(secrets);
      const checklist = productionChecklist(secrets);
      return Response.json({
        ...mode,
        checklist,
        supportedActions: COMMUNICATIONS_ACTIONS,
        warning: mode.mode === 'mock'
          ? 'Running in MOCK mode. All calls/SMS are simulated and clearly labeled. No live telephony is occurring.'
          : 'Production mode configured. Verify the production checklist is complete before going live.'
      });
    }

    if (!action) {
      return Response.json({ error: 'action is required', supportedActions: COMMUNICATIONS_ACTIONS }, { status: 400 });
    }

    const result = await handleCommunication(action, params, secrets);

    // Create the durable CRM call record immediately after Twilio/mock call
    // creation so later status and recording webhooks can attach to the lead.
    if (action === 'create_call' && result?.ok && result.callId && params.leadId) {
      try {
        const lead = await base44.entities.Lead.get(params.leadId);
        await base44.asServiceRole.entities.CallRecord.create({
          organization_id: lead.organization_id,
          brand_id: lead.brand_id,
          campaign_id: lead.campaign_id,
          lead_id: lead.id,
          agent_id: user.id,
          call_id: result.callId,
          provider_status: result.status || 'initiated',
          call_direction: 'outbound',
          caller_id_number: params.from || secrets.get('TWILIO_DEFAULT_FROM_NUMBER') || '',
          called_number: params.to || '',
          call_start: new Date().toISOString(),
          disposition: 'attempted',
          provider_mode: result.mode === 'production' ? 'production' : 'mock'
        });
      } catch (recordError) {
        // Do not cancel an already-started call, but surface the linkage issue.
        return Response.json({
          ...result,
          crmRecordCreated: false,
          crmRecordError: recordError.message
        });
      }
    }

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}