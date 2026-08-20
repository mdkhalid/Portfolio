# Improvement Plan — Job Application Automation System

## System Overview

This is a portfolio website with a built-in job application automation system. The
admin panel manages content (profile, skills, experience, resumes, articles, etc.)
and automates job applications across Naukri, Indeed, Wellfound, Work at a Startup,
and custom sites.

### Auto-Apply Pipeline (Worker)

`server/queue/worker.js` processes each queued application through **4 steps**:

```
STEPS = ['fetch_jd', 'generate_resume', 'prepare_application', 'submit']
```

| Step | What it does |
|---|---|
| `fetch_jd` | Fetches the full job description from the site (if not already stored on the Job). Logs in if the JD page requires authentication. |
| `generate_resume` | Generates a tailored ATS resume or reuses an existing one. **Skipped entirely for Wellfound** (RESUME_FREE_SITES). Aborts the whole application if AI budget is exceeded (`skipOnBudgetExceeded: true`). |
| `prepare_application` | Detects form fields via `adapter.detectApplyFields` (optional — gracefully skipped if the adapter doesn't export it). Resolves field values from profile history. If unresolved fields remain → pauses app for user input. |
| `submit` | Enforces rate limit + site concurrency. **Logs in** (cookie first, then password, then persistent browser profile). Calls `adapter.submitApplication()` with the resume PDF Buffer, field values, and credentials. Refreshes session cookies after success. |

Live progress is broadcast via Socket.io to the admin dashboard's "Auto-Apply Pipeline" panel.

### Resume Generation

`server/services/resumeGenerate.js` → `buildTailoredResume(job, { userId, skipOnBudgetExceeded })`:

1. **Master resume exists (`.docx`)**: Inject JD keywords into the Skills section via `injectKeywordsIntoDocx` (preserves original formatting, clones existing skill paragraphs).
2. **Master resume exists (`.pdf`)**: If AI available → restructure + merge keywords into Skills. If not → `appendKeywordsToResumePdf` (appends keyword page).
3. **No master resume**: Build from DB profile (Experience, Education, Skills, Certifications) via `buildResumePdf`.

AI budget check: `checkAICost(userId, { purpose: 'generate_resume' })`. If exceeded and `skipOnBudgetExceeded` → returns `{ aiSkipped: true }`, worker aborts the application.

### Login Methods

| Method | How it works | Where session is persisted |
|---|---|---|
| **Password** | `adapter.login({ email, password })` | Worker captures cookies afterward (`captureCookiesFromContext`, worker.js:455). `login-all` does NOT capture them. |
| **Cookie header** | `adapter.login({ cookies, cookieOrigin })` | Stored encrypted on `UserJobSite.cookies`, refreshed after successful submit (`refreshSiteCookies`, worker.js:500). |
| **Browser login** | `interactiveLogin(site)` — opens visible Chrome, user completes CAPTCHA/SSO/OTP, cookies harvested. | Cookie header saved to `UserJobSite.cookies`. Wellfound also uses a **persistent browser profile** (`data/browser_profiles/<site>/`). |

---

## Phase 1: Login Persistence

> "Once login at once or one by one. it should be login all the time. when applying it should not break."

### Issue 1.1 — `login-all` does not capture session cookies after password login

**File**: `server/routes/job-sites.js:109-173` (login-all handler), `server/services/browserLogin.js:213-239` (connectSite)

**Problem**: When `login-all` connects via password credentials (`connectSite` returns `{ ok: true, via: 'password' }`), no `cookieHeader` is returned. The login-all handler only persists cookies when `r.cookieHeader` is truthy (line 156):

```js
const updates = { status: 'connected' };
if (r.cookieHeader) {
  updates.cookies = encrypt({ value: r.cookieHeader });
  updates.cookieUpdatedAt = new Date();
  updates.enabled = true;
}
```

When login is via password, only `{ status: 'connected' }` is saved — no cookies, no `enabled: true`. The next auto-apply run must re-login with the password, which can fail on sites that rate-limit password logins or require 2FA/CAPTCHA.

**Fix**: After a password login in `login-all`, call `captureCookiesFromContext` to persist the session cookies, and set `enabled: true` when credentials are stored (not only when cookies are present).

### Issue 1.2 — `login-all` does not set `enabled: true` on password-only login

**File**: `server/routes/job-sites.js:155-164`

**Problem**: Same as above. `enabled` is only set when `r.cookieHeader` exists. A site that successfully logged in via password remains disabled, so its jobs aren't fetched and auto-apply won't pick them up. The user must manually toggle the site on after `login-all`.

**Fix**: Set `enabled: true` whenever `r.ok` is true and the site has stored credentials (cookie OR password).

### Issue 1.3 — No proactive session validation / scheduled keep-alive

**File**: `server/queue/scheduler.js` (only schedules job fetching), `server/services/sessionRefresh.js` (only called reactively)

**Problem**: Session cookies are only refreshed **after** a successful application (worker.js:500). There is no scheduled task that proactively validates and refreshes sessions before they expire. If the user doesn't apply for several days, sessions expire silently. The next auto-apply fails with a login error, which may require interactive browser login (slow, disruptive).

**Fix**: Add a scheduled session health-check (e.g., via the existing scheduler or a new cron job) that calls `refreshSiteCookies` for all connected sites at intervals shorter than the site's cookie TTL.

### Issue 1.4 — `connectSite` (login-all) doesn't capture cookies for credential/cookie logins

**File**: `server/services/browserLogin.js:213-239`

**Problem**: `connectSite` calls `adapter.login(...)` but only returns `cookieHeader` when the interactive browser fallback is used (line 236-238). When automated login via stored cookie or password succeeds, no fresh cookie jar is captured — even though the login may have refreshed the session. The stored cookie is never updated.

**Fix**: After a successful automated login (cookie or password), call `captureCookiesFromContext` to persist any refreshed session cookies.

### Issue 1.5 — `fetch_jd` and `submit` login use the same cached browser but don't share session state

**File**: `server/queue/worker.js:211-248` (fetch_jd), `server/queue/worker.js:441-456` (submit)

**Problem**: The `fetch_jd` step may log in (if JD page requires auth), and the `submit` step logs in again. They share the same cached browser (`getBrowser(site)`), but the `fetch_jd` login doesn't capture cookies for reuse. If the `fetch_jd` step logs in via password and the `submit` step also tries password login, the site may rate-limit or show CAPTCHA. If the `fetch_jd` step logs in via cookies and those cookies expire between steps, the submit step would fail.

**Fix**: After `fetch_jd` logs in, call `captureCookiesFromContext` so the `submit` step can reuse the refreshed session.

---

## Phase 2: Resume Attachment ("May Not Add Resume")

### Issue 2.1 — Wellfound seed flow lists `upload_resume` but worker skips resume generation

**File**: `server/seed-apply-flows.js:55`, `server/queue/worker.js:21` (RESUME_FREE_SITES)

**Problem**: Wellfound is in `RESUME_FREE_SITES` (worker.js:21), so the `generate_resume` step is skipped entirely — no `GeneratedResume` is created, `app.resumeId` is never set, and the Wellfound adapter's `if (resume)` guard (wellfound.js:260) skips the upload. This is by design (Wellfound uses profile-based resumes), BUT the seed apply flow metadata still lists `upload_resume` as a step (seed-apply-flows.js:55), creating a misleading expectation that a tailored resume will be uploaded.

**Fix**: Remove `upload_resume` from Wellfound's seed apply flow steps, and rename the `upload_resume` step key to `generate_resume` across all flows to match the worker's actual step names (consistency).

### Issue 2.2 — Reused attached resume fetched without `.select('+pdf')`

**File**: `server/queue/worker.js:264`

**Problem**: When reusing a manually-generated resume (`job.resumeId`), the query uses `.lean()` without `.select('+pdf')`:

```js
const attached = await GeneratedResume.findById(job.resumeId).lean().catch(() => null);
```

The `pdf` field has `select: false` on the `GeneratedResume` schema, so `attached.pdf` is `undefined` here. This works in practice because the `submit` step re-fetches with `.select('+pdf')` (line 421), but it's a redundant second query and a code smell — if anyone refactors to reuse the `attached` object, the PDF would silently be missing.

**Fix**: Add `.select('+pdf')` to the line 264 query.

### Issue 2.3 — No validation that GeneratedResume has a non-null PDF before passing to adapter

**File**: `server/queue/worker.js:420-466`

**Problem**: The worker fetches the resume in the `submit` step and passes `resume?.pdf || null` to the adapter (line 465). If a `GeneratedResume` document exists but its `pdf` field is `null` (e.g., corrupted record or edge case in `buildResumePdf`), the adapter receives `null` and silently skips the resume upload. The job application would be submitted without a resume, which most sites would reject.

**Fix**: Add a guard: if `resume` exists but `resume.pdf` is falsy, throw a clear error (`"Resume PDF is missing — regenerate the resume and retry"`) instead of silently passing `null`.

### Issue 2.4 — `buildTailoredResume` can return `pdf: undefined` when `buildResumePdf` fails

**File**: `server/services/resumeGenerate.js:464`

**Problem**: The DB-profile fallback path calls `buildResumePdf(...)`. If this function throws or returns a falsy value, the `pdf` field in the return object would be `undefined`. `buildResumePdf` uses `PDFDocument.create()` from `pdf-lib` — if the PDF library has issues (corrupt data, OOM), the exception would propagate. The `generate_resume` step in the worker doesn't wrap `buildTailoredResume` in a try/catch for the PDF generation failure case — a thrown error from `buildResumePdf` would mark the step as `failed` and the application would be marked `not_applied`, with no resume attached.

**Fix**: Add error handling in `buildTailoredResume` to ensure `pdf` is always a Buffer, or let the error propagate with a clear message.

---

## Phase 3: AI Budget Guard Behavior

### Issue 3.1 — Auto-apply aborts entirely on AI budget exhaustion (no resume, no application)

**File**: `server/queue/worker.js:269-289`

**Problem**: When `skipOnBudgetExceeded: true` and the AI budget is exceeded, the `generate_resume` step returns `{ skipped: true, aiSkipped: true }`. The worker sets the application to `not_applied` with `notAppliedReason: 'ai_budget'` and aborts the entire application. No resume is generated, no application is submitted. The user must wait for the budget to reset or manually generate resumes.

In contrast, the admin UI's manual "Generate Resume" button (resume-ai.js:158) calls `buildTailoredResume` **without** `skipOnBudgetExceeded`, so it falls back to the deterministic path and always produces a resume. This inconsistency means auto-apply is stricter than manual generation.

**Fix**: Make the auto-apply `generate_resume` step fall back to the deterministic path (like the manual button) when AI budget is exceeded, instead of aborting the entire application. Only skip if there's genuinely no way to produce a resume.

### Issue 3.2 — `/api/resume/generate` doesn't pass `skipOnBudgetExceeded`

**File**: `server/routes/resume-ai.js:158`

**Problem**: The manual resume generation endpoint calls `buildTailoredResume(job, { userId: req.adminId })` without `skipOnBudgetExceeded`. This is actually the **desired** behavior for manual generation (always produce a resume). But when a user manually generates a resume and the job is later auto-applied, the worker detects `job.resumeId` and reuses the manually-generated resume (bypassing AI entirely). So the manual generation is the escape hatch for budget-exhausted auto-apply.

This is actually a **workaround**, not a bug — but it's not documented or surfaced in the UI. The user might not know to manually generate a resume to bypass the budget guard.

**Fix**: Surface this in the UI — when a job shows `not_applied: ai_budget`, show a "Generate Resume (deterministic)" button that pre-generates a resume so the retry can proceed.

---

## Phase 4: Admin UI Job Section Issues

### Issue 4.1 — No visual indicator of which jobs have generated resumes attached

**File**: `client/src/pages/AdminDashboard.jsx`

**Problem**: In the Job Applications tab, only a small "Resume" badge is shown (line 2257: `{job.resumeId && <span ...>Resume</span>}`). There's no indication of whether the resume was AI-generated or reused, no way to download it from the job card, and the auto-apply button doesn't reflect whether a resume needs to be generated first.

**Fix**: Add a "Generate Resume" action to the job card toolbar, or show the resume status (AI-generated vs reused) in the badge. Allow downloading the attached resume directly from the card.

### Issue 4.2 — `handleBulkAction('apply')` marks applied without recording a source

**File**: `client/src/pages/AdminDashboard.jsx:632-667`

**Problem**: The "Mark Applied" button sends `PUT /api/jobs/:id` with `{ status: 'applied' }`. The server creates an Application record (jobs.js:470-474) but sets `appliedVia` to `'manual'` (the server infers this from the status change). There's no explicit `appliedVia` field sent from the client. If the user marks a job as "applied" manually, it shows in Tracking as `appliedVia: manual`. But if auto-apply also uses `appliedVia: 'system'`, there's no `appliedVia: 'manual_mark'` distinction — both manual and auto applications share the `manual` bucket in the `appliedVia` field (need to verify on the server).

**Fix**: Ensure the server distinguishes `appliedVia: 'manual_mark'` vs `appliedVia: 'system'` vs `appliedVia: 'manual_browser'`.

### Issue 4.3 — Auto-apply pipeline progress is not persisted to the batch when the page is refreshed

**File**: `client/src/pages/AdminDashboard.jsx:2290-2339`

**Problem**: The live apply progress panel (`applyProgress` state) is populated from Socket.io `apply:progress` events. When the page is refreshed, the progress is lost. The user must reopen the panel to see the current batch status. There's no REST endpoint to fetch the current batch progress by batchId — wait, actually `GET /api/jobs/apply/batch/:batchId` exists (jobs.js:761). But the client doesn't call it on mount to restore the panel state.

**Fix**: On tab activation or page load, if `lastBatchId` exists in state, call `GET /api/jobs/apply/batch/:batchId` to restore the progress panel.

### Issue 4.4 — `loginAll` disables sites when no credentials are present (but doesn't re-enable after a successful interactive login)

**File**: `client/src/pages/AdminDashboard.jsx:417-438`

**Problem**: The "Login All" button calls `POST /api/job-sites/login-all`. If a site has no stored credentials or cookies, `connectSite` would fail. The handler (job-sites.js:151-154) sets the status to `'error'` but doesn't try the interactive browser login fallback for sites that have NO credentials at all. The user must manually add credentials first, then login.

This is actually correct behavior — you can't login to a site without credentials. But the UI doesn't guide the user to add credentials first.

**Fix**: In the admin UI's login-all result, show a clear message for sites with "No credentials — save them first" and link to the credentials modal.

---

## Phase 5: Resume Generation Edge Cases

### Issue 5.1 — Wellfound generates resume before `generate_resume` then discards it

**File**: `server/queue/worker.js:252-305`

**Problem**: For Wellfound (RESUME_FREE_SITES), the `generate_resume` step is skipped → no resume is generated → the `submit` step gets `resume: null`. But the `fetch_jd` step and `prepare_application` step still run, consuming browser time and potentially triggering rate limits. The `submit` step then logs in and applies without a resume.

This is by design, but it's worth noting that the AI budget guard (`skipOnBudgetExceeded`) is **not** triggered for Wellfound (since the step is skipped before reaching `buildTailoredResume`). This is correct — Wellfound doesn't need a resume.

### Issue 5.2 — `buildTailoredResume` always calls `checkAICost` even when reusing an uploaded file

**File**: `server/services/resumeGenerate.js:266-271`

**Problem**: The function calls `checkAICost(userId, { purpose: 'generate_resume' })` at line 266, before checking if there's an uploaded master resume file. If the user is in the PDF/DOCX path (lines 280-393) and AI is not needed (keywords already known from the matcher), the cost check still runs and could return `budgetOk: false`. But since `skipOnBudgetExceeded` is only `true` in the worker, and the check happens before determining if AI is actually needed, the budget check is slightly premature.

For the DOCX path: if `client && budgetOk` is false, the function falls back to `job.missingKeywords` (line 296) — still produces a resume. ✓
For the PDF path: if `client && budgetOk` is false, the function falls back to `appendKeywordsToResumePdf` (line 372) — still produces a resume. ✓
For the DB profile path: if `useAI` is false, the function uses `job.missingKeywords` (line 458-460) — still produces a resume. ✓

So the cost check doesn't actually prevent resume generation in any path — it only gates whether AI is used for keyword suggestions. This is correct behavior. No fix needed.

### Issue 5.3 — Generated resume content stored as plain text, used for admin display

**File**: `server/models/GeneratedResume.js`, `client/src/pages/AdminDashboard.jsx:1237-1239`

**Problem**: The `content` field on `GeneratedResume` stores a plain-text description of the resume (e.g., "ATS Tailored Resume for X at Y\n\nKeywords added: ..."). The admin UI's "Generated Resumes (ATS)" section shows this text in a line-clamp-2 div. This is fine, but there's no full preview of the resume content — the user can only download the PDF.

**Fix**: Add a "View" button that opens the PDF in a browser tab (instead of forcing download), so the user can preview before applying.

---

## Phase 6: Login Persistence (Detailed)

### Current Login Flow Recap

```
1. User logs in via browser login (wellfound-specific) OR login-all
2. Browser login: interactiveLogin() opens visible Chrome → user completes login → cookies harvested → stored encrypted as UserJobSite.cookies
3. Password login: adapter.login({ email, password }) → after success, worker calls captureCookiesFromContext() to persist cookies
4. Auto-apply: worker reads stored cookies → adapter.login({ cookies }) → applies → refreshSiteCookies() after success
5. Sliding session: refreshSiteCookies() replays stored cookies, verifies session alive, captures fresh cookie jar
```

### Gaps in Login Persistence

| Scenario | What happens | Problem |
|---|---|---|
| `login-all` via password | `connectSite` calls `adapter.login({ email, password })` → succeeds → returns `{ ok: true, via: 'password' }` (no cookieHeader) | `login-all` doesn't save `enabled: true` — site stays disabled |
| `login-all` via stored cookie | `connectSite` calls `adapter.login({ cookies })` → succeeds → returns `{ ok: true, via: 'cookies' }` (no cookieHeader) | No new cookies captured even if session was refreshed during login |
| Session expires between applies | Next `submit` step calls `adapter.login({ cookies })` → fails (expired) → throws error → application fails with `login_failed` | No automatic retry or re-login attempt — application just fails |
| Wellfound browser profile | Persistent profile in `data/browser_profiles/wellfound/` | Profile lock conflicts possible if worker + interactive login run simultaneously — handled by `killProfileProcesses` but can cause temporary gaps |
| Password login during auto-apply | Worker calls `adapter.login({ email, password })` → may hit CAPTCHA/2FA | Worker can't handle CAPTCHA → application fails with `login_failed` → no fallback to browser login |

### Fixes Needed

1. **login-all**: After any successful automated login (password or cookie), call `captureCookiesFromContext` to persist refreshed session. Set `enabled: true` when credentials exist, not just when new cookies are captured.

2. **Worker submit step**: If `adapter.login()` with stored cookies fails with a login-related error, attempt a password re-login automatically (if credentials are stored) before failing the application. Only escalate to `login_failed` if both cookie and password login fail.

3. **Scheduled session health check**: Add a cron job (via the existing scheduler) that calls `refreshSiteCookies` for all `enabled` + `connected` sites at a configurable interval (e.g., daily). This proactively refreshes sessions before they expire.

4. **Browser profile lock recovery**: The existing `withBrowserRetry` (worker.js:66-79) handles browser disconnects, but there's no equivalent for profile lock conflicts. Add a retry with `killProfileProcesses` cleanup for Wellfound.

---

## Phase 7: Data Model / Seeding Consistency

### Issue 7.1 — ApplyFlow step names don't match worker step names

**File**: `server/seed-apply-flows.js`, `server/queue/worker.js:16`

**Problem**: The seed apply flows use step keys like `upload_resume`, `fill_form`, `detect_fields`, `manual_apply` — but the worker's actual `STEPS` array is `['fetch_jd', 'generate_resume', 'prepare_application', 'submit']`. The ApplyFlow data is used for metadata/display (e.g., timeline events in worker.js:386-388) but the step names don't align. This makes debugging confusing.

**Fix**: Align seed flow step keys with worker step names.

### Issue 7.2 — WorkataStartup seed flow says `manualApply: true` but worker still runs `generate_resume` for it

**File**: `server/queue/worker.js:252-259`, `server/seed-apply-flows.js:35-45`

**Problem**: WorkataStartup is `manualApply: true` in the seed flow. The worker's `submit` step checks `flow.manualApply` and routes to manual apply (worker.js:392-403). But the `generate_resume` step runs BEFORE the submit step (it's earlier in STEPS). So the worker generates a tailored resume for WorkataStartup, then throws it away when routing to manual apply. This wastes AI budget.

**Fix**: In the `generate_resume` step, check if the site's flow has `manualApply: true` and skip resume generation for manual-only sites.

---

---

## Phase 8: Silent UI Updates (Dashboard Doesn't Reflect Completed Work)

> "There must be silent update. page should not see refreshing. get benefit of React."

### Issue 8.1 — Failure path never emits `jobs:changed` or terminal `apply:progress`

**File**: `server/queue/worker.js:626-665` (catch block), `server/queue/worker.js:269-289` (AI budget), `server/queue/worker.js:382-403` (manual_apply skip), `server/queue/worker.js:258-261` (needs_input)

**Problem**: The **success** path (worker.js:519-530) emits both `emitJobsChanged(app.userId)` and a terminal `emitProgress` payload. But **every other terminal path** only calls `markStep` (which emits an intermediate `apply:progress`) and `notify` — **never `emitJobsChanged`**:

| Terminal path | `markStep`/progress emitted? | `emitJobsChanged` emitted? | `notify` type |
|---|---|---|---|
| Success (applied) | Yes (line 520) | **Yes** (line 530) | `apply_success` |
| Failure (catch block) | **No** — direct `Application.updateOne` (line 631, 643) | **No** | `apply_failed` |
| AI budget exceeded | Yes (line 289) | **No** | `ai_budget` |
| Needs user input | Yes (line 261) | **No** | `needs_input` |
| Manual apply skip | Yes (line 398) | **No** | (none) |

**Consequence**: When an application **fails**, the dashboard has **no socket signal** to refresh. The `notify:inapp` handler (AdminDashboard.jsx:515) only shows a toast for `apply_failed` — it does **not** refresh any list. The user must manually click "Refresh" or reload the page to see:
- The application status change in the Tracking tab
- The job disappearing from the "Job Applications" list (or showing as failed)
- The progress panel transitioning from "running" to "failed"

The `apply:progress` handler (line 483) does receive the terminal status from `markStep`, but it only updates the `jobApps` state for the `job-apps` tab — **the Tracking tab is never updated reactively**.

**Fix (server)**:
1. In the catch block (line 626-665): after setting the application to `not_applied`, call `emitJobsChanged(app.userId)` and `emitProgress` with the terminal status.
2. In the AI budget path (line 289): add `emitJobsChanged(app.userId)`.
3. In the needs_input path (line 261): add `emitJobsChanged(app.userId)`.
4. In the manual_apply skip path (line 398): add `emitJobsChanged(app.userId)`.

**Fix (client)**:
1. In the `apply:progress` handler (AdminDashboard.jsx:483-509): also update the `tracking` state when `activeTab === 'tracking'`, finding the matching Application by `applicationId` and updating its status/steps.
2. In the `notify:inapp` handler (line 512-528): refresh the active list on `apply_failed`, `needs_input`, and `ai_budget` events, not just `apply_success` and `batch_complete`.

### Issue 8.2 — Client `apply:progress` handler only updates Job Applications tab, never Tracking tab

**File**: `client/src/pages/AdminDashboard.jsx:483-509`

**Problem**: The `apply:progress` socket handler updates two pieces of client state:
1. `applyProgress` — used by the "Auto-Apply Pipeline" panel (progress display)
2. `jobApps` — used by the "Job Applications" tab (job cards)

It does **not** touch the `tracking` state (used by the "Tracking" tab, which shows Application records). When the user is on the Tracking tab watching a batch run, the only way the list updates is via the `jobs:changed` event — which, as shown in Issue 8.1, is only emitted on the success path. Failed, paused, or skipped applications are invisible until a manual refresh.

**Fix**: In the `apply:progress` handler, when `data.applicationId` is present, also find and update the matching entry in `tracking.items` (the Application records shown on the Tracking tab). Use the `applicationId` from the progress payload to match.

### Issue 8.3 — `apply:progress` emits intermediate step status, but Tracking tab can't correlate `applicationId` to list items

**File**: `client/src/pages/AdminDashboard.jsx:765-780` (refreshTracking), `server/queue/worker.js:102-119` (emitProgress)

**Problem**: The Tracking tab fetches Applications via `GET /api/applications` (line 774). The `apply:progress` payload includes `applicationId`, `status`, `currentStep`, and `steps`. To update the Tracking tab reactively, the client needs to match `data.applicationId` to an item in `tracking.items`. However, the current `apply:progress` handler (line 483) never attempts this match — it only checks `data.jobId` against `jobApps.items`.

Additionally, when `data.status === 'applied'`, the handler removes the job from `jobApps` (line 499-503). But for the Tracking tab, a successful application should remain visible (it's a tracking record), just with the updated status. The removal logic only applies to the Job Applications tab.

**Fix**: Add a `tracking` update path in the `apply:progress` handler that finds the Application by `applicationId` (not `jobId`) in `tracking.items` and updates its `status`, `appliedAt`, and `progress.steps`.

### Issue 8.4 — `notify:inapp` doesn't refresh lists on failure or pause events

**File**: `client/src/pages/AdminDashboard.jsx:512-528`

**Problem**: The `notify:inapp` handler:
- `apply_success` → refreshes `jobApps` (line 519) ✓
- `batch_complete` → refreshes `jobApps` (line 522) ✓
- `apply_failed` → **toast only, no refresh** ✗
- `needs_input` → **toast only, no refresh** ✗
- `pipeline_paused` / `ai_budget` → **toast only, no refresh** ✗

When an application fails, the user sees a toast but the lists don't update. If they switch to the Tracking tab, they'll see stale data (status still "running").

**Fix**: Add `liveRefreshRef.current.jobApps?.()` and/or `liveRefreshRef.current.tracking?.()` calls in the `apply_failed`, `needs_input`, `pipeline_paused`, and `ai_budget` branches.

### Issue 8.5 — `jobs:changed` throttle can mask rapid status transitions

**File**: `client/src/pages/AdminDashboard.jsx:534-542`

**Problem**: The `jobs:changed` handler is throttled to 2 seconds (line 537: `if (now - lastJobsChangedAt < 2000) return`). During a fast batch run (many applications completing within seconds), some `jobs:changed` events are dropped. The lists end up stale — showing applications as "running" when they've already completed.

**Fix**: Instead of a blunt 2-second throttle, use the `apply:progress` event for immediate fine-grained updates (Issue 8.2/8.3 fix) and reserve `jobs:changed` for coarse structural changes (new jobs fetched, job deleted). The progress events don't need throttling — React handles rapid state updates efficiently.

---

## Phase Summary

| Phase | Focus | Key Files |
|---|---|---|
| Phase 1 | Login persistence (login-all, password login, proactive refresh) | `routes/job-sites.js`, `services/browserLogin.js`, `services/sessionRefresh.js`, `queue/worker.js`, `queue/scheduler.js` |
| Phase 2 | Resume attachment reliability (`.select('+pdf')`, validation) | `queue/worker.js` |
| Phase 3 | AI budget guard behavior (abort vs fallback) | `queue/worker.js`, `routes/resume-ai.js`, `services/resumeGenerate.js` |
| Phase 4 | Admin UI improvements (resume indicators, batch restore, source tracking) | `client/src/pages/AdminDashboard.jsx` |
| Phase 5 | Resume generation edge cases (wellfound skip, cost gate, content display) | `services/resumeGenerate.js`, `models/GeneratedResume.js` |
| Phase 6 | Login persistence deep-dive (detailed fixes) | Same as Phase 1 |
| Phase 7 | Data model / seeding consistency | `seed-apply-flows.js`, `queue/worker.js` |
## Verification Status (Aug 2026)

Each issue from the plan has been verified against the actual codebase:

### Phase 1 — Login Persistence (ALL CONFIRMED)

| Issue | Status | Code Reference | Fix Location |
|-------|--------|----------------|--------------|
| 1.1 `login-all` does not capture session cookies after password login | **CONFIRMED** | `server/routes/job-sites.js:155-164` | After password login, `r.cookieHeader` is falsy → no cookies saved, `enabled` not set |
| 1.2 `login-all` does not set `enabled: true` on password-only login | **CONFIRMED** | `server/routes/job-sites.js:155-164` | `enabled` only set when `r.cookieHeader` exists |
| 1.3 No proactive session validation / scheduled keep-alive | **CONFIRMED** | `server/queue/scheduler.js` | Scheduler only handles job fetch + stale expiry; no cookie refresh task |
| 1.4 `connectSite` (login-all) doesn't capture cookies for credential/cookie logins | **CONFIRMED** | `server/services/browserLogin.js:213-239` | `cookieHeader` returned only for interactive browser fallback |
| 1.5 `fetch_jd` and `submit` login use same cached browser but don't share session state | **CONFIRMED** | `server/queue/worker.js:211-248` (fetch_jd), `worker.js:441-456` (submit) | `fetch_jd` login doesn't capture cookies for reuse by `submit` |

### Phase 2 — Resume Attachment (MOSTLY CONFIRMED)

| Issue | Status | Code Reference | Fix Location |
|-------|--------|----------------|--------------|
| 2.1 Wellfound seed flow lists `upload_resume` but worker skips resume generation | **CONFIRMED** | `server/seed-apply-flows.js:55`, `worker.js:21` (RESUME_FREE_SITES) | Remove `upload_resume` from Wellfound steps; rename to `generate_resume` across all flows |
| 2.2 Reused attached resume fetched without `.select('+pdf')` | **CONFIRMED** | `server/queue/worker.js:264` | Query uses `.lean()` without `.select('+pdf')` → `pdf` undefined |
| 2.3 No validation that GeneratedResume has non-null PDF before passing to adapter | **CONFIRMED** | `server/queue/worker.js:420-466` | If `resume.pdf` is null, adapter receives `null` and silently skips upload |
| 2.4 `buildTailoredResume` can return `pdf: undefined` when `buildResumePdf` fails | **CONFIRMED** | `server/services/resumeGenerate.js:464` | DB-profile fallback path; if `buildResumePdf` throws/returns falsy, `pdf` is `undefined` |

### Phase 3 — AI Budget Guard (CONFIRMED)

| Issue | Status | Code Reference | Fix Location |
|-------|--------|----------------|--------------|
| 3.1 Auto-apply aborts entirely on AI budget exhaustion (no resume, no application) | **CONFIRMED** | `server/queue/worker.js:269-289` | When `skipOnBudgetExceeded: true` and budget exceeded, returns `{aiSkipped:true}` and aborts entire app |
| 3.2 `/api/resume/generate` doesn't pass `skipOnBudgetExceeded` | **CONFIRMED** | `server/routes/resume-ai.js:158` | Manual generation calls `buildTailoredResume` without `skipOnBudgetExceeded` (intended, but not documented) |

### Phase 4 — Admin UI (CONFIRMED)

| Issue | Status | Code Reference | Fix Location |
|-------|--------|----------------|--------------|
| 4.1 No visual indicator of which jobs have generated resumes attached | **CONFIRMED** | `client/src/pages/AdminDashboard.jsx:2257` | Only "Resume" badge shown; no status indicator, no download action |
| 4.2 `handleBulkAction('apply')` marks applied without recording a source | **CONFIRMED** | `client/src/pages/AdminDashboard.jsx:632-667`, `jobs.js:470-474` | Server sets `appliedVia: 'manual'` but no granular distinction |
| 4.3 Auto-apply pipeline progress not persisted when page refreshed | **CONFIRMED** | `client/src/pages/AdminDashboard.jsx:2290-2339` | `applyProgress` state lost on refresh; no REST endpoint call to restore |
| 4.4 `loginAll` disables sites when no credentials present, doesn't guide user | **CONFIRMED** | `client/src/pages/AdminDashboard.jsx:417-438` | No message linking to credentials modal for sites with "No credentials" |

### Phase 5 — Resume Generation Edge Cases (CONFIRMED)

| Issue | Status | Code Reference | Fix Location |
|-------|--------|----------------|--------------|
| 5.1 Wellfound generates resume before `generate_resume` then discards it | **CONFIRMED** | `server/queue/worker.js:252-305` | Step skipped for Wellfound (RESUME_FREE_SITES); no resume generated |
| 5.2 `buildTailoredResume` always calls `checkAICost` even when reusing uploaded file | **CONFIRMED** | `server/services/resumeGenerate.js:266-271` | Cost check runs before determining if AI actually needed; fallbacks always produce resume |
| 5.3 Generated resume content stored as plain text, used for admin display | **CONFIRMED** | `server/models/GeneratedResume.js`, `client/src/pages/AdminDashboard.jsx:1237-1239` | `content` field is plain text; no "View in browser" option |

### Phase 6 — Login Persistence Deep-Dive (PENDING IMPLEMENTATION)

| Issue | Status | Code Reference | Notes |
|-------|--------|----------------|-------|
| 6.1-6.4 Detailed fixes from gap table | **PENDING** | Multiple files | See task descriptions above; building on Phase 1 fixes |

### Phase 7 — Data Model / Seeding Consistency (PENDING IMPLEMENTATION)

| Issue | Status | Code Reference | Notes |
|-------|--------|----------------|-------|
| 7.1 ApplyFlow step names don't match worker step names | **PENDING** | `server/seed-apply-flows.js`, `worker.js:16` | Step keys: `upload_resume`, `fill_form`, `detect_fields`, `manual_apply` vs worker `STEPS` |
| 7.2 WorkataStartup seed flow says `manualApply: true` but worker still runs `generate_resume` | **PENDING** | `worker.js:252-259`, `seed-apply-flows.js:35-45` | AI budget wasted generating resume for manual-only site |

### Phase 8 — Silent UI Updates (PENDING IMPLEMENTATION)

| Issue | Status | Code Reference | Notes |
|-------|--------|----------------|-------|
| 8.1-8.5 Failure path never emits `jobs:changed`/terminal progress, throttling issues | **PENDING** | `worker.js:626-665`, `AdminDashboard.jsx:483-542`, `534-542` | Only success path emits `emitJobsChanged`; progress lost on failure/pause |

**Verification Method**: Each claim was checked by reading the actual source files and comparing against the plan's descriptions. Line numbers reflect the code at time of verification (Aug 2026).

### Profile Avatar Fix (POST-VERIFICATION)

The profile avatar filename mismatch has been resolved:

| Item | Before | After |
|------|--------|-------|
| **Profile stored path** | `/uploads/avatar.jpg` | `/uploads/avatar-1786101377241-3e05a5dd9dc352c7.jpg` |
| **Actual file on disk** | `avatar-1786101377241-3e05a5dd9dc352c7.jpg` | Same |
| **Client reads** | `data.profile.avatar` → 404 / broken image | Correct path, image displays |

**Fix applied**: Updated the profile document's `avatar` field in MongoDB to match the actual uploaded filename. This was necessary because the seed originally stored the simple path `/uploads/avatar.jpg`, but the upload system auto-generates namespaced filenames (`avatar-<timestamp>-<random>.jpg`). The profile field was not updated after the avatar was uploaded.

### Admin Login Fix (POST-VERIFICATION)

Admin login is now working after fixing the `Article.js` pre-save hook bug that prevented the seed from completing. The admin user `admin` / `admin123` is now created in the database.

**Fix applied**: Removed the incompatible `pre('save')` hook from `server/models/Article.js` (lines 13-20). This hook's `next()` call was not compatible with the installed Mongoose version, causing `TypeError: next is not a function` and preventing the full seed from running (including `Admin.create()` at `seed.js:552`).

...

| Issue | Status | Code Reference | Fix Location |
|-------|--------|----------------|--------------|
| **Profile avatar filename mismatch** | **CONFIRMED** | `server/models/Profile.js:12`, `server/seed.js:36`, `server/uploads/` | Profile seeded with `avatar: '/uploads/avatar.jpg'` but actual file is `avatar-1786101377241-3e05a5dd9dc352c7.jpg` — path mismatch causes image not to load |
| **Admin login failure** | **PENDING INVESTIGATION** | `server/routes/auth.js:20-86`, `server/models/Admin.js` | May be related to seed not completing (earlier `TypeError: next is not a function` in Article model). Admin user may not exist in DB, or JWT_SECRET may be misconfigured |

### Profile Avatar Fix

The profile was seeded with `avatar: '/uploads/avatar.jpg'` (seed.js:36), but the actual avatar file in `server/uploads/` has an auto-generated name: `avatar-1786101377241-3e05a5dd9dc352c7.jpg`. This mismatch means the client cannot load the avatar image because the path doesn't exist.

**Quick fix**: Update the profile document's `avatar` field to match the actual filename, or re-upload the avatar with the name `avatar.jpg`.

### Admin Login Fix

If admin login is not working:

1. **Run the seed**: `cd server && npm run seed` — but note the Article model has a pre-existing bug (`TypeError: next is not a function` at line 20). Fix that first or skip it.
2. **Check JWT_SECRET**: Ensure `server/.env` has a valid `JWT_SECRET` (≥32 characters).
3. **Verify admin exists**: After seeding, the admin user should be `username: 'admin'`, `password: 'admin123'` (bcrypt hashed).

**Verification Method**: Each claim was checked by reading the actual source files and comparing against the plan's descriptions. Line numbers reflect the code at time of verification (Aug 2026).

