# JobShaman — Technical Overview for a Potential Technical Cofounder

Date: 25 January 2026

Purpose: a compact, actionable summary of the current app architecture, workflow, API surface, data model, deployment notes, and immediate technical risks/next steps.

---

## Executive summary
- Product: JobShaman — a web product providing AI-assisted job analysis and an invitation-only Assessment Center for employers to evaluate candidates.
- Primary flows: job browsing, AI job analysis, company-managed invitation creation, candidate token-based assessment start, AI assessment generation, result submission and storage, billing for AI assessments.

## Technology stack
- Frontend: React + TypeScript, Vite, Tailwind CSS.
- Backend: FastAPI (Python) in `backend/app`.
- DB: Postgres (Supabase). Migrations live under `database/`.
- Auth: Supabase Auth (JWT/session) for logged-in flows.
- AI: `geminiService` wrapper used to generate assessments.
- Email: Resend service used for sending invitation links.
- Billing: Stripe (checkout + webhook integration) via `stripeService`.
- Hosting: Render/Vercel-style manifests present (`render.yaml`), Supabase managed Postgres.

## High-level app structure (where to look)
- Entry: `App.tsx` — path-based view switching (reads `window.location.pathname`).
- Frontend pages: `pages/*` (e.g., `InvitationLanding.tsx`, `SubscriptionManagementPage.tsx`).
- Main components: `components/AssessmentCreator.tsx`, `components/AssessmentInvitationModal.tsx`, `components/MyInvitations.tsx`, `components/CompanyDashboard.tsx`, `components/ProfileEditor.tsx`.
- Hooks: `hooks/useUserProfile.ts`, `hooks/useJobs.ts`, `hooks/useJobFilters.ts`.
- Services: `services/geminiService.ts`, `services/supabaseClient.ts`, `services/stripeService.ts`, `services/csrfService.ts`.
- Backend main app: `backend/app/main.py` (FastAPI endpoints, invitation lifecycle additions).
- DB migration: `database/ASSESSMENT_INVITATIONS.sql` (creates `assessment_invitations` and `assessment_results` tables with RLS policies).

## Backend: behavior and API specification

Auth model
- Company/admin actions: require Supabase-authenticated session (JWT) and company context.
- Candidate start/submit: token-based unauthenticated endpoints — the token in URL query param grants limited-time access.

Key endpoints (current implementation)
- POST /assessments/invitations/create
  - Auth: required (company)
  - Body: { candidate_email, company_id, metadata?, expires_in_seconds? }
  - Action: create DB row in `assessment_invitations`, generate secure `invitation_token`, email candidate a link `/assessment/{invitation_id}?token=...`, log to `premium_access_logs`.
  - Response: { invitation_id, invitation_token (optional) }

- GET /assessments/invitations/{invitation_id}?token=...
  - Auth: token in query param (no session required) or company auth allowed.
  - Action: validate token, ensure not expired and status == 'pending', return invitation details.
  - Response: { invitation_id, assessment_id, company_id, company_name, candidate_email, status, expires_at, metadata }

- POST /assessments/invitations/{invitation_id}/submit?token=...
  - Auth: token in query param
  - Body: { assessment_id, questions_total, questions_correct, score, time_spent_seconds, answers, feedback }
  - Action: validate token & pending status, insert row in `assessment_results`, mark invitation status='completed', attempt to increment company usage counters (ai_assessments_used), return success.
  - Response: { ok: true, result_id }

- GET /assessments/invitations
  - Auth: required
  - Query: company view (company admin) or candidate view (user id/email)
  - Action: returns list of invitations for the caller.

Security notes
- Tokens are single-use/limited-time; backend enforces expiry and status. Ensure HTTPS links in emails.
- Recommendation: sign tokens (HMAC/JWT) or store unpredictable random tokens with sufficient entropy in DB (current approach uses DB-stored token).
- Ensure `ai_assessments_used` is incremented atomically (transactional UPDATE or DB-side RPC), not best-effort client-side increments.

## Data model (summary)
- `assessment_invitations` (id PK, company_id, candidate_email, invitation_token unique, assessment_id, status ENUM (pending|completed), expires_at TIMESTAMP, metadata JSON, created_at)
- `assessment_results` (id PK, invitation_id FK, assessment_id, metrics JSON {score, time_spent, answers}, questions_total, questions_correct, submitted_at)

See `database/ASSESSMENT_INVITATIONS.sql` for full DDL and RLS policies.

## Frontend workflows

Company creates invitation
- UI: `components/AssessmentInvitationModal.tsx` (modal in `CompanyDashboard`).
- Flow: company inputs candidate email + metadata → POST `/assessments/invitations/create` → backend sends email with `/assessment/{id}?token=...` link.

Candidate receives invitation
- Email link opens `pages/InvitationLanding.tsx` (routed by `App.tsx` when pathname starts with `/assessment/`).
- Landing page loads GET `/assessments/invitations/{id}?token=...`, validates token and expiry, then calls `geminiService.generateAssessment` to produce questions (client-side call to AI wrapper).
- Candidate answers questions; frontend submits to POST `/assessments/invitations/{id}/submit?token=...`.

Assessment generation
- `geminiService.generateAssessment(role, skills, difficulty, questionCount)` — currently used by `AssessmentCreator` and landing page to produce questions. Generation is performed from the frontend calling the gemini wrapper service.

Candidate listing & company management
- `components/MyInvitations.tsx` fetches `/assessments/invitations` (logged-in) and shows invites for the user/company.

## Running locally & env vars

Prereqs: Node (recommended v18+), Python 3.10+, Supabase (remote project or local), Postgres, Yarn/npm.

Frontend (dev)
1. Install deps: `npm install` or `yarn`
2. Start dev server: `npm run dev` (Vite)
3. Ensure `constants.BACKEND_URL` points to running backend.

Backend (dev)
1. Create Python venv and install `requirements.txt` in `backend/`.
2. Run: `uvicorn backend.app.main:app --reload --port 8000` (or the project's run script)
3. Env vars required (example):
  - `SUPABASE_URL`, `SUPABASE_KEY`
  - `DATABASE_URL` (Postgres)
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `RESEND_API_KEY`
  - `BACKEND_BASE_URL` (for email links)

Deployment
- Backend: `backend/render.yaml` present; uses environment variables for production keys.
- Frontend: root `render.yaml` or Vercel config possible; ensure `BACKEND_URL` is set for production.

## Tests & monitoring
- Currently no E2E tests covering invite→start→submit. Add Playwright or Cypress tests for the full flow.
- Add server-side logging/metrics for failed token validations, email send failures, and Stripe webhook failures.

## Known Issues / TODOs (high priority)
1. Replace placeholder Stripe `single_assessment` price ID with real product price ID.
2. Harden atomic increment of `ai_assessments_used` (use DB transaction or RPC).
3. Add E2E tests for the invite lifecycle.
4. Add admin UI for revoke/resend and improved invite management.

## Immediate next steps I recommend for a technical cofounder
- Review `backend/app/main.py` invitation endpoints and convert usage increment logic to a single transactional DB statement.
- Review token generation/validation strategy and consider HMAC-signed tokens for stateless validation or keep DB-stored random tokens but add rotation/short TTL.
- Wire real Stripe price IDs and run a full checkout webhook end-to-end test.
- Add Playwright E2E tests for: create invite → receive link (simulate) → open landing → generate assessment → submit → verify DB records and company usage updated.

---

If you'd like, I can also:
- produce a short architecture diagram (textual mermaid or ascii),
- run a local smoke test of the landing flow (requires running backend + env), or
- open a PR with changes to the `ai_assessments_used` increment to make it transactional.

File references
- App entry: [App.tsx](App.tsx)
- Invitation landing: [pages/InvitationLanding.tsx](pages/InvitationLanding.tsx)
- Company modal: [components/AssessmentInvitationModal.tsx](components/AssessmentInvitationModal.tsx)
- Backend endpoints: [backend/app/main.py](backend/app/main.py)
- DB migration: [database/ASSESSMENT_INVITATIONS.sql](database/ASSESSMENT_INVITATIONS.sql)
