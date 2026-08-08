# Portfolio — Tech Stack Reference

Full technical inventory of the Portfolio monorepo (Mohammad Khalid, Senior Solution Architect). Root structure: `client/` (frontend) + `server/` (backend API).

## 1. Monorepo Layout

```
Portfolio/
├── client/                 # React + Vite SPA
├── server/                 # Express 5 + Mongoose API
│   ├── ai/                 # LLM client (OpenAI / Groq)
│   ├── config/             # env.js, db.js
│   ├── controllers/        # route handlers (+ CRUD factory)
│   ├── middleware/         # auth, csrf, rate-limit, sanitize, security, errors
│   ├── models/             # Mongoose schemas
│   ├── routes/             # API route definitions
│   ├── services/           # crudService, helpers
│   ├── socket/             # Socket.io chat server
│   ├── utils/              # security, fileType, helpers
│   ├── uploads/            # uploaded resumes/files (git-ignored)
│   ├── __tests__/          # jest + supertest route tests
│   └── seed.js / seed-postmortems.js / seed-article-solid.js
├── .env.example            # env template
├── README.md / SECURITY.md
└── important_resource/     # design / techstack / features reference
```

## 2. Client Stack

- **React 19.2.6** + **react-dom 19.2.6** (createRoot, functional components + hooks).
- **Vite 8.0.12** build tool; `@vitejs/plugin-react` 6; **@tailwindcss/vite** 4 plugin.
- **Tailwind CSS 4.3.0** — CSS-first config; `index.css` uses `@import "tailwindcss"`.
- **react-router-dom 7.15.1** — lazy-loaded routes (`React.lazy` + `Suspense`) except Home.
- **framer-motion 12.38.0** — scroll reveals, modals, layout transitions.
- **lucide-react 1.16.0** — icon set.
- **react-markdown 10.1.0** + **mermaid 11.15.0** — blog/postmortem markdown with diagrams.
- **react-helmet-async 3.0.0** — per-page SEO/meta tags.
- **socket.io-client 4.8.3** — live chat (visitor side).
- **axios 1.16.1** — HTTP client (`client/src/lib/api.js`: JWT header, CSRF header, 30s timeout, 401 auto-logout).
- **react-helmet-async / @tailwindcss/vite / lucide-react / framer-motion** as above.

### Client tooling
- **Vite config** (`vite.config.js`): dev proxy `/api` → `http://localhost:5000`, `/uploads`, `/socket.io` (ws). Build target `es2020`, CSS minified & inlined, `chunkSizeWarningLimit: 1000`.
- **ESLint 10** flat config: `@eslint/js` recommended + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`.
- **index.html**: Google Fonts preconnect (Inter), favicon.svg, base SEO/OG/Twitter meta.

## 3. Server Stack

- **Node.js** + **Express 5.2.1** — CommonJS (`"type": "commonjs"`).
- **Mongoose 9.6.2** — ODM for MongoDB.
- **Socket.io 4.8.3** — real-time live chat.
- **AI clients**: `openai` 6.38.0 (OpenAI) and Groq via OpenAI-compatible base URL `https://api.groq.com/openai/v1`.
- **Auth**: `jsonwebtoken` (JWT, HS256), `bcryptjs` (password hashing).
- **Security middleware**: `helmet` 8.2.0 (+ CSP in prod), `cors` (allow-list), `express-mongo-sanitize`, `hpp`, `sanitize-html`, `validator`.
- **Rate limiting**: `express-rate-limit` 8.5.2.
- **File upload**: `multer` 2.1.1 (memory storage), `pdf-parse` 2 for PDF text extraction (ATS).
- **Email**: `nodemailer` (contact/lead notifications to EMAIL_USER).
- **Misc**: `compression`, `cookie-parser`, `dotenv` 17, `uuid` (visitorId).
- **Test tooling**: `jest` 30 + `supertest` (`server/__tests__/routes.test.js`).

### Server scripts
- `npm start` → `node server.js`
- `npm run seed` → `node seed.js` (base seed data)

## 4. Environment Variables (`server/config/env.js`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes (≥32 chars) | Token signing; `JWT_SECRET_PREVIOUS` enables rotation |
| `PORT` | no | Default `5000` |
| `NODE_ENV` | no | `production` / `development` / `test` |
| `CLIENT_URL` | no | CORS allow-list + client origin (comma-separated) |
| `TRUST_PROXY` | no | Set when behind reverse proxy (rate limiting) |
| `OPENAI_API_KEY` | no | OpenAI chat + ATS |
| `GROQ_API_KEY` | no | Groq chat + ATS fallback |
| `EMAIL_USER` / `EMAIL_PASS` | no | Nodemailer SMTP for contact/lead notifications |
| `ANALYTICS_SALT` | no | Salt for hashing visitor IPs (`sha256(rawIp + salt)`) |

## 5. Architecture

### Client pages/routes
`/` (Home classic), `/bento`, `/resume`, `/chat` (AI), `/ats-checker`, `/blog`, `/blog/:slug`, `/postmortems`, `/postmortems/:slug`, `/live-chat`, `/admin` (login → `/admin/dashboard` protected by `ProtectedRoute`).

### Server layering
- **routes/** → thin route files wiring controllers + middleware.
- **controllers/** → handlers; `createCrudController(Model, {allowedFields, requiredFields, stringFields, arrayFields, boolFields, intFields})` factory in `controllers/shared.js` generates standard CRUD.
- **services/crudService.js** → pick allowed fields, run required/unique checks, save; `getVisibleData` strips private fields for public reads.
- **models/** → Mongoose schemas with validators: Admin, Analytics, Article, Certification, ChatSession, Education, Experience, Lead, Message, Postmortem, Profile, Project, Resume, Skill.
- **middleware/** → `auth` (JWT verify), `csrf` (cookie+header `x-csrf-token`), `rateLimiter` (named limiters), `sanitize` (sanitize-html allow-list + `cleanPlain`), `noSqlSanitize`, `security` (helmet/CSP, CORS, hpp, compression), `errorHandler`, `validate`.
- **socket/index.js** → chat: admin room + `admin-room`; visitor role via `visitorId`; `MAX_ACTIVE = 3` concurrent; events `chat:status`, `chat:history`, `chat:message`, `chat:closed`, `admin:availability`, `auth_error`; admin socket requires JWT.
- **ai/client.js** → picks provider from `Profile.aiProvider` (default `openai`); models `gpt-4o-mini` (OpenAI) and `llama-3.3-70b-versatile` (Groq); used by both `/api/chat` and `/api/ats`.

### Rate limits (IP-based)
- `authLimiter` 5/15 min · `contactLimiter` 3/hour · `resumeLimiter` 10/15 min · `chatLimiter` 20/15 min · `atsLimiter` 5/15 min · `trackLimiter` 30/min.
- Contact endpoint also: honeypot field (`company`), per-email cooldown, 500ms minimum response time.

## 6. Security Highlights

- Helmet CSP (production), CORS allow-list from `CLIENT_URL`, `express-mongo-sanitize` + `hpp`.
- HTML input sanitized via `sanitize-html` allow-list; plain-text fields via `cleanPlain`; prompt-injection patterns stripped in `utils/security.js` (`sanitizeForAI`).
- CSRF: double-submit cookie + `x-csrf-token` header.
- File uploads: multer memory storage; magic-byte signature sniffing (JPEG/PNG/GIF/WebP/PDF/DOC) in `utils/fileType.js`; resume download path safety (`isPathSafe`).
- Admin passwords bcrypt-hashed; brute-force lockout after failed attempts; JWT expiry; token rotation via `JWT_SECRET_PREVIOUS`.
- Analytics: `sha256(rawIp + ANALYTICS_SALT)` hashing, `MAX_UNIQUE_IPS = 5000` cap.

## 7. Deployment Notes

- Static build: `client/dist` served by Express in production; `/uploads` served statically (path-safe).
- Socket.io shares the same HTTP server; `TRUST_PROXY` matters behind nginx/cloud.
- Seed scripts populate demo content (projects, skills, experiences, postmortems incl. 14-min checkout cache stampede incident, article "solid.js" etc.).
