# Link Marketing Solutions — API & Webhooks Contract

> Single source of truth for all workspace, lead, routing, telephony, and webhook behavior.
> The UI must never assume ownership scope — it relies on API filters and authorization responses.

## Transport & Security

- **No secrets in frontend.** All privileged work happens server-side.
- Auth: `Authorization: Bearer <jwt>` (managed by the platform SDK).
- Tenant context is derived server-side from the authenticated user's profile
  (`organization_id`, `assigned_brand_ids`, `role`). In a non-Base44 deployment these
  map to the following request headers, which the API validates against the token —
  the frontend never self-asserts them:
  - `X-Organization-Id`
  - `X-Brand-Ids` (comma-separated allowed brands)
  - `X-Role`
  - `X-User-Id`
- **Authorization failures must be shown clearly.** `401` → session expired / re-authenticate;
  `403` → not permitted for this tenant/brand. The UI surfaces a safe error/retry state and
  never silently hides the failure.

## List Envelope

Every list endpoint returns:

```json
{
  "count": 12,
  "tenant": {
    "organization_id": "org_...",
    "brand_ids": ["brand_a", "brand_b"],
    "role": "lead_response_agent",
    "user_id": "user_..."
  },
  "items": [ /* records */ ]
}
```

`brand_ids` is the set of brands the caller is permitted to see (`"all"` for super/org admins).

## 1. Unified Agent Workspace

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/workspace/agent` | Workspace summary: assigned brands/campaigns, counts |
| GET | `/api/workspace/agent/new-leads` | Fresh unworked leads, sorted priority → freshness |
| GET | `/api/workspace/agent/callback-queue` | Scheduled callbacks due |
| GET | `/api/workspace/agent/follow-up-queue` | Open follow-up tasks |
| GET | `/api/lead-inbox` | All in-scope leads (filterable) |
| GET | `/api/leads/:leadId` | Single lead + brand/campaign/script/form context |
| POST | `/api/calls/:leadId/disposition` | Save call record + disposition + next action |
| POST | `/api/notifications/ack` | Acknowledge a notification |
| POST | `/api/followups` | Create a follow-up task |

### Pre-call context (shown before answering/placing a call)
Brand · Campaign · Caller identity · Lead source · Required greeting · Required script ·
Required qualification form · Priority · Lead age · Existing notes · Disposition controls.
An optional private agent **whisper** is displayed to the agent only (never played to prospect).

### POST /api/calls/:leadId/disposition
Request:
```json
{ "disposition": "connected", "notes": "...", "next_action": "Callback tomorrow 10am", "qualification_data": {} }
```
Response: `{ "call": {...}, "lead": {...} }`

## 2. Supervisor Workspace

| Method | Path |
|---|---|
| GET | `/api/workspace/supervisor` |
| GET | `/api/dashboard/supervisor` |
| GET | `/api/leads` |

Returns agent availability, unworked leads, overdue follow-ups, missed alerts, coverage gaps,
brand & campaign performance.

## 3. Admin / Brand Management

| Method | Path |
|---|---|
| GET | `/api/workspace/admin` |
| GET | `/api/dashboard/admin` |
| GET | `/api/brands` |
| POST | `/api/brands` |
| GET | `/api/brands/:brandId` |
| PUT | `/api/brands/:brandId` |
| GET | `/api/brands/:brandId/dashboard` |

## 4. Script Management

| Method | Path |
|---|---|
| GET | `/api/scripts` |
| POST | `/api/scripts` |
| GET | `/api/scripts/:scriptId` |
| PUT | `/api/scripts/:scriptId` |
| POST | `/api/scripts/:scriptId/publish` |
| POST | `/api/scripts/:scriptId/retire` |
| GET | `/api/scripts/:scriptId/versions` |

Only admins/supervisors create/publish/retire. Agents always see the currently approved version.

## 5. Qualification Form Builder

| Method | Path |
|---|---|
| GET | `/api/qualification-forms` |
| POST | `/api/qualification-forms` |
| GET | `/api/qualification-forms/:formId` |
| PUT | `/api/qualification-forms/:formId` |
| GET | `/api/qualification-forms/:formId/questions` |
| POST | `/api/qualification-forms/:formId/questions` |

## 6. Lead Routing

| Method | Path |
|---|---|
| GET | `/api/routing-rules` |
| POST | `/api/routing-rules` |
| GET | `/api/routing-rules/:ruleId` |
| POST | `/api/routing/decide` |

`POST /api/routing/decide` request: `{ "lead_id": "..." }` → returns next assignee / realtor
per the configured strategy (round-robin, sequential realtor rotation with acceptance period, etc.).

### Realtor rotation (Golden Cross Realty)
1. Present qualified lead to Realtor A.
2. Realtor A has a defined acceptance period.
3. Accepted → record acceptance.
4. Declined / timed out / unanswered → route to Realtor B.
5. Continue through the approved rotation.
6. Next lead begins with the next realtor in sequence.
7. Every acceptance, refusal, timeout, and transfer is recorded.

## 7. Duplicate Review

| Method | Path |
|---|---|
| GET | `/api/leads/:leadId/duplicates` |
| POST | `/api/leads/:leadId/duplicates/:matchId/merge` |
| POST | `/api/duplicates/scan` |

Match on phone, email, name+phone, name+address, campaign source, time-window. Warn the agent,
preserve the source record, allow authorized merge with audit history.

## 8. Follow-ups

| Method | Path |
|---|---|
| GET | `/api/followups` |
| POST | `/api/followups` |
| PATCH | `/api/followups/:followUpId` |

## 9. Callback Management

| Method | Path |
|---|---|
| GET | `/api/callbacks` |
| POST | `/api/callbacks` |

## 10. Appointments

| Method | Path |
|---|---|
| GET | `/api/appointments` |
| POST | `/api/appointments` |
| POST | `/api/appointments/:appointmentId/confirm` |
| POST | `/api/appointments/:appointmentId/reschedule` |
| POST | `/api/appointments/:appointmentId/cancel` |
| POST | `/api/appointments/:appointmentId/attendance` |

Attendance states: booked · confirmed · attended · canceled · no-show · outcome unknown.

## 11. Notifications

| Method | Path |
|---|---|
| GET | `/api/notifications` |
| POST | `/api/notifications/ack` |
| GET | `/api/notifications/preferences` |
| POST | `/api/notifications/preferences` |

Notifications identify brand, campaign, lead name, age, priority, required action, secure lead link.
SMS/browser notifications omit unnecessary sensitive data. Preferences by org/brand/campaign/priority/agent/owner/time/escalation.

## 12. Telephony UI surface (mock-safe)

| Method | Path |
|---|---|
| GET | `/api/telephony/status` |
| POST | `/api/telephony/calls` |
| POST | `/api/telephony/calls/:callId/end` |
| POST | `/api/telephony/calls/:callId/hold` |
| POST | `/api/telephony/calls/:callId/resume` |
| POST | `/api/telephony/calls/:callId/warm-transfer` |

`GET /api/telephony/status` → `{ "mode": "mock" | "production", "healthy": true, "provider": "twilio" | null, "checklist": [...] }`.
Mock mode is clearly labeled; test calls/transfers are marked. Production mode requires all
Twilio secrets present and a successful health check.

## 13. Phone Numbers

| Method | Path |
|---|---|
| GET | `/api/phone-numbers` |
| POST | `/api/phone-numbers` |
| PATCH | `/api/phone-numbers/:phoneId` |

## 14. Webhooks (read-only display / audit only)

| Method | Path |
|---|---|
| POST | `/webhooks/leads` |
| POST | `/webhooks/twilio/call-status` |
| POST | `/webhooks/twilio/recording-complete` |
| POST | `/webhooks/twilio/sms` |

Webhooks are idempotent, retry failed deliveries, and never destroy lead data on provider outage.
Twilio webhook signatures are validated server-side.

## UI Behavior Rules

- Render deterministic **empty-state** views for stubbed/empty responses.
- Never assume ownership scope; always rely on API filters + authorization response.
- Show **brand/context chips** on every lead card.
- Log and display all failed endpoints in a safe **retry/error** state.
- Mock mode is visually separated from production mode.