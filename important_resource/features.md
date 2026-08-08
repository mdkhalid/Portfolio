# Portfolio — Features Reference

Complete feature inventory of the Portfolio app (Mohammad Khalid, Senior Solution Architect). Organized by area.

## 1. Portfolio Presentation

- **Two layouts**: Classic single-page (Hero → Summary → Skills → Experience → Projects → Certifications → Blog → Contact) and **Bento** grid home (`/bento`).
- **Layout selection**: per-visit override stored in `localStorage` (`useBentoTheme`); server `Profile.useBentoTheme` can force a default.
- **Live clock** (Asia/Kolkata) in bento header.
- **Specialty carousel** highlighting expertise areas.
- **Skills** with proficiency levels; **experience/education timeline**; **certifications** grid.
- **Projects**: cards with tech-stack chips, links (GitHub / live / demo / video), and a detail modal.
- **Resume page** (`/resume`): fetch/download resume files; visitors can download the latest resume PDF.
- **Contact section**: form → `/api/contact` with honeypot (`company`), per-email cooldown, rate limiting, and 500ms min response; notifications via Nodemailer to `EMAIL_USER`.
- **SEO**: per-page meta via `react-helmet-async` (title, description, OG/Twitter, canonical).

## 2. AI Resume Chat (`/chat`)

- Conversational Q&A about the portfolio/profile, powered by LLM.
- **Provider**: `Profile.aiProvider` → `openai` (`gpt-4o-mini`) or `groq` (`llama-3.3-70b-versatile`).
- **Fallback responder**: rule-based answers when no API key is configured OR when the API call fails (graceful degradation).
- **Prompt-injection protection**: user input sanitized via `sanitizeForAI` (strips prompt-injection patterns).
- Rate-limited (`chatLimiter` 20/15 min), `ChatSession` persistence, typing indicators, and markdown rendering in messages.

## 3. ATS Resume Checker (`/ats-checker`)

- Upload a resume PDF (10MB max) → server extracts text via `pdf-parse`.
- **ATS score** (0–100) with circular gauge + section score bars (skills, keywords, formatting).
- **Keyword matching**: highlights matched vs missing keywords (job-description aware), suggestions to improve.
- LLM-powered analysis through the same provider chain (OpenAI/Groq), rate-limited (`atsLimiter` 5/15 min).

## 4. Blog & Articles (`/blog`, `/blog/:slug`)

- Article cards with cover image, excerpt, tag, date, and **reading time**.
- **Tag filter** + infinite scroll (12 per page).
- Full article view renders **markdown** (`react-markdown`) with **Mermaid diagrams** (`MermaidDiagram`), typographic content styling, and related articles.
- Admin CRUD for articles (create/edit/publish/draft, delete).

## 5. Postmortems (`/postmortems`, `/postmortems/:slug`)

- Engineering incident postmortems (e.g. seeded "Cache Stampede During Peak Traffic Took Down Checkout for 14 Minutes").
- Fields: severity (SEV1/2/3), status (resolved/mitigated/monitoring/ongoing), incident & resolved dates, duration, systems affected, customer impact, detection source, root cause, contributing factors, what-went-well, what-didn't, **action items** (owner, priority P0-P2, status), **timeline**, and full markdown content (with Mermaid diagrams).
- Admin CRUD for postmortems.

## 6. Live Chat (`/live-chat`)

- Real-time chat between visitors and the admin over **Socket.io**.
- **Queue system**: max 3 concurrent active chats (`MAX_ACTIVE = 3`); visitors beyond queue capacity are told to try later.
- Events: `chat:status`, `chat:history`, `chat:message`, `chat:closed`, `admin:availability`, `auth_error`.
- Admin socket must authenticate with JWT; joins `admin-room`; visitors identified by `visitorId` (uuid).
- Chat sessions persisted; typing indicators; notification sounds/badges for the admin dashboard.

## 7. Admin Dashboard (`/admin/dashboard`)

Protected by `ProtectedRoute` + JWT. **12 tabs**:

1. **Profile** — edit bio, titles, contact info, social links, `aiProvider`, `useBentoTheme`.
2. **Skills** — CRUD with proficiency levels.
3. **Experiences** — CRUD (role, company, dates, bullets, order).
4. **Education** — CRUD.
5. **Certifications** — CRUD.
6. **Projects** — CRUD (name, role, description, dates, bullets, techStack, links, order).
7. **Resumes** — upload new resume file, list/download, delete.
8. **Articles** — CRUD with publish/draft.
9. **Messages** — inbox from contact form.
10. **Leads** — lead capture records.
11. **Livechat** — real-time chat console (reply to visitors, end sessions).
12. **Analytics** — traffic dashboard.

- All CRUD backed by the `createCrudController` factory (field allow-listing, required checks, validation).
- Toasts on success/error; modal forms for edit.

## 8. Analytics

- Visitor tracking middleware records page views/visits.
- **Privacy**: IPs hashed as `sha256(rawIp + ANALYTICS_SALT)`; unique-IP cap `MAX_UNIQUE_IPS = 5000`.
- Daily aggregation (`Analytics` model); admin charts for views over time, top pages, device/browser breakdown.
- Tracking only runs after **cookie consent** (banner with accept/decline; stored in localStorage).

## 9. Auth & Security Features

- Admin login (`/admin`) with bcrypt password hash + JWT (httpOnly cookie + Authorization header).
- **Brute-force protection**: account lockout after repeated failures.
- **CSRF protection** on state-changing routes (cookie + `x-csrf-token` header).
- **Rate limiting** across auth, contact, resume, chat, ATS, and tracking endpoints.
- **Input sanitization** (HTML allow-list, plain-text cleaning, prompt-injection stripping).
- **File upload validation** by magic-byte signature; safe path-based resume downloads.
- Security headers via Helmet (CSP in production), CORS allow-list, mongo-sanitize, hpp.
- Seed data includes a demo admin and sample content via `npm run seed`.

## 10. UX Extras

- Dark/light theme toggle persisted.
- Cookie consent banner.
- Toast notifications.
- Scroll-to-top on route change.
- Responsive mobile-first design with hamburger nav.
- Favicon + per-page document titles/meta.
