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
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}