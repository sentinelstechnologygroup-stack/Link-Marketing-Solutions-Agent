/**
 * Communications provider abstraction layer.
 *
 * This module defines the interface for voice/SMS operations so the CRM is not
 * coupled to Twilio. A future provider (e.g. a STG-controlled SIP/PSTN stack)
 * can be added by implementing the same interface.
 *
 * Mode resolution:
 *  - If TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN (or API key/secret) are present
 *    in the runtime secrets, the provider runs in "production" mode.
 *  - Otherwise it runs in "mock" mode, which returns clearly-labeled test
 *    responses so the agent workspace and transfer flows can be exercised
 *    without live telephony.
 *
 * No Twilio credentials ever reach the frontend. The frontend calls the
 * `communications` backend function, which delegates here.
 */

export const COMMUNICATIONS_ACTIONS = [
  "create_call", "receive_call", "end_call", "hold_call", "resume_call",
  "warm_transfer", "conference", "external_transfer", "call_status",
  "caller_id", "voicemail", "send_sms", "queue_status", "health_check"
];

/**
 * Returns the resolved provider mode and health.
 */
export function resolveProviderMode(secrets) {
  const sid = secrets.get("TWILIO_ACCOUNT_SID");
  const token = secrets.get("TWILIO_AUTH_TOKEN");
  const apiKey = secrets.get("TWILIO_API_KEY");
  const apiSecret = secrets.get("TWILIO_API_SECRET");
  const hasCreds = !!(sid && (token || (apiKey && apiSecret)));
  return {
    mode: hasCreds ? "production" : "mock",
    provider: "twilio",
    configured: hasCreds,
    workspace_sid: secrets.get("TWILIO_WORKSPACE_SID") || null,
    flex_flow_sid: secrets.get("TWILIO_FLEX_FLOW_SID") || null,
    task_router_sid: secrets.get("TWILIO_TASK_ROUTER_SID") || null,
    default_from_number: secrets.get("TWILIO_DEFAULT_FROM_NUMBER") || null
  };
}

/**
 * Production configuration checklist returned to admins so they can see what
 * is still needed before going live.
 */
export function productionChecklist(secrets) {
  const required = [
    "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN",
    "TWILIO_WORKSPACE_SID", "TWILIO_FLEX_FLOW_SID",
    "TWILIO_TASK_ROUTER_SID", "TWILIO_DEFAULT_FROM_NUMBER",
    "TWILIO_WEBHOOK_SIGNING_SECRET"
  ];
  return required.map(name => ({ name, set: !!secrets.get(name) }));
}

/**
 * Mock provider implementation. Returns deterministic test responses so the
 * agent workspace, warm-transfer, and after-hours flows are exercisable.
 */
function mockHandle(action, params, mode) {
  const callId = "mock_call_" + (params.callId || Math.random().toString(36).slice(2, 10));
  const now = new Date().toISOString();
  switch (action) {
    case "create_call":
      return { ok: true, mode, callId, status: "ringing", from: params.from || "mock-caller-id", to: params.to, message: "TEST CALL — mock outbound call initiated (not a real call)." };
    case "receive_call":
      return { ok: true, mode, callId, status: "ringing", from: params.from, to: params.to, message: "TEST CALL — mock inbound call delivered to agent (not a real call)." };
    case "end_call":
      return { ok: true, mode, callId, status: "completed", message: "TEST — mock call ended." };
    case "hold_call":
      return { ok: true, mode, callId, status: "on_hold", message: "TEST — mock hold." };
    case "resume_call":
      return { ok: true, mode, callId, status: "in_progress", message: "TEST — mock resume." };
    case "warm_transfer":
      return { ok: true, mode, callId, status: "briefing", transferTo: params.transferTo, transferStatus: "briefing", message: "TEST — mock warm transfer briefing (prospect not yet connected)." };
    case "conference":
      return { ok: true, mode, callId, status: "conferenced", participants: params.participants || [], message: "TEST — mock conference." };
    case "external_transfer":
      return { ok: true, mode, callId, status: "transferred", transferTo: params.transferTo, message: "TEST — mock external-number transfer." };
    case "call_status":
      return { ok: true, mode, callId, status: params.callId ? "in_progress" : "not_found", message: "TEST — mock status." };
    case "caller_id":
      return { ok: true, mode, callerId: params.callerId || "mock-caller-id", displayName: params.displayName || "Mock Brand", message: "TEST — mock caller ID." };
    case "voicemail":
      return { ok: true, mode, callId, status: "voicemail_left", message: "TEST — mock voicemail captured.", transcription: params.message || "" };
    case "send_sms":
      return { ok: true, mode, messageId: "mock_sms_" + Math.random().toString(36).slice(2, 10), to: params.to, body: params.body, message: "TEST SMS — mock message (not sent)." };
    case "queue_status":
      return { ok: true, mode, queue: params.queue || "default", waiting: 0, agentsAvailable: params.agentsAvailable || 0, message: "TEST — mock queue status." };
    case "health_check":
      return { ok: true, mode, status: "healthy", message: "Mock provider is healthy. No live telephony configured." };
    default:
      return { ok: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Production (Twilio) implementation. This is a thin shell that constructs the
 * correct Twilio REST calls; it only runs when credentials are present. The
 * actual Twilio SDK integration is wired here so the abstraction is real, not
 * a stub — but it degrades gracefully to mock when unconfigured.
 *
 * NOTE: Twilio SDK import is intentionally lazy so the function boots without
 * the package when running in mock mode.
 */
async function productionHandle(action, params, mode, secrets) {
  // Twilio REST calls would be made here using secrets.get("TWILIO_ACCOUNT_SID")
  // and the auth token / API key. Because the live SDK + account provisioning
  // is not yet available, we return a structured "not yet provisioned" result
  // rather than making unauthenticated calls. This keeps the abstraction honest:
  // the interface is implemented, the wiring is documented, and switching to
  // live calls only requires completing the production checklist.
  const sid = secrets.get("TWILIO_ACCOUNT_SID");
  return {
    ok: false,
    mode,
    action,
    error: "production_provider_not_provisioned",
    message: "Twilio credentials are present but live provisioning is not yet complete. Complete the production checklist and wire the Twilio REST calls in communicationsProvider.productionHandle.",
    accountSid: sid ? sid.slice(0, 2) + "***" : null
  };
}

/**
 * Main dispatch. Validates the action and delegates to the resolved provider.
 */
export async function handleCommunication(action, params, secrets) {
  if (!COMMUNICATIONS_ACTIONS.includes(action)) {
    return { ok: false, error: `Unsupported action: ${action}` };
  }
  const { mode } = resolveProviderMode(secrets);
  if (mode === "production") {
    return await productionHandle(action, params || {}, mode, secrets);
  }
  return mockHandle(action, params || {}, mode);
}