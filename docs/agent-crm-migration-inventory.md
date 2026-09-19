# Agent CRM Migration Inventory

## Scope and status

This inventory covers only the Link Marketing Solutions Agent CRM. It is a preservation checklist for replacing the legacy legacy provider service layer. The existing UI is not evidence that a workflow is connected or production-ready.

The repository currently contains legacy provider SDK and Vite-plugin dependencies, a legacy provider client, legacy provider-backed authentication, entity operations throughout the CRM, and legacy provider-hosted communications and Twilio webhook functions. The package manifest has no Firebase SDK, and this repository has no Firebase project configuration, Firestore rules, indexes, or Firebase Functions setup. The CRM therefore cannot safely complete its Firebase migration until it can use the shared backend contract and environment configuration.

## Existing CRM routes to preserve

| Route | Existing screen/workflow |
| --- | --- |
| `/` | Home dashboard |
| `/workspace` | Agent workspace and lead response |
| `/supervisor` | Supervisor workspace |
| `/leads` | Lead inbox |
| `/leads/:id` | Lead detail, call history, qualification, disposition, follow-up, appointment, duplicate review |
| `/brands` | Brand administration |
| `/scripts` | Script management and approval/version history |
| `/qualification-forms` | Qualification form management |
| `/routing-rules` | Routing rules and rotation |
| `/appointments` | Appointment management |
| `/phone-numbers` | Phone-number administration |
| `/business-owners` | Business owner/realtor administration |
| `/audit-log` | Audit history |
| `/settings` | Communications/telephony status |
| `/campaigns` | Campaign management |
| `/lead-sources` | Lead-source management |
| `/login`, `/forgot-password`, `/reset-password`, `/register` | Legacy authentication screens; replace with invitation-based identity and password setup, not open registration |

## Legacy data and service surface

Preserve the fields, relationships, and behavior represented by these legacy entities until mapped to the shared contract: User, Organization, Brand, Campaign, LeadSource, Lead, FollowUpTask, CommunicationAlert, CallRecord, CallTranscript, CallQualityReview, Appointment, BusinessOwner, Script, QualificationForm, RoutingRule, PhoneNumber, and AuditLog.

The CRM calls legacy provider directly from both `src/lib/apiClient.js` and individual screens/components. The central client currently covers agent and supervisor workspaces, lead inbox/detail/disposition, brands, scripts, qualification forms, routing, duplicate detection/merge, follow-ups, callbacks, appointments, notifications, telephony actions, campaigns, lead sources, phone numbers, and admin summaries. Direct page-level calls also exist, so replacing only the central client would not remove the dependency.

Legacy server-side functionality to preserve or explicitly retire with approval:

- Communications actions: health check, call creation, end, hold, resume, and warm transfer.
- Twilio webhook handling for call/recording updates.
- Entity-level read/write authorization and organization/brand relationships.
- The lead disposition flow that records a call and updates lead status/attempt counts.
- Routing rotation, appointment status updates, duplicate marking, notifications, and audit visibility.

## legacy provider-to-shared-backend parity checklist

For each item, record the canonical contract route/collection, authorization rules, implementation link, and test evidence before marking it replaced.

| Capability | Required preservation/equivalent | Status |
| --- | --- | --- |
| Identity and session | Invitation acceptance, password setup/reset, verified identity, disabled-user handling, revocation, and role/membership loading | Blocked on shared auth contract/configuration |
| Tenant and brand scope | Organization membership and assigned-brand scope enforced by verified server identity; deny cross-tenant access | Blocked on shared authorization contract and rules |
| Agent workspace | New-lead, callback, and follow-up queues; assigned brands/campaigns; lead age and status | legacy provider-backed; not migrated |
| Lead inbox/detail | Search/filter, lead context, scripts/forms, calls/tasks/appointments, duplicate warnings | legacy provider-backed; not migrated |
| Dispositions and qualification | Call record, disposition, qualification data, attempt count, next action, valid state transition, audit event | legacy provider-backed; not migrated |
| Routing | Rule selection, round-robin/sequential behavior, ordered GCR primary/approved backup handling, timeout/acceptance audit | legacy provider-backed; server-side contract required |
| Follow-ups/callbacks | Create/update/complete, due-date ordering, notifications, ownership and audit | legacy provider-backed; not migrated |
| Appointments | Create, confirm, reschedule, cancel, attendance, timezone, and lead-state consistency | legacy provider-backed; atomic server behavior required |
| Telephony | Status, create/end/hold/resume/transfer; explicit mock-vs-live state; no false success | legacy provider function-backed; secure server replacement required |
| Admin/configuration | Brands, campaigns, scripts, qualification forms, routing rules, phone numbers, business owners, lead sources | legacy provider-backed; not migrated |
| Audit and QA | Read authorization, append-only operational events, call-quality review, evidence links | Partial legacy entity coverage; shared event contract required |
| Direct navigation | SPA fallback and refresh work for every listed route | Preview rewrite added; production deployment still needs release |
| Preview identity | Clearly labeled, non-production access that cannot authorize production data/actions | Preview bypass exists; retain only in Preview/development |
| legacy provider removal | No legacy provider package/plugin/client/import/env var/function runtime or legacy provider network request remains | Not started; remove only after parity and migration evidence |

## Contract conflict to resolve before implementation

`docs/api-and-webhooks.md` describes a REST API but also describes client-supplied organization, brand, role, and user headers. Those headers are not an authorization source and conflict with the pilot security requirement that the server derive tenant and role scope from a verified token and membership. The shared Backend/Core workstream must publish the authoritative Firebase/API contract, including identity/profile loading, invitation lifecycle, authorization, data operations, privileged mutations, and error envelopes. The CRM must not ship browser-side Firestore writes or trust browser-supplied tenant/role headers as a substitute.

## CRM implementation sequence

1. Backend/Core publishes and versions the canonical identity, tenant, data, and operation contract, with emulator/staging access.
2. Replace CRM authentication with invitation-based Firebase identity and server-verified CRM profile/membership loading. Keep public self-registration disabled.
3. Replace the centralized API client and every direct screen-level legacy provider call with the approved backend adapter. Preserve the legacy feature surface above.
4. Move routing decisions, lead transitions, appointment consistency, invitations, audit events, and telephony operations to authorized server-side functions/endpoints.
5. Remove legacy provider SDK/plugin/configuration and legacy functions after all parity rows have equivalent behavior and data migration/retention decisions are recorded.
6. Prove role and tenant allow/deny behavior, every priority workflow, direct route refresh, mock/live separation, and legacy provider absence against staging before production release.

## Current blockers requiring the shared backend/account setup

- Canonical Firebase project/environment IDs and client configuration.
- Firebase Auth profile/membership and invitation endpoint contract.
- Canonical collections/API endpoints, field mapping, indexes, and error semantics.
- Default-deny Firestore/Storage rules and authorization test harness.
- Server-side functions/API for privileged CRM writes, audit/state transitions, and telephony.
- Staging credentials/configuration and Twilio test resources, if telephony is in pilot scope.

Do not enter real customer or lead data into Preview while these controls are absent. The current Preview login bypass is for UI review only.
