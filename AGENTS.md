# AGENTS.md

## Project Context

This is the Link Marketing Solutions Agent CRM, a Vercel-deployable React/Vite application being migrated away from Base44. Scope work to this Agent CRM repository; the corporate website and Customer Portal are separate projects.

Preserve existing routes, screens, fields, actions, workflows, responsive behavior, and visual design unless the user explicitly approves a change. Before replacing an integration, record feature parity in `docs/agent-crm-migration-inventory.md`.

## Migration Safety

- Do not add new Base44 dependencies, SDK calls, environment variables, or deployment workflows.
- Do not remove existing Base44-backed behavior until an equivalent implementation exists and its parity is recorded.
- Use the shared Firebase/backend contract as the authority for collections, API routes, roles, and authorization. Do not invent a second CRM schema.
- Derive tenant and role authorization from verified identity on the server. Never trust tenant IDs, roles, or brand scopes asserted by the browser.
- Keep privileged operations, invitation issuance, role assignment, telephony credentials, and webhook handling server-side.
- Keep preview/test data visibly distinct from live data. Do not fabricate production records or report mock operations as successful live operations.
- Never commit secrets. Use environment-specific provider settings for local, preview, staging, and production.

## Project Files

- `src/`: CRM frontend source.
- `base44/entities/`: legacy entity definitions to preserve as migration references until parity is complete.
- `base44/functions/`: legacy backend functions to inventory and replace server-side.
- `docs/agent-crm-migration-inventory.md`: CRM feature inventory, parity checklist, and blockers.
- `.env.local`: local-only values; never commit secrets.

## Working Notes

- Do not use Base44 CLI workflows for new development or deployment.
- Keep CRM authentication invitation-only; do not enable public self-registration or Google sign-in unless explicitly approved.
- Keep the CRM build and deployment separate from the website and Customer Portal.
- Run relevant project checks when implementation work is ready for validation.
