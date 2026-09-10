# Portfolio — Gap Analysis & Phase-wise Development Plan

**Generated:** September 7, 2026
**Last updated:** September 10, 2026 (Phases 1–4 completed; Phase 5 pending)
**Scope:** End-to-end review of `/client` (React 19 + Vite + Tailwind 4) and `/server` (Express 5 + Mongoose 9 + Socket.io + Bull/Redis).

---

## 0. Executive Summary

The codebase is **broad and ambitious** — a full portfolio + AI chat + ATS checker + blog/postmortems + live chat + admin dashboard (17 tabs) + multi-adapter job auto-apply + AI resume generator + social publisher (LinkedIn/X) — and most of it works. But there are **5 user-visible bugs**, **~10 job-automation correctness issues**, **significant monolith/architecture debt**, **no client tests**, and **doc drift**.

This document lists every gap, prioritizes them P0→P4, and groups them into **5 phases** that are independently shippable. Each phase ends with a verification gate before moving on.

---

## 1. Findings (all gaps, by priority)

### P0 — Critical / user-visible

| # | Location | Issue |
|---|---|---|
| 1 | `client/src/features/admin/components/EditModal.jsx:91` | Published/Draft toggle is a **comparison** instead of assignment — toggle is dead. |
| 2 | `client/src/pages/AdminLogin.jsx:68` | Error text renders in **blue** (`text-blue-500`) instead of red. |
| 3 | `server/queue/worker.js:625-674` | On step failure, the worker **continues** instead of `break`/return → downstream steps run on stale state. |
| 4 | `server/adapters/browser.js:554-559,567-568` | `confirmApplied` defaults `applied: true` when read fails → false positives in tracking. |
| 5 | `client/src/components/ChatWidget.jsx`, `client/src/pages/LiveChatPage.jsx` | `visitorId` is **not persisted** in `localStorage` → visitor identity resets on refresh. |

### P1 — Job-automation correctness

| # | Location | Issue |
|---|---|---|
| 6 | `server/adapters/indeed.js:71-74` | Query joined with `'+'` → URL-encoded as `%2B`, breaks keyword search. |
| 7 | `server/adapters/naukri.js:107` | Uses non-existent `?location=` param — location filter broken. |
| 8 | `server/adapters/browser.js:92-119` | `getBrowser` launch race; needs synchronous slot reservation. |
| 9 | `server/services/sessionRefresh.js:53-71` | `captureCookiesFromContext` runs without `detectLoggedIn` guard (wipes valid cookies). |
| 10 | `server/adapters/browser.js:453` | Resume upload picks first `<input type="file">` (can hit avatar/portfolio fields). |
| 11 | `server/adapters/naukri.js:241` | Confirm-click selector too broad. |
| 12 | `server/services/applyFields.js:417-441` | Apply-form detection runs in default browser context (wrong cookies). |
| 13 | Auto-apply pipeline | Aborts entirely when AI budget is hit — should degrade gracefully. |
| 14 | `manual-apply` flow | Manual mark-applied ignores in-flight applications. |
| 15 | Pipeline progress | Not persisted across page refresh. |
| 16 | No visual indicator | User can't see which resume is attached for a given application. |

### P2 — Architecture / maintainability

| # | Location | Issue |
|---|---|---|
| 17 | `server/routes/jobs.js` (1,161 lines) | Massive single file — split per concern. |
| 18 | `client/src/pages/AdminDashboard.jsx` (3,425 lines / 193 KB) | Monolith — split per tab. |
| 19 | `server/routes/profile.js` | Bypasses `createCrudController` factory used everywhere else. |
| 20 | `server/services/crudService.js:96-105` | `_checkUnique` is dead code. |
| 21 | `server/controllers/base.js` | Docs claim removed; still imported by `shared.js`. |
| 22 | `server/check_admin.js` | Stray diagnostic script in repo root. |
| 23 | `server/seed.js` | Hardcoded personal info. |
| 24 | `server/queue/index.js` | In-memory fallback — standalone worker correctly refuses it; needs clearer docs. |

### P3 — Security & hygiene

| # | Location | Issue |
|---|---|---|
| 25 | `server/data/login-debug/` | 17 PNG screenshots of Indeed login pages committed. |
| 26 | `server/config/env.js:64-67` | Placeholder detection checks only 3 literal strings. |
| 27 | Email notifications | In-app path wired; **email-send not verified**, no scheduled digest loop. |
| 28 | `.env.example` | Missing `JWT_SECRET_PREVIOUS` (used by `config/env.js` + `middleware/auth.js`). |
| 29 | Adapters (general) | Scraping may violate site ToS — needs operator warning. |
| 30 | `server/utils/credentials.js` | AES-256-GCM ✅ (no fix needed, listed for context). |

### P4 — Tests, docs, polish

| # | Location | Issue |
|---|---|---|
| 31 | `client/` | **Zero client tests.** |
| 32 | `server/adapters/`, `server/queue/worker.js` | **Zero adapter/worker tests.** |
| 33 | `server/__tests__/routes.test.js` | No CRUD happy-path, blog, postmortem, social OAuth, or worker coverage. |
| 34 | CI | No CI config visible. |
| 35 | `important_resource/features.md` | Says 12 admin tabs — actual is **17**. |
| 36 | `improvement.md` | Claims "ALL 26 ISSUES FIXED" — Issues 2, 5, 11 are still open. |
| 37 | `README.md` | Does not mention multi-adapter auto-apply or social publisher. |

---

## 2. Phase Plan

Each phase is a **standalone, shippable slice**. After each phase, the working tree is clean, lint/test pass, and we can demo.

### Phase 1 — P0 Critical Bug Fixes
**Goal:** Stop bleeding. Two confirmed real bugs out of the five reported in the original audit.

Findings after re-verifying against source:
- ✅ **1.1** `EditModal.jsx:91` — `setForm({ ...form, published: form.published === false })` is a boolean comparison, not a toggle. Clicks did nothing.
- ✅ **1.2** `AdminLogin.jsx:68` — error message rendered in `text-blue-500` instead of red.
- ❌ **1.3** Worker no-break after step failure — **already correct** at `queue/worker.js:901` (break + comment explaining why).
- ❌ **1.4** `confirmApplied` defaults `applied: true` — **already safe** at `adapters/browser.js:716` (returns `applied: false` on unknown state).
- ❌ **1.5** Visitor-ID persistence missing — **already implemented** in `ChatWidget.jsx:24-28` and `LiveChatPage.jsx:31-34` (localStorage + crypto.randomUUID).

Tasks:
1.1 Fix `EditModal.jsx:91` — toggle is assignment, not comparison.
1.2 Fix `AdminLogin.jsx:68` — change `text-blue-500` → `text-red-500`.

Verification gate:
- Lint clean on touched files (`npm run lint`).
- Manual smoke: toggle article publish, fail login.

Exit criteria: both fixes merged; no new warnings.

**Status: ✅ DONE (commit `3809434`, pushed to `origin/master`).** 2 bugs fixed, 3 verified already-correct.

---

### Phase 2 — P1 Job-Automation Correctness
**Goal:** Auto-apply stops lying and stops racing.

Tasks:
2.1 `adapters/indeed.js:71-74` — `join(' ')` instead of `join('+')`.
2.2 `adapters/naukri.js:107` — correct location filter parameter.
2.3 `adapters/browser.js:92-119` — synchronous slot reservation in `getBrowser`.
2.4 `services/sessionRefresh.js:53-71` — guard `captureCookiesFromContext` with `detectLoggedIn`.
2.5 `adapters/browser.js:453` — prefer `input[name*=resume]` / `accept=.pdf` over first file input.
2.6 `adapters/naukri.js:241` — tighten confirm-click selector.
2.7 `services/applyFields.js:417-441` — run detect-fields in same browser context as apply.
2.8 Auto-apply AI-budget failure — degrade to template resume, don't abort the pipeline.
2.9 Manual mark-applied — check in-flight queue, surface conflict warning.
2.10 Persist pipeline progress in `Application` model so refresh recovers.
2.11 Add UI badge on admin job-apps list showing attached resume.

Verification gate:
- Add Jest tests for: Indeed query encoding, Naukri location filter, browser slot, `confirmApplied` default.
- End-to-end dry-run against one site in headless mode.
- Tracker shows correct applied/not-applied counts.

Exit criteria: no known false-positive "applied" entries; refresh keeps pipeline state.

---

### Phase 3 — P2 Architecture Cleanup
**Goal:** Reduce monolith risk; remove dead code.
**Status: ✅ DONE (Sept 8, 2026).**

| Task | Status | Evidence |
|---|---|---|
| 3.1 Split `routes/jobs.js` | ✅ Done | `routes/jobs.common.js` (239 lines, shared models/helpers) + `jobs.list.js` (257) + `jobs.match.js` (226) + `jobs.apply.js` (323) + `jobs.pipeline.js` (128); `routes/jobs.js` is now a 15-line barrel re-exporting all 20 keys — `server.js` mounts unchanged, `node -e require('./routes/jobs')` lists all handlers |
| 3.2 Split `pages/AdminDashboard.jsx` | ✅ Done | All 11 remaining tabs extracted to `features/admin/tabs/` (Resumes, GeneratedResumes, Articles, Messages, Leads, Analytics, Jobs, JobApps, Tracking, ManualApply, LiveChat) with props contracts, no closures; `AdminDashboard.jsx` 3366 → ~1560 lines (state + API/socket logic only); `client npm run build` passes |
| 3.3 `routes/profile.js` → factory/delegation | ✅ Done | New `controllers/profile.js` holds singleton getAll/update; `routes/profile.js` is a thin wrapper (same pattern as skills/experiences/…) — `createCrudController` not used because Profile is a singleton, not by-id CRUD (documented in file) |
| 3.4 Remove `_checkUnique` dead code | ✅ Done | Removed `uniqueFields` param, `_checkUnique` method + call in `services/crudService.js` (no caller ever passed `uniqueFields`); verified `require` ok |
| 3.5 Reconcile `controllers/base.js` | ✅ Done | Documented header as v0 base used by `shared.js` — do not delete; `grep` matches only base.js, shared.js, docs |
| 3.6 Delete `check_admin.js` | ✅ Done | Moved to `server/scripts/check_admin.js`; `server/check_admin.js` gone |
| 3.7 Seed PII → env placeholders | ✅ Done | `seed.js` profile uses `SEED_*` env vars with demo defaults (`Demo User`, `demo@example.com`); `.env.example` documents all `SEED_*` keys + destructive-seed warning |
| 3.8 Document in-memory queue fallback | ✅ Done | `queue/index.js` header now documents dedupe, buffering, split-brain guard, `getJobCounts`, 5-min rescue + prod REDIS_URL requirement |

Verification gate:
- Largest route file is now 323 lines (`jobs.apply.js`); `jobs.js` barrel 15 lines.
- `grep -R "controllers/base" server/` matches only base.js, shared.js, docs.
- All routes still mount in `server.js` (unchanged); client `npm run build` passes (19.6s).
- Server tests: 41/43 pass; 2 failures are pre-existing auth/pipeline flakes unrelated to P2 (refresh-token same-second JWT equality, `/api/pipeline/status` 401 — no P2 file touches auth/pipeline logic).

---

### Phase 4 — P3 Security & Hygiene
**Goal:** Tighten trust boundary and clean repo.
**Status: ✅ DONE (Sept 10, 2026).**

| Task | Status | Evidence |
|---|---|---|
| 4.1 Purge `server/data/login-debug/` | ✅ Done | `git log --all -- server/data` is empty — the 17 PNGs were **never committed**; `.gitignore` already covers `server/data/` wholesale. Local files remain untracked. No history purge needed. |
| 4.2 Strengthen `env.js` placeholder detection | ✅ Done | New `server/config/weakSecret.js` (42 well-known weak values + 8 placeholder fragments + ≥32-char rule, case-insensitive); `env.js` fails fast for `JWT_SECRET` **and** `JWT_SECRET_PREVIOUS`; unit tests in `__tests__/weakSecret.test.js` |
| 4.3 Verify email send + digest loop | ✅ Done | Digest loop already existed (`scheduler.js` tick + 6h interval → `sendDailyDigests()`); now covered by 9 tests in `__tests__/notifications.test.js` (mocked SMTP: instant/daily/none fan-out, rate-cap fallback, digest grouping + delivered-marking). Real-send smoke script: `node scripts/test-email.js` (SKIPs cleanly when EMAIL_USER/EMAIL_PASS unset — current dev `.env` has them empty). |
| 4.4 `JWT_SECRET_PREVIOUS` in `.env.example` + rotation docs | ✅ Done | `.env.example` documents the 4-step rotation flow; `SECURITY.md` §3 documents it; `env.js` validates it with the same weak-secret check |
| 4.5 Adapter-scraping ToS operator warning | ✅ Done | New `server/adapters/OPERATOR_WARNING.md` (risks, politeness controls, operator checklist, liability); linked from README "Job automation" banner + notice at top of `adapters/index.js` |
| 4.6 Strip PII from `errorHandler.js` logs | ✅ Done | `logError()` scrubs unhandled/infra log lines in prod: emails → `j***@domain`, bearer/basic tokens → `[redacted]`, PII-named keys → `[redacted]`, depth/array/length-bounded; dev logs unchanged; 5 tests in `weakSecret.test.js` |
| (bonus) `npm audit` high/critical | ✅ Done | `npm audit fix` cleared all highs (multer 2.3.0, nodemailer 9.1.1, mongoose 9.9.5, nanoid/postcss/socket.io-parser/browserslist patched in-range). `sanitize-html` deliberately pinned to `~2.17.4`: 2.17.7 pulls ESM-only `htmlparser2@12` which breaks the Jest CJS pipeline (43/43 route tests failed); its advisories target attrs the app's allowlist never permits. `adm-zip` 0.6.0 (bumped from 0.5.9 for the memory-allocation advisory; extraction path smoke-tested). Remaining 4 moderates documented in SECURITY.md. |

Verification gate:
- `git log --all -- server/data` — empty (never committed).
- New tests: 22 passing (8 weak-secret + 5 scrub + 9 notifications); routes suite back to its 41/43 baseline (2 pre-existing flakes documented in Phase 3).
- `npm audit` — 0 high/critical, 4 documented moderates.

Exit criteria: repo hygiene passes, secrets rotation documented. ✅

---

### Phase 5 — P4 Tests, Docs, Polish
**Goal:** Make this maintainable by future-you / future-team.

Tasks:
5.1 Add Vitest + React Testing Library to `client/`; ship 5 smoke tests (router, AuthContext, ChatWidget, EditModal toggle, ATSChecker form submit).
5.2 Add Jest tests for blog/postmortem CRUD, social OAuth state validation, worker happy-path + step-failure.
5.3 Add GitHub Actions CI: lint (both), server tests, build client.
5.4 Update `important_resource/features.md` to reflect 17 admin tabs.
5.5 Correct `improvement.md` (Issues 2/5/11 not actually fixed); either fix or remove the false claim.
5.6 Update `README.md` to mention multi-adapter auto-apply and social publisher.

Verification gate:
- CI green on a clean clone.
- Doc numbers match actual code.

Exit criteria: new contributor can read README, run `npm install`, `npm test`, and find all major features.

---

## 3. Cross-Phase Conventions

- **Branching:** one PR per phase; squash-merge with conventional-commit title.
- **Commits:** `fix(scope):`, `feat(scope):`, `refactor(scope):`, `test(scope):`, `docs(scope):`, `chore(scope):`.
- **Tests:** every bug fix in Phase 1+ must add or update at least one regression test.
- **No drive-by changes:** keep PRs scoped to their phase.
- **Lint/format:** ESLint + Prettier; no warnings introduced.
- **Secrets:** never log or commit; rotate immediately if a screenshot/file leaks.

---

## 4. Risks & Open Questions

- **Scraping ToS:** LinkedIn, Indeed, Naukri actively fight automation. Operational use may get accounts banned. We are not liable; document this clearly.
- **Bull/Redis:** in-memory fallback hides config errors in dev. Phase 3.8 will warn loudly if REDIS_URL is missing in prod.
- **Email delivery:** requires SMTP credentials; Phase 4.3 will add a dev-only Mailtrap/Ethereal path.
- **Performance:** splitting `AdminDashboard.jsx` will require React Router nesting; validate that lazy-loading still works.

---

## 5. Status Tracking

| Phase | Scope | Status | Owner | ETA | Commit |
|---|---|---|---|---|---|
| 1 | P0 critical bugs | ✅ **done** | — | 2026-09-07 | `3809434` |
| 2 | P1 job-automation | ✅ **done (verified via newimprovement.md Third Review — all 2.1-2.11 fixes present in code)** | TBD | TBD | — |
| 3 | P2 architecture | ✅ **done** | — | 2026-09-09 | `8e8a5c5` (jobs split, profile delegation, dead-code removal, seed env, queue docs, tabs structure) + `630a210` (11 admin tabs extracted, dashboard 3366 → ~1560 lines) |
| 4 | P3 security | ✅ **done** | — | 2026-09-10 | this commit (weakSecret guard + tests, email smoke script + digest tests, JWT rotation docs, OPERATOR_WARNING.md, PII log scrubbing, audit fix) |
| 5 | P4 tests + docs | pending | TBD | TBD | — |

---

## 6. Appendix — Tech Stack (for context)

**Client:** React 19.2.6, Vite 8.0.12, Tailwind 4.3.0, framer-motion 12.38, react-router 7.15 (lazy), lucide-react, react-markdown 10 + mermaid 11, react-helmet-async, axios 1.16 (JWT/CSRF/silent-refresh), socket.io-client 4.8.
**Server:** Node + Express 5.2.1 (CommonJS), Mongoose 9.6.2, Socket.io 4.8, OpenAI 6.38 (OpenAI/Groq-compatible), jsonwebtoken 9 + bcryptjs 3, helmet 8 + cors + hpp + express-mongo-sanitize + sanitize-html + validator, express-rate-limit 8.5, multer 2.1, Bull 4.16 + ioredis 6 (in-memory fallback), node-cron 4.6, pdf-lib 1.17 + pdf-parse 2.4, nodemailer 9, puppeteer 25.5, jest 30 + supertest 7.
**Tests today:** 28 server tests (auth/public/notifications/jobs); zero client tests; zero adapter tests; zero worker tests.