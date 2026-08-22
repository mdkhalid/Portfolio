# Social Publisher — LinkedIn + X Content Automation

> **Status:** In progress — Phases 0–3 shipped (`1424aa7`, `5e1d015`, `d10b6f3`, `406c7f6`, `dd847c3`); Phases 4–5 remaining
> **Created:** 2026-08-22
> **Scope:** Entirely new feature. Zero changes to existing features. Only additive edits:
> one new tab entry in `AdminDashboard.jsx`, new route mounts in `server.js`, new models/services/routes.

---

## ✅ Progress Log

| Phase | Status | Commit | Notes |
|---|---|---|---|
| Centralized error handling | ✅ Done | `5e1d015` | `socialFail()` funnel, 503 infra mapping, uncaughtException net, socket safeHandler, client `getApiErrorMessage` |
| 0 — Foundations | ✅ Done | `1424aa7` | Models, crypto util, route skeleton, queue jobs, env placeholders (also seeded into real `.env`) |
| 1 — Connections | ✅ Done | `d10b6f3` | LinkedIn + X OAuth (signed state, PKCE), encrypted tokens, popup connect flow, Social tab UI |
| 2 — AI Pipeline | ✅ Done | `406c7f6` | Prompt builders, OpenAI-compatible content/image calls, async Bull job, live socket steps |
| 3 — Preview UI | ✅ Done | `dd847c3` | Compose form, animated stepper, LinkedIn lookalike preview, inline editing, regenerate, prompts inspector |
| 4 — Publishing | ⏳ Next | — | LinkedIn image upload + post creation, X teaser with link, success-only counters |
| 5 — History & Polish | ⏳ Pending | — | Paginated archive, detail view, expired-token handling, setup docs |

**Verification so far:** 42/42 server tests pass · eslint + production build clean ·
end-to-end pipeline probe green (POST → async job → prompts persisted → graceful failure without keys).

**Blocked on user inputs (not code):** `CONTENT_AI_*` / `IMAGE_AI_*` keys (zenmux/aihub),
LinkedIn app Client ID/Secret, X app Client ID/Secret — placeholders already in `server/.env`.

---

## 1. Goal

Inside the Admin Dashboard, a new **"Social"** tab lets the admin:

1. Connect LinkedIn and X accounts once (official login on the platform's own page).
2. Type a few lines explaining a tech/education topic.
3. The app builds a **content prompt** and an **image prompt**, then generates a polished
   LinkedIn post text + a matching image.
4. Preview exactly how the post will look — before anything is published.
5. Publish to LinkedIn with one click. The app then writes a short teaser message for X
   containing the **LinkedIn post URL** and a call-to-action.
6. Track everything: successful post counts per content item, publish history,
   paginated archive of all posts from past months, detail view per item.

---

## 2. Confirmed Requirements

| # | Requirement | Decision / Behavior |
|---|---|---|
| 1 | Feature location | New tab (`Social`) inside existing `AdminDashboard.jsx`, same JWT admin auth |
| 2 | Content generation AI | OpenAI-compatible custom provider (zenmux / aihub) via dedicated env placeholders |
| 3 | Image generation AI | Separate OpenAI-compatible provider via its own dedicated placeholders |
| 4 | Platform login | **Official OAuth 2.0** only — app redirects to LinkedIn's / X's own login page; no username/password stored by this app |
| 5 | Generation input | Few lines of topic notes from admin |
| 6 | Prompt-first pipeline | App creates content prompt + image prompt first, shows them, then generates post text + image |
| 7 | Preview before publish | In-app realistic preview of the LinkedIn post (text + image) before any API call |
| 8 | Editability | Generated text editable before publishing; text/image independently regeneratable |
| 9 | Reposting | Same content can be posted to LinkedIn multiple times over months |
| 10 | Success counting | Per-item counters increment **only on confirmed successful publishes** |
| 11 | Publish log | Every publish attempt recorded: platform, date/time, URL, success/failure |
| 12 | X message | Short auto-written teaser + "read more" CTA linking to the LinkedIn post URL |
| 13 | History list | Paginated server-side list of all published posts (thumbnail, title, counts, date) |
| 14 | Detail view | Clicking a history item opens full content + image + links + publish log |
| 15 | Asynchronous everywhere | Generation & publishing run as background jobs (Bull) — UI never blocks |
| 16 | Live visibility | Socket.io pushes step-by-step progress events; animated status shown to user |
| 17 | Persistence | All drafts, prompts, images, statuses, URLs saved in MongoDB |
| 18 | Token security | OAuth tokens encrypted at rest (AES-256-GCM, dedicated key) |

---

## 3. New Environment Placeholders

Added to `.env.example` (all optional until each phase ships):

```bash
# ─── Social Publisher ─────────────────────────────────────────────────────────

# Content generation (OpenAI-compatible endpoint, e.g. zenmux / aihub)
CONTENT_AI_BASE_URL=
CONTENT_AI_API_KEY=
CONTENT_AI_MODEL=

# Image generation (separate OpenAI-compatible endpoint)
IMAGE_AI_BASE_URL=
IMAGE_AI_API_KEY=
IMAGE_AI_MODEL=
IMAGE_AI_SIZE=1024x1024

# LinkedIn Developer App (https://www.linkedin.com/developers/apps)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
# Redirect URL registered in the LinkedIn app:
LINKEDIN_REDIRECT_URI=http://localhost:5000/api/social/linkedin/callback

# X Developer App (https://developer.x.com) — OAuth 2.0 user context
X_CLIENT_ID=
X_CLIENT_SECRET=
# Redirect URI registered in the X app:
X_REDIRECT_URI=http://localhost:5000/api/social/x/callback

# AES-256-GCM key for encrypting stored social tokens (>= 32 chars)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SOCIAL_CREDENTIALS_KEY=

# Public base URL of this server used when building OAuth redirect URIs
SERVER_BASE_URL=http://localhost:5000
```

---

## 4. Architecture

### 4.1 Backend additions

```
server/
├── models/
│   ├── SocialConnection.js     # one row per connected platform (encrypted tokens)
│   └── SocialPost.js           # content items + publish log + counters
├── services/
│   ├── socialAi.js             # prompt builders + OpenAI-compatible calls (content & image)
│   ├── linkedinService.js      # OAuth exchange, token refresh awareness, image upload, post creation
│   ├── xService.js             # PKCE OAuth, token refresh, tweet creation
│   └── cryptoSocial.js         # AES-256-GCM encrypt/decrypt for tokens
├── routes/
│   └── social.js               # all /api/social/* endpoints (admin-JWT protected)
└── queue/
    └── socialJobs.js           # Bull producers/workers: generate_content, generate_image, publish_linkedin, publish_x
```

### 4.2 Data models (sketch)

**SocialConnection**
```
platform            'linkedin' | 'x'        (unique per platform)
accessToken         encrypted
refreshToken        encrypted (nullable)
expiresAt           Date
scope               String
platformUserId      String
platformUserName    String   # display name for UI badges
avatarUrl           String   # optional, for realistic preview
status              'connected' | 'expired' | 'disconnected'
connectedAt / updatedAt
```

**SocialPost**
```
topicNotes          String    # admin's few lines of raw input
contentPrompt       String    # built by app (visible/editable in UI)
imagePrompt         String    # built by app (visible/editable in UI)
content             { hook, body, hashtags[], fullText }   # generated LinkedIn post
xMessageTemplate    String    # short teaser (LinkedIn URL appended at send time)
imagePath           String    # /uploads/social/<uuid>.png (served statically)
status              'generating' | 'draft' | 'ready' | 'failed'
lastError           String
linkedinCount       Number    # SUCCESSFUL publishes only (default 0)
xCount              Number    # SUCCESSFUL publishes only (default 0)
publishes           [{ platform, url, platformPostId, postedAt, ok, error }]
createdAt / updatedAt                       # indexed: createdAt desc for pagination
```

### 4.3 Async job flow (no lag)

```
Admin clicks Generate
  → POST /api/social/posts            (creates SocialPost, returns id instantly)
  → Bull job social.generate          (worker: build prompts → CONTENT_AI → IMAGE_AI → save)
  → socket.io 'social:progress' events per step:
       building_prompts → writing_content → creating_image → saving_draft → done|error

Admin clicks Post to LinkedIn
  → POST /api/social/posts/:id/publish/linkedin   (queues job, returns immediately)
  → worker: register image asset → upload binary → create post → verify → save URL
  → on verified success ONLY: linkedinCount++ , publish log entry appended
  → socket events mirror every step + final URL

Admin clicks Post to X
  → queues publish_x with the saved LinkedIn URL embedded in the teaser
  → on verified success ONLY: xCount++ , publish log entry appended
```

Socket room pattern reuses the existing apply-progress convention already present
in the codebase (`applySocketRef` in `AdminDashboard.jsx`).

### 4.4 Frontend additions

```
client/src/
├── features/social/
│   ├── SocialTab.jsx          # wizard container (connect → compose → generating → preview → done)
│   ├── ConnectCards.jsx       # LinkedIn/X connect buttons + status badges
│   ├── ComposeForm.jsx        # topic notes textarea + tone/hashtag options
│   ├── GeneratingOverlay.jsx  # animated step-by-step progress (socket-driven)
│   ├── PostPreview.jsx        # realistic LinkedIn card lookalike (editable text)
│   ├── PromptPanel.jsx        # shows/editable content + image prompts
│   ├── HistoryList.jsx        # paginated table/cards w/ thumbnails + counters
│   └── PostDetail.jsx         # full content, image, links, publish log
```

New tab entry `{ key: 'social', label: 'Social', icon: ... }` added to the `tabs`
array in `AdminDashboard.jsx` — nothing else in the dashboard changes.

---

## 5. API Endpoints (all under `/api/social`, JWT-protected)

| Method | Path | Purpose |
|---|---|---|
| GET | `/connections` | Connection status for both platforms |
| GET | `/linkedin/connect` | 302 redirect to LinkedIn OAuth consent |
| GET | `/linkedin/callback` | Code exchange → encrypted token storage → close popup |
| POST | `/linkedin/disconnect` | Mark disconnected, wipe tokens |
| GET | `/x/connect` | 302 redirect to X OAuth (PKCE + state) |
| GET | `/x/callback` | Token exchange + refresh-token storage → close popup |
| POST | `/x/disconnect` | Mark disconnected, wipe tokens |
| POST | `/posts` | Create draft from topic notes, kick off generation job |
| GET | `/posts?page=&limit=&status=` | Paginated history (lean projection) |
| GET | `/posts/:id` | Full detail incl. publish log |
| DELETE | `/posts/:id` | Remove item |
| POST | `/posts/:id/regenerate/text` | Re-run content generation only |
| POST | `/posts/:id/regenerate/image` | Re-run image generation only |
| PUT | `/posts/:id` | Save manual edits to text/prompts |
| POST | `/posts/:id/publish/linkedin` | Queue LinkedIn publish job |
| POST | `/posts/:id/publish/x` | Queue X publish job (uses stored LinkedIn URL) |

---

## 6. Phases

Each phase is independently verifiable and leaves the app fully working.
No phase modifies existing behavior.

### Phase 0 — Foundations
- Add env placeholders to `.env.example`
- Models: `SocialConnection`, `SocialPost` (+ indexes)
- `cryptoSocial.js` encryption util
- Mount `/api/social` router skeleton (auth-guarded)
- Bull queue definitions stubbed
- **Verify:** server boots clean, old features unaffected, models persist

### Phase 1 — Platform Connections
- LinkedIn OAuth 2.0 (OIDC scopes: `openid profile email w_member_social`)
- X OAuth 2.0 PKCE user-context (scopes: `tweet.read tweet.write users.read offline.access`)
- Encrypted token storage, expiry tracking, disconnect
- `ConnectCards.jsx` UI with live status badges
- **Verify:** click Connect → platform login page → return → badge shows Connected ✓

### Phase 2 — AI Generation Pipeline
- Prompt builders (content prompt + image prompt from few topic lines)
- OpenAI-compatible clients honoring `*_BASE_URL` overrides
- Async Bull jobs with socket.io progress events
- Images saved to `server/uploads/social/`
- **Verify:** POST topic notes → job completes → DB has prompts/content/image path

### Phase 3 — Preview UI
- Wizard flow in `SocialTab.jsx`
- Animated generation overlay driven by socket events (clear step visibility)
- Realistic LinkedIn post lookalike preview, inline editing, regenerate buttons
- **Verify:** end-to-end compose → watch animation → see/edit preview

### Phase 4 — Publishing
- LinkedIn: register-image-upload → binary upload → UGC post → capture public URL
- X: tweet with teaser + LinkedIn URL
- Success-only counter increments + publish log entries
- Result URLs surfaced in UI (copyable)
- **Verify:** real posts appear on both platforms; counts increase only on confirmed success

### Phase 5 — History & Polish
- Server-paginated history list + detail view
- Error surfacing/retry, expired-token handling prompts reconnect
- Setup documentation (LinkedIn dev app + X dev account step-by-step)
- **Verify:** months-scale list paginates fast; clicking items opens detail instantly

---

## 7. One-Time External Setup (admin action, ~20 min, free)

Needed before Phase 1 testing:

1. **LinkedIn app** — https://www.linkedin.com/developers/apps
   - Product: *Sign In with LinkedIn using OpenID Connect* + *Share on LinkedIn*
   - Add redirect URL matching `LINKEDIN_REDIRECT_URI`
   - Copy Client ID/Secret into `.env`
2. **X app** — https://developer.x.com
   - Enable OAuth 2.0, user context, add `X_REDIRECT_URI`
   - Copy Client ID/Secret into `.env`
3. Provider keys for `CONTENT_AI_*` and `IMAGE_AI_*`

Detailed click-by-click guide will be written during Phase 1 delivery.

---

## 8. Non-Goals / Explicit Exclusions

- No scheduling/auto-posting cron (possible future phase)
- No multi-account support (single admin's own profiles)
- No comment/like analytics ingestion
- No credential (username/password) automation — official OAuth only, per decision
- No changes to existing chat/ATS/job features or their keys
