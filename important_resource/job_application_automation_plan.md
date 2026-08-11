# Job Application Automation System: Phased Plan

**Goal**: Build a system to fetch, match, and auto-apply to jobs from Naukri, Indeed, and other sites, with AI-driven resume optimization.

**Design Principles**:
- **Single-user only** (you). **Multi-user is NOT planned for now** — will be considered later if needed; the schema is already minimally future-proofed (owner `userId` fields).
- **Modular phases** to avoid scope creep.
- **Reuse existing patterns** (Tailwind, modals, toasts).
- **Secure credential storage** (encrypted in DB).
- **Every application gets a custom, ATS-friendly resume** generated from the JD.
- **Design is simple, modern, and uncluttered** — clean cards, generous spacing, one clear action per view, no dense dashboards or overlapping info.

---

## Phase 1: Job Site Integration & Configuration
### Goals
- Add job sites (Naukri, Indeed) to the admin dashboard.
- Store credentials securely.
- Fetch jobs based on your resume.

### Tasks
#### 1.1 Admin Dashboard UI
- Add a **"Job Sites" tab** to the admin dashboard.
- UI components:
  - Toggle switches to enable/disable sites.
  - "Login" button to open a modal for credentials.
  - Status indicators (e.g., "Connected", "Last fetched: 2h ago").

#### 1.2 Backend
- Extend the `Profile` model to store job site configurations:
  ```javascript
  jobSites: [
    {
      name: { type: String, enum: ["Naukri", "Indeed", "LinkedIn"] },
      enabled: { type: Boolean, default: false },
      credentials: { type: Object, select: false }, // Encrypted
      lastFetched: { type: Date },
    },
  ],
  ```
- Add a `/api/job-sites` endpoint to:
  - Save credentials (encrypted with `bcrypt` or `crypto`).
  - Test connections (e.g., `/api/job-sites/test`).

#### 1.3 Authentication Flow
- For **Naukri/Indeed** (no public API):
  - Use **Puppeteer/Playwright** to log in via a headless browser.
  - Store session cookies/tokens in the `credentials` field.
- For **LinkedIn** (if API available):
  - Use OAuth 2.0 and store tokens.

#### 1.4 Job Fetching
- Add a `/api/jobs/fetch` endpoint.
- For each enabled site:
  - Scrape/search jobs using keywords from your resume (e.g., "Senior Solution Architect", "React", "Node.js").
  - Apply filters (location, salary, experience) from the `Profile` model.
- **Cross-site de-duplication**: a job can appear on Naukri **and** Indeed. Compute a canonical `dedupeKey` = normalized hash of `(title + company + location)` (e.g., `sha256`); only one `Job` doc is kept regardless of how many sites list it. Guard with an index so the same key can never be inserted twice for the same user.
- **Company blocklist**: skip fetching/keeping jobs from companies in the user's blocklist (e.g., current employer, consultancies). Matches by normalized company name.
- Store jobs in a `Job` model:
  ```javascript
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // owner (multi-user)
    title: String,
    company: String,
    location: String,
    salary: String, // raw salary text from listing (optional)
    description: String, // Full JD
    url: String,
    site: { type: String, enum: ["Naukri", "Indeed"] }, // site it originated from
    siteJobId: String, // site's own job id (per-site ref)
    dedupeKey: String, // cross-site dedup: hash(title+company+location)
    postedDate: Date,  // drives the "job age" filter
    lastSeenAt: Date,  // last fetch that included this job (stale tracking)
    matchScore: { type: Number, min: 0, max: 100 }, // Calculated in Phase 2
    applied: { type: Boolean, default: false },
    appliedAt: Date,   // when user applied (system / imported / manual)
    appliedVia: { type: String, enum: ["system", "imported", "manual"] },
    status: { type: String, enum: ["new", "pending", "applied", "passed", "not_applied", "expired"] },
  }
  ```
- **Refresh & expiry**:
  - `GET /api/jobs/fetch` re-runs on demand; also a **scheduled refresh** (e.g., daily via a cron inside the worker process).
  - On each fetch, update `lastSeenAt`. Jobs not seen for N days (configurable, default e.g. 7) are auto-marked `expired` and move out of the active list (kept in DB for records).

### Deliverables
- A "Job Sites" tab in the admin dashboard.
- Ability to enable/disable sites and log in.
- Jobs fetched, cross-site de-duplicated, blocklisted, and stored in the DB.
- Scheduled refresh + auto-expiry of stale postings.

---

## Phase 2: Job Matching & Listing UI
### Goals
- Calculate matching scores for jobs.
- Display jobs as tiles with match percentages.
- Add bulk actions (apply/pass).

### Tasks
#### 2.1 Matching Algorithm
- Add a `/api/jobs/match` endpoint.
- Use **OpenAI/Groq** to:
  - Extract keywords from the JD (e.g., "React", "AWS", "10+ years").
  - Compare against your resume.
  - Calculate a `matchScore` (0–100).
- Store the score in the `Job` model.

#### 2.2 Job Listing UI
- Add a **"Job Applications" tab** to the admin dashboard.
- UI components:
  - **Job tiles**: Grid of cards with:
    - Job title, company, location, posted date.
    - **Circular badge** (top-right) with `matchScore` (e.g., "85%").
    - **Apply** (green) and **Pass** (red) buttons.
    - Checkbox for multi-select.
  - **Bulk actions**:
    - "Apply Selected" and "Pass Selected" buttons (top-right).
  - **Filters**:
    - Site (Naukri/Indeed).
    - Status (new/pending/applied/not_applied/passed/expired).
    - Match score (≥70%).
    - **Job age**: "Last 24h", "Last 3 days", "Last week", "Last 2 weeks", "Any" — uses `postedDate`.
  - **Search** (local, non-blocking): a single search box filters by title / company / keyword.
  - **Pagination**: **server-side pagination** (e.g., 20 per page) with page controls; required because listings can hold hundreds of jobs.
  - **Blocklist access**: a link/button in this tab opens the company blocklist editor (Phase 2.4).

#### 2.3 Job Detail Panel
- Clicking a job tile opens a **side panel** (left/right) with:
  - Full JD (rendered with `react-markdown`).
  - **AI match breakdown**: matched keywords (highlighted) + missing keywords the resume lacks, and why the score is what it is. Updates with re-match.
  - **AI-generated resume preview** (optimized for this JD).
  - **Apply** button (triggers Phase 3).

#### 2.4 Company Blocklist
- New small blocklist editor (can live in the Job Sites tab or a Settings panel):
  - Add/remove company names (e.g., `Wipro`, `TCS`) with optional note ("consultancy", "current employer").
  - Toggle to **hide** or **hard-exclude** blocklisted companies from fetching.
  - Stored per user in the `Profile`/`UserSettings` doc:
    ```javascript
    blocklist: [
      { name: String, note: String, addedAt: Date },
    ]
    ```

### Deliverables
- Job tiles with match scores.
- Bulk apply/pass functionality.
- Side panel with JD + match breakdown + resume preview.
- Search + server-side pagination + filters (incl. job age).
- Company blocklist editor.

---

## Phase 3: Auto-Apply System
### Goals
- Auto-apply to jobs with dynamic resumes.
- Handle site-specific prompts (e.g., additional forms).

### Tasks
#### 3.1 Dynamic Resume Generation
- Add a `/api/resume/generate` endpoint.
- For each job:
  - Use **OpenAI/Groq** to generate a custom resume:
    - Base resume (from `Profile` or `Resume` model).
    - **Base resume variants**: user can maintain multiple base resumes and pick one per apply (e.g., "Solution Architect" vs "Hands-on Dev/Lead"), or let AI auto-select the best match for the JD. Stored as a list in `Profile`.
    - Keywords from the JD (extracted in Phase 2.1).
    - ATS-friendly formatting (e.g., bullet points, skills section).
  - Store generated resumes in a `GeneratedResume` model:
    ```javascript
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // owner
      jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
      applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application" }, // tie to the application
      content: String, // Markdown or text
      pdf: Buffer, // Optional: PDF version
      pdfFilename: String, // e.g. "Senior-React-Developer_Google_resume.pdf"
      coverLetter: String, // Optional
      baseTemplateId: String, // which base resume variant was used
      jdUsed: String, // snapshot of the JD this resume was built from (record)
      keywordsMatched: [String], // keywords used for this resume
      costBucket: String, // AI budget accounting: which day/week this counts against
      createdAt: { type: Date, default: Date.now },
    }
    ```

#### 3.2 Auto-Apply Workflow
- Add a `/api/jobs/apply` endpoint.
- For each job:
  1. **Check for additional forms**:
     - Use Puppeteer to detect prompts (e.g., "Years of experience in React?").
     - If forms exist, pause and show a modal:
       - Pre-fill with an **AI-generated answer** (OpenAI/Groq).
       - Let the user edit before submitting.
  2. **Submit the application**:
     - Upload the generated resume.
     - Fill in standard fields (name, email) from `Profile`.
     - Handle CAPTCHAs (if possible) or pause for user input.
  3. **Update status**:
     - Mark the job as `applied` in the `Job` model.
     - If the job could **not** be applied for any reason, set status to `not_applied` with a `notAppliedReason` (e.g., job expired, login failed, site error, blocked/CAPTCHA, missing required info). It stays visible in Tracking with the reason and can be retried later.
     - Log the application in an `Application` model:
       ```javascript
       {
         jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
         site: String,
         resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "GeneratedResume" },
         appliedAt: Date,
         status: { type: String, enum: ["applied", "pending", "failed", "passed", "not_applied"] },
         notAppliedReason: String,
         lastAction: String,
         timeline: [...],
       }
       ```

#### 3.3 Async, Non-Blocking Apply Pipeline (Background Jobs)
- **Principle**: every long-running operation (AI resume generation, scraping a JD, submitting an application) runs in a **worker queue**, never in the HTTP request. API calls return immediately; the client polls or receives live progress via Socket.io.
- **Queue**: **Bull + Redis** (`applyQueue`). Each job enqueued as a Bull job with an `applicationId`.
- **Worker chain** (each step emits progress):
  1. `fetch_jd` — pull full JD for the job.
  2. `generate_resume` — AI builds the JD-optimized resume (streams progress "Preparing resume…").
  3. `prepare_application` — stage resume + profile fields.
  4. `submit` — Puppeteer-driven submit on the site (may pause → `waiting_user`).
- **Queue statuses**: `queued` → `running` → `done` | `failed` | `waiting_user` | `canceled`.
- **Concurrency & limits**: per-site concurrency (e.g., 1 active per site), retries with exponential backoff (3 attempts), configurable per-site rate delay to avoid blocks.
- **Max applications per batch**: user-set cap (e.g., "apply max 20 per run"); when the cap is reached the queue stops enqueuing the remaining selection (they stay `queued`/unselected with a note).
- **AI cost guard**: configurable daily/weekly cap on AI generations (resume/cover-letter/match calls). When the cap is hit, the pipeline pauses generation steps and flags the batch for review — prevents surprise OpenAI API spend.
- **Non-blocking API surface**:
  - `POST /api/jobs/apply` — enqueues bulk-selected jobs, returns immediately with a `batchId` (200 OK, no waiting).
  - `GET /api/jobs/apply/batch/:batchId` — aggregate progress of a batch.
  - `GET /api/applications/:id/progress` — per-application progress (steps + current state).
  - `POST /api/applications/:id/cancel` — cancel a queued/running application.
  - `POST /api/jobs/apply/batch/:batchId/cancel` — **cancel the entire batch** (all queued/running applications in it).
  - `POST /api/pipeline/pause` / `POST /api/pipeline/resume` — **master pause/kill-switch**: one toggle the user can flip to stop the whole pipeline (accepting new work) while bulk actions wait; running submits drain gracefully, then nothing new starts.
  - **Socket.io** events pushed live to the admin UI: `apply:progress` (step updates), `apply:status` (status changes), `apply:done`, `apply:failed`, `apply:need_input`, `batch:canceled`, `pipeline:paused`, `pipeline:resumed`.
- **Crash safety**: workers are idempotent; a step that crashes is retried from the last completed step; queue is Redis-backed so restarts resume safely.

#### 3.4 Live Apply Progress Listing (What's Happening Behind the Apply)
- A **"Progress" view/panel** in the admin that shows, per application, exactly what the system is doing right now:
  - Step list with live checkmarks/spinners:
    ```
    ● Fetching JD from Naukri …          done
    ● Preparing ATS-friendly resume …    running (match score target 92%)
    ● Filling standard profile fields …  queued
    ● Submitting application …           queued
    ```
  - Each step shows status (queued / running / done / failed / waiting), started + finished timestamps, and error details on failure.
  - Updates arrive via Socket.io in real time; also persisted in `Application.progress.steps` so the UI can re-render from DB on refresh.
- Batch view: when multiple jobs are selected, show one consolidated queue list (position in queue, per-job progress bar).

#### 3.5 Resume Saved as Record With the Application
- Every applied job **automatically persists its generated resume** (`GeneratedResume` linked via `applicationId` + `jobId`) — part of the `generate_resume` step.
- The saved record includes a JD snapshot (`jdUsed`) and the matched keywords used, so it is a complete audit of what was submitted.
- Available for **viewing** (side panel "View Resume", or a dedicated "Resumes" section) and **downloading** (the generated PDF).
- User can **delete** any saved resume later (soft-delete; the Application/Job record and applied status remain intact).

### Deliverables
- Auto-apply functionality with dynamic resumes.
- Handling of site-specific prompts.
- Application status tracking.
- **Async, non-blocking apply pipeline** (Bull/Redis workers) with crash-safe retries.
- **Live progress view** of every behind-the-scenes step (fetch JD → prepare resume → submit).
- **Every generated resume saved with its applied job** — viewable, downloadable, and deletable.
- **Master pause/kill-switch** and **batch cancel-all** for full control.
- **Max applications per batch** cap and **AI cost guard** to control spend.
- **Multi base-resume templates** per user.

---

## Phase 4: AI Features
### Goals
- Enhance resumes with AI for better ATS compatibility.
- Generate cover letters.

### Tasks
#### 4.1 Keyword Optimization
- Add a `/api/resume/optimize` endpoint.
- Extract keywords from the JD and suggest additions to the user:
  - Example: "Add 'TypeScript' and 'AWS Lambda' to improve match score."

#### 4.2 Cover Letter Generation
- Add a "Generate Cover Letter" button to the job detail panel.
- Use OpenAI/Groq to generate a cover letter based on the JD and resume.
- Store cover letters in the `GeneratedResume` model.

#### 4.3 ATS-Friendly Formatting
- Ensure generated resumes follow ATS best practices:
  - Simple formatting (no tables, columns, or images).
  - Keyword-rich skills section.
  - Standard headings (e.g., "Work Experience", "Education").
- Use a template (e.g., JSON → PDF with `pdf-lib`).

### Deliverables
- AI-generated resumes and cover letters.
- Keyword suggestions for manual edits.
- Every generated resume **persisted, viewable, downloadable, and deletable** alongside its applied job.

---

## Phase 5: Application Tracking & Status Management
### Goals
- Track the status of all applications (applied, pending, failed, passed).
- Show pending actions (e.g., "Fill additional details for Job X").
- Provide a timeline of events for each application.
- **Track jobs already applied to** (either before this system existed or applied manually on the site), so they are not re-applied and appear in the Tracking tab.

### Tasks
#### 5.1 Tracking Page UI
- Add a **"Tracking" tab** to the admin dashboard.
- UI components:
  - **Card/list view** of all applications with essential info:
    - Job title, company, site, status, applied date, last action.
  - **Status badges**:
    - `Applied` (green): Successfully submitted.
    - `Pending` (amber): Awaiting user input (e.g., additional form).
    - `Failed` (red): Application failed (e.g., CAPTCHA, rate limit) — retryable.
    - `Passed` (gray): User marked as "not interested".
    - `Not Applied` (blue/neutral): Job was **not** applied for a reason — shows the reason (job expired, login failed, site error, blocked/CAPTCHA, missing info, manual skip). Retryable where relevant.
  - **Filters**:
    - Status (Applied, Pending, Failed, Passed, Not Applied).
    - Site (Naukri, Indeed, etc.).
    - Date range.
  - **Timeline** for each application:
    - Events like "Application submitted", "Resume generated", "Needs more info", "Applied successfully", "Not applied — reason".

#### 5.2 Backend
- Extend the `Application` model:
  ```javascript
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
    site: String,
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "GeneratedResume" },
    batchId: String, // group of bulk-applied jobs
    appliedAt: Date,
    status: {
      type: String,
      enum: ["queued", "running", "applied", "pending", "failed", "passed", "canceled", "not_applied"],
      default: "queued",
    },
    notAppliedReason: { type: String }, // e.g., "job_expired", "login_failed", "blocked_or_captcha"
    lastAction: { type: String }, // e.g., "Needs more info: Years of experience in React"
    timeline: [
      {
        event: String, // e.g., "Application submitted", "Resume generated"
        timestamp: Date,
        details: String, // Optional: error messages, form fields needed
      },
    ],
    progress: {
      currentStep: String, // e.g., "generate_resume"
      steps: [
        {
          key: String, // fetch_jd | generate_resume | prepare_application | submit
          label: String,
          status: { type: String, enum: ["queued", "running", "done", "failed", "waiting"], default: "queued" },
          startedAt: Date,
          finishedAt: Date,
          error: String, // details on failure
        },
      ],
      attempts: { type: Number, default: 0 },
    },
  }
  ```
- Add a `/api/applications` endpoint to:
  - Fetch applications with filters.
  - Update status (e.g., `pending` → `applied` after user fills additional info).
  - Return `progress` + `timeline` for the live view.

#### 5.3 Handling Pending Actions
- For jobs with `status: "pending"`:
  - Show a modal when the user clicks the job in the Tracking tab:
    - Pre-fill **AI-generated answers** for missing fields (e.g., "Why do you want this job?").
    - Let the user edit before resubmitting.
  - Update the `timeline` with the new event (e.g., "User filled additional details").

#### 5.4 Retry Failed Applications
- For jobs with `status: "failed"`:
  - Show an error message (e.g., "CAPTCHA required" or "Rate limit exceeded").
  - Add a **"Retry"** button to requeue the application.

#### 5.5 Already-Applied Jobs (Prevent Re-Applying)
- Capture jobs the user has **already applied to** so the system:
  - Never offers "Apply" again on them (shows "Applied" state instead).
  - Keeps them visible in the Tracking tab alongside system-applied jobs.
- Sources:
  - **Imported from site**: On first connect, scrape the site's "Applied / My Applications" pages and import those jobs (marked `applied` with `appliedAt` from the site).
  - **Manual mark**: User can open any job tile and click "Mark as applied" (e.g., if they applied directly on the site).
  - **Auto-detected**: During job fetch, if the scrape indicates the user already applied (site shows "Applied" button instead of "Apply"), set `applied: true`.
- De-duplication: match imported/already-applied jobs to fetched jobs by `site` + job URL or unique site job id, so a job is never duplicated or re-applied.

#### 5.6 Not-Applied Jobs (With Reason)
- Whenever an apply attempt does not result in a submission, the application is recorded as `not_applied` **with a reason** — never silently dropped.
- Auto-set reasons (from the worker):
  - `job_expired` — posting closed / no longer accepting applications.
  - `login_failed` — could not log into the site.
  - `site_error` — site returned an error or temporary failure.
  - `blocked_or_captcha` — site blocked the bot or CAPTCHA could not be solved.
  - `missing_info` — required form info was unavailable (defer to `pending` if the info can be collected from the user).
- User-set reasons (manual, from the tile/Tracking):
  - `location_mismatch` — remote/relocation mismatch.
  - `salary_mismatch` — salary below preference.
  - `manual_skip` — not interested (equivalent to Pass).
- UX:
  - Not-applied jobs remain visible in Tracking with a blue "Not Applied" badge and the reason.
  - For retryable reasons (`job_expired` is final; others retryable) the card shows a **"Retry"** action that re-enqueues the apply.
  - The reason is appended to the `timeline` and shown in the job detail panel too (`lastAction`).

### Deliverables
- A **"Tracking" tab** in the admin dashboard.
- Status badges and timelines for all applications.
- Handling of pending actions and retries.
- Already-applied jobs imported/marked and excluded from apply, tracked with their applied dates.
- **Not-applied jobs recorded with a reason**, shown in Tracking, and retryable where applicable.

---

## Phase 6: Multi-User Future-Proofing — NOT PLANNED (do later if needed)
### Status
- **Explicitly out of scope for now.** Single-user only.
- Minimal future-proofing already done (owner `userId` fields on every model, per-user site configs). Full multi-user hardening (roles, ownership scoping, per-user isolation, admin-vs-user gating) will only be considered if a multi-user need actually arises later.
- Revisit by searching this plan for "multi-user".

### Goals
- Prepare the system for multiple users (in future, anyone can log in, add job sites, and use their own credentials).
- Ensure secure credential storage.

### Tasks
#### 6.1 User-Specific Data
- Move job site configurations from `Profile` to a new `UserJobSite` model:
  ```javascript
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, enum: ["Naukri", "Indeed"] },
    enabled: { type: Boolean, default: false },
    credentials: { type: Object, select: false },
  }
  ```
- Scope all jobs, generated resumes, and applications to `userId`.
- Update all endpoints to use `userId` (e.g., `/api/jobs/fetch?userId=...`).

#### 6.2 Role-Based Access
- Extend the `Admin` model to include roles:
  ```javascript
  role: { type: String, enum: ["admin", "user"], default: "user" },
  ```
- Restrict access to:
  - Job site configuration (admin only).
  - Bulk actions (e.g., "Apply Selected").

#### 6.3 Credential Security
- Encrypt credentials in the DB (e.g., `bcrypt` or `crypto`).
- For OAuth-based sites (e.g., LinkedIn), use refresh tokens.

### Deliverables
- Multi-user support.
- Secure credential storage.
- Self-service flow: user adds sites → logs in with their credentials → fetches and applies to jobs.

---

## Phase 7: Notifications
### Goals
- Keep the user informed of apply progress without watching the screen.
- Surface jobs that are stuck waiting for input.

### Tasks
#### 7.1 In-App (Toast/Badge) Notifications
- Toast on: apply batch finished, per-job apply success / failed / not applied, pipeline paused (auto or manual), AI budget reached.
- Sidebar/notification badge count for `waiting_user` items that need input.

#### 7.2 Email Notifications (Reuse existing Nodemailer / EMAIL_USER)
- Opt-in email alerts via existing SMTP config:
  - Batch apply complete summary (N applied, X failed, Y need input).
  - Job waiting for input ("Complete details for <Job> at <Company>").
  - Application failed with reason (CAPTCHA / login / expiring).
- Rate-limited; digest mode (e.g., daily summary) optional to avoid email spam.

### Deliverables
- Toast + badge notifications for pipeline events.
- Optional email notifications for batch completion, pending input, and failures.

---

## Tech Stack
| Component          | Technology                          | Notes                                  |
|--------------------|-------------------------------------|----------------------------------------|
| Scraping           | Puppeteer/Playwright                | For Naukri/Indeed.                     |
| APIs               | Axios                               | For LinkedIn (if available).           |
| Background Jobs    | Bull + Redis                        | Async apply pipeline, retries, backoff.|
| Real-time Progress | Socket.io (existing)                | Live step updates to admin UI.         |
| AI                 | OpenAI/Groq                         | Resume generation, keyword matching.   |
| PDF Generation     | pdf-lib or similar                  | Convert text resumes to PDF.           |
| Encryption         | crypto (AES-256-GCM) + bcrypt       | Encrypt site credentials at rest.      |
| UI                 | React + Tailwind                    | Reuse existing patterns.               |

---

## Configuration (Env Vars) — New
Add to `.env.example` / `config/env.js`:
| Variable | Purpose |
| --- | --- |
| `JOB_CREDENTIALS_KEY` | Encryption key (AES-256-GCM) for stored site credentials |
| `REDIS_URL` | Bull queue / Redis connection string |
| `JOB_FETCH_SCHEDULE` | Cron for scheduled refresh (e.g., `0 9 * * *`) |
| `JOB_STALE_DAYS` | Default stale-job expiry (days), overridable per user |
| `JOB_AI_DAILY_BUDGET` | Default AI-generation daily cap (per user) |
| `JOB_NOTIFY_FROM` | From address for apply notifications (falls back to EMAIL_USER) |

---

## Security (Job Automation System)

### Credential & Session Handling
- **Encrypt stored site credentials** at rest (`crypto` AES-256-GCM with a key from env `JOB_CREDENTIALS_KEY`; `select: false` on the schema so they never return to the client).
- **Never return credentials** in any API response; only return masked state (e.g., `connected: true`).
- Browser sessions for scraping are **kept isolated per user/site**; session cookies stored encrypted and scoped to that user.
- **Prompt-injection hardening** on JD text and AI resume prompts (reuse `sanitizeForAI`): strip instructions like "ignore previous instructions" before sending to OpenAI/Groq.
- Do not log credentials, session tokens, or full JD text with PII; redact emails/phones in logs (reuse `redactEmail`).

### Access Control
- All apply/fetch/progress endpoints behind **JWT auth** (`authMiddleware`).
- **Ownership checks**: every job/application/resume query is scoped to the authenticated user's `userId` — never fetch by id alone (prevents IDOR).
- Multi-user: role gate `admin` vs `user`; only the owner can trigger apply on their jobs (CSRF-protected via existing `x-csrf-token` flow).
- Socket.io progress events require the authenticated JWT; listeners only receive their own `applicationId`/`batchId`.

### Rate Limiting & Abuse Protection
- Reuse existing rate limiter for the new API surface:
  - `applyLimiter` (e.g., 5 apply requests / min) and `fetchLimiter` (e.g., 10 fetches / 15 min) per user.
- **Per-site throttling** in the worker (delay between submits) to avoid account blocks.
- Requeue/retry only from the worker with backoff; no client-driven retry storm.

### Data Safety
- **Never auto-apply without explicit user intent** — bulk apply requires a confirmation step.
- Sanitize/validate all input fields (site names, job ids, batch ids) against whitelists.
- Idempotency: guard so the same `(site, siteJobId, userId)` can never enqueue a duplicate application.
- Audit trail via the existing `Activity` model (apply started / applied / failed, no secrets).
- **Resume deletion safety**: resume delete is soft-delete and ownership-scoped; a deleted resume never touches the Application/Job record or applied status.
- **AI budget guard**: enforced in the worker before any generation step — daily/weekly caps from `UserSettings`; hitting the cap pauses generation and notifies, never silently exceeding budget.
- **Cross-site dedupe safety**: `dedupeKey` is user-scoped + indexed with a unique index; a malformed/duplicate insert is rejected, preventing double-applying the same role via two sites.
- **Master pause**: when `pipelinePaused` is set, `POST /api/jobs/apply` returns `409` with a clear message; only drain of already-running submits is allowed.
- **Notification safety**: email alerts contain no credentials and never include full JD text or PII beyond the job title/company.

---

## Data Models
### Job
```javascript
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // owner
  title: String,
  company: String,
  location: String,
  salary: String, // optional raw text
  description: String,
  url: String,
  site: { type: String, enum: ["Naukri", "Indeed"] },
  siteJobId: String,
  dedupeKey: String, // hash(title+company+location) — cross-site dedup
  postedDate: Date,
  lastSeenAt: Date, // stale tracking → expiry
  matchScore: Number,
  matchedKeywords: [String], // from match breakdown (Phase 2)
  missingKeywords: [String],
  applied: { type: Boolean, default: false },
  appliedAt: Date,
  appliedVia: { type: String, enum: ["system", "imported", "manual"] },
  status: { type: String, enum: ["new", "pending", "applied", "passed", "not_applied", "expired"] },
}
```

### UserJobSite (Multi-User)
```javascript
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: { type: String, enum: ["Naukri", "Indeed"] },
  enabled: { type: Boolean, default: false },
  credentials: { type: Object, select: false },
}
```

### UserSettings (Per-User Toggles/Limits)
```javascript
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
  blocklist: [
    { name: String, note: String, addedAt: { type: Date, default: Date.now } },
  ],
  maxApplyPerBatch: { type: Number, default: 20 },
  aiDailyBudget: { type: Number, default: 100 }, // AI generation calls per day
  aiWeeklyBudget: { type: Number, default: 500 },
  expireAfterDays: { type: Number, default: 7 }, // stale job expiry
  notifyEmail: { type: Boolean, default: false },
  notifyDigest: { type: String, enum: ["none", "instant", "daily"], default: "instant" },
  pipelinePaused: { type: Boolean, default: false }, // master kill-switch
  baseResumeTemplates: [String], // ids of base resume variants
}
```

### GeneratedResume (Persistent Record, Viewable & Deletable)
```javascript
{
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // owner (multi-user)
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
  applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application" }, // tie to the application
  content: String, // Markdown/text
  pdf: Buffer, // Optional (for viewing/downloading)
  pdfFilename: String, // e.g. "Senior-React-Developer_Google_resume.pdf"
  coverLetter: String, // Optional
  baseTemplateId: String, // which base resume variant was used
  jdUsed: String, // snapshot of the JD this resume was built from (record)
  keywordsMatched: [String], // keywords used for this resume
  costBucket: String, // AI budget accounting (day/week this counts against)
  createdAt: { type: Date, default: Date.now },
}
```
- **Saved automatically for every applied job** as part of the apply pipeline (step `generate_resume`).
- **Viewable**: shown in the application's side panel ("View Resume") and in a dedicated "Resumes" section; render from `content` or download the `pdf`.
- **Deletable**: user can delete any generated resume (soft-delete by default, hard-delete option); deleting removes it from the record but never affects the applied status.
- **Retention note**: deleting a generated resume does **not** delete the `Application`/`Job` record; only removes the resume artifact (or links it as "resume removed").

### Application
```javascript
{
  jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
  site: String,
  resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "GeneratedResume" },
  batchId: String,
  appliedAt: Date,
  status: {
    type: String,
    enum: ["queued", "running", "applied", "pending", "failed", "passed", "canceled", "not_applied"],
  },
  notAppliedReason: {
    type: String,
    enum: [
      "job_expired",       // posting closed / no longer accepting applications
      "login_failed",      // could not log into the site
      "site_error",        // site error or temporary failure
      "missing_info",      // required info unavailable to fill the form
      "location_mismatch", // remote/relocation mismatch detected
      "salary_mismatch",   // salary range below preference
      "blocked_or_captcha",// site blocked or CAPTCHA could not be solved
      "manual_skip",       // user chose not to apply
      "other",
    ],
  },
  lastAction: String,
  timeline: [{ event: String, timestamp: Date, details: String }],
  progress: {
    currentStep: String,
    steps: [
      {
        key: String, // fetch_jd | generate_resume | prepare_application | submit
        label: String,
        status: { type: String, enum: ["queued", "running", "done", "failed", "waiting"] },
        startedAt: Date,
        finishedAt: Date,
        error: String,
      },
    ],
    attempts: { type: Number, default: 0 },
  },
}
```

---

## UI/UX

### Design Style (Simple, Modern, Uncluttered)
- **Clean layout**: one focus per screen; grid of uniform cards with consistent sizing; generous whitespace (gap-4/gap-6).
- **Card-driven**: each job = a single simple card (title, company, location, posted date, match badge). No extra chips, icons, or buttons crammed on a card.
- **Match score**: one small circular badge, top-right, subtle color only (emerald/blue/amber/red).
- **Actions kept minimal**: each card shows at most **Apply** and **Pass**; bulk actions live only in the top toolbar (not on cards).
- **Detail view**: single side panel (drawer) with JD + resume preview + Apply. One panel at a time.
- **Filters**: compact single row of dropdowns/pills; collapsed by default to avoid clutter.
- **Status signals**: small colored dot/badge (Applied green, Pending amber, Failed red, Not Applied blue, Passed gray) — no long status text.
- **Modern touches**: subtle borders (`border-gray-200`/`border-gray-700`), rounded-2xl cards, soft shadows, hover elevation. Reuse the existing dark/light theme.
- **No clutter**: no tables with many columns on the main list (Tracking tab uses a clean minimal table or card list, only essential columns).

### Job Sites Tab
```
[Toggle: Naukri □] [Login] [Configure]
[Toggle: Indeed □] [Login] [Configure]
```
- Clicking "Login" opens a modal to enter credentials.

### Job Applications Tab
```
[⏸ Pause Pipeline] [Select All] [Apply Selected] [Pass Selected]  [Blocklist]
[Search: ______]  [Filters: Site ▾] [Status ▾] [Match ≥70% ▾] [Posted: Last week ▾]

[Job Tile 1] [Job Tile 2] [Job Tile 3]
- Title: Senior React Developer
- Company: Google
- Location: Remote
- Posted: 2d ago
- [85%] [Apply] [Pass] [Checkbox]

[Job Tile 4]
- Title: Solution Architect
- Company: Amazon
- Location: Bangalore
- Posted: 1d ago
- [92%] [Apply] [Pass] [Checkbox]

[‹ Prev] Page 2 of 14 [Next ›]
```
- Clicking a tile opens a side panel with JD + match breakdown + resume preview + "Apply" button.
- Already-applied jobs show an "Applied" badge (with `appliedAt`/`appliedVia`) instead of Apply/Pass.
- **Posted** filter options: Last 24h / Last 3 days / Last week / Last 2 weeks / Any.
- **Search** filters live by title/company/keyword; pagination is server-side (20/page).
- **Pause Pipeline** flips the master kill-switch; while paused, Apply buttons are disabled with a note.

### Company Blocklist Modal
```
[Add Company]
[Company name: ______] [Note (optional): ______] [Add]

[Wipro — consultancy] [Remove]
[TCS — current employer] [Remove]
[Toggle: Hide blocklisted jobs from list]
```

### Batch Progress View (Cancel + Caps)
```
Batch #412 — Applying to 20 selected jobs
[Max per batch: 20] [Applied: 12] [Failed: 2] [Need info: 1] [Remaining: 5]
[Cancel Entire Batch] [⏸ Pause Pipeline]
[Job A — ● Running (Preparing resume…)]
[Job B — ● Applied]
[Job C — ● Not applied — blocked/CAPTCHA]
```

### Side Panel
```
[Job Title: Senior React Developer]
[Company: Google]
[Location: Remote] [Salary: ₹20-30L] [Posted: 2d ago]

[Match: 85%]
[✓ React, Node.js, AWS, TypeScript, CI/CD]   (matched)
[✗ Kubernetes, Terraform, Kafka]             (missing)

[Job Description]
- Full JD rendered with react-markdown.

[AI-Generated Resume Preview]
- Optimized for this JD (template: Solution Architect).

[Apply] [Generate Cover Letter]
```

### Apply Progress View (Live, Behind the Scenes)
- After clicking Apply, the tile/panel switches to a **live progress view** without blocking the UI:
```
[Senior React Developer · Google · Naukri]
● Fetching JD from Naukri …                    done    10:00:01
● Preparing ATS-friendly resume (target 92%)    running …
● Filling standard profile fields              queued
● Submitting application                       queued
```
- Updates stream in real time via Socket.io; on refresh they load from the persisted `Application.progress`.
- Batch view shows a queue list: position in queue + per-job mini progress bars.
- `waiting_user` steps surface a "Needs info" action (see Pending Action Modal) instead of failing.

### Saved Resumes (Record With Each Applied Job)
- Every applied job keeps its generated resume; accessible from the application's side panel **"View Resume"** and a dedicated **"Resumes"** section:
```
[Senior React Developer_Google_resume.pdf]
Senior React Developer · Google · Naukri · Applied 2026-08-08
[View] [Download] [Delete]

[Solution Architect_Amazon_resume.pdf]
Solution Architect · Amazon · Indeed · Applied 2026-07-20
[View] [Download] [Delete]
```
- View renders the resume content (or opens the PDF) with the matched keywords highlighted; Download gets the PDF; Delete removes the resume record (soft-delete) while keeping the application intact.
- Backend endpoints:
  - `GET /api/resumes` — list my saved resumes (filtered by user/job/site/date).
  - `GET /api/resumes/:id` — view one (content or PDF file).
  - `GET /api/resumes/:id/download` — download PDF.
  - `DELETE /api/resumes/:id` — delete (soft-delete by default).
  - All ownership-scoped to the authenticated user.



### Tracking Tab (Card/List View)
- Clean list of application cards with only essential info:
```
[Senior React Developer · Google · Naukri]
[● Applied 2026-08-08] [Open]

[Solution Architect · Amazon · Indeed]
[● Applied 2026-07-20] [Open]

[Cloud Engineer · IBM · Naukri]
[● Pending — needs info] [Open]

[DevOps Lead · Oracle · Indeed]
[● Failed — CAPTCHA] [Retry]

[Backend Engineer · Flipkart · Naukri]
[● Not applied — job expired] [View]

[Data Engineer · Netflix · Indeed]
[● Not applied — blocked/CAPTCHA] [Retry]
```
- Each card: job title + company + site, one small status dot, one primary action (Open/Retry).
- Filters: Status (incl. "Not Applied"), Site, Applied Via (system/imported/manual), date range.
- Already-applied jobs (imported/manual) are shown here and never re-apply-able.
- Not-applied jobs show their reason on the card and in the detail panel; retryable ones offer a "Retry" action.

### Timeline for a Job
```
[Job: Senior React Developer at Google]
- 2026-08-08 10:00 AM: Application submitted
- 2026-08-08 10:01 AM: Resume generated (match score: 85%)
- 2026-08-08 10:02 AM: Applied successfully
```

### Pending Action Modal
```
[Job: Solution Architect at Amazon]
This job requires additional information:

[Form Field: Years of experience in AWS]
> 5 (AI-generated answer)

[Form Field: Why do you want this job?]
> As a Senior Solution Architect with 18+ years of experience... (AI-generated)

[Submit] [Cancel]
```

---

## Tradeoffs & Open Questions
1. **Scraping vs. APIs**:
   - Scraping (Puppeteer) is fragile but works for all sites.
   - APIs are stable but may not be available (e.g., Naukri/Indeed).
   - **Recommendation**: Start with Puppeteer for Naukri/Indeed; use APIs for LinkedIn if available.

2. **Credential Storage**:
   - Encrypted in DB (simpler) or OAuth tokens (more secure).
   - **Recommendation**: Encrypted DB storage for MVP; OAuth later.

3. **AI Features**:
   - Enable by default (better UX) or opt-in (lower cost).
   - **Recommendation**: Opt-in to avoid OpenAI/Groq API costs.

4. **Multi-Select vs. Single Apply**:
   - Multi-select is faster but riskier (e.g., applying to 10 jobs at once).
   - **Recommendation**: Start with single-apply; add multi-select later.

5. **ATS Resume Formatting**:
   - Use a template (e.g., JSON → PDF with `pdf-lib`).
   - **Recommendation**: Start with text-based resumes (easier to generate).

6. **Tracking Granularity**:
   - Should the timeline include **every event** (e.g., "Resume generated", "Form submitted") or only **key milestones** (e.g., "Applied successfully")?
   - **Recommendation**: Start with key milestones; add granularity later.

7. **Retry Logic**:
   - Should failed applications **auto-retry** (e.g., after 1 hour) or require **manual retry**?
   - **Recommendation**: Manual retry for MVP (avoid rate limits).

8. **Notifications**:
   - Should the system notify you (e.g., email/toast) when a job requires action?
   - **Recommendation**: Add toast notifications for pending actions.

9. **Data Retention**:
   - Should old applications (e.g., >6 months) be **archived** or **deleted**?
   - **Recommendation**: Archive by default; add a "Delete" button for users.

10. **Already-Applied Tracking**:
    - Scraping "My Applications" pages may be blocked or slow on some sites.
    - **Recommendation**: Import best-effort + rely on manual "Mark as applied" + auto-detect "Applied" state during fetch as fallbacks.

11. **Job Age Filter Source**:
    - `postedDate` comes from the site's listing; some sites show relative dates ("2 days ago") only.
    - **Recommendation**: Store a normalized `postedDate` (best-effort parse); jobs with no date default to "Any" bucket.

12. **Scraping reliability vs. law/ToS**:
    - Auto-fetching and auto-applying on third-party sites (Naukri, Indeed) may violate their Terms of Service.
    - **Recommendation**: Personal-use only, honor per-site throttling/rate delay, and never bypass CAPTCHAs — mark `blocked_or_captcha` instead.

13. **AI cost control**:
    - Resume/cover-letter generation per apply multiplies OpenAI/Groq spend.
    - **Recommendation**: Enforce the daily/weekly AI budget guard from `UserSettings`; expose a "match-only" mode (no generation) for cheap triage.

14. **Cross-site dedupe accuracy**:
    - `title+company+location` hashes can collide when sites phrase titles differently.
    - **Recommendation**: Normalize casing/whitespace + use Jaccard-similarity fallback; keep `siteJobId` for per-site uniqueness.

15. **Scheduled refresh vs. rate limits**:
    - Frequent re-fetching can trigger site blocks.
    - **Recommendation**: Daily schedule by default; `lastSeenAt` + stale expiry (`JOB_STALE_DAYS`) keeps data fresh without hammering sites.

---

## Next Steps

### Dev Phase Breakdown (Build Order)
- **Dev Phase 0 — Foundations** ✅ **COMPLETED**:
  - Env/config added: `REDIS_URL`, `JOB_CREDENTIALS_KEY`, `JOB_FETCH_SCHEDULE`, `JOB_STALE_DAYS`, `JOB_AI_DAILY_BUDGET`, `JOB_AI_WEEKLY_BUDGET`, `JOB_NOTIFY_FROM` (`server/config/env.js` + `.env.example`).
  - Models created: `Job`, `Application`, `GeneratedResume`, `UserSettings`, `UserJobSite` (`server/models/`).
  - Queue infrastructure: `server/queue/index.js` (Bull + Redis, in-memory fallback if Redis unreachable) and `server/queue/worker.js` (4-step apply pipeline `fetch_jd → generate_resume → prepare_application → submit`, live `Application.progress` + timeline, stub step implementations).
  - Wired in-process into `server.js` + standalone `npm run worker` script; `bull` + `ioredis` installed.
  - Tested: server boots (health OK), end-to-end smoke (queued → all steps done → Application `applied`, Job `applied`/`appliedVia: system`), 20/20 jest tests pass.
- **Dev Phase 1 — Job Site Integration** ✅ **COMPLETED**:
  - Credential encryption (AES-256-GCM), Puppeteer adapters (Naukri/Indeed), job-sites + jobs routes, cross-site dedupe, blocklist, scheduled refresh + stale expiry, rate limiters. Backend fully tested. Client UI remaining.
- **Dev Phase 2 — Matching & Listing** ✅ **COMPLETED**: `/api/jobs/match` (AI score + matched/missing keywords), Job Applications tab (tiles, circular score, filters incl. job age, search, server-side pagination), side panel with match breakdown + resume preview, bulk select/apply/pass.
- **Dev Phase 3 — Auto-Apply Pipeline** ✅ **COMPLETED**: `/api/jobs/apply` (returns `batchId` immediately), Bull workers (`fetch_jd → generate_resume → prepare_application → submit`), live progress view via Socket.io, `waiting_user` → Pending Action Modal, master pause/kill-switch, batch cancel-all, max-per-batch cap, AI cost guard, crash-safe idempotent steps.
- **Dev Phase 4 — AI Resume Engine** ✅ **COMPLETED**: base resume variants + template picker, `/api/resume/generate`, ATS-friendly formatting, cover letter generation, `/api/resume/optimize` keyword suggestions, generated resume persisted with each application (view/download/soft-delete).
- **Dev Phase 5 — Tracking & Records** ✅ **COMPLETED**: Tracking tab (status badges, filters, timeline, already-applied import/manual-mark/auto-detect), retry failed/not-applied, saved-resumes section + endpoints, `not_applied` reasons.
- **Dev Phase 6 — Notifications** ✅ **COMPLETED**: in-app notification bell + unread badge + dropdown, live toasts via Socket.io for pipeline events, optional email alerts (instant/daily digest/none) for batch summaries, pending-input items, failures, and AI-budget / pause events, email rate cap + dedupe, notification settings in the pipeline card.
- **Dev Phase 7 — Multi-User Hardening**: **NOT PLANNED — single-user only.** Dropped for now; will be considered later only if multi-user support is actually needed. Not started.

### Sprint Plan (initial build)
1. **Sprint 1** = Dev Phase 0 ✅ done + Dev Phase 1 (job sites + fetch/dedupe/blocklist/expiry) ✅ done.
2. **Sprint 2** = Dev Phase 2 (matching, tiles, filters, search, pagination, side panel) ✅ done.
3. **Sprint 3** = Dev Phase 3 + 4 (async pipeline + AI resume engine) ✅ done.
4. **Sprint 4** = Dev Phase 5 + 6 (tracking, records, notifications) ✅ done.
5. **Sprint 5** = Dev Phase 7 (multi-user hardening) — **NOT PLANNED, dropped for now** (single-user only). The plan is complete without it.

### Progress Log
- **2026-08-08**: Dev Phase 0 complete (models, queue infra, worker scaffold, env vars; boot + smoke + jest verified). Next: Dev Phase 1 — Naukri/Indeed integration.
- **2026-08-09**: Dev Phase 1 complete:
  - AES-256-GCM credential encryption (`server/utils/credentials.js`) with sha256-derived key from `JOB_CREDENTIALS_KEY`; encrypted `credentials` field (`select: false`) on `UserJobSite` model.
  - Puppeteer adapters for Naukri + Indeed (`server/adapters/`): login (best-effort, graceful SSO/CAPTCHA handling), `searchJobs` with pagination + per-card normalization, `fetchJobDescription`. Shared `browser.js` with singleton browser, element-scoped `safeText`/`safeAttr`, `delay` helper (replaces removed `page.waitForTimeout`).
  - Routes: `server/routes/job-sites.js` (Express Router: list/save/test/remove, masked email in responses), `server/routes/jobs.js` (`POST /api/jobs/fetch` with dedupe + blocklist + per-user upsert, `GET /api/jobs` with pagination/filters/age/search).
  - Cross-site dedupe (`server/services/jobDedupe.js`: `buildDedupeKey` = sha256 of normalized title|company|location, 32 hex), company blocklist from `UserSettings`.
  - Scheduled refresh + stale expiry (`server/queue/scheduler.js`: daily interval + 5s-after-boot tick, marks `new` jobs as `expired` based on `lastSeenAt` vs `JOB_STALE_DAYS`).
  - Rate limiters added: `jobFetchLimiter` (10/15min), `jobSiteLimiter` (20/15min).
  - Fixed Phase 0 worker crash bug (`setTimeout(onErr)` firing after successful DB connect).
  - Fixed Puppeteer v25 ESM/jest conflict via lazy-require in `browser.js`.
  - Verified: server boots clean (worker + scheduler up, no errors), 20/20 jest tests pass, full API flow works (login → save site with encrypted creds → fetch returns graceful error for invalid creds).
  - Client Job Sites tab UI: complete (site cards, toggle, credentials modal, test, fetch).
  - Next: Dev Phase 2 — Matching & Listing.
- **2026-08-10**: Dev Phase 2 complete:
  - Added `/api/jobs/match` endpoint to calculate AI match scores against candidate profile + skills + experience using OpenAI/Groq with fallback to keyword overlap.
  - Added `/api/jobs/:id` update endpoint to update job status (`applied`, `passed`, etc.).
  - Added **Job Applications** tab to `AdminDashboard` UI featuring:
    - Job tiles with title, company, site badge, post age, status, and circular match score display (color-coded).
    - Filters: site, status, job age (24h, 3d, 7d, 14d), min match score, search query, and server-side pagination.
    - Side panel: job details, salary, full description, match score breakdown, matched/missing keywords, and direct open URL action.
    - Bulk selection + bulk actions: Match, Apply (mark as applied), Pass (mark as passed).
  - Verified: client build (`npm run build`) succeeded without errors, jest test suite passes (20/20).
  - Next: Dev Phase 3 — Automation & Application Queue.
- **2026-08-10**: Dev Phase 3 (Auto-Apply System) complete + partial Dev Phase 4 (AI resume tools):
  - **Apply pipeline endpoints** (`server/routes/jobs.js`): `POST /api/jobs/apply` (enqueues bulk-selected jobs → returns `batchId` immediately), `GET /api/jobs/apply/batch/:batchId`, `POST /api/jobs/apply/batch/:batchId/cancel`, `POST /api/applications/:id/cancel`, `GET /api/applications/:id/progress`. Idempotency guard skips jobs already queued/running/pending; `batchSize` cap (default 20, max 50).
  - **Worker upgrades** (`server/queue/worker.js`): real `fetch_jd` step (pulls full JD via adapter if missing), `generate_resume` step creates a `GeneratedResume` record linked to the Application, `submit` marks job applied (`appliedVia: 'system'`). Per-step timeline + progress persistence.
  - **Live progress via Socket.io** (`server/socket/index.js`, `server/queue/worker.js`): `setupSocket(server, onIO)` hands the io instance to the worker; `apply:progress` + `apply:batch` events broadcast to the admin room as each step runs.
  - **AI resume tools** (`server/routes/resume-ai.js`): `POST /api/resume/optimize` (ATS keyword suggestions from JD) and `POST /api/resume/cover-letter` (tailored AI cover letter). Mounted under `/api/resume`.
  - **Frontend** (`client/src/pages/AdminDashboard.jsx`): Auto Apply toolbar button, live Auto-Apply Pipeline panel (per-job step checkmarks/spinners via socket), Cover Letter + Optimize Resume buttons in the job detail side panel with inline results.
  - Verified: server boots clean, 23/23 jest tests pass, client `vite build` succeeds.
  - **Not yet done (remaining Phase 3)**: master pause/kill-switch, AI cost guard, per-site concurrency + rate-delay tuning, cookie-import login fallback.
  - **Remaining Phase 4**: ATS-friendly PDF generation (pdf-lib), generated-resume view/download/soft-delete endpoints + UI.
  - Next: finish Phase 3 extras → Phase 4 ATS PDF → Phase 5 — Application Tracking & Status Management.
- **2026-08-10**: Dev Phase 4 (AI Features) complete:
  - **ATS-friendly PDF generation** (`server/services/resumePdf.js`, `pdf-lib` installed): clean single-column, standard-headings, keyword-rich resume PDF with profile name/title, summary, skills, experience, education, certifications; auto multi-page.
  - Worker `generate_resume` step now builds the PDF from profile data and persists it (Buffer + filename) on `GeneratedResume`, along with `jdUsed` snapshot and `keywordsMatched`.
  - **Generated resume endpoints** (`server/routes/resume-ai.js`): `GET /api/resume/generated` (list, no pdf buffer), `GET /api/resume/generated/:id` (record), `GET /api/resume/generated/:id/pdf` (download PDF), `DELETE /api/resume/generated/:id` (soft delete via `deletedAt`). All scoped to `req.adminId`.
  - **Frontend** (`client/src/pages/AdminDashboard.jsx`): Resumes tab now has a **Generated Resumes (ATS)** section — list with generation date + keyword count, download button, soft-delete button, and refresh; loads automatically when the tab opens. Base resume files remain unchanged below.
  - Verified: PDF service produces valid `%PDF` output (1547 bytes test), worker loads clean, 23/23 jest tests pass, client `vite build` succeeds.
  - **Remaining**: Phase 3 extras (master pause/kill-switch, AI cost guard, per-site rate tuning, cookie-import login fallback) and Phase 5 — Application Tracking & Status Management.
  - Next: Dev Phase 5 — Application Tracking & Status Management.
- **2026-08-10**: Dev Phase 3 extras complete:
  - **Master pause/kill-switch** (`server/routes/pipeline.js`): `GET /api/pipeline/status`, `POST /api/pipeline/pause|resume`, `PUT /api/pipeline/budget`. `POST /api/jobs/apply` rejects with `409 PIPELINE_PAUSED` when `UserSettings.pipelinePaused` is set. Admin UI now shows a live **Apply Pipeline** control card (Running/Paused pill, AI usage today/this week, per-batch cap, rate-delay, site concurrency) with Save Settings.
  - **AI cost guard** (`server/services/aiCost.js` + `server/models/AiUsage.js`): daily/weekly generation budgets with UTC day/week buckets. `checkAICost` before + `recordAICost` after wired into the match endpoint, `/api/resume/cover-letter`, `/api/resume/optimize`, and the worker `generate_resume` step (skips application when budget exhausted). Budget limits are configurable from the UI.
  - **Per-site concurrency + rate-delay tuning**: `UserSettings.applyRateDelayMs` (default 15s between submits) + `siteConcurrency` (default 1); worker enforces both with a per-site in-flight semaphore (`acquireSiteSlot`/`releaseSiteSlot`) and last-submit timestamp.
  - **Cookie-import login fallback**: `UserJobSite.cookies` (encrypted Cookie header string) + `cookieUpdatedAt`, `PUT /api/job-sites/:name/cookies` endpoint, `setCookiesFromHeader`/`loginWithCookies` in `server/adapters/browser.js`; Naukri + Indeed `login()` now try a pasted session cookie first (SSO/CAPTCHA fallback), worker `fetch_jd`/`submit` use it, test endpoint reports `via: cookies`. UI: paste-Cookie textarea in the site credentials modal + "Session cookie" indicator on site cards.
  - `maxApplyPerBatch` no longer hardcoded — read from `UserSettings` (default 20) in `/api/jobs/apply`.
  - Verified: 28/28 jest tests pass (added pipeline/cookie/apply 401 coverage), client `vite build` succeeds.
  - **Remaining**: Phase 5 — Application Tracking & Status Management.
  - Next: Dev Phase 5 — Application Tracking & Status Management.

- **2026-08-10 (follow-up)**: Added **Issue 3 — Write Suggested Keywords into an Actual Resume (Per-Job / Bulk)** to Phase 1 Follow-ups (required): auto generate + attach tailored resume per job (`POST /api/resume/generate`, single + bulk), keyword-merge into Skills/Summary **without changing resume structure**, keywords woven naturally (no weird text), per-job viewable PDF, Auto-Apply uses the attached resume. Next: implement Issue 3 phase-wise.
- **2026-08-11**: **Issue 3 implemented**:
  - New shared service `server/services/resumeGenerate.js` — `buildTailoredResume(job, { userId, skipOnBudgetExceeded })`: loads profile context, runs one AI call (keyword extraction + natural Summary rewrite, keeping structure/tone/length), deterministic fallback to stored `missingKeywords`, merges keywords into Skills (dedupe, case-insensitive), builds the same-structure ATS PDF, respects AI budget guard.
  - `POST /api/resume/generate` (`server/routes/resume-ai.js`): accepts `{ jobId }` or `{ jobIds }` (bulk, max 20), persists `GeneratedResume` per job (linked to job + latest application), sets `Job.resumeId`, returns per-job results with `keywordsAdded`/`usedAI`.
  - `Job.resumeId` field added; worker `generate_resume` step now reuses an attached resume when present, otherwise generates via the shared service (keeps skip-on-budget behavior).
  - Client (`AdminDashboard.jsx`): per-job "Generate Resume"/"Regenerate Resume" + "View Attached Resume" in the detail side panel, bulk "Generate Resumes (n)" toolbar button, "Resume" badge on job tiles, updated Resumes-tab empty state.
  - Verified: 31/31 jest tests pass, client `vite build` succeeds, worker/service modules load cleanly.
  - Next: Dev Phase 5 — Application Tracking & Status Management.
- **2026-08-11**: **Dev Phase 5 — Application Tracking & Status Management complete**:
  - `Application.appliedVia` field (`system`/`imported`/`manual`); worker submit step sets `appliedVia: 'system'`.
  - `PUT /api/jobs/:id` (manual apply/pass) now also creates/updates an `Application` record so manually-marked jobs appear in Tracking alongside system applications.
  - New endpoints (`server/routes/jobs.js`): `GET /api/applications` (paginated, filters: site/status/via/date range, populated with job info), `PUT /api/applications/:id` (status + lastAction with timeline events, keeps Job in sync when applied), `POST /api/applications/:id/retry` (requeues failed/not_applied/canceled apps into Bull queue; guards: pipeline paused → 409, job expired/already applied → 400; resets progress + increments attempts).
  - Client: new **Tracking** tab — application cards (title, company, site, status badge, applied-via, applied date, Retry button for retryable states), filters (site/status/via), server-side pagination, detail side panel with last action, "Open Job Posting", and a reverse-chronological timeline view.
  - Verified: 34/34 jest tests pass, client `vite build` succeeds, full end-to-end smoke test passes (login → generate resume single/bulk → PDF download → mark applied → applications list/filters → status update → retry guard + successful requeue).
  - Next: Dev Phase 6 — Notifications.
- **2026-08-11**: **Auto-Fill Apply Forms (capture fields, AI workflow, user-attention fallback)** — keeps bulk apply automatic by default:
  - New `ApplyField` model — per-user+site knowledge base of apply-form fields (`key`, `label`, `type`, `selector`, `options`, `value`, `source`, `timesUsed`), unique `{userId, site, key}`. Values are learned from every successful apply and reused automatically.
  - New shared service `server/services/applyFields.js`:
    - `detectFields(page)` — generic Puppeteer form-field detection (visible text inputs/selects/textareas + label/aria/placeholder/name resolution, stable selector building).
    - `fillFields(page, fieldValues, detected)` — React-safe value setting (prototype setter + input/change events) for text/textarea/select; skips missing fields.
    - `resolveFieldValues({ userId, site, detected, jobTitle })` — priority: learned knowledge base → candidate profile (name/email/phone/location/title/years/linkedin/github) → AI (one JSON call, PII like email/phone/password never invented, select-only-from-options, budget-guarded). Anything still unresolved becomes `waitingFields`.
    - `learnFieldValues(...)` — upserts resolved values into the knowledge base with `timesUsed+1`.
    - `detectApplyFormFields({ url, applySelectors })` — opens a job, clicks apply, detects the form (no submit).
  - Application model: added `fieldValues` (Map), `detectedFields`, `waitingFields`; progress step status `waiting_user` added (→ application `pending`).
  - Worker: `prepare_application` is now real — detects fields (best-effort; no inline form → proceeds), resolves values, stages them on the application; if required fields are unresolved it pauses THAT job at `pending`/`waiting_user` ("Needs your attention") and the pipeline loop stops for that job only. `submit` passes `fields`+`detected` to the adapter to fill the form before confirming, and learns resolved values into the knowledge base on success. Loop now also breaks on `skipped` (fixes submit-after-not_applied).
  - Adapters (naukri, indeed): added `detectApplyFields({ url })`; `submitApplication` now accepts `fields`+`detected` and auto-fills the form.
  - New `POST /api/applications/:id/answers` — saves user answers for pending `waitingFields`, merges into `fieldValues`, learns them into the knowledge base (source `user`), then automatically requeues the application to resume and submit (no manual retry).
  - Client: Tracking detail panel shows an amber **"Needs your attention"** form (inputs/selects/textareas pre-filled with AI suggestions) with "Save & Auto-Apply"; card badge for pending-needing-attention; live progress panel renders `waiting_user` steps.
  - Verified: 35/35 jest tests pass, client `vite build` succeeds, smoke test confirms profile+saved auto-fill, AI-off fallback → waiting, answers → requeue → knowledge base learn, and 400 guards.
  - Next: Dev Phase 6 — Notifications.
- **2026-08-11**: **Dev Phase 6 — Notifications complete**:
  - New `Notification` model — in-app + email record per user (`type`: batch_complete, apply_success, apply_failed, needs_input, pipeline_paused, pipeline_resumed, ai_budget, system), `title/body/metadata`, optional unique `dedupeKey` (per-user), `read`, `emailDelivered`, `digestPending`.
  - New `server/services/notifications.js`:
    - `notify()` — dedupe check (skips if same dedupeKey within maxAge), creates the record, emits Socket.io `notify:inapp` to the admin dashboard, and handles email per `UserSettings.notifyEmail` + `notifyDigest` (`instant` sends now, `daily` queues, `none` never). Instant email is rate-capped at 8/hour → excess falls back to digest (prevents bulk-run spam).
    - `sendEmail()` — lazy nodemailer (Gmail SMTP via `EMAIL_USER`/`EMAIL_PASS`), never crashes when SMTP is unconfigured.
    - `listNotifications/unreadCount/markRead/markAllRead`, and `sendDailyDigests()` — groups all `digestPending` notifications per user into one summary email.
  - Routes `server/routes/notifications.js`: `GET /api/notifications` (+page/limit + unreadCount), `GET /unread-count`, `PUT /:id/read`, `PUT /read-all` — all behind `auth` + CSRF.
  - Notification hooks:
    - Worker: `apply_success` (submit done), `apply_failed` (step failure, deduped per application), `needs_input` (waiting_user — "Complete details for <Job>"), `ai_budget` (resume skipped on budget), and `batch_complete` via new `maybeNotifyBatchComplete(batchId)` (fires once when a batch has no queued/running/pending apps left; summary "N applied · X failed · Y need input · Z canceled").
    - Pipeline pause/resume routes → `pipeline_paused`/`pipeline_resumed`.
    - `aiCost.checkAICost` → `ai_budget` notification (deduped once per day/week).
  - Settings: `GET /api/pipeline/status` now returns `notifyEmail` + `notifyDigest`; `PUT /api/pipeline/budget` accepts them (`bool` + enum `none|instant|daily`).
  - Scheduler: runs `sendDailyDigests()` on the daily tick + a 6-hourly digest interval.
  - Client (`AdminDashboard.jsx`):
    - Notification bell in the header with unread-count badge + dropdown (recent list, type icons, click → mark read + jump to Tracking/job-apps tab, "Mark all read").
    - Socket listener for `notify:inapp` on the existing admin socket → live toasts (warning for failed/needs-input/budget, success for applied/resumed, info for batch complete) + badge bump.
    - Toast renderer extended with `warning` (amber) and `info` (blue) variants.
    - Apply Pipeline card: "Email notifications" toggle + "Email digest" select (Instant/Daily summary/None).
  - Verified: 41/41 jest tests pass (added notification 401 guards, create/list/read/read-all/dedupe flow, pipeline notify-prefs + invalid-digest 400), client `vite build` succeeds, smoke test confirms dedupe, digestPending behavior, pause/resume + ai_budget + batch_complete notifications, mark-read/mark-all API flow, and no-crash when SMTP unconfigured.
  - **2026-08-11 (cont.)**: Added Phase 6.5 integration coverage — `server/__tests__/routes.test.js` now 42/42 tests (custom-site add + duplicate 409 + masked email response, manual-job add/list + unknown-site 400, mark-applied creates Application with `appliedVia: manual` and clears `needsManualApply`, unknown-site PUT 400). JWT signed directly in test to avoid auth rate-limiter (5 logins/IP window already consumed by earlier tests).
  - Next: **Dev Phase 7 — Multi-User Hardening is NOT PLANNED** (single-user only; dropped for now, revisit only if multi-user support is actually needed later). The automation system (Phases 1–6) is feature-complete for single-user use.

### Open Questions Still to Decide
- Start with **Naukri/Indeed** (scraping) or also attempt **LinkedIn** (API) later?
- Build **UI-first** or **backend-first**? (Recommendation: backend-first for Phases 1-2, then UI.)
- AI budget defaults and max-per-batch default (proposed: 20).

---

## Phase 1 Follow-ups (Plan — implement later)

### Issue 1: Naukri/Indeed Login Not Working
**Problem**: Naukri and Indeed detect headless browsers and show a JS challenge or blank page instead of the login form, so Puppeteer login fails.

**User Request**: When the browser launches a site, provide a login option so scraping works.

**Proposed Solution — Login on Launch**:
1. When Puppeteer opens a site (on first fetch or when creds are saved), navigate to the site.
2. **Auto-login**: Detect login forms using common selectors (`input[type=email]`, `input[name=email]`, `input[type=password]`, `button[type=submit]`). Fill saved credentials and submit.
3. **Cookie import fallback**: If auto-login fails (CAPTCHA/JS challenge), let the user paste cookies from their browser. Store and inject via `page.setCookie(...)`.
4. **Stealth**: Add `puppeteer-extra-plugin-stealth` + `--disable-blink-features=AutomationControlled` to reduce detection.
5. **Result**: On success, store session cookies. On failure, return a clear error: "Login blocked — import cookies from your browser instead."

**Note**: This is part of the generic custom-site flow (Issue 2) — the same login-on-launch logic applies to any site the user adds.

### Issue 2: Add Custom Job Sites (Simplified)
**Problem**: Sites are hardcoded in `server/adapters/index.js`. No way to add a custom site without code changes.

**User Request**: Provide a name + link for any job site. When the browser launches, handle login automatically so scraping works.

**Proposed Solution — Generic Site Flow**:
1. **User adds a custom site**: name + base URL via the UI ("Add Site" button → enter name + URL).
2. **Saved credentials** (email/password or cookies) are auto-injected when Puppeteer navigates to the site.
3. **Login on launch**: When the browser opens a site for the first time (or when creds are saved), it:
   - Navigates to the site's login URL (or the base URL if a login form is detected)
   - Fills in saved credentials (email/password fields — auto-detected by common selectors)
   - Submits the form
   - On success, stores session cookies for future runs
   - On failure (CAPTCHA/JS challenge), returns a clear error: "Login blocked — try importing cookies from your browser"
4. **Generic scraping**: After login, navigate to a search URL (constructed from base URL + keywords) and extract job cards using generic selectors (`[data-job-id]`, `.job-card`, `.job-listing`, `[itemtype*=JobPosting]`, schema.org `JobPosting` microdata). If generic selectors fail, return a friendly "No jobs found — try a different search URL".
5. **Future enhancement**: Let the user optionally configure custom CSS selectors per site (stored in the `UserJobSite` doc), but ship with generic selectors first.

**Data model changes**:
- `UserJobSite.name`: keep as string (already supports custom names)
- `UserJobSite`: add `baseUrl` field (required for custom sites)
- `UserJobSite.credentials`: keep as `Mixed` (email/password or `{ cookies: [...] }`)

**UI changes**:
- "Add Site" card → modal with: Name input, Base URL input, Credentials section (email/password + cookie textarea)
- Credentials modal: when user clicks "Login" or "Save", launch Puppeteer → navigate → auto-login → store cookies → report success/failure

**Files to change**:
- `server/adapters/index.js` → remove hardcoded SITES, add generic adapter
- `server/adapters/browser.js` → add `loginAndScrape({ url, credentials, keywords })` generic flow
- `server/routes/job-sites.js` → add site accepts `baseUrl`, update save/login/test
- `server/models/UserJobSite.js` → add `baseUrl` field, relax `SITE_ENUM`
- `client/src/pages/AdminDashboard.jsx` → Add Site modal with name/URL/creds fields

### Issue 3: Write Suggested Keywords into an Actual Resume (Per-Job / Bulk) — REQUIRED
**Problem**: The Optimize Resume feature only *displays* keyword suggestions in the side panel — nothing is written into a real resume. The Auto-Apply `generate_resume` step builds a PDF from profile skills only and stores the suggested keywords only as `keywordsMatched` metadata, never merging them into the resume content. There is no way to edit a per-job resume before attaching it.

**User Request**: For every job, individually or in bulk, be able to **generate an actual resume that incorporates the suggested keywords**, review/edit it, and attach the updated resume to that job/application. **The new resume must be viewable per job.**

**Hard constraints (from user)**:
- **DO NOT change the resume structure** — same sections, order, and layout as the base resume.
- **Only change keywords** — merge suggested keywords into the Skills list and weave a few into the Summary naturally.
- **Must not look weird** — keywords inserted grammatically (no awkward comma lists, no invented experience/claims). The resume should read as a properly adjusted, natural document.
- **Auto edit + attach** — generation is automatic; the generated resume is attached to the job and viewable per job.

**Proposed Solution — Generate & Attach Tailored Resume**:
1. **`POST /api/resume/generate`** (body: `{ jobId }` or bulk `{ jobIds: [] }`):
   - Runs the optimize-style keyword analysis for each job's JD (reuse `server/services/aiCost.js` guard).
   - Merges suggested keywords into the resume: append missing keywords to **Skills**, and have the AI weave 1-3 of the most important into the **Summary** sentence flow (keep original tone/length; empty summary stays empty).
   - Builds an ATS-friendly PDF via `server/services/resumePdf.js` with the **same structure** and persists a `GeneratedResume` record (keyword source + JD snapshot).
   - Bulk mode loops over ids and returns per-job results; each generated resume is stored + linkable.
2. **Attach & edit**:
   - Generated resume becomes **viewable per job** (`GET /api/resume/generated/:id/pdf` + per-job link in the job detail panel).
   - A job's chosen resume is attached to the job/application (link `GeneratedResume.jobId` + `applicationId`, and `Job.resumeId`).
   - The Auto-Apply `submit` step uses the attached tailored resume instead of the generic one.
3. **UI**:
   - Job Applications tab: "Generate Resume" per job in the side panel; bulk "Generate Resumes" toolbar button for selected jobs. After generation show a "View Resume" link for that job.
   - Resumes tab already lists generated resumes — surface keyword count + per-job PDF download.

**Files to change**:
- `server/routes/resume-ai.js` → add `POST /generate` (single + bulk), keyword-merge logic, attach to job/application
- `server/models/Job.js` → add optional `resumeId` (attached tailored resume)
- `server/queue/worker.js` → `generate_resume`/`submit` steps prefer the attached job resume
- `client/src/pages/AdminDashboard.jsx` → per-job Generate Resume + View Resume link + bulk toolbar button
- `server/__tests__/routes.test.js` → add coverage for `POST /api/resume/generate` (single + bulk, 401 without auth)
