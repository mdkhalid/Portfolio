# Job Automation Adapters — Operator Warning

**Read this before enabling any job-site adapter** (Naukri, Indeed, Wellfound,
foundit/Monster, Work at a Startup, or any custom site) in a deployment you
operate.

## The risk, plainly

This project's job-automation features drive a real browser (Puppeteer) that
logs into third-party job sites, scrapes search listings, and auto-submits
application forms on the operator's behalf.

**Automated access, scraping, and automated submissions likely violate the
Terms of Service of every supported site.** Typical consequences, in ascending
order of severity:

- CAPTCHAs / bot challenges that block the automated session
- IP throttling or temporary blocks
- **Permanent account bans** — including the linked email account and any
  recruiter-side profile data
- For paid or employer accounts: forfeiture of the account and, in the worst
  case, claims under anti-circumvention law (e.g. CFAA in the US, IT Act
  provisions in India)

This repository is an engineering portfolio and research project. The authors
are **not liable** for how operators use it. Enabling these features is an
explicit, informed choice made solely by the operator.

## What the code does (and doesn't) do to stay quiet

The adapters already implement politeness controls — not as a legal shield,
but to avoid trivially detectable abuse:

- **Per-site concurrency**: one browser per site at a time (`siteConcurrency`,
  default 1), enforced via `acquireSiteSlot` in the worker
- **Rate delays**: `applyRateDelayMs` (default 15s) between submissions
- **Human-like pacing**: `gotoWithBackoff`, typed input with per-keystroke
  delay, explicit navigation delays
- **Session reuse**: cookies are captured once and refreshed proactively
  (`services/sessionRefresh.js`) instead of hammering login flows
- **Scheduled windows only**: fetches run on the `JOB_FETCH_SCHEDULE` cron
  (default once daily), not continuously

None of this makes automation compliant. It only reduces the chance of
disrupting other users of the site.

## Operator checklist (before going live)

1. **Use a dedicated, throwaway account** — never your primary personal or
   recruiter account. Assume it will eventually be banned.
2. **Check the site's ToS and `robots.txt`** for the specific automation
   clauses (e.g. Indeed's API/automation terms, Naukri's scraping clause).
   If operating a business on top of this, get legal advice first.
3. **Keep volumes low**: the defaults (single-site concurrency, 15s apply
   delay, daily fetch) are deliberately conservative. Do not crank them up.
4. **Prefer official APIs where they exist** (Indeed Publisher API,
   LinkedIn Jobs API) — this project's adapters exist for sites without
   usable public APIs.
5. **Honor removal requests**: if a site contacts you about automated
   access, disable that adapter immediately (`PUT /api/job-sites/:name` with
   `enabled: false`).
6. **Never store or expose scraped data beyond personal use** — job
   listings scraped here are for the operator's own application tracking only.

## Where the controls live

| Control | Location |
|---|---|
| Site enable/disable + credentials | `server/routes/job-sites.js` |
| Concurrency / rate defaults | `server/models/UserSettings.js`, `server/queue/worker.js` |
| Fetch schedule | `JOB_FETCH_SCHEDULE` in `server/.env` (see `.env.example`) |
| Session refresh cadence | `server/services/sessionRefresh.js` + `server/queue/scheduler.js` |
| Adapter implementations | `server/adapters/*.js` |

## Liability

This software is provided "as is", without warranty of any kind. The
operators of any deployment assume full responsibility for compliance with
third-party terms and applicable law.
