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
| Logs print PII on errors | `errorHandler` scrubs unhandled/infra error logs in production: emails, bearer tokens, and PII-named keys (`password`, `token`, `cookie`, …) are redacted; depth/length-bounded (see `middleware/errorHandler.js`) |
| CORS misuse | Origin allow-list driven by `CLIENT_URL` env var (not `*`) |
| Missing security headers | `helmet` (HSTS in prod, `frameguard: deny`, `noSniff`, `xssFilter`) + CSP in prod |
| HTTP parameter pollution | `hpp` with whitelist for known array fields |
| Slowloris / DoS | `compression` (gzip), `express-rate-limit` global cap, `serverSelectionTimeoutMS` on Mongo |
| JWT secret leak | Server refuses to start if `JWT_SECRET` (or `JWT_SECRET_PREVIOUS`) is a placeholder, well-known weak value (`changeme`, `secret`, …), or shorter than 32 chars — see `server/config/weakSecret.js` |
| Token theft (access) | Short-lived access JWT (12h default) + silent renewal through a 30-day httpOnly refresh cookie; refresh tokens are stored **hashed** (SHA-256), rotated on every use, and invalidated by `tokenVersion` on password change |
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

- `JWT_SECRET` — minimum 32 characters, never the placeholder. The server also refuses to start for well-known weak values (`changeme`, `secret`, `password`, …) or values that embed a placeholder fragment. Generate with:
  ```
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `JWT_SECRET_PREVIOUS` — previous secret, set **only during rotation**. New tokens are signed with `JWT_SECRET`; both secrets verify until the old tokens expire. Rotation flow:
  1. Move the old `JWT_SECRET` value to `JWT_SECRET_PREVIOUS`, set the new secret in `JWT_SECRET`, restart.
  2. Wait ≥ `JWT_EXPIRES_IN` (default 12h) so every client re-authenticates and refresh tokens are re-issued.
  3. Remove `JWT_SECRET_PREVIOUS` and restart.
  Both secrets must pass the same weak-value/length startup check.
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
- [ ] `npm audit` reports no high/critical vulnerabilities (remaining moderates documented: `adm-zip` symlink write — the app only reads/creates zips, never extracts attacker-supplied archives; `sanitize-html` 2.17.4 pinned — 2.17.7's advisories target attrs the app's allowlist never permits, and 2.17.7 breaks the Jest CJS test pipeline via ESM-only `htmlparser2`; `bull`→`uuid` — Redis-queue-only dependency).
- [ ] `helmet` CSP policy in `middleware/security.js` is reviewed and adjusted for your real asset hosts (fonts, images, etc.).
- [ ] A backup strategy exists for the MongoDB database.
- [ ] The admin password is ≥ 12 characters and unique to this service.
- [ ] Logs are not printed to STDOUT in a way that includes PII — unhandled/infra error logs are scrubbed automatically (`middleware/errorHandler.js`); review remaining `console.log`/`console.error` calls in routes.
- [ ] Email notification path verified once via `node scripts/test-email.js` (needs `EMAIL_USER`/`EMAIL_PASS`).

## 5. Reporting a Vulnerability

If you find a security issue, please email the maintainer directly rather than opening a public issue.
