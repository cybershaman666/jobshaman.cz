# Cybershaman Production TODO

Scope for the production hardening pass: Czech and English only. Other locales can remain in the codebase, but new product-critical copy, prompts, and backend contracts should target `cs` and `en` first.

## Product Spine

1. Narrative onboarding produces a canonical candidate profile.
2. JCFPM becomes a production candidate module, not a `/tests` API.
3. Matching uses the complete candidate profile: narrative, skills, preferences, JCFPM, and practical evidence.
4. Companies define a role-specific handshake blueprint.
5. Candidates complete a backend-owned handshake session.
6. Recruiters receive one server-side readout/dossier.

## Product Vocabulary

- Candidate profile: the canonical server-side candidate model built from narrative onboarding, structured preferences, JCFPM, skills, and practical evidence.
- Narrative onboarding: the Cybershaman-guided life story flow that creates or enriches the candidate profile.
- JCFPM profile: the production psychometric/work-potential snapshot stored as `preferences.jcfpm_v1`.
- Handshake blueprint: the company-defined role scenario, constraints, deliverables, rubric, and culture signals for one job.
- Handshake session: the backend-owned candidate attempt for one role-specific blueprint.
- Recruiter readout: the server-side dossier produced from the submitted handshake session and candidate profile.

Signal Boost and the rebuild journey are implementation sources: they can supply scoring, readout, UX, and reasoning patterns, but the production contract should stay anchored in the vocabulary above.

New product-critical copy, prompts, and backend prompt contracts should be written for `cs` and `en` only until the core candidate-to-company flow is stable.

## Phase 0: Scope And Flags

- [x] Lock product vocabulary: candidate profile, narrative onboarding, JCFPM profile, handshake blueprint, handshake session, recruiter readout.
- [x] Add or reuse release flags for `cybershaman_onboarding_v1`, `candidate_jcfpm_v1`, `handshake_v1`, and `recruiter_readout_v1`.
- [x] Treat Signal Boost and rebuild journey as logic sources, not the final product model.
- [x] Limit new production copy and prompts to `cs` and `en`.
- [x] Route all backend AI generation through the Mistral chat completions API only.

## Phase 1: Canonical Candidate Profile

- [x] Add `POST /candidate/profile/onboarding/complete`.
- [x] Persist AI profile output server-side into `candidate_profiles`.
- [x] Mark `preferences.candidate_onboarding_v2.completed_at`.
- [x] Invalidate recommendation cache after profile changes.
- [x] Refresh candidate embedding after profile changes.
- [x] Add `GET /candidate/profile/readiness`.
- [x] Move Cybershaman onboarding from direct Supabase persistence to the new endpoint.

## Phase 2: Production JCFPM

- [x] Add `backend/app/routers/jcfpm.py`.
- [x] Add `GET /candidate/jcfpm/items`.
- [x] Add `POST /candidate/jcfpm/submit`.
- [x] Add `GET /candidate/jcfpm/latest`.
- [x] Persist `jcfpm_v1` only under `candidate_profiles.preferences`.
- [x] Keep append-only `jcfpm_results` as audit/history.
- [x] Add backend-generated archetype to the snapshot.
- [x] Move frontend JCFPM service off `/tests/jcfpm/*`.
- [x] Remove public registration of the legacy `/tests/jcfpm/*` router.
- [x] Prefer backend JCFPM item loading before direct Supabase fallback.

## Phase 3: Matching Uses The Whole Profile

- [x] Extend candidate feature extraction with JCFPM dimensions, archetype, top percentiles, and blind-spot signals.
- [x] Add JCFPM as a soft signal in scoring.
- [x] Return evidence buckets: narrative, profile, JCFPM, practical evidence.
- [x] Add tests for narrative + JCFPM improving role fit.
- [x] Add recruiter-facing match explanations with consent-aware visibility.

## Phase 4: Handshake Blueprint

- [x] Define `handshake_blueprint_v1` schema.
- [x] Store role-specific scenario, constraints, deliverables, rubric, company goal, hard truth, failure pattern, and culture signals.
- [x] Generate or validate blueprint during job draft publish.
- [x] Keep `editor_state.handshake` as fallback only.

## Phase 5: Handshake Session

- [x] Add `POST /handshakes/start`.
- [x] Add `GET /handshakes/{id}`.
- [x] Add `PATCH /handshakes/{id}/answer`.
- [x] Add `POST /handshakes/{id}/finalize`.
- [x] Server-side compose candidate snapshot from live profile, onboarding, JCFPM, job, and company blueprint.
- [x] Move slot/capacity accounting to backend.
- [x] Store answers, timing, stages, attachments, and final state.

## Phase 6: Recruiter Readout

- [x] Create `backend/app/services/handshake_readout.py`.
- [x] Reuse useful Signal Boost readout logic.
- [x] Add `GET /company/handshakes/{id}/readout`.
- [x] Support anonymous-first readout before identity reveal.
- [x] Include strengths, risks, JCFPM summary, evidence sections, what CV does not show, and recommended next step.

## Phase 7: Locale Simplification

- [x] Centralize new product prompts/copy for `cs` and `en`.
- [x] Avoid adding new production strings for `de`, `pl`, `sk`, `at` until the core flow is stable.
- [x] Keep backend prompt locale validation to `cs | en` for new endpoints.

## Phase 8: UX Polish And Accessibility

- [x] Add light, dark, and system-driven theme selection for the rebuild shell.
- [x] Improve light theme contrast for panels, headers, fields, and secondary text.
- [x] Audit remaining hardcoded dark surfaces in legacy Cybershaman screens.
- [x] Add automated Cybershaman visual preflight for legacy theme scoping and focused QA routes.
- [x] Replace candidate insights with the screenshot-inspired dashboard shell.
- [x] Add a shared dashboard chrome for sidebar, topbar, light theme, dark theme, and brand assets.
- [x] Add a recruiter dashboard using the same dashboard layout system.
- [x] Bundle local dashboard visuals for archetype orbit and growth recommendation cards.
- [x] Make narrative onboarding available to all signed-in candidates, with non-premium fallback completion.
- [x] Route production app root to the rebuild shell so completed onboarding lands on the new dashboard instead of the legacy map.
- [x] Remove obsolete Cybershaman legacy shell routes and files.
- [x] Remove legacy shell theme overrides that conflicted with the new dashboard.
- [x] Render candidate and recruiter dashboard routes without the old rebuild backdrop layer.
- [x] Redirect signed-in users from `/` to the proper product dashboard instead of the old marketplace shell.
- [ ] Run focused mobile/desktop visual QA for onboarding, marketplace, candidate profile, and recruiter workspace.

## First Production Milestone

A candidate can complete narrative onboarding, complete JCFPM, receive recommendations based on the complete profile, start a role-specific handshake, submit real answers, and the company can read one server-side recruiter dossier.
