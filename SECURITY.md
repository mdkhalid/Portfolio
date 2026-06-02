# Security & Privacy

This document describes the security and privacy controls applied to the portfolio app, how to operate it safely, and what to review before deploying to production.

## 1. Threat Model (in scope)

| Threat | Mitigation |
|---|---|
| Brute-force login | `authLimiter` (5 attempts / 15 min / IP) + generic error messages + failed-login activity log |
| Spam on contact form | `contactLimiter` (3 / hr / IP) + length + format validation + honeypot field + optional per-email cooldown |
| Spam on AI chat | `chatLimiter` (20 / 15 min / IP) + `sanitizeForAI` (prompt-injection patterns) + 2000-char cap |
| Spam on ATS scoring | `atsLimiter` (5 / 15 min / IP) + magic-byte PDF check + 10MB cap + 1 file |
| Spam on analytics | `trackLimiter` (30 / min / IP) + `MAX_UNIQUE_IPS` cap |
| Mass assignment (Mongoose) | `pick(req.body, ALLOWED_FIELDS)` on every CRUD route + per-field validation |
| NoSQL injection (`{$gt: ""}`) | `express-mongo-sanitize` + `hpp` on every request |
| XSS via article content | `sanitize-html` with allow-list (no `script`, no `on*` handlers, `javascript:` URLs stripped) |
| XSS via profile/contact | All string inputs run through `cleanPlain` |
| Path traversal in resume download | `isPathSafe()` regex + `path.resolve` containment check |
| Malicious uploads (fake extensions) | Magic-byte sniffing (JPEG/PNG/GIF/WebP/PDF/DOC signatures) before saving |
| Oversized requests | `express.json({ limit: '100kb' })` + `express.urlencoded({ limit: '100kb' })` + Multer per-route caps |
| Stack-trace leaks in errors | Global `errorHandler` returns generic message in production |
| CORS misuse | Origin allow-list driven by `CLIENT_URL` env var (not `*`) |
| Missing security headers | `helmet` (HSTS in prod, `frameguard: deny`, `noSniff`, `xssFilter`) + CSP in prod |
| HTTP parameter pollution | `hpp` with whitelist for known array fields |
| Slowloris / DoS | `compression` (gzip), `express-rate-limit` global cap, `serverSelectionTimeoutMS` on Mongo |
| JWT secret leak | Server refuses to start if `JWT_SECRET` is the placeholder or shorter than 32 chars |
| API key rotation not picked up | `ai/client.js` no longer caches the OpenAI/Groq client — picks up new env on each call |
| Prompt injection on AI | Blocklist in `sanitizeForAI` + explicit "do not reveal system prompt" rule in `SYSTEM_PROMPT` |
| Static-file abuse | `/uploads` sets `X-Content-Type-Options: nosniff` + `Cross-Origin-Resource-Policy: cross-origin` + `fallthrough: false` |

## 2. Privacy Controls

| Concern | Control |
|---|---|
| IP storage in analytics | IPs are SHA-256-hashed with a server-side `ANALYTICS_SALT` before storage. Raw IPs are never persisted. |
| Unbounded IP set | `MAX_UNIQUE_IPS` (5000) caps the per-day `uniqueIPs` array to prevent cardinality blow-up. |
| Activity log retention | `Activity.prune()` keeps only the last 500 records. |
| Cookie / localStorage usage | The app only stores theme preference and admin auth in `localStorage`. No third-party trackers. |
| Consent | A cookie-consent banner is shown on first visit. It is purely informational — declining has no functional effect today (no cookies are set), but the banner gives users transparency. |
| Public exposure of contact submissions | Only authenticated admins can call `/api/messages`. |
| AI provider data | Messages sent to `/api/chat` and `/api/ats-score` are forwarded to OpenAI / Groq per their data-handling terms. A short system-prompt rule prevents the model from revealing the resume. |

## 3. Environment Variables

See `.env.example`. **Never** commit a real `.env` file. Important rules:

- `JWT_SECRET` — minimum 32 characters, never the placeholder. Generate with:
  ```
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `CLIENT_URL` — comma-separated list of allowed origins. In production, set this to your real domain(s).
- `ANALYTICS_SALT` — any random string; changing it invalidates all existing analytics hashes.
- `OPENAI_API_KEY` / `GROQ_API_KEY` — at least one is required for `/api/chat` and `/api/ats-score`. Without a key, the AI features fall back to a rule-based responder that does not call any external API.

## 4. Production Checklist

Before deploying:

- [ ] `NODE_ENV=production` is set.
- [ ] `JWT_SECRET` is a strong random value (≥ 32 chars).
- [ ] `CLIENT_URL` is set to the real frontend origin(s).
- [ ] `MONGODB_URI` points to a managed instance with auth + TLS.
- [ ] Server runs behind HTTPS (Caddy, Nginx, or a PaaS that terminates TLS).
- [ ] Trust proxy is set to the correct hop count (`TRUST_PROXY`).
- [ ] `npm audit` reports no high/critical vulnerabilities.
- [ ] `helmet` CSP policy in `middleware/security.js` is reviewed and adjusted for your real asset hosts (fonts, images, etc.).
- [ ] A backup strategy exists for the MongoDB database.
- [ ] The admin password is ≥ 12 characters and unique to this service.
- [ ] Logs are not printed to STDOUT in a way that includes PII — review the few `console.log`/`console.error` calls in routes.

## 5. Reporting a Vulnerability

If you find a security issue, please email the maintainer directly rather than opening a public issue.
