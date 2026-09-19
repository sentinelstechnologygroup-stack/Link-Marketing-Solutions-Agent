# Link Marketing Solutions Agent CRM

This is the Firebase-backed Agent CRM for Link Marketing Solutions.

## Local development

1. Install dependencies with `npm install`.
2. Configure the Firebase Agent CRM environment variables in `.env.local`.
3. Run `npm run dev`.
4. Use Firebase Authentication invitations for staff access.

The shared backend is `linkmarketing-agent-portal-crm`, with tenant and role authorization enforced by Firebase Functions and Firestore rules.
