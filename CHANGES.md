# Change Plan — Resume UI declutter + Applied-jobs relocation + Login persistence

One document, four phases. Each phase is independently shippable.

---

## Phase 1 — Master resume shows in the admin UI

**Problem:** An uploaded master resume never appears in Dashboard → Resumes.
**Root cause:** The dashboard loads resumes from the *public* endpoint
`GET /api/resumes`, which filters masters out (`server/routes/resumes.js:7`
→ `isMaster: { $ne: true }`). So `items.find(i => i.isMaster)` is always null
and the Master card always renders the empty upload state.

**Changes**
- `server/routes/upload-resume.js`: add `GET /api/resume-files` (already
  behind auth+csrf in server.js) returning ALL resumes incl. the master.
- `client/src/pages/AdminDashboard.jsx` (`fetchAll`): load resumes from
  `/api/resume-files` instead of `/api/resumes`.
- Result: uploaded master shows under "Master Resume" with its Master badge;
  Replace/Edit/Delete work on it.

## Phase 2 — Move Generated (ATS) resumes out of the Resumes tab

**Problem:** Resumes tab mixes master/other uploads with a long list of
per-job generated resumes → cluttered.

**Changes**
- New sidebar tab `{ key: 'generated', label: 'Generated', icon }`.
- Extract the "Generated Resumes (ATS)" block from `renderResumes()` into
  `renderGeneratedResumes()`; remove it from the Resumes tab.
- Load generated resumes when `activeTab === 'generated'` too.
- Resumes tab now shows only: Master Resume + Other Resume Files.

## Phase 3 — Applied jobs: badge on card + separate location

**Problem:** After a job is applied it stays mixed into the actionable
pipeline list; users can't tell pipeline state at a glance.

**Changes**
- Segmented control above the job grid: **Pipeline** (default filter,
  excludes applied) ↔ **Applied** (status=applied). Applied jobs leave the
  main list but remain fully accessible via the Applied segment (and the
  existing Status dropdown).
- Applied cards get an emerald tint/border + "Applied" badge with date
  (badge already existed; make state visible even when selected).

## Phase 4 — Login persistence & browser reliability

**Problems observed**
1. `Failed to launch the browser process (Code: 4294967295)` — Chrome relaunch
   races a stale profile lock on Windows; no launch retry exists.
2. Worker pre-check `fs.existsSync(getProfileDir(site))` is meaningless:
   `getProfileDir` CREATES the dir, so a logged-out profile passes the gate
   and fails later at submit ("Login required").
3. Raw Puppeteer `TimeoutError` ("Timed out after waiting 30000ms") surfaces
   verbatim and is never retried, though slow/challenged page loads are
   usually transient.
4. `confirmApplied` "still apply" branch returns no reason → generic worker
   message "Application could not be confirmed on the site."

**Changes**
- `server/adapters/browser.js`
  - `getBrowser`: retry launch up to 3× on launch failures; between attempts
    re-run `killProfileProcesses(site)` + growing backoff. Add
    `--hide-crash-restore-bubble` arg.
  - `confirmApplied`: give the still-active-apply-button branch a real reason.
- `server/queue/worker.js`
  - `BROWSER_DISCONNECT_RE`: also match "Failed to launch the browser process"
    so a transient launch crash triggers close+retry (submit retries stay
    guarded by `checkBeforeRetry`).
  - Treat `Timed out after …` timeout errors as retryable through the same
    guarded path.
  - `hasProfile` gate: directory must exist AND be non-empty (real profile
    content), not auto-created empties.
- Session persistence itself stays as-is: interactive "Login via Browser" →
  persistent per-site profile + harvested cookie headers + sliding refresh.

---

## Verification
- `cd client && npm run build` must pass.
- Server syntax check: `node --check` on edited files.
- Manual: upload master → appears with badge; generate resumes → live under
  Generated tab; apply flow failure messages now specific.
