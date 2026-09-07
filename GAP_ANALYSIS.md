# Portfolio — Gap Analysis & Phase-wise Development Plan

**Generated:** September 7, 2026
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
**Goal:** Stop bleeding. Five user-visible bugs.

Tasks:
1.1 Fix `EditModal.jsx:91` — toggle is assignment, not comparison.
1.2 Fix `AdminLogin.jsx:68` — change `text-blue-500` → `text-red-500`.
1.3 Fix `queue/worker.js:625-674` — add early `break`/`return` after step failure.
1.4 Fix `adapters/browser.js:554-559,567-568` — `confirmApplied` default `applied: false`.
1.5 Fix visitor-ID persistence — generate UUID in `ChatWidget`/`LiveChatPage` and store in `localStorage`.

Verification gate:
- Lint clean (`npm run lint` in both apps).
- Server tests pass.
- Manual smoke: toggle article publish, fail login, reload live chat tab.

Exit criteria: all 5 fixes merged; no new warnings.

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

Tasks:
3.1 Split `routes/jobs.js` into `routes/jobs.list.js`, `routes/jobs.match.js`, `routes/jobs.apply.js`, `routes/jobs.pipeline.js`.
3.2 Split `pages/AdminDashboard.jsx` into per-tab route components under `features/admin/tabs/*`.
3.3 Convert `routes/profile.js` to use `createCrudController`.
3.4 Remove `_checkUnique` dead code in `crudService.js`.
3.5 Reconcile `controllers/base.js` — either delete it or document it as the v0 base used by `shared.js`.
3.6 Delete `check_admin.js` (or move to `scripts/` and `.gitignore` outputs).
3.7 Move seeded PII in `seed.js` to env-driven placeholders; default to a "demo" profile.
3.8 Document the in-memory queue fallback in `queue/index.js`.

Verification gate:
- No file over ~600 LOC except intentionally batched ones.
- `grep -R "controllers/base" server/` matches only documentation.
- All routes still mount in `server.js`.

Exit criteria: cleaner tree, all tests still green.

---

### Phase 4 — P3 Security & Hygiene
**Goal:** Tighten trust boundary and clean repo.

Tasks:
4.1 Add `server/data/login-debug/` to `.gitignore`; purge from history if committed recently; rotate any leaked cookies.
4.2 Strengthen `env.js` placeholder detection — reject well-known weak keys ("changeme", "secret", "password", empty, <32 chars where required).
4.3 Verify email notifications actually send (smoke test against Mailtrap/Ethereal); add scheduled digest loop.
4.4 Add `JWT_SECRET_PREVIOUS` to `.env.example` and document rotation flow.
4.5 Add operator warning doc for adapter-scraping ToS risk.
4.6 Audit `errorHandler.js` — strip PII from logs (already noted as LOW).

Verification gate:
- `git log -- server/data/login-debug` reviewed; clean.
- Email send verified in dev.
- `npm audit` shows no high/critical.

Exit criteria: repo hygiene passes, secrets rotation documented.

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

| Phase | Scope | Status | Owner | ETA |
|---|---|---|---|---|
| 1 | P0 critical bugs | **starting** | TBD | TBD |
| 2 | P1 job-automation | pending | TBD | TBD |
| 3 | P2 architecture | pending | TBD | TBD |
| 4 | P3 security | pending | TBD | TBD |
| 5 | P4 tests + docs | pending | TBD | TBD |

---

## 6. Appendix — Tech Stack (for context)

**Client:** React 19.2.6, Vite 8.0.12, Tailwind 4.3.0, framer-motion 12.38, react-router 7.15 (lazy), lucide-react, react-markdown 10 + mermaid 11, react-helmet-async, axios 1.16 (JWT/CSRF/silent-refresh), socket.io-client 4.8.
**Server:** Node + Express 5.2.1 (CommonJS), Mongoose 9.6.2, Socket.io 4.8, OpenAI 6.38 (OpenAI/Groq-compatible), jsonwebtoken 9 + bcryptjs 3, helmet 8 + cors + hpp + express-mongo-sanitize + sanitize-html + validator, express-rate-limit 8.5, multer 2.1, Bull 4.16 + ioredis 6 (in-memory fallback), node-cron 4.6, pdf-lib 1.17 + pdf-parse 2.4, nodemailer 9, puppeteer 25.5, jest 30 + supertest 7.
**Tests today:** 28 server tests (auth/public/notifications/jobs); zero client tests; zero adapter tests; zero worker tests.