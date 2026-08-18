# Portfolio — Mohammad Khalid

A full-stack developer portfolio platform with two separate packages:

- **`client/`** — React 19 + Vite 8 + Tailwind CSS 4 + Framer Motion + Socket.io-client
- **`server/`** — Express 5 + MongoDB (Mongoose 9) + Socket.io + OpenAI/Groq

The site includes a classic portfolio layout, a bento-grid layout, an AI resume chat assistant, an ATS resume score checker, a blog with markdown/Mermaid articles, production postmortems, a visitor live-chat with admin queue, lead capture, contact forms, analytics, and a full admin dashboard.

> Security details, threat model, and hardening checklist live in [`SECURITY.md`](./SECURITY.md).

---

## Features

| Area | What it does |
| --- | --- |
| **Portfolio** | Classic and bento layouts (toggleable), profile, skills, experience, education, certifications, projects, resume downloads |
| **AI Chat** (`/chat`) | Answers questions about the resume from stored data. Uses OpenAI or Groq; falls back to a rule-based responder when no API key is set **or the API call fails** (no more 503s on a bad AI key) |
| **ATS Checker** (`/ats-checker`) | Upload a PDF resume + job description → AI-powered ATS compatibility score with breakdown, keywords, strengths |
| **Blog** (`/blog`, `/blog/:slug`) | Markdown articles with Mermaid diagrams, reading time, tags, SEO |
| **Postmortems** (`/postmortems`) | Production incident write-ups with severity, timeline, action items |
| **Live Chat** (`/live-chat`) | Visitors chat with the admin in real time (Socket.io) with queueing (max 3 active) and session history |
| **Admin** (`/admin`) | Login + dashboard: manage profile, skills, experience, education, certs, projects, resumes, articles, messages, leads, live chat, analytics |
| **Analytics** | Anonymized page views (IPs hashed with `ANALYTICS_SALT`) + activity feed |
| **Security** | JWT auth (secret rotation), CSRF double-submit cookies, rate limiting, helmet/CSP, CORS whitelist, input sanitization, path-traversal protection, magic-byte file validation |

---

## Project structure

```
.
├── client/                  # React SPA (Vite)
│   └── src/
│       ├── pages/           # Home, BentoHome, Chat, ATS, Blog, Postmortems, Admin...
│       ├── components/      # Navbar, Hero, Timeline, bento/*, ats/* ...
│       ├── context/         # Theme, Auth, (shared portfolio data lives in Home)
│       └── lib/api.js       # Axios instance (auth + CSRF interceptors)
└── server/                  # Express API + Socket.io
    ├── config/              # env loading, MongoDB connection
    ├── middleware/          # auth, csrf, rate limiting, security, sanitize, validate
    ├── models/              # Mongoose models (Profile, Project, Article, ...)
    ├── routes/              # REST endpoints
    ├── controllers/         # CRUD controller factories (shared/base) + per-resource controllers
    ├── services/            # applyFields, resume*, sessionRefresh, jobDedupe, notifications, ...
    ├── adapters/            # Per-site job automation (naukri, indeed, workatastartup, wellfound, generic)
    ├── queue/               # Bull/Redis apply worker + scheduler (in-memory fallback)
    ├── socket/              # Live-chat Socket.io server
    ├── ai/                  # OpenAI/Groq client
    ├── seed.js              # Full seed (clears + reseeds demo data)
    ├── seed-postmortems.js  # Idempotent postmortem seed
    ├── seed-article-solid.js# Idempotent article seed
    └── seed-apply-flows.js  # Idempotent per-provider apply-flow seed
```

---

## Prerequisites

- **Node.js** 20.19+ or 22.12+ (LTS recommended; Vite 8 requires this) and npm
- **MongoDB** — local install, Docker, or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- Optional: an **OpenAI** (`sk-...`) or **Groq** (`gsk_...`) API key for the AI features

---

## Quick start

```bash
# 1. Install dependencies (two separate packages)
cd client && npm install
cd ../server && npm install

# 2. Configure the server environment
cd server
cp .env.example .env
# edit .env: set MONGODB_URI and a real JWT_SECRET (>= 32 chars)
# generate a secret with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Make sure MongoDB is running, then seed demo data (first time only)
npm run seed

# 4. Start the API server (http://localhost:5000)
npm start

# 5. In a second terminal, start the client dev server (http://localhost:5173)
cd ../client
npm run dev
```

Then open **http://localhost:5173**. Admin dashboard: **http://localhost:5173/admin** (seed credentials: `admin` / `admin123`). Use **Change Password** in the dashboard header before any public deployment — it rehashes the password and invalidates all existing sessions.

The Vite dev server proxies `/api`, `/uploads`, and `/socket.io` to `http://localhost:5000`, so no extra CORS setup is needed locally.

---

## Environment variables (`server/.env`)

| Variable | Required | Description |
| --- | --- | --- |
| `MONGODB_URI` | ✅ | MongoDB connection string. Server refuses to start without it |
| `JWT_SECRET` | ✅ | JWT signing secret, **≥ 32 chars**, never a placeholder. Server validates this at startup |
| `JWT_SECRET_PREVIOUS` | — | Previous secret during rotation (sign tokens with current, accept both) |
| `CLIENT_URL` | prod ✅ | Comma-separated allowed origins for CORS + Socket.io (e.g. `https://example.com`) |
| `PORT` | — | API port (default `5000`) |
| `NODE_ENV` | — | `development` (default) or `production` (enables CSP/HSTS, strict CORS, serves built client) |
| `OPENAI_API_KEY` | —* | Used when the profile's `aiProvider` is `openai` |
| `GROQ_API_KEY` | —* | Used when the profile's `aiProvider` is `groq` (free tier) |
| `EMAIL_USER` / `EMAIL_PASS` | — | SMTP creds for contact-form email notifications |
| `ANALYTICS_SALT` | — | Salt for hashing visitor IPs (generate like `JWT_SECRET`) |
| `TRUST_PROXY` | — | Number of reverse-proxy hops (`1` default). Note: the server coerces falsy values to `1`, so `0` does **not** disable it — use `0` only if you're sure your host never forwards client IPs |

\* At least one AI key must be set to use the AI features. Chat gracefully falls back to the built-in rule-based responder when no key is set **or the provider call fails**; the ATS checker requires a working key.

---

## Seeding

Three seed scripts exist. All load `server/.env` themselves, so run them from `server/`.

| Command | What it does | Safe to re-run? |
| --- | --- | --- |
| `npm run seed` | **Clears** and reseeds everything: profile, skills, experience, education, certifications, projects, 1 article, and the admin user (`admin` / `admin123`) | ⚠️ **Destructive** — wipes all documents in those collections |
| `node seed-postmortems.js` | Upserts 3 postmortem articles (by slug) | ✅ Idempotent |
| `node seed-article-solid.js` | Upserts 1 SOLID-principles article (by slug) | ✅ Idempotent |

After the destructive seed, the admin account is reset to `admin` / `admin123` — change the password from the dashboard before exposing the site.

---

## Available scripts

**Client** (`cd client`):

```bash
npm run dev        # Vite dev server (port 5173)
npm run build      # Production build → client/dist
npm run lint       # ESLint
npm run preview    # Preview the production build
```

**Server** (`cd server`):

```bash
npm start          # node server.js (port 5000)
npm run seed       # Destructive full seed
npx jest --forceExit  # API tests (requires MongoDB running locally)
                    # --forceExit prevents hanging on the open Mongo connection
```

---

## Testing

Server tests use **Jest + Supertest** (`server/__tests__/routes.test.js`) and hit a real database — they default to `mongodb://localhost:27017/portfolio_test` and set `NODE_ENV=test`. Run with MongoDB up:

```bash
cd server && npx jest --forceExit
```

(`--forceExit` is required — the open Mongoose connection keeps Jest from exiting otherwise. All 42 tests currently pass.)

Client lint:

```bash
cd client && npm run lint
```

---

## Deployment

The server serves the built SPA itself, so one process is enough. It works on any Node host (Render, Railway, Fly.io, VPS) with MongoDB available.

```bash
# 1. Build the client
cd client
npm install
npm run build          # produces client/dist

# 2. Configure the server for production
cd ../server
npm install
```

Production environment:

```dotenv
NODE_ENV=production
PORT=8080
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/portfolio
JWT_SECRET=<generated, >= 32 chars>
CLIENT_URL=https://your-domain.com        # must match your public origin
ANALYTICS_SALT=<generated>
# optional:
OPENAI_API_KEY=sk-...                     # or GROQ_API_KEY=gsk_...
EMAIL_USER=...
EMAIL_PASS=...
TRUST_PROXY=1                             # 1 if behind a reverse proxy/load balancer
```

Then start: `npm start` (in `server/`).

**What happens in production mode:**

- The server statically serves `client/dist` and falls back to `index.html` for non-API routes (SPA routing), so `/chat`, `/blog/:slug`, etc. work on refresh.
- Helmet applies a strict CSP, HSTS, and frame/object restrictions.
- CORS and Socket.io only allow origins listed in `CLIENT_URL` — **you must set it to your real domain** or browsers will block API and live-chat connections.
- `POST /api/ats-score` uses a **10 MB in-memory** upload limit (no files written to disk); avatar/resume uploads go to `server/uploads/` (gitignored).

### First deploy checklist

- [ ] `MONGODB_URI` and a strong `JWT_SECRET` are set
- [ ] `CLIENT_URL` is your real origin (no trailing slash)
- [ ] Seeded once (or loaded via the admin dashboard)
- [ ] Admin password changed from `admin123` (use **Change Password** in the dashboard header)
- [ ] HTTPS is terminated at the proxy and `TRUST_PROXY` is correct

---

## Job automation

The admin dashboard includes a job-search + automated-apply subsystem (the "Job Sites", "Job Applications", "Tracking", and "Manual Apply" tabs). It fetches jobs from supported providers, matches them against the profile, optionally generates a tailored resume, and applies — or routes the job to the Manual Apply list when a provider cannot be automated.

**Supported providers** (in `server/adapters/`):

| Provider | Search | JD fetch | Auto-apply |
| --- | --- | --- | --- |
| `naukri` | ✅ | ✅ | ✅ (cookie → password login, resume upload, field fill, submit) |
| `indeed` | ✅ | ✅ | ✅ (cookie → password/SSO login, apply wizard; external employer redirects become manual) |
| `workatastartup` | ✅ (client-side keyword filter) | ✅ | ❌ manual (YC single application) |
| `wellfound` | ✅ (rate-limit backoff) | ✅ | ✅ (cookie → persistent profile → password login, pitch + fields + resume) |
| `generic` (custom site) | ❌ | ❌ | ❌ manual |

**How a job flows through the system:**

1. **Fetch** — `POST /api/jobs/fetch` searches enabled sites and upserts results into `Job` (deduped by `dedupeKey`).
2. **Match** — `POST /api/jobs/match` scores jobs against the profile using AI (`AiUsage` tracks spend against `UserSettings` budgets).
3. **Queue** — `POST /api/jobs/apply` enqueues selected jobs into the Bull/Redis queue (`server/queue/`). If `REDIS_URL` is unset, the queue falls back to an in-memory implementation so local runs work without Redis.
4. **Worker** (`server/queue/worker.js`) walks each application through four steps:
   - `fetch_jd` — fetch the full job description (login fallback only if needed).
   - `generate_resume` — build a tailored ATS-friendly resume.
   - `prepare_application` — detect + resolve apply-form fields (learned values → canonical cross-site memory → profile → AI few-shot).
   - `submit` — call the provider adapter, confirm submission, and route failures/manual-only providers appropriately.
5. **Scheduler** (`server/queue/scheduler.js`) periodically re-runs the pipeline for configured sites.
6. **Manual apply** — jobs with `needsManualApply` (custom sites, external redirects, YC) are applied in the browser and marked applied via the Manual Apply tab.

**Session + credentials:**

- Job-site credentials and session cookies are encrypted with AES-256-GCM using `JOB_CREDENTIALS_KEY`.
- `POST /api/job-sites/:name/browser-login` opens a visible Chrome window for interactive login (CAPTCHA/OTP/SSO), then harvests cookies.
- `server/services/sessionRefresh.js` replays stored sessions after successful submits to keep them alive indefinitely.

**Relevant environment variables:**

| Variable | Required | Description |
| --- | --- | --- |
| `JOB_CREDENTIALS_KEY` | ✅ for site creds/cookies | Secret (≥ 32 chars) used to encrypt job-site credentials and session cookies |
| `REDIS_URL` | — | Redis connection string; when absent the queue uses an in-memory fallback |
| `JOB_*` | — | Per-site/worker tuning (see `server/.env.example` and `server/config/env.js` for the current set) |

The provider-specific apply steps are also stored in the `ApplyFlow` collection (seeded by `node seed-apply-flows.js`) so they are inspectable via `GET /api/apply-flows` and reusable as LLM context.

---

## Admin dashboard

- URL: `/admin` (login) → `/admin/dashboard`
- Manages: profile (incl. section visibility + layout preference + AI provider), skills, experience, education, certifications, projects, resume files, blog articles (draft/published), contact messages, chat leads, **live chat** (queue + active sessions, max 3), and analytics (page views + activity feed)
- Auth: JWT in localStorage + CSRF-protected mutations; login is rate-limited (5 attempts / 15 min) and locked out for 15 min after 5 failures
- Live chat admin connections are authenticated with the same JWT over Socket.io

---

## Notes & gotchas

- **Known UI issue:** the admin login page renders error messages in blue (`text-blue-500`) instead of red.
- **Resume file cleanup**: replacing or deleting a resume via the admin leaves the old file on disk in `server/uploads/`.
- **Analytics counts page loads once per visit** to the home/bento pages; logged-in admin views are excluded.
- **CSP in production** requires all first-party scripts/styles; inline styles are allowed, third-party trackers are not (by design).
