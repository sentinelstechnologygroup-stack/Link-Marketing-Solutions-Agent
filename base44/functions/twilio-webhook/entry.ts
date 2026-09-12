import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';
import { secrets } from 'base44:runtime';

async function verifyTwilioSignature(req, params) {
  const authToken = secrets.get('TWILIO_AUTH_TOKEN');
  if (!authToken) return false;
  const url = secrets.get('TWILIO_WEBHOOK_BASE_URL') || req.url;
  const signature = req.headers.get('X-Twilio-Signature') || '';
  const data = url + [...params.keys()].sort().map((key) => key + params.get(key)).join('');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return signature === expected;
}

function isoNow() {
  return new Date().toISOString();
}

export default async function(req) {
  const base44 = createClientFromRequest(req);
  const contentType = req.headers.get('content-type') || '';
  const params = contentType.includes('application/json')
    ? new URLSearchParams(Object.entries(await req.json()))
    : new URLSearchParams(await req.text());

  if (!(await verifyTwilioSignature(req, params))) {
    return Response.json({ error: 'Invalid Twilio signature' }, { status: 403 });
  }

  const eventType = params.get('EventType') || params.get('event_type') || 'call-status';
  const callSid = params.get('CallSid') || params.get('call_sid');
  if (!callSid) return Response.json({ ok: true, ignored: 'missing_call_sid' });

  const calls = await base44.asServiceRole.entities.CallRecord.filter({ call_id: callSid }, '-created_date', 1);
  const call = calls[0];

  if (eventType === 'recording-complete' || params.get('RecordingUrl')) {
    if (!call) return Response.json({ ok: true, ignored: 'call_not_found' });
    const recordingUrl = params.get('RecordingUrl');
    const recordingUpdate = {
      recording_metadata: {
        duration_seconds: Number(params.get('RecordingDuration') || 0),
        status: params.get('RecordingStatus') || 'completed',
        received_at: isoNow()
      }
    };
    if (recordingUrl) recordingUpdate.recording_url = recordingUrl + '.mp3';
    if (params.get('RecordingSid')) recordingUpdate.recording_sid = params.get('RecordingSid');
    const updated = await base44.asServiceRole.entities.CallRecord.update(call.id, recordingUpdate);
    return Response.json({ ok: true, event: 'recording-complete', call_id: updated.id });
  }

  if (!call) return Response.json({ ok: true, ignored: 'call_not_found' });

  const status = params.get('CallStatus') || params.get('call_status') || 'unknown';
  const update = {
    provider_status: status,
    duration_seconds: Number(params.get('CallDuration') || 0)
  };
  if (['completed', 'busy', 'failed', 'no-answer', 'canceled'].includes(status)) {
    update.call_end = isoNow();
  }
  const updated = await base44.asServiceRole.entities.CallRecord.update(call.id, update);
  return Response.json({ ok: true, event: 'call-status', call_id: updated.id, provider_status: status });
}