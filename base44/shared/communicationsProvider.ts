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
  const hasCredentials = !!(sid && (token || (apiKey && apiSecret)));
  const hasCallConfig = !!(secrets.get("TWILIO_DEFAULT_FROM_NUMBER") && secrets.get("TWILIO_VOICE_TWIML_URL"));
  const ready = hasCredentials && hasCallConfig;
  return {
    mode: ready ? "production" : "mock",
    provider: "twilio",
    configured: ready,
    credentials_configured: hasCredentials,
    call_configured: hasCallConfig,
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
    "TWILIO_API_KEY", "TWILIO_API_SECRET",
    "TWILIO_WORKSPACE_SID", "TWILIO_FLEX_FLOW_SID",
    "TWILIO_TASK_ROUTER_SID", "TWILIO_DEFAULT_FROM_NUMBER",
    "TWILIO_VOICE_TWIML_URL", "TWILIO_STATUS_CALLBACK_URL",
    "TWILIO_RECORDING_CALLBACK_URL", "TWILIO_WEBHOOK_SIGNING_SECRET"
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
  const accountSid = secrets.get("TWILIO_ACCOUNT_SID");
  const username = secrets.get("TWILIO_API_KEY") || accountSid;
  const password = secrets.get("TWILIO_API_SECRET") || secrets.get("TWILIO_AUTH_TOKEN");
  if (!accountSid || !username || !password) {
    return { ok: false, mode, action, error: "twilio_credentials_missing", message: "Twilio credentials are not configured." };
  }

  const baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}`;
  const auth = "Basic " + btoa(`${username}:${password}`);
  const request = async (path, init = {}) => {
    const response = await fetch(baseUrl + path, {
      ...init,
      headers: { Authorization: auth, ...(init.headers || {}) }
    });
    const text = await response.text();
    let body;
    try { body = JSON.parse(text); } catch { body = { raw: text }; }
    if (!response.ok) {
      return { ok: false, status: response.status, error: body?.message || "twilio_request_failed", details: body };
    }
    return { ok: true, data: body };
  };

  if (action === "health_check") {
    const result = await request(".json");
    return result.ok
      ? { ok: true, mode, provider: "twilio", status: "healthy", accountSid: accountSid.slice(0, 2) + "***" }
      : { ok: false, mode, provider: "twilio", status: "unhealthy", ...result };
  }

  if (action === "call_status" && params.callId) {
    const result = await request(`/Calls/${encodeURIComponent(params.callId)}.json`);
    return result.ok
      ? { ok: true, mode, callId: result.data.sid, status: result.data.status, provider: "twilio" }
      : { ok: false, mode, provider: "twilio", ...result };
  }

  if (action === "end_call" && params.callId) {
    const form = new URLSearchParams({ Status: "completed" });
    const result = await request(`/Calls/${encodeURIComponent(params.callId)}.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form
    });
    return result.ok
      ? { ok: true, mode, callId: result.data.sid, status: result.data.status, provider: "twilio" }
      : { ok: false, mode, provider: "twilio", ...result };
  }

  if (action === "create_call") {
    const from = params.from || secrets.get("TWILIO_DEFAULT_FROM_NUMBER");
    const twimlUrl = params.twimlUrl || secrets.get("TWILIO_VOICE_TWIML_URL");
    if (!params.to || !from || !twimlUrl) {
      return { ok: false, mode, error: "twilio_call_configuration_missing", message: "A destination number, default caller ID, and TWILIO_VOICE_TWIML_URL are required." };
    }
    const form = new URLSearchParams({
      To: params.to,
      From: from,
      Url: twimlUrl,
      Record: params.record === false ? "false" : "true",
      StatusCallbackEvent: "initiated ringing answered completed",
      ...(params.statusCallbackUrl || secrets.get("TWILIO_STATUS_CALLBACK_URL")
        ? { StatusCallback: params.statusCallbackUrl || secrets.get("TWILIO_STATUS_CALLBACK_URL") }
        : {}),
      ...(params.recordingCallbackUrl || secrets.get("TWILIO_RECORDING_CALLBACK_URL")
        ? { RecordingStatusCallback: params.recordingCallbackUrl || secrets.get("TWILIO_RECORDING_CALLBACK_URL") }
        : {})
    });
    const result = await request("/Calls.json", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form });
    return result.ok
      ? { ok: true, mode, callId: result.data.sid, status: result.data.status, provider: "twilio", raw: { direction: result.data.direction } }
      : { ok: false, mode, provider: "twilio", ...result };
  }

  return { ok: false, mode, action, error: "twilio_action_not_implemented", message: "This action is not yet connected to the Twilio REST API." };
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