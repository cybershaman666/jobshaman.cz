# Test Plan: CV Dictation + AI Guide (Premium User)

Date: 2026-02-16  
Scope: verify premium-gated candidate features for CV dictation and AI guided profile flow.

## Preconditions

- Test user is logged in.
- Subscription is set on `user_id` (not only `company_id`):
  - `tier = premium`
  - `status = active`
- Backend deployed with latest fixes for:
  - admin subscription update payload compatibility
  - `/subscription-status` context resolution (`user_id` vs `company_id`)
- Browser microphone permission is allowed for `jobshaman.cz`.

## Quick API Sanity Check

1. Open DevTools -> Network.
2. Trigger profile load.
3. Verify request:
   - `GET /subscription-status?userId=<YOUR_USER_ID>`
4. Expected:
   - response contains `tier: "premium"` and `status: "active"`.

## Test Cases

### TC-01 Profile Access (No forced company dashboard)

Steps:
1. Open `/cs/profil`.
2. Refresh page.

Expected:
- Profile editor remains visible.
- App does not redirect to `/company-dashboard` unless account is true company context.

Result:
- [ ] Pass
- [ ] Fail
Notes:

### TC-02 Premium Gate for AI Guide

Steps:
1. In profile flow, open AI guided CV/profile section.
2. Start AI guide.

Expected:
- No premium access denial for active premium user.
- AI guide UI loads without forced fallback to free tier.

Result:
- [ ] Pass
- [ ] Fail
Notes:

### TC-03 Microphone Dictation Start

Steps:
1. Click dictation/microphone button in CV input area.
2. Grant mic permission if prompted.

Expected:
- Mic state changes to active/listening.
- No JS error in console tied to dictation start.

Result:
- [ ] Pass
- [ ] Fail
Notes:

### TC-04 Dictation Text Capture

Steps:
1. Dictate 2-3 sentences (name, role, experience).
2. Stop dictation.

Expected:
- Text appears in CV input/textarea.
- Czech diacritics are preserved reasonably (minor ASR variance tolerated).

Result:
- [ ] Pass
- [ ] Fail
Notes:

### TC-05 AI Parse / Suggestion Generation

Steps:
1. Submit dictated text to AI guide step.
2. Wait for AI response.

Expected:
- AI returns structured suggestions/profile updates.
- No blocking error toast for subscription/CSRF/network (except transient retries).

Result:
- [ ] Pass
- [ ] Fail
Notes:

### TC-06 Save and Reload Persistence

Steps:
1. Save profile after AI-generated updates.
2. Reload page and open profile again.

Expected:
- Saved fields persist after reload.
- Coordinates/address or other previously saved profile fields remain intact.

Result:
- [ ] Pass
- [ ] Fail
Notes:

## Automated Checks Run (Local shell)

Executed commands:

1. `SECRET_KEY=test-secret python -m pytest backend/tests -q`
   - Result: `6 passed, 1 error`
   - Error: `backend/tests/test_assessment_usage.py` uses outdated monkeypatch target (`backend.app.main.supabase`), unrelated to CV dictation flow.

2. `SECRET_KEY=test-secret python -m pytest backend/tests/test_ai_v2_models.py backend/tests/test_geocoding.py -q`
   - Result: `4 passed`

Limitations in this environment:
- `node`/`npm` not available in current shell, so frontend `typecheck/build` could not be executed here.

## Go/No-Go Criteria

- Go:
  - TC-01..TC-05 all pass.
- Conditional Go:
  - TC-06 fails only on non-critical formatting but data persists.
- No-Go:
  - Premium still resolves to `free` on `/subscription-status` for the logged-in `user_id`.
  - Dictation cannot start or AI guide is blocked by billing checks.
