# JobShaman Audit Report (Bug-first, Staging, Admin+Recruiter)

Date: 2026-02-17  
Targets: `https://jobshaman.com`, `https://jobshaman-cz.onrender.com`  
Accounts used: admin + recruiter (candidate account unavailable)

## Method
- Static audit: frontend, backend, infra, migrations, CI.
- Runtime audit: authenticated role matrix + public endpoints + controlled burst tests.
- Note on runtime: endpoint responsiveness was intermittent during this audit window (frequent hard timeouts on some calls). Findings that depend on runtime behavior were verified via retries and marked accordingly.
- Runtime artifacts:
- `docs/runtime_audit_core_2026-02-17.json`
- `docs/runtime_audit_role_retry_matrix_2026-02-17.json`
- `docs/runtime_audit_retests_2026-02-17.json`
- `docs/runtime_audit_fuzz_2026-02-17.json`
- `docs/runtime_secret_inventory_2026-02-17.json`

## Findings (ordered by severity)

### JS-AUD-001
- Severity: `P0`
- Category: `Secrets / Incident`
- Evidence:
- `.env` is tracked by git (`git ls-files` confirmed)
- `backend/.env` is tracked by git (`git ls-files` confirmed)
- Secret-like keys present in tracked files: `.env:6`, `.env:13`, `backend/.env:7`, `backend/.env:14`
- Impact:
- High probability of secret exposure via repository access, forks, archives, CI logs, accidental sharing.
- Potential full compromise of data/API billing channels.
- Repro:
- `git ls-files .env backend/.env`
- inspect key names in `.env` and `backend/.env`
- Fix:
- Immediate key rotation (Supabase, Resend, Stripe, Sentry, any API keys).
- Remove secrets from tracked files, enforce `.env.example` only.
- Purge secret history (BFG/git-filter-repo) and invalidate old credentials.

### JS-AUD-002
- Severity: `P0`
- Category: `Client-side secret exposure`
- Evidence:
- Resend is initialized in frontend with `VITE_RESEND_API_KEY`: `services/emailService.ts:4`
- Client sends email directly from browser: `services/emailService.ts:16`
- Called by user flows: `components/ApplicationModal.tsx:111`, `components/PartnerOfferModal.tsx:82`
- Impact:
- Private email provider key effectively becomes public to any browser user.
- Abuse vector: spam, brand/domain reputation damage, quota/billing abuse.
- Repro:
- Build frontend bundle and inspect runtime config/network usage around `sendEmail`.
- Fix:
- Move all email sending to backend-only endpoint.
- Remove `VITE_RESEND_API_KEY` from frontend entirely.

### JS-AUD-003
- Severity: `P1`
- Category: `Payment security / Open redirect validation bypass`
- Evidence:
- URL validation allows any URL starting with `https://jobshaman`: `backend/app/models/requests.py:37`
- Runtime-independent proof: model accepts `https://jobshaman.evil.tld/...`.
- Impact:
- Checkout redirect target can be attacker-controlled lookalike domain.
- Phishing/session theft risk post-checkout.
- Repro:
- Instantiate `CheckoutRequest` with `successUrl=https://jobshaman.evil.tld/success`.
- Fix:
- Parse URL and enforce exact hostname allowlist (`jobshaman.cz`, `www.jobshaman.cz`, localhost for dev).

### JS-AUD-004
- Severity: `P1`
- Category: `Token leakage / Invitation flow`
- Evidence:
- Invitation token required via query string: `backend/app/routers/assessments.py:82`, `backend/app/routers/assessments.py:106`
- Frontend sends token in URL query: `pages/InvitationLanding.tsx:40`, `pages/InvitationLanding.tsx:119`
- Impact:
- Token appears in URL history, potential logs, analytics/referrer chains.
- Replay and accidental leak risk increases.
- Repro:
- Open invitation URL and inspect query token usage.
- Fix:
- Use one-time exchange token or POST body/header token.
- Add strict expiry + single-use enforcement + redact in logs.

### JS-AUD-005
- Severity: `P1`
- Category: `Availability / API reliability`
- Evidence:
- `/jobs/recommendations` repeatedly timed out for both admin and recruiter in role retry matrix:
- `docs/runtime_audit_role_retry_matrix_2026-02-17.json`
- 3/3 retries timeout for both roles at 12s each.
- Impact:
- Candidate/recruiter recommendation UX can stall/fail unpredictably.
- Can cascade into frontend retry/cooldown logic and poor UX.
- Repro:
- Call `GET /jobs/recommendations?limit=3` with valid bearer token; observe repeated timeout.
- Fix:
- Add strict server timeout budget + fallback path + caching.
- Profile DB query and model inference path for this endpoint.

### JS-AUD-006
- Severity: `P1`
- Category: `Error disclosure`
- Evidence:
- Raw exception strings exposed via HTTP details:
- `backend/app/routers/stripe.py:69`
- `backend/app/routers/auth.py:134`
- `backend/app/routers/scraper.py:28`
- Impact:
- Information leakage of internal stack/business logic/provider errors.
- Increases exploitability and reconnaissance value.
- Repro:
- Trigger backend exception path; observe `detail` echoes `str(e)`.
- Fix:
- Return generic error messages to clients, log internals server-side only.
- Standardize exception mapper for 5xx/4xx responses.

### JS-AUD-007
- Severity: `P2`
- Category: `Frontend/backend contract bug`
- Evidence:
- Protected endpoints are called without authenticated helper in FE:
- `services/jobPublishService.ts:124` (`/match-candidates`)
- `services/jobPublishService.ts:136` (`/scrape`)
- Public runtime results show no-auth denial:
- `match_candidates_no_auth=401`, `scrape_no_token=403` in `docs/runtime_audit_core_2026-02-17.json`
- Impact:
- Feature appears broken in production for end users.
- Creates false negatives in recruiter workflows.
- Repro:
- Trigger these frontend functions; requests are sent without bearer/CSRF.
- Fix:
- Route all protected calls through `authenticatedFetch` with token/CSRF handling.

### JS-AUD-008
- Severity: `P2`
- Category: `Data deletion correctness / privacy`
- Evidence:
- Account delete cleanup map uses `("jobs", "contact_email")` but deletes with `user_id` value:
- `backend/app/routers/auth.py:90`, `backend/app/routers/auth.py:104`
- Impact:
- Incomplete account data deletion; privacy/compliance risk.
- Repro:
- Review loop logic: `.eq(col, user_id)` is applied for all tuples including `contact_email`.
- Fix:
- Split deletion logic by type; use `user_email` where column is email.

### JS-AUD-009
- Severity: `P2`
- Category: `Abuse resistance / DoS`
- Evidence:
- Public burst tests show heavy timeout/error behavior under modest parallel load:
- `docs/runtime_audit_fuzz_2026-02-17.json` (`/ai/execute-public`: 24/24 timed out, `/jobs/hybrid-search-v2`: 22/24 timed out).
- Earlier broader run also shows high timeout/error under burst:
- `docs/runtime_audit_results_2026-02-17.json`
- Impact:
- Public endpoints can become unstable under moderate abuse.
- Risk of partial outage or degraded UX.
- Repro:
- Send short parallel bursts to `/ai/execute-public` and `/jobs/hybrid-search-v2`.
- Fix:
- Add upstream concurrency caps, queueing/circuit breaker, stricter rate limiting and fast-fail responses.

### JS-AUD-010
- Severity: `P2`
- Category: `Governance / least privilege`
- Evidence:
- No RLS policy DDL found in repository SQL by search (`CREATE POLICY`, `ENABLE ROW LEVEL SECURITY` absent).
- Impact:
- Security posture depends on out-of-band database config; drift risk.
- Harder auditable compliance and reproducibility.
- Repro:
- Search SQL files for policy statements.
- Fix:
- Version-control RLS policies and grants in migrations.

### JS-AUD-011
- Severity: `P2`
- Category: `CI & dependency hygiene`
- Evidence:
- CI runs only frontend install/typecheck/build: `.github/workflows/ci.yml:21`, `.github/workflows/ci.yml:24`, `.github/workflows/ci.yml:27`
- Backend requirements are unpinned: `backend/requirements.txt:1`
- Impact:
- Regressions/security issues can ship undetected on backend.
- Non-deterministic deployments due floating dependency versions.
- Fix:
- Add backend tests/security checks to CI.
- Pin backend dependencies or use lockfile strategy.

### JS-AUD-012
- Severity: `P3`
- Category: `Operational configuration`
- Evidence:
- Frontend fallback backend URL hardcoded to Render hostname: `constants.ts:5`
- Impact:
- Environment drift and domain/cert mismatch incidents are more likely.
- Fix:
- Remove risky production fallback; require explicit env per environment.

## Role/Auth Matrix (runtime)
- Admin access check:
- Admin token: `/admin/me` => `200`
- Recruiter token: `/admin/me` => `403`
- Evidence: `docs/runtime_audit_role_retry_matrix_2026-02-17.json`

## Functional Runtime Observations
- Public endpoints:
- `/healthz` healthy (`200`)
- `/scrape` without token denied (`403`)
- `/match-candidates` without auth denied (`401`)
- `/ai/execute-public` disallowed action correctly denied (`403`)
- `/ai/execute-public` allowed action responded (`200`) but high latency (~9s in one run)
- Evidence: `docs/runtime_audit_core_2026-02-17.json`

## Fix Roadmap

### Quick wins (0-48h)
1. Rotate exposed credentials and remove tracked secret files from git history.
2. Disable client-side Resend usage; hotfix to backend mail endpoint.
3. Patch checkout URL validation to strict hostname allowlist.
4. Stop returning raw exception details to clients.
5. Fix `jobPublishService` protected endpoint calls to use authenticated request helper.

### Sprint 1
1. Refactor invitation token flow out of query parameters.
2. Stabilize `/jobs/recommendations` with timeout budgets/caching/fallback.
3. Fix account deletion logic for `jobs.contact_email` cleanup.
4. Add backend CI stage: tests + lint + security scan.

### Sprint 2+
1. Add versioned RLS policies in migrations and validate in CI.
2. Add platform-level anti-abuse controls (per-route concurrency, circuit breaker, adaptive throttling).
3. Standardize API error envelope and observability fields (request id, safe codes).

## Risk Register
- `R-001` Secret exposure in git history: `Open`, `Critical`, owner `Platform/Security`.
- `R-002` Client mail API key abuse: `Open`, `Critical`, owner `Frontend+Backend`.
- `R-003` Checkout redirect allowlist weakness: `Open`, `High`, owner `Backend`.
- `R-004` Recommendations endpoint instability: `Open`, `High`, owner `Backend/Data`.
- `R-005` Public endpoint timeout under burst: `Open`, `High`, owner `Platform`.
- `R-006` Token-in-query leakage path: `Open`, `High`, owner `Backend+Frontend`.

## Retest Checklist
1. Verify no secrets exist in tracked files and rotated keys are effective.
2. Confirm email flow only works via backend endpoint; no `VITE_RESEND_API_KEY` in built bundle.
3. Negative tests for checkout URLs (`jobshaman.evil.tld` rejected with 422/400).
4. Invitation flow works without query token leakage.
5. `/jobs/recommendations` responds within SLO under authenticated calls.
6. Protected FE actions (`match-candidates`, `scrape`) succeed with proper auth and fail predictably without.
7. Burst tests produce controlled 429s instead of widespread timeout failures.
8. CI fails on backend regression and dependency/security checks.
