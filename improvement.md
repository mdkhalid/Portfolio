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
