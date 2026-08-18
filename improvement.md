# Improvement Plan

Full-stack bug & inconsistency review. Confirmed findings, ordered by impact. Each item has a location, what's wrong, and a suggested fix.

---

## High — real functional breakage

### 1. Activity log enum mismatch — audit records silently dropped
- **Where:** `server/models/Activity.js:7`
- **Writers:** `server/routes/auth.js:34,44,58,67` (`login_failed`, `account_locked`) and `server/routes/jobs.js:166` (`jobs_fetched`)
- **What's wrong:** The `type` enum only allows `['message', 'resume_download', 'page_view', 'lead']`, but the code writes `login_failed`, `account_locked`, and `jobs_fetched`. Mongoose validation throws, and every call is chained with `.catch(() => {})`, so the error is swallowed and the activity record is never persisted.
- **Impact:** Failed-login logging, account-lockout logging, and job-fetch activity tracking are all silently broken.
- **Fix:** Add the missing values to the enum (or relax the enum to a plain string with an allowlist check):
  ```js
  enum: ['message', 'resume_download', 'page_view', 'lead', 'login_failed', 'account_locked', 'jobs_fetched'],
  ```

### 2. Article "Published/Draft" toggle is a no-op
- **Where:** `client/src/features/admin/components/EditModal.jsx:85`
- **What's wrong:** `setForm({ ...form, published: form.published !== false })` assigns the result of a *comparison*, not a toggle. `true → true`, `false → false`, `undefined → true` — it never flips.
- **Fix:** `published: form.published === false` (or `!(form.published !== false)`).

### 3. New article shows "Published" but is saved as a Draft
- **Where:** `client/src/features/admin/components/EditModal.jsx:7,85` + `server/routes/articles.js:41`
- **What's wrong:** On "New Article", `form` starts as `{}` so `form.published` is `undefined`; the display logic (`form.published !== false`) renders "Published". On save, no `published` key is sent, so the server falls back to `false`.
- **Impact:** The admin's intent is silently inverted.
- **Fix:** After fixing #2, initialize `published: false` for new articles (or make the toggle default explicitly).

### 4. Editing an article shows a blank Content field
- **Where:** `server/routes/articles.js:31` + `client/src/pages/AdminDashboard.jsx` (article edit passes the stripped list item)
- **What's wrong:** `getAllAdmin` uses `.select('-content')`, but the edit button passes that stripped item into `EditModal`, which renders the content textarea.
- **Impact:** Admin cannot see or edit existing article bodies without retyping them.
- **Fix:** Either remove `.select('-content')` from the admin list, or fetch full article content (`/api/articles/:id` or a dedicated GET) before opening the editor.

### 5. Live-chat visitor identity is never persisted correctly
- **Where:** `client/src/components/ChatWidget.jsx:29-31` and `client/src/pages/LiveChatPage.jsx:35-37`
- **What's wrong:**
  1. The generated `crypto.randomUUID()` is thrown away.
  2. `localStorage.setItem('visitorId', socket.id)` stores the per-connection Socket.io id (changes every reconnect).
  3. In `LiveChatPage`, `socket.auth?.visitorId` is always `undefined` (client connects with `query`, not `auth`).
- **Impact:** The server keys chat sessions by `visitorId`, so a returning visitor never matches a prior session — history is lost and a new session is created each visit.
- **Fix:** Generate once and reuse:
  ```js
  let visitorId = localStorage.getItem('visitorId')
  if (!visitorId) {
    visitorId = crypto.randomUUID()
    localStorage.setItem('visitorId', visitorId)
  }
  const socket = io(window.location.origin, { query: { role: 'visitor', visitorId } })
  ```
  (and remove the `socket.id`/`socket.auth` write).

### 6. Profile update silently drops `avatarUrl`, `calendlyUrl`, `availabilityStatus`
- **Where:** `server/routes/profile.js:8-9,21` (also duplicated in `server/controllers/profile.js:8-9,21`) vs `server/models/Profile.js:3-39`
- **What's wrong:** These keys are in `ALLOWED_FIELDS`/`stringFields` but not on the `Profile` schema (only `avatar` exists). Strict-mode Mongoose drops them on `save()`.
- **Impact:** Fields accepted by validation but never stored.
- **Fix:** Add the missing fields to the schema, or remove them from the allowlist if not actually needed:
  ```js
  avatarUrl: { type: String, default: '' },
  calendlyUrl: { type: String, default: '' },
  availabilityStatus: { type: String, default: '' },
  ```

### 7. Project create/update silently drops `current`, `githubUrl`, `liveUrl`, `demoUrl`, `videoUrl`
- **Where:** `server/controllers/projects.js:6-16` vs `server/models/Project.js:3-13`
- **What's wrong:** Same pattern — `current` (bool), `githubUrl`, `liveUrl`, `demoUrl`, `videoUrl` (strings) are in the controller's allowlist but not on the schema, so they are discarded.
- **Impact:** Project "current role" flag and repo/live/demo/video links are never persisted.
- **Fix:** Add the fields to the `Project` schema, or remove them from the controller allowlist.

---

## Medium

### 8. `UserSettings` fetched without a `userId` filter
- **Where:** `server/queue/worker.js:339`
- **What's wrong:** `UserSettings.findOne()` with no `{ userId: app.userId }`. Everywhere else (`routes/jobs.js:656`, `routes/pipeline.js`, `services/aiCost.js`) it's scoped to `userId`.
- **Impact:** Returns an arbitrary record if more than one user exists.
- **Fix:** `UserSettings.findOne({ userId: app.userId }).lean()`.

### 9. `ref: 'User'` on 8 models, but no `User` model exists
- **Where:** `Job.js:8`, `Application.js:62`, `ApplyField.js:14`, `UserJobSite.js:5`, `UserSettings.js:14`, `Notification.js:10`, `GeneratedResume.js:5`, `AiUsage.js:5`
- **What's wrong:** Identity is `Admin` (`middleware/auth.js` signs JWTs with `Admin._id`), but the models reference `'User'`.
- **Impact:** Latent — nothing populates `userId` today, but any future `.populate('userId')` throws `MissingSchemaError: Schema hasn't been registered for model "User"`.
- **Fix:** Decide on a single identity model. Either create a `User` model (and migrate), or change the refs to `'Admin'` for consistency.

---

## Low

### 10. `/api/resumes` list handler lacks `asyncHandler`
- **Where:** `server/routes/resumes.js:3-7`
- **What's wrong:** `exports.getAll` is an async function mounted directly (`server/server.js:121`) with no `asyncHandler` wrapper. If the query rejects, the rejection is unhandled and the request hangs instead of returning a 500.
- **Impact:** Only route handler in the app with this gap.
- **Fix:** Wrap with `asyncHandler`, matching every other handler.

### 11. Dead/duplicate code
- `server/controllers/profile.js` is a full copy of `server/routes/profile.js` (only the routes version is mounted by `server.js`).
- `server/controllers/base.js` is unused.
- **Fix:** Delete the unused controller, or make routes delegate to it (as done for skills/experiences/education/certifications/projects).

---

## Documentation

### 12. Job-automation subsystem is undocumented
- The whole jobs / apply / match / tracking / pipeline / notifications / job-sites subsystem is implemented but missing from `README.md`.
- **Fix:** Add a section covering: job sites setup, fetch/match/apply flow, the Bull/Redis queue (and in-memory fallback), worker/scheduler, manual-apply list, and the relevant env vars (`REDIS_URL`, `JOB_*`, `JOB_CREDENTIALS_KEY`).

---

## Verification checklist (after fixes)

- `cd server && npx jest --forceExit` — all 20 tests still pass.
- `cd client && npm run lint` — no new errors.
- Manually verify: article publish/draft toggle, editing existing article content, live-chat session persistence across refresh, profile fields persist after save, project link fields persist after save.

---

## New Requirements — Auth Persistence & Apply Intelligence

### 13. Login should persist for months; re-login only on password change

- **Current state:**
  - JWT is already signed with `expiresIn: '90d'` (`server/routes/auth.js:82`).
  - Token is stored in `localStorage` under the `auth` key (`client/src/context/AuthContext.jsx`).
  - `server/middleware/auth.js` only checks signature + expiry — there is no way to invalidate a token early.
  - `Admin` (`server/models/Admin.js`) has no token version field, and there is no password-change endpoint.
- **Required behavior:**
  - Once logged in, stay logged in for months — no frequent re-auth.
  - Only a password change should force a new login.
  - Add a `tokenVersion` to `Admin`; include it in the JWT; `middleware/auth.js` compares the token's version against the DB on every request.
  - Add `POST /api/auth/change-password`: verify the current password, update the hash, and increment `tokenVersion` so all previously issued tokens are invalidated.
  - Consider extending the token lifetime to 6-12 months (`expiresIn: '365d'`), with token-version invalidation as the security backstop.

### 14. Capture and persist the per-provider apply flow

- **Current state (flows exist only in adapter code):**
  - `naukri` (`server/adapters/naukri.js`): login (cookie → password form) → search → JD fetch → detect fields → upload resume → fill fields → submit → confirm "Applied".
  - `indeed` (`server/adapters/indeed.js`): login (cookie → password/SSO) → search → JD fetch → detect fields → apply wizard (Continue/Next → resume upload → Submit, up to 6 steps) → external redirect becomes manual apply.
  - `workatastartup` (`server/adapters/workatastartup.js`): YC SSO two-step login → search (client-side keyword filter) → JD fetch → manual apply only (YC single application).
  - `wellfound` (`server/adapters/wellfound.js`): login (cookie → persistent browser profile → password, Cloudflare) → search with backoff → JD fetch → apply modal (note/pitch → fields → resume → send) → confirm.
  - `generic` custom sites (`server/adapters/generic.js`): login (cookie → password) → no auto search/JD/apply → manual apply.
- **Required behavior:**
  - Capture each provider's apply flow as structured, persistent data — steps, selectors, decision branches, and manual-apply conditions — in a new `ApplyFlow` model (or equivalent), seeded from the adapters.
  - Store it per provider (and per user where relevant) so flows are inspectable, editable, and usable as LLM context.
  - Drive or validate the apply pipeline against the stored flow, keeping adapter logic and the stored flow in sync.

### 15. LLM auto-fills future applications from previous applies

- **Current state (partial):**
  - `ApplyField` already learns resolved answers after a successful submit (`server/services/applyFields.js` → `learnFieldValues`).
  - `resolveFieldValues` priority: saved site-specific → canonical cross-site → profile → AI (non-PII only).
  - `Application` stores `fieldValues`, `detectedFields`, and `waitingFields` for history.
- **Required behavior:**
  - Condition the LLM on the candidate's full prior application history so future forms fill end-to-end without pausing.
  - Feed previous applies (field → value pairs, per provider flow) into the AI as few-shot context, not just the static profile.
  - Persist the learned provider flow + answered fields and reference them during `prepare_application`.
  - Track fill confidence and unresolved fields so the user is interrupted only when the LLM genuinely cannot answer.

---

## Development Phases

Dependency order: Phase 1 → Phase 2 → Phase 3. Phase 1 is independent and can ship alone; Phase 3 depends on Phase 2's persisted flow data.

### Phase 1 — Auth: persistent login + password-change invalidation

**Goal:** Stay logged in for months; only a password change forces re-login.

**Scope (item 13):**
- `server/models/Admin.js`: add `tokenVersion` (Number, default `0`).
- `server/routes/auth.js`: include `tv: admin.tokenVersion` in the JWT payload; extend `expiresIn` to `'365d'`.
- `server/middleware/auth.js`: after JWT verification, load the admin and reject if `decoded.tv !== admin.tokenVersion`.
- `server/routes/auth.js`: add `POST /api/auth/change-password` (verify current password → rehash → `tokenVersion += 1`).
- `client`: add change-password UI wired to the new endpoint.

**Out of scope:** refresh tokens, multi-admin, social SSO for the dashboard.

**Verify:**
- Login once → token valid across restarts (no re-auth).
- Change password → old token returns 401 on next request; new login works.

### Phase 2 — Persist per-provider apply flows

**Goal:** Apply flows become structured, stored data instead of adapter-only code.

**Scope (item 14):**
- `server/models/ApplyFlow.js`: new model storing, per provider, an ordered step list with `{ key, label, kind, selectors, branches, manualApplyCondition }`.
- Seed script: encode the current flows for `naukri`, `indeed`, `workatastartup`, `wellfound`, `generic` from the adapters.
- `server/services/applyFlow.js`: loader that returns the stored flow for a site (fallback to adapter for backward compat).
- Wire the worker's `submit` step to reference the stored flow for logging/decision context.
- Expose flows via an admin endpoint (read-only initially) for inspectability.

**Out of scope:** a visual flow editor; auto-generating flows from unvisited sites.

**Verify:**
- Seeded flow for each of the 5 providers matches the documented adapter behavior.
- Worker still applies successfully with the stored flow in place.

### Phase 3 — LLM auto-fill from previous applies (few-shot)

**Goal:** Future applications fill end-to-end using prior apply history, interrupting only when genuinely unresolved.

**Scope (item 15):**
- `server/services/applyFields.js`: extend `aiAnswerFields` to accept prior `Application` records (field → value pairs) as few-shot context.
- `resolveFieldValues`: load the candidate's recent successful applies and pass them to the AI for remaining (non-PII) fields.
- Persist per-field confidence/`source` (`ai_fewshot` vs `ai`) so fill quality is trackable.
- Reduce `waitingFields` to only those the LLM explicitly cannot answer (or PII it is forbidden to invent).

**Out of scope:** model fine-tuning; fully autonomous long-form essay generation.

**Verify:**
- After 1–2 real applies, a new application on the same/another provider fills more fields automatically than today.
- Manual interruption occurs only for missing PII or genuinely unknown answers.

---

## Job Subsystem — Deep-Review Findings (fix later)

A full end-to-end read of the job fetch → match → apply → track → notify flow surfaced these additional gaps. They are ordered by impact and grouped for phased work below.

### 16. Cancel is racy — a running application can still submit

- **Where:** `server/queue/worker.js` (queue process loop + `runStep` + `markStep`)
- **What's wrong:**
  - `queue.process` loads `app` once, then loops `if (app.status === 'canceled') break` against that **stale** object.
  - `runStep` re-fetches the doc but never checks for `canceled`.
  - `markStep` unconditionally sets `status: 'running'` on each step, so it can flip a just-canceled application back to `running`.
- **Impact:** `POST /api/applications/:id/cancel` and `POST /api/jobs/apply/batch/:batchId/cancel` are not reliably honored — a canceled job can still proceed to `submit` and apply on the provider.
- **Fix:**
  - Re-check `status === 'canceled'` inside `runStep` (and before `submit`).
  - `markStep` must not overwrite `canceled`/terminal status with `running`.

### 17. `sanitizeForAI` truncates long documents to 2000 chars

- **Where:** `server/utils/security.js:70-72`
- **What's wrong:** `sanitizeForAI` always does `input.slice(0, 2000)`, even when callers pass `{ checkInjection: false }` for long-form content.
- **Impact:**
  - Uploaded resume text passed for structuring (`resumeGenerate.js:96`) and matching (`jobs.js:393`) is truncated — a multi-page resume only reaches the AI as its first 2000 characters.
  - This breaks the "preserve the original resume verbatim" resume-structuring feature and weakens ATS matching.
- **Fix:** Make the truncation limit a parameter (e.g. `maxLen`) and let long-form callers pass a higher bound (or `0` for no truncation).

### 18. `retryApplication` ignores `needsManualApply` and stale field state

- **Where:** `server/routes/jobs.js:930-971`
- **What's wrong:**
  - Re-queues a `failed`/`not_applied`/`canceled` application without checking `job.needsManualApply`.
  - Never resets `app.needsManualApply`, `manualApplyReason`, `detectedFields`, or `waitingFields`.
- **Impact:** A job already routed to Manual Apply (external employer redirect / custom site) can be auto-submitted again on retry, and stale waiting-field state carries into the new attempt.
- **Fix:** On retry, if `job.needsManualApply` (or `!isAutomatedSite`) → reject with a clear "manual apply" error; otherwise reset the manual-apply and field-staging state before queueing.

---

### 19. `JOB_FETCH_SCHEDULE` is parsed and logged but never used

- **Where:** `server/config/env.js:36`, `server/queue/scheduler.js:64`
- **What's wrong:** The cron value is read into env and printed as `cron "..." documented`, but the scheduler hardcodes `setInterval(tick, 24h)`.
- **Impact:** The documented `JOB_FETCH_SCHEDULE` env var has no effect.
- **Fix:** Either honor a real cron expression (node-cron) or remove/rename the env var and stop implying it is configurable. Update `.env.example` and `README.md` accordingly.

### 20. Scraped job descriptions are injected into AI prompts unsanitized

- **Where:** `server/routes/jobs.js:326`, `server/services/resumeGenerate.js:159`, `server/routes/resume-ai.js`
- **What's wrong:** External JD text is passed to AI prompts via `.slice(...)` with no `sanitizeForAI`.
- **Impact:** A malicious/compromised job posting can carry prompt-injection content into the matcher, resume builder, and cover-letter generator.
- **Fix:** Sanitize JD text (with `checkInjection: false` + a larger max length) before interpolating into prompts.

### 21. Batch-complete notification always reports `needInput: 0`

- **Where:** `server/queue/worker.js:109-132`
- **What's wrong:** `maybeNotifyBatchComplete` returns early while any app is `pending`, then computes `needInput = apps.filter(status === 'pending').length` — which is always 0 by the time the terminal notification fires.
- **Impact:** The "X need input" figure in the batch-complete notification is always wrong.
- **Fix:** Compute `needInput` from `waitingFields.length > 0` (or capture it before the early return) instead of counting `pending` apps post-termination.

---

### 22. Duplicate `getUploadedResumeText` with divergent behavior

- **Where:** `server/routes/jobs.js:373-398` vs `server/services/resumeGenerate.js:80-102`
- **What's wrong:** Two separate implementations. `jobs.js` is PDF-only and picks a different resume (regex label match); `resumeGenerate.js` handles PDF + DOCX and uses `pickMasterResume`.
- **Impact:** Matcher and resume builder can base decisions on different master resumes.
- **Fix:** Extract a single shared helper (or reuse `resumeGenerate.getUploadedResumeText`) and delete the duplicate.

### 23. Dead `$or` clause in `buildFewShotContext`

- **Where:** `server/services/applyFields.js:290-295`
- **What's wrong:** `{ 'fieldValues.0': { $exists: true } }` never matches — `fieldValues` is a Mongoose Map, not an array. Only `detectedFields.0` actually matches.
- **Impact:** No functional bug, but the query is misleading and the unused branch suggests intent that isn't implemented.
- **Fix:** Remove the dead clause (or match `fieldValues` via a Map-specific query if that is the intent).

### 24. `match` uses `$in: [null, undefined]`

- **Where:** `server/routes/jobs.js:229`
- **What's wrong:** `undefined` in `$in` is ignored by Mongoose; the filter only works because the schema defaults `matchScore` to `null`.
- **Impact:** Fragile/latent — relies on a schema default rather than an explicit "unmatched" state.
- **Fix:** Use `{ $in: [null] }` (or `$exists: false`) explicitly.

### 25. `mapNotAppliedReason` has a duplicated regex alternative

- **Where:** `server/queue/worker.js:28`
- **What's wrong:** `/sign ?in|sign ?in/` lists the same pattern twice.
- **Impact:** Cosmetic only.
- **Fix:** Collapse to `/sign ?in/`.

### 26. `AiUsage.purpose` comment is stale

- **Where:** `server/models/AiUsage.js:6`
- **What's wrong:** Comment lists `match | resume | cover_letter | optimize`, but code also records `generate_resume` and `prepare_application`.
- **Impact:** Misleading documentation only.
- **Fix:** Update the comment (or add a `PURPOSE` enum for real validation).

---

## Development Phases — Job Subsystem Fixes

Dependency order: Phase 4 (correctness) → Phase 5 (reliability) → Phase 6 (cleanup).

### Phase 4 — Correctness: cancel, resume truncation, retry

**Goal:** Stop the pipeline from doing the wrong thing (submitting canceled jobs, truncating resumes, re-submitting manual jobs).

**Scope:**
- Item 16 — fix cancel race in `worker.js` (`runStep`/`markStep`/process loop).
- Item 17 — make `sanitizeForAI` truncation configurable; raise it for long-form resume text.
- Item 18 — guard `retryApplication` against manual-apply jobs and reset stale field state.

**Verify:**
- Cancel a running job mid-`prepare_application` → it does not reach `submit`.
- Upload a >2000-char resume → the matcher/resume-builder see full text.
- Retry a job flagged `needsManualApply` → rejected with a clear error, not re-submitted.

### Phase 5 — Reliability: scheduler cron, JD sanitization, batch counts

**Goal:** Make documented behavior match reality and harden external input.

**Scope:**
- Item 19 — honor `JOB_FETCH_SCHEDULE` (node-cron) or stop claiming it is configurable; fix docs.
- Item 20 — sanitize scraped JD text before AI prompts.
- Item 21 — fix `needInput` count in batch-complete notification.

**Verify:**
- `JOB_FETCH_SCHEDULE` actually changes the fetch schedule (or docs no longer claim it does).
- A JD with prompt-injection patterns is sanitized before reaching the model.
- A batch with waiting applications reports a correct `needInput` figure.

### Phase 6 — Cleanup: dead code + docs

**Goal:** Remove duplication and stale comments without changing behavior.

**Scope:**
- Item 22 — consolidate duplicate `getUploadedResumeText`.
- Item 23 — remove dead `$or` branch.
- Item 24 — fix `$in: [null, undefined]`.
- Item 25 — collapse duplicate regex.
- Item 26 — fix stale `AiUsage` purpose comment.

**Verify:**
- Full server test suite passes.
- No change in match/resume/apply behavior after the consolidation.
