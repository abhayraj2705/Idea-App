# IDEA Platform Mobile App: Master Plan

> **Status:** Plan. Nothing in `mobile/` exists yet.
> **Goal:** Ship native iOS and Android apps for the IDEA Platform, launching alongside the web app, on top of the backend that already exists.
> **Owner doc:** This is the single source of truth for the mobile client. Update it when scope, endpoints or launch criteria change, the same way `README.md` and `docs/HANDOVER_NOTES.md` track the web platform.

---

## 0. Read this first

- **This is the app *for* the platform, not the apps the platform *generates*.** `backend/src/modules/ai/mobile/` and docs/MOBILE_APP_PIPELINE_PLAN.md cover the pipeline that generates React Native apps for users. This document covers the IDEA app itself, on the App Store and Play Store, where users sign in, describe an idea, watch it generate, preview it, refine it and ship it.
- **The backend is the contract.** Every screen below maps to an endpoint that already exists (§5). The client adds no business logic the server doesn't already enforce. Quota, rate limits, plan approval, scope and generation all stay server-side.
- **Additive backend changes only.** §6 lists the small gaps a native client exposes, such as OAuth redirects that assume a browser popup, plus store-mandated features. Every one of them is a new route or an extra accepted value. None changes how the web app behaves, so the two clients can ship in parallel.
- **Envelope.** Every response is `{ success: boolean, data: T | null, error: string | null }`. The mobile API layer unwraps it once, in one place (§8.3).

---

## 1. Product scope

### 1.1 What the mobile app is for

The phone is where people **start ideas, follow builds and react to them**. It is not where they read 40 files of generated code. The design rule is that **every core loop can be completed on the phone**, and the deep work (large code reading, design canvas, admin) stays on the web or opens there.

| Loop | Mobile v1 | Notes |
|---|---|---|
| Sign up / sign in / verify / reset / 2FA | ✅ Full | Email + Google + Apple (iOS, store-required) + GitHub |
| Describe idea → requirements → wireframe approval → generate | ✅ Full | Same gates as web (`wireframeGate`, `planApprovalGate`) |
| Watch a generation live, leave, come back, get notified | ✅ Full | Job stream reattach + push notification |
| Preview a generated **web** app | ✅ WebView | Preview proxy |
| Preview a generated **mobile** app | ✅ Native | Open directly in Expo Go (deep link), no QR needed on the same device |
| Refine / Edit-chat (Ask / Edit / Agent) with diff review | ✅ Full | Diff review shown as a per-file hunk list |
| Conversation thread + restore points | ✅ Full | |
| Browse files, read code | ✅ Read-only | Syntax-highlighted viewer, search |
| Download ZIP / share project | ✅ Share sheet | |
| Deploy (Vercel / Railway / GitHub push) | ✅ Launch + status | OAuth connection via in-app browser |
| Android APK build of a generated app | ✅ Trigger + status + install link | Behind `mobileBuild` |
| Templates gallery, clone | ✅ Full | |
| Teams (invite, accept, roles) | ✅ Full | Invite accept via universal link |
| Settings: profile, password, 2FA, BYO API keys, connections | ✅ Full | |
| Database connections (`/api/db`) | ⚠️ List + test only | Create/provision opens web |
| Design canvas (`/design/*`) | ❌ Opens web | Not a phone interaction |
| Admin console (`/admin/*`) | ❌ Not in app | Web only, never bundled |
| Billing / pricing | ❌ Hidden | See §6.7, store payment rules |
| Legacy template builder / `/api/project/generate` | ❌ Never | Legacy scaffolder |

### 1.2 Out of scope for v1
Code editing by hand (edits go through Edit chat), the design canvas, admin, billing purchase, tablet-specific layouts (the app must *work* on tablets, it just isn't optimised for them), offline generation, and a desktop app.

---

## 2. Technology decisions

| Concern | Choice | Why |
|---|---|---|
| Framework | **React Native + Expo (SDK 58), Expo Router**, TypeScript strict | The team already owns an Expo contract (`mobile-contract.ts`), the sandbox Expo template and the know-how. One codebase for iOS and Android. Matches the platform's newest supported SDK. |
| Build / release | **EAS Build, EAS Submit, EAS Update** | Store builds without local Xcode, signed Android builds, OTA JS fixes between store releases. |
| Server state | **TanStack Query v5** | Caching, retries, background refetch and pagination. Every REST call goes through it. |
| Client state | **Zustand** (small: session, active job, UI prefs) | No Redux boilerplate. |
| Forms / validation | **react-hook-form + zod** | zod is already the backend's schema library, so shared shapes can be copied 1:1. |
| HTTP | `fetch` wrapper (no axios) | Streaming needs `fetch` anyway, so one client covers both. |
| Streaming | **`react-native-sse`** for `GET /api/ai/jobs/:id/stream`, with a polling fallback on `GET /api/ai/jobs/:id/events?fromSeq=N` | RN `fetch` can't read SSE bodies reliably on Android. The poll fallback makes background/foreground and flaky networks safe. |
| Secure storage | **expo-secure-store** (JWT, guest tokens) | Keychain / Keystore. Never AsyncStorage for credentials. |
| Non-secret storage | **react-native-mmkv** (query cache persistence, prefs) | Fast, synchronous. |
| Auth providers | **expo-auth-session** (Google, GitHub), **expo-apple-authentication** (iOS) | |
| In-app browser | **expo-web-browser** (OAuth, docs, "open on web") | |
| Push | **expo-notifications** + Expo Push Service (FCM/APNs underneath) | One API for both stores. Backend sends through Expo's HTTP API. |
| Deep links | Expo Router + **universal links (iOS) / App Links (Android)** on the web domain, plus custom scheme `ideaplatform://` | Email verify, reset password, team invites and OAuth return all land in the app. |
| WebView | **react-native-webview** | Web app previews, mobile-web previews. |
| Code viewer | **react-native-syntax-highlighter** (or Shiki pre-rendered), virtualised with **FlashList** | Large files must not freeze the JS thread. |
| Markdown | **react-native-markdown-display** | Assistant replies (parity with `ChatMarkdown.tsx`). |
| Lists | **@shopify/flash-list** | Projects, files, messages, events. |
| Animation | **react-native-reanimated** | Generation progress, sheets. |
| Errors / crashes | **Sentry (`@sentry/react-native`)** | The backend already uses Sentry, so both ends land in one place. Tag events with `jobId`. |
| Analytics | **Firebase Analytics → same GA4 property** as web | The web already reports to GA4 (HANDOVER_NOTES). Use one property with a `platform` dimension. |
| i18n | **expo-localization + i18next**, English only at launch | String keys from day one, so adding a language later doesn't mean a rewrite. |
| Testing | **Jest + React Native Testing Library**, **Maestro** E2E, **MSW** for API mocks | §12 |

**Rejected:** Flutter (a second language and none of the existing Expo knowledge), a pure WebView wrapper around the Next.js app (Apple rejects thin wrappers under 4.2, and the generation UI needs native streaming and push to feel right), and Capacitor (same 4.2 risk).

---

## 3. Repository layout

The app lives in the monorepo as a third deployable, next to `backend/` and `frontend/`:

```
IDEA/
├── backend/
├── frontend/
├── mobile/                      ← new
│   ├── app/                     # Expo Router routes (§7)
│   ├── src/
│   │   ├── api/                 # client.ts, endpoints/*.ts, types.ts, sse.ts
│   │   ├── features/            # auth, projects, builder, generation, preview,
│   │   │                        # chat, files, deploy, mobileBuild, teams,
│   │   │                        # templates, settings, notifications
│   │   ├── components/          # design-system primitives (Button, Card, Sheet…)
│   │   ├── theme/               # tokens.ts (generated, §9), ThemeProvider
│   │   ├── stores/              # zustand stores
│   │   ├── lib/                 # secureStore, deepLinks, analytics, sentry, flags
│   │   └── i18n/
│   ├── assets/                  # icon, splash, fonts
│   ├── e2e/                     # Maestro flows
│   ├── app.config.ts            # reads APP_ENV → dev/staging/prod
│   ├── eas.json
│   └── package.json
└── docs/MOBILE_APP_MASTER_PLAN.md
```

**Shared types.** Don't import from `backend/src` directly, because Metro would try to bundle server code. Use one of these instead:
1. **v1:** copy the API types into `mobile/src/api/types.ts`, with a CI check (`npm run check:api-types`) that diffs them against the backend's zod schemas and fails on drift.
2. **Later:** extract `packages/api-contract` (zod schemas + inferred types) that both `backend` and `mobile` import. Do this only once the web frontend also wants it.

**Design tokens** are generated from `frontend/styles/tokens.json` (§9). Never hand-copy them.

---

## 4. Environments

| Env | API base URL | EAS channel | Bundle ID / package |
|---|---|---|---|
| development | `http://<LAN-IP>:5000` (backend `npm run dev`) | `development` (dev client) | `com.ideaplatform.app.dev` |
| staging | staging API host | `staging` | `com.ideaplatform.app.staging` |
| production | production API host | `production` | `com.ideaplatform.app` |

The three apps install side by side. `app.config.ts` picks the name, icon badge, scheme, bundle ID, API URL, Sentry DSN and Google client IDs from `APP_ENV`. Secrets go in EAS secrets, never in the repo.

**CORS:** native requests send no `Origin` header, and `utils/corsPolicy.ts`'s `resolveCorsDecision` already allows `!origin`. No change is needed. The Android emulator reaches the host's localhost at `10.0.2.2`.

---

## 5. Backend contract (what already exists)

All of these are mounted in `backend/src/server.ts` today. "Auth" means `Authorization: Bearer <jwt>`. "Optional" means `optionalAuth`: guests work too, tracked by `guestToken`.

### 5.1 Auth: `/api/platform/auth`
| Method | Path | Use in app |
|---|---|---|
| POST | `/register` | Sign up |
| POST | `/login` | Sign in. Can return a 2FA-pending token (5-minute JWT) |
| POST | `/2fa/verify` | Second step of sign-in |
| POST | `/google` | `{ idToken }` → session (**needs §6.1**) |
| GET | `/github/start`, `/github/callback` | GitHub sign-in (**needs §6.2**, currently popup + `postMessage`) |
| POST | `/forgot-password`, `/reset-password` | Reset via deep link |
| POST | `/verify-email`, `/resend-verification` | Verify via deep link |
| GET | `/me` | Bootstrap the session on launch |
| PATCH | `/profile` · POST `/change-password` | Settings |
| POST | `/onboarding/complete` | First-run onboarding |
| POST | `/2fa/setup`, `/2fa/enable`, `/2fa/disable` | Security settings (show the TOTP secret as a copyable string as well as a QR, because the user is *on* the phone that would scan it) |
| POST | `/api-keys` · DELETE `/api-keys/:provider` | Bring-your-own-key |
| GET | `/quota` | Quota meter on the home screen and before generate |

**Session model:** a single JWT that lasts **7 days** (`platform-auth.service.ts`), with no refresh token. The app stores it in SecureStore, sends it as a bearer token, and on any `401` clears it and routes to sign-in, keeping the user's draft idea (§8.4). A refresh-token flow is a v1.1 improvement (§6.9), not a launch blocker.

### 5.2 Projects: `/api/platform/projects`
`GET /` (list) · `GET /:id` · `DELETE /:id` · `GET /:id/download` (ZIP) · `PATCH /:id/public` · `PATCH /:id/team-shared` · `GET /templates` · `POST /templates/:templateId/clone` · `POST /from-template` · legacy `GET /:id/versions`, `POST /:id/versions/restore` (only when `conversationThread` is off, so the app doesn't need them).

**Conversation thread** (mounted under `/:projectId`, `optionalAuth`, guest-accessible):
`GET|POST /:projectId/conversations` · `GET|POST /:projectId/conversations/:conversationId/messages` · `GET /:projectId/conversations/:conversationId/messages/:messageId` · `GET /:projectId/checkpoints/:checkpointId` · `POST /:projectId/checkpoints/:checkpointId/restore`.

### 5.3 AI: `/api/ai`
| Method | Path | Use |
|---|---|---|
| GET | `/providers`, `/capabilities` | Model picker, stack list (from `stacks/registry.ts`: show `status` badges ga/beta/experimental) |
| POST | `/estimate` | Token/time estimate shown before Generate |
| POST | `/requirements`, `/requirements/suggest`, `/requirements/compile` | Idea → structured requirements |
| POST | `/wireframe` | Wireframe gate |
| POST | `/generate/v2` | **Start generation.** With Redis: `202 { jobId, guestToken?, streamUrl }`. Without Redis it streams SSE in-request; production must run Redis (§6.8) |
| POST | `/refine`, `/chat` | Legacy chat/refine (when `editChat` is off) |
| POST | `/chat/v2` | Edit chat: Ask / Edit / Agent (flag `EDIT_CHAT_ENABLED`) |
| GET | `/edits/:proposalId` · POST `/edits/:proposalId/apply` · POST `/edits/:proposalId/discard` | Diff review |
| POST | `/patch/propose`, `/patch/apply` | Surgical patches |
| POST | `/explain` | "Explain this file" |
| POST | `/design-to-code` | Photo/screenshot → code (camera input on phone, §7.4) |
| GET | `/usage-stats` | Usage screen |

**Generation jobs:** `/api/ai/jobs`
`GET /` (my jobs) · `GET /:jobId` · `GET /:jobId/events?fromSeq=N` (persisted transcript) · `GET /:jobId/stream?fromSeq=N` (SSE: replay, then live) · `POST /:jobId/cancel` · `/retry` · `/finalize` ("Deliver as-is") · `/approve-plan` · `/adjust-plan` · `/preview-change-request` · `/repair`.

**Stream events the app must handle** (from `generation-runner.ts`): `phase`, `plan_ready`, `plan_completed`, `module_complete`, `file_checkpoint`, `healing_scan`, `healing_pass`, `healing_round`, `healing_files`, `healing_convergence`, `typecheck_report`, `compile_report`, `validation_report`, `verification_report`, `quality_report`, `issue_ledger`, `preview_readiness`, `budget_report`, `completeness_gap`, `phase_diagnostic`, `token_limit`, `codemod_report`, `repair_report`, `generation_quality_complete`, `complete`, `error`. Edit chat adds `turn`, `delta`, `agent_step`, `proposal`, `scope_upgrade_required`.
**Rule:** unknown event types are ignored and logged, never a crash. The server adds events over time.

### 5.4 Preview
- Web app previews: `/api/ai/preview/...` proxy (`preview-proxy.routes.ts`, session token via `POST /:projectId/__control/session-token`) → render in WebView.
- Data proxy for previews: `/api/preview/sessions…`.
- Mobile app previews: `POST /api/mobile/projects/:projectId/preview` (auth) → preview id → `GET /api/mobile/previews/:previewId` (+ `/manifest`, `/web/*`, `/android/*`, capability-token based). On a phone, **open the Expo Go manifest URL directly** (`exp://…` / `Linking.openURL`) instead of showing a QR code. Keep the QR code for "preview on another device". For SDK-54 projects (`previewEngineFor` → Snack), keep the same explicit "this sends your code to Expo" confirmation the web has in `ExpoSnackPreview.tsx`.

### 5.5 Mobile builds: `/api/mobile`
`GET /sdk` · `GET /projects/:id/readiness` · `POST /projects/:id/repair` · `GET|POST /projects/:id/sdk|upgrade-sdk` · `GET|POST /projects/:id/builds` · `GET /builds/:buildId`. When an APK build finishes, offer **"Install on this phone"** (Android only: download the artifact and hand it to the system installer via intent). On iOS, show "Android build ready" with share.

### 5.6 Deploy: `/api/deploy`
`GET /providers` · `POST /plan/preview` · `POST /launch` · `GET /plan/:planId`, `GET /plans/:projectId`, `POST /plan/:planId/cancel` · `GET /deployments/:projectId` · `GET /deployment/:id/status` · Vercel / Railway / GitHub endpoints · `GET /github/oauth/start` + `/github/callback` (**needs §6.2**).

### 5.7 Connections, teams, DB, billing
- `/api/platform/connections`: `GET /capabilities`, `GET /`, `POST /:provider/oauth/start`, `GET /:provider/callback` (**needs §6.2**), `POST /:provider/pat`, `DELETE /:id`.
- `/api/platform/teams`: `POST /`, `GET /my-team`, `POST /invite`, `POST /accept-invite`, member role/remove, `POST /transfer-ownership`, `DELETE /invites/:token`, `POST /leave`, `DELETE /`.
- `/api/db`: `GET /engines`, `GET /`, `POST /:id/test` (v1 is read and test only).
- `/api/platform/billing`: **not used by the app** (§6.7).

---

## 6. Backend changes required for mobile

Each item is additive and has its own test. None alters web behaviour. **Ship 6.1–6.6 before store submission.**

### 6.1 Google sign-in: accept the mobile client IDs *(blocker)*
`loginWithGoogle` verifies against a single `GOOGLE_CLIENT_ID`. Native Google sign-in issues ID tokens whose `aud` is the iOS or Android OAuth client.
**Change:** read `GOOGLE_CLIENT_IDS` (comma list: web, iOS, Android) and pass the array as `audience`. Fall back to `GOOGLE_CLIENT_ID`. Keep the `email_verified` check exactly as is.
**Test:** a token whose audience is any listed ID passes, and an unlisted audience fails.

### 6.2 OAuth redirect for native clients *(blocker)*
GitHub sign-in (`/api/platform/auth/github/*`), the deploy GitHub OAuth and the provider connections all finish with `renderOauthPopup` (an HTML page that `postMessage`s to `window.opener`) and use a **state cookie**. Neither survives a system browser handing back to a native app.
**Change:** add an optional `client=mobile&redirect=ideaplatform://oauth` on `start`:
- validate `redirect` against an allow-list (`MOBILE_OAUTH_REDIRECTS`, never an open redirect);
- store `state` server-side (Redis or Mongo, 10-minute TTL) instead of the cookie, keyed by state;
- on callback, `302` to `ideaplatform://oauth?code=<one-time-exchange-code>&type=…` (never the JWT itself in a URL);
- new `POST /api/platform/auth/oauth/exchange { code }` → `{ token, user }`. The code is single-use with a 60-second TTL.
- provider connections (repo/deploy) use the same pattern, where the exchange returns `{ connectionId }`.
The app opens `start` with `WebBrowser.openAuthSessionAsync`. **Tests:** a disallowed redirect is rejected, a reused code fails, an expired code fails, and the web popup path is unchanged.

### 6.3 Sign in with Apple *(blocker for iOS)*
App Store Guideline 4.8: an app that offers Google/GitHub sign-in must also offer Sign in with Apple.
**Change:** `POST /api/platform/auth/apple { identityToken, nonce, fullName? }`. Verify against Apple's JWKS (`aud` = bundle ID), check the nonce, then find-or-create by `sub` (store `appleSub` on `PlatformUser`) and fall back to the email. Handle Apple private-relay emails. The user's name is only sent on first sign-in, so persist it then.

### 6.4 Account deletion *(blocker for both stores)*
Apple 5.1.1(v) and Google Play both require in-app account deletion. There is no such endpoint today.
**Change:** `DELETE /api/platform/auth/me` (auth + password or recent 2FA re-confirm). Then:
- cancel the user's running jobs;
- delete projects, conversations, checkpoints, edit proposals, connections (revoking OAuth tokens where the provider allows), sealed API keys, and device tokens (§6.5);
- transfer or dissolve team ownership (reuse the team rules: block if they're the sole owner of a team with members, and tell them why);
- write an audit entry (the admin `/audit` already exists) without PII;
- also expose a web URL for "request deletion" (Play requires a web link too).
**Test:** after deletion, `/me` returns 401 and none of the user's documents remain.

### 6.5 Push notifications
**Model:** `DeviceToken { userId, expoPushToken, platform, appVersion, lastSeenAt }`.
**Routes:** `POST /api/platform/notifications/devices` (register/refresh), `DELETE /api/platform/notifications/devices/:token` (sign-out), `GET|PATCH /api/platform/notifications/preferences`.
**Senders** (a small `notifications` module calling Expo's push API, batched, with receipts checked and dead tokens pruned):
| Trigger | Where it hooks | Message |
|---|---|---|
| Job reached `complete` / `partial` / failed | `generationJobService.markComplete` / failure path (worker) | "Your app *{name}* is ready" / "finished with issues" / "failed, tap to retry" |
| Plan ready for approval (`planApprovalGate`) | where `plan_ready` is emitted | "Review the plan for *{name}*" |
| APK build finished | mobile-builds refresh | "Android build ready" |
| Deploy finished/failed | deploy status | "Live at {url}" |
| Team invite | `teams` invite | "{who} invited you to {team}" |
The notification payload carries **ids only** (`jobId`, `projectId`), never code, prompts or emails. Fire it after the Mongo write so tapping it always finds data. Notifications are a no-op when `EXPO_ACCESS_TOKEN` isn't set (same pattern as Sentry).

### 6.6 App config / forced update
`GET /api/platform/app-config` (public) → `{ minSupportedVersion: { ios, android }, latestVersion, maintenance: { active, message }, features: { editChat, mobileBuild, planApprovalGate, generationScope, wireframeGate, frontendPreview, conversationThread } }`.
This is the **server-driven** source for feature flags, so the app never hardcodes a flag that must "stay in step with the backend" the way `frontend/config/features.ts` does. Below the minimum version, the app shows a blocking "Update required" screen. It also gives an emergency kill switch per feature.

### 6.7 Billing stays off in the app
Phase 1 is free (`BILLING_ENABLED=false`), so nothing to do at launch. **Before billing is turned on:** digital subscriptions sold *inside* an iOS/Android app must use in-app purchase (Apple 3.1.1, Google Play Billing). Options, to be decided then:
(a) the app never shows prices or upgrade buttons and the web sells plans (the "reader"-style approach; no in-app link to buy, except where regional rules allow),
(b) RevenueCat + IAP, with a new `POST /api/platform/billing/iap/verify` that maps the store entitlement onto the same plan record Stripe writes.
Until decided: the app hides every price, and a quota-exhausted state says "limit reached, resets at {time}", with no purchase CTA.

### 6.8 Redis is required in production
Without `REDIS_URL`, `/generate/v2` runs inline over SSE for the life of one HTTP request. A phone that locks its screen or changes network kills that run. **Production and staging must run the queue + worker**, so the app always gets `202 { jobId }` and reattaches. The app's code still handles the inline SSE response for local development.

### 6.9 Nice-to-have (v1.1)
- Refresh tokens (short access JWT + rotating refresh token, revocable per device) replacing the 7-day bearer.
- `GET /api/platform/projects/:id/files/:path` for lazy file loading. Today `GET /:id` returns the whole project, which is fine up to a few MB. Measure first.
- Rate-limit keys that include the user id, not just the IP. Mobile carrier NAT puts many users behind one IP, so check whether `generationLimiter`'s per-IP keying causes false 429s in staging.
- UGC reporting endpoint (§13.3) if public projects/templates are browsable in-app.

---

## 7. Screens and navigation

Expo Router file tree (`mobile/app/`):

```
_layout.tsx                    # providers, auth gate, deep-link handling, update gate
(auth)/welcome.tsx             # value prop + Continue with Apple/Google/GitHub/email
(auth)/sign-in.tsx
(auth)/sign-up.tsx
(auth)/two-factor.tsx
(auth)/forgot-password.tsx
(auth)/reset-password.tsx      # deep link: /reset-password?token=
(auth)/verify-email.tsx        # deep link: /verify-email?token=
(onboarding)/index.tsx         # 3 cards + pick default stack → /onboarding/complete
(tabs)/_layout.tsx             # bottom tabs: Home · Projects · New(+) · Activity · Profile
(tabs)/home.tsx                # quota meter, running jobs, recent projects, templates strip
(tabs)/projects.tsx            # list, search, filter (mine/team/public), swipe actions
(tabs)/new.tsx                 # → builder flow (modal stack)
(tabs)/activity.tsx            # jobs list (GET /api/ai/jobs) + notifications inbox
(tabs)/profile.tsx
builder/idea.tsx               # prompt input, voice dictation, attach screenshot
builder/scope.tsx              # website-only vs full app (generationScope flag)
builder/stack.tsx              # stack picker with status badges + capability chips
builder/requirements.tsx       # editable requirement list, suggest more
builder/wireframe.tsx          # wireframe approval (wireframeGate)
builder/review.tsx             # estimate + quota + model → Generate
job/[jobId].tsx                # live generation screen
job/[jobId]/plan.tsx           # plan approval / adjust (planApprovalGate)
project/[id]/index.tsx         # overview: status, preview card, actions
project/[id]/chat.tsx          # conversation thread + composer (Ask/Edit/Agent)
project/[id]/proposal/[pid].tsx# diff review: per-file hunks, Keep/Discard
project/[id]/files.tsx         # tree + search
project/[id]/file.tsx          # code viewer (?path=)
project/[id]/preview.tsx       # WebView or Expo Go launcher
project/[id]/deploy.tsx        # plan → launch → status timeline
project/[id]/android-build.tsx # readiness → build → install
project/[id]/history.tsx       # checkpoints (restore)
templates/index.tsx, templates/[id].tsx
team/index.tsx, team/invite.tsx, team/accept.tsx   # deep link /team/accept?token=
settings/account.tsx, settings/security.tsx (password, 2FA),
settings/api-keys.tsx, settings/connections.tsx, settings/notifications.tsx,
settings/appearance.tsx, settings/about.tsx (licences, version, privacy, terms),
settings/delete-account.tsx
update-required.tsx, maintenance.tsx, +not-found.tsx
```

### 7.1 Home
Quota meter (`/quota`, "x of y today, resets at …"; hidden when unlimited), **running jobs** cards with live progress (each subscribes to its stream while visible), recent projects, the templates strip and a big "New idea" button.

### 7.2 Builder flow (mirrors `select-ai.tsx` → `ai-generate.tsx`)
1. **Idea.** Multiline input with keyboard-safe layout, dictation through the system keyboard mic, and an optional screenshot/photo attachment that routes to `/design-to-code`. Example prompts come from the templates.
2. **Scope** (if the flag is on) → **Stack** (from `/capabilities`; `experimental` stacks are behind "Show experimental") → **Requirements** (`/requirements`, editable, `/requirements/suggest`, `/requirements/compile`) → **Wireframe** (`/wireframe`, approve or regenerate) → **Review** (`/estimate`, quota check, BYO key notice).
3. **Generate** → `POST /generate/v2` with an `Idempotency-Key` header (a UUID per tap, so a double tap or retry doesn't double charge; the controller already dedups) → navigate to `job/[jobId]`, storing `guestToken` in SecureStore if present.
**Draft persistence:** each builder step saves to MMKV, so being killed by the OS or a 401 never loses a typed idea.

### 7.3 Live generation screen (`job/[jobId]`)
- **Header:** project name, stack, elapsed time, Cancel.
- **Stage rail:** Plan → Generate → Verify → Heal → Finalise, driven by `phase`, `plan_ready`, `module_complete`, `healing_*`, `generation_quality_complete`.
- **File feed:** `file_checkpoint` events animate into a list (path + size). Tap one to peek at the content.
- **Healing line:** "Round 3 · 12 → 4 errors" from `healing_round` / `healing_convergence` (flag `elasticGenerationBudget`), plus a **"Deliver as-is"** button → `POST /finalize`.
- **Reports** (collapsible): validation, typecheck, verification, `issue_ledger`, `preview_readiness`, `budget_report`.
- **End state:** `complete` → confetti-free success card with Preview / Chat / Deploy. `partial` → shows what blocked, with Repair (`/repair`) and Retry. `error` → message + Retry (`/retry`) + "Report".
- **Lifecycle:** reconnect with `?fromSeq=<lastSeq>` on foreground, network change or SSE error (exponential backoff, max 30 s). After 3 SSE failures, switch to polling `/events?fromSeq=` every 3 s. On background, close the stream and rely on push. Never hold a socket in the background.
- **Plan approval:** `plan_ready` with the gate on → push + in-app sheet → `approve-plan` / `adjust-plan`.

### 7.4 Project chat (`project/[id]/chat`)
- The thread comes from `conversations` + `messages` (paginated by `seq`, inverted FlashList).
- Messages with a `checkpointId` show **"Restore to here"** → confirm sheet → `POST /checkpoints/:id/restore` (append-only, so say "This adds a new restore point", not "undo").
- The composer has mode chips **Ask / Edit / Agent** when `editChat` is on, otherwise the legacy Chat/Refine. Stream `turn`/`delta`/`agent_step`; on `proposal` → open the diff review.
- **Diff review:** a file list with +/– counts; each file shows unified hunks (no side-by-side on a phone). **Keep** → `/edits/:id/apply`, **Discard** → `/discard`. A `409`/conflict means "Project changed since this suggestion; regenerate?"
- `scope_upgrade_required` → a sheet that explains it and offers "Upgrade to full app".

### 7.5 Files & code
A tree with collapsible folders, fuzzy search, a syntax-highlighted viewer (virtualised by line, line numbers, horizontal scroll, monospace font from tokens), Copy, Share, and "Explain" (`/explain`). It's read-only, and edits go through chat.

### 7.6 Preview
- **Generated web app:** WebView on the preview proxy with a session token, pull-to-reload, a device-size toggle (phone/tablet/desktop via viewport scaling), and "Open in browser". When `preview_readiness` says not ready, show the reasons, not a blank WebView.
- **Generated mobile app:** "Open in Expo Go" (deep link; links to the store if it isn't installed), plus "Show QR for another device", plus the web build in a WebView as a quick look. Show "Upgrade SDK" when `/projects/:id/sdk` reports an older SDK.

### 7.7 Deploy, Android build, templates, team, settings
Each follows its endpoint group in §5. Deploy and builds show a vertical **status timeline** that polls its status endpoint every 5 s while the screen is visible, then relies on push.

---

## 8. App architecture

### 8.1 Layers
`screen (app/)` → `feature hooks (features/*/use*.ts, TanStack Query)` → `api endpoints (api/endpoints/*.ts)` → `api client (api/client.ts)`. Screens never call `fetch`, and endpoints never touch React.

### 8.2 Query keys & caching
`['me']`, `['quota']`, `['projects', filter]`, `['project', id]`, `['conversation', projectId]`, `['messages', conversationId]`, `['jobs']`, `['job', jobId]`, `['deployments', projectId]`, `['builds', projectId]`, `['templates']`, `['team']`, `['app-config']`. Persist `projects`/`templates`/`me` to MMKV so the app opens instantly offline. Never persist file contents for more than the 5 most recent projects (storage).

### 8.3 API client rules
- Base URL from config, a `Authorization` header from SecureStore, and an `X-Client: ideaplatform-mobile/<version> (<os>)` header (useful in logs and metrics; **don't** put the user's email in it).
- Unwrap the envelope: `success:false` → throw `ApiError { status, message: error, code? }`.
- `401` → session store `signOut('expired')` → sign-in screen with the draft kept. `429` → read `Retry-After`, show "Slow down: try again in N s". `5xx`/network → TanStack retry (2, backoff). Mutations don't auto-retry unless they carry an idempotency key.
- 30 s timeout for REST via `AbortController`. Streams have no timeout, but they have heartbeat detection (no event for 60 s → reconnect).
- `guestToken` (anonymous runs) is sent wherever the web sends it, for job streams and conversation routes. On sign-up, offer "Keep your guest projects" if the backend supports claiming (check `platform-projects`; if not, add a claim endpoint as v1.1).

### 8.4 Session lifecycle
Launch → read token → `GET /app-config` (update gate) → `GET /me` → tabs or auth. Sign-out → `DELETE` device token → clear SecureStore, query cache and MMKV user data.

### 8.5 Offline
Read-only offline: cached projects, last-viewed files and the thread. All mutations need network. When offline, the builder saves the draft and shows "You're offline, we'll keep this", with no queued generation (it costs quota and has to be a deliberate tap).

### 8.6 Performance budgets
Cold start < 2.5 s on a mid-range Android (Pixel 6a-class), JS bundle < 6 MB, 60 fps scroll on a 5,000-line file and a 500-message thread, memory < 300 MB during a live generation. Enable Hermes, use the new architecture (default on SDK 58), and wrap with `React.memo` for feed rows.

---

## 9. Design system (Lumen on mobile)

The web follows docs/UI_MASTER_PLAN.md: black→white neutrals, an orange accent, red for errors, all from `frontend/styles/tokens.json`. The app uses **the same tokens**:
- Add `scripts/tokens-to-rn.mjs` to the `frontend` `npm run tokens` pipeline (or a `mobile` script) that emits `mobile/src/theme/tokens.ts` (colours light/dark, radii, spacing, type scale, shadows → RN `elevation` + iOS shadow props). Commit the generated file. CI fails if it is stale (the same idea as `check:design`).
- Glass effects → `expo-blur` `BlurView` only where the web uses glass, with a solid fallback on Android low-end devices.
- Text on accent uses `onAccent` (the `text-on-accent` rule). No raw hex in components; a lint rule (`no-restricted-syntax` on `#[0-9a-f]{3,8}`) enforces it.
- Light and dark themes follow the system and can be overridden in Appearance.
- **Accessibility:** every touchable has `accessibilityRole` + label, 44×44 pt minimum hit areas, Dynamic Type / font scaling up to 200% without clipping, and VoiceOver/TalkBack announcements for generation stage changes (`AccessibilityInfo.announceForAccessibility`), with reduced motion respected. Contrast is already checked by the token pipeline.
- Haptics (`expo-haptics`) on generation complete, apply diff and errors.
- Icon/splash: generated from the brand mark at all sizes, plus an Android adaptive icon and a monochrome icon (Android 13 themed icons).

---

## 10. Security & privacy

- JWT and guest tokens are kept **only** in SecureStore (`keychainAccessible: AFTER_FIRST_UNLOCK`).
- BYO provider API keys are sent once to `/api-keys` and **never stored on the device**. The server seals them.
- No secrets in the bundle: Google client IDs are public, and everything else lives server-side.
- Disable screenshots/recording on screens that show the 2FA secret (`expo-screen-capture`) and blur the app switcher snapshot there.
- Optional biometric app lock (`expo-local-authentication`) in Security settings.
- Deep links: validate every incoming param. A `token` in reset/verify/invite links is used once and removed from navigation state. The OAuth return accepts only the exchange `code` (§6.2).
- WebView: previews load only the platform's preview origins (`originWhitelist`). `javaScriptCanOpenWindowsAutomatically=false`. External links open in the system browser. No `injectedJavaScript` that exposes the token.
- TLS only (ATS default on iOS, `usesCleartextTraffic=false` in non-dev Android builds). Certificate pinning is deferred (operationally risky, low marginal value), and noted as a decision.
- Logs and Sentry: scrub `Authorization`, tokens, prompts and file contents (`beforeSend`). Only ids go to analytics.
- Run `/security-review` on the backend changes in §6 before merging them.

---

## 11. Analytics & observability

**Events** (GA4 via Firebase, `platform=ios|android`): `sign_up` (method), `login`, `onboarding_complete`, `idea_started`, `requirements_confirmed`, `wireframe_approved`, `generation_started` (stack, scope), `generation_finished` (status, duration bucket), `deliver_as_is`, `preview_opened` (kind), `chat_turn` (mode), `proposal_applied`/`discarded`, `checkpoint_restored`, `deploy_launched`/`succeeded`, `apk_build_started`, `push_opened` (type), `quota_exhausted`. Never send prompts, code or emails.

**Funnels to watch at launch:** install → sign-up → first generation started → first `complete` → first preview → second session within 7 days.

**Sentry:** release = app version + EAS update id, tag `jobId`/`projectId` on generation screens, and use the backend's own Sentry `stage` tags to correlate. Crash-free sessions target ≥ 99.5% before widening the rollout.

---

## 12. Testing strategy

| Layer | Tool | What |
|---|---|---|
| Unit | Jest | API envelope unwrap, error mapping, stream event reducer (feed every event type in §5.3, including an unknown one), reconnect `fromSeq` logic, deep-link parser, draft persistence |
| Component | RN Testing Library + MSW | Each screen's loading / empty / error / success states; diff review keep/discard; restore confirm |
| Contract | `check:api-types` | Mobile types vs backend zod schemas |
| E2E | **Maestro** on CI emulators + one real device lane | Sign up → verify (link stubbed) → generate (staging, cheap model, small prompt) → watch → preview → chat edit → apply → restore → deploy plan preview → sign out. Plus: background mid-generation → foreground → stream resumes with no duplicate files |
| Backend | node:test (existing pattern) | Each §6 change: Google multi-audience, OAuth exchange (reuse/expiry/allow-list), Apple verify, account deletion cascade, device token CRUD, push sender (mock Expo API), app-config |
| Manual matrix | — | iPhone SE (small), iPhone 15/16, iPad, Pixel 6a, Samsung mid-range (One UI quirks), Android 10 (oldest supported), dark mode, 200% font, TalkBack/VoiceOver, airplane mode toggle mid-stream |

**Minimum OS:** iOS 15.1+ and Android 7.0 (API 24)+, or whatever Expo SDK 58 requires, whichever is higher.

---

## 13. Store readiness

### 13.1 Accounts & identifiers (start in week 1, since these have lead time)
- Apple Developer Program (organisation enrolment needs a D-U-N-S number, which can take days to weeks).
- Google Play Console (organisation account; new personal accounts must run a closed test with ≥ 12 testers for 14 days before production, so plan around it).
- Bundle ID `com.ideaplatform.app`, Android package of the same name, and the Apple Services ID for Sign in with Apple.
- Firebase project (FCM + Analytics), APNs key uploaded to Expo, Google OAuth iOS + Android clients (Android needs the EAS signing SHA-1).
- `apple-app-site-association` + `assetlinks.json` served from the web domain (Next.js `public/.well-known/`) for universal/App Links.

### 13.2 Listing assets
App name, subtitle, keywords, description (do the ASO pass with the `seo`/marketing skills), screenshots (6.9", 6.5", iPad 13" if iPad is supported; Play phone + 7"/10" tablet), feature graphic (Play), preview video (optional), support URL, marketing URL, privacy policy URL (`/privacy` exists), terms (`/terms`), and an account-deletion URL (§6.4).

### 13.3 Policy items specific to this product
- **Review account:** a pre-verified demo account with quota and a couple of finished projects, and a note telling reviewers that generation takes minutes. Provide a pre-generated project, so review doesn't depend on a live model.
- **AI-generated content (Apple 1.2 / Play AI-generated content policy):** if public projects or templates from other users are viewable in-app, there must be a way to **report** content and **block** users, plus a filter for objectionable prompts. Templates are admin-curated (`admin/templates`), which is low risk. Public user projects are the risk. **Decision for v1:** only admin-curated templates are browsable, and user projects are visible only to their owner and team. Report/block is v1.1 if a public gallery is added.
- **Code download/execution (Apple 2.5.2):** the app shows code and previews generated *web* apps in a WebView and *mobile* apps in Expo Go (a separate app). The IDEA app itself never downloads and runs executable native code, so keep it that way. The APK install hand-off is Android-only and goes through the system installer with the user's consent.
- **Privacy labels / Data safety form:** collected data is email, name, user content (prompts, generated code), identifiers (user id, device push token), diagnostics (Sentry) and usage analytics. It is linked to the user and not used for tracking, so **no ATT prompt is needed** as long as no ad SDKs are added.
- **Encryption export compliance:** the app uses only standard HTTPS → `ITSAppUsesNonExemptEncryption = false`.
- **Age rating:** 4+/Everyone, but the "unrestricted web access" question is **Yes** (the WebView previews arbitrary generated sites), which raises the iOS rating to 17+ unless previews are restricted to the platform's preview origins. Restrict them (§10) and answer accordingly.
- **Permissions requested, each with a reason string:** camera/photos (design-to-code, only when tapped), notifications (asked after the first generation starts, not at launch). Nothing else.

---

## 14. CI/CD & release

- **GitHub Actions** (`.github/workflows/mobile.yml`, path-filtered on `mobile/**`): install → typecheck → lint (incl. no-hex) → Jest → `check:api-types` → token staleness check → `expo-doctor`.
- **EAS Build** profiles: `development` (dev client, internal), `preview` (staging, internal distribution / TestFlight internal), `production` (store).
- **EAS Update** channels match profiles. OTA is allowed only for JS/asset changes. A **native change (new module, permission, SDK bump) always requires a store build**. Use `runtimeVersion: { policy: "fingerprint" }` so a mismatched OTA can't load.
- **Versioning:** semver `marketingVersion`, auto-incremented build numbers (`autoIncrement` in EAS).
- **Rollout:** Play staged rollout 5% → 20% → 50% → 100% gated on crash-free ≥ 99.5% and no P1 bugs. iOS phased release (7-day). Keep the ability to roll back with EAS Update to the previous update group, and `app-config.minSupportedVersion` for hard cases.
- **Backend coordination:** the backend deploys first, every time. The app may only use endpoints already live in production. API changes stay additive. If a breaking change is ever unavoidable, version the route (`/v2`) and keep the old one until `minSupportedVersion` has moved past every client that uses it.

---

## 15. Parallel launch with the web app

| Track | Web | Mobile | Shared dependency |
|---|---|---|---|
| Auth | live | §6.1–6.3 | Backend change + Google/Apple console setup |
| Generation | live | §7.2–7.3 | Redis in production (§6.8) |
| Notifications | (email) | §6.5 | Push module; the web can reuse it later for browser push |
| Flags | `config/features.ts` | `/app-config` | Move the web onto `/app-config` too eventually (one source of truth) |
| Legal | `/privacy`, `/terms` | links + deletion | Update the privacy policy for push tokens, Apple sign-in and mobile analytics **before** submission |
| Support | site | in-app "Contact support" (mail link with app version + user id prefilled) | One support inbox |
| Launch comms | landing page | store badges on the landing page + `apple-itunes-app` smart banner meta | Landing-page rewrite is deferred (Phase 1 note), so add badges only |

**Launch day order:** backend release (with §6) → web release → mobile released on Play (staged) and App Store (phased) once both are approved → turn on store badges on the web.

---

## 16. Roadmap

Estimates assume 1–2 mobile engineers plus part-time backend support. Each phase ends with its acceptance criteria met on both platforms.

### Phase 0: Foundations (week 1)
Accounts (§13.1), `mobile/` scaffold with Expo Router, TS strict, ESLint/Prettier, EAS profiles, env config, Sentry, token generation (§9), the API client + envelope + error mapping, CI workflow.
**Done when:** a dev client on both platforms shows a themed screen that calls `/api/health` and `/app-config` on staging, and CI is green.

### Phase 1: Backend gaps (weeks 1–3, in parallel)
§6.1 Google multi-audience, §6.2 OAuth exchange, §6.3 Apple, §6.4 account deletion, §6.5 device tokens + push sender, §6.6 app-config, with a test for each. Redis worker confirmed in staging.
**Done when:** all backend tests pass, `fullstackSurfaceBaseline.test.ts` is unchanged (none of this touches generation), and there's a security review of the auth changes.

### Phase 2: Auth & shell (weeks 2–3)
Welcome, email sign-up/in, 2FA, forgot/reset/verify via deep links, Google, Apple, GitHub, onboarding, tabs shell, profile, sign-out, update/maintenance gates, account deletion screen.
**Done when:** every auth path works on real devices from cold start and from a deep link while signed out.

### Phase 3: The core loop (weeks 3–6)
Home + quota, projects list, builder flow (idea → scope → stack → requirements → wireframe → review), `generate/v2`, the live job screen with reattach, polling fallback, plan approval, deliver-as-is, retry/repair, push on completion, Activity tab.
**Done when:** a user can start a generation, lock the phone, get a push, tap it and land on the finished project, with no lost or duplicated events. Maestro covers it.

### Phase 4: Working with a project (weeks 6–8)
Project overview, file tree + code viewer + explain, previews (WebView + Expo Go launcher + QR), chat thread, Ask/Edit/Agent, diff review, apply/discard, restore points, ZIP share, templates gallery + clone.
**Done when:** the full edit loop works, and restore appends rather than rewinding (verified against the thread).

### Phase 5: Ship it (weeks 8–9)
Deploy flow + status, provider connections via OAuth exchange, Android APK build + install, teams + invite deep links, settings (API keys, connections, notifications, appearance, security, biometric lock).
**Done when:** a generated app is deployed from the phone end to end.

### Phase 6: Hardening & store (weeks 9–11)
Accessibility pass, performance budgets (§8.6), offline behaviour, the device matrix (§12), privacy labels / data safety, store assets, review account, Play closed testing, TestFlight external beta (20–50 users), fixing beta feedback.
**Done when:** crash-free ≥ 99.5% in beta, no open P0/P1, both stores have approved the build, and the §17 checklist is all ticked.

### Phase 7: Launch & after (week 12+)
Staged/phased rollout, monitoring dashboards (GA4 funnels, Sentry, push delivery receipts, backend metrics `/api/metrics` split by `X-Client`), then v1.1: refresh tokens, lazy file loading, guest project claiming, report/block if a public gallery ships, tablet layouts, IAP decision (§6.7), widgets / Live Activities for running generations.

---

## 17. Launch checklist

**Backend**
- [ ] §6.1–6.6 merged, tested and deployed to production
- [ ] Redis + worker running in production; `/generate/v2` returns 202
- [ ] `GOOGLE_CLIENT_IDS`, Apple config, `MOBILE_OAUTH_REDIRECTS`, `EXPO_ACCESS_TOKEN` set in production
- [ ] `.well-known/apple-app-site-association` and `assetlinks.json` served from the production web domain
- [ ] Privacy policy updated (push tokens, Apple sign-in, mobile analytics, deletion)
- [ ] Rate limiting checked under carrier NAT (no false 429s)

**App**
- [ ] All auth methods work on both platforms, including from deep links
- [ ] Generation survives background, kill and network switch, with no duplicate files
- [ ] Push for complete / partial / failed / plan-ready / build / deploy / invite; tapping opens the right screen
- [ ] Account deletion works end to end; the web deletion URL is live
- [ ] Update-required and maintenance screens tested via `/app-config`
- [ ] Only platform origins load in WebView; no token is leaked to previews
- [ ] Accessibility: VoiceOver/TalkBack walk-through of the core loop, 200% font
- [ ] Performance budgets met on a mid-range Android
- [ ] Sentry release + source maps uploaded; PII scrubbing verified
- [ ] Analytics events firing with `platform` dimension; no PII

**Stores**
- [ ] Listings, screenshots, privacy labels, data safety and age rating answered as in §13.3
- [ ] Review demo account with a pre-generated project + reviewer notes
- [ ] Encryption compliance set; permission strings reviewed
- [ ] Play closed test requirement satisfied (if applicable)
- [ ] Staged rollout plan and rollback owner named

---

## 18. Open decisions

| # | Decision | Recommendation | Needed by |
|---|---|---|---|
| D1 | Monetisation in-app once billing turns on | (a) Web-only purchase, app shows no prices, until revenue justifies IAP | Before `BILLING_ENABLED=true` |
| D2 | Guest (no-account) generation on mobile | Allow one guest generation, then require sign-up to save. Store `guestToken` in SecureStore | Phase 3 |
| D3 | Public project gallery in-app | Not in v1 (avoids the UGC report/block requirement) | Phase 4 |
| D4 | iPad-optimised layout | v1.1. v1 runs full-screen on iPad, not optimised | Phase 6 |
| D5 | Refresh tokens | v1.1 (§6.9). 7-day JWT + re-login is acceptable at launch | Post-launch |
| D6 | Shared `packages/api-contract` | After launch, once the web wants it too | Post-launch |
| D7 | Minimum OS versions | iOS 15.1 / Android 7 (or the SDK 58 floor) | Phase 0 |

---

*Related docs:* `README.md` · `docs/HANDOVER_NOTES.md` · `docs/AI_GENERATION_ARCHITECTURE.md` · `docs/EDIT_CHAT_PLAN.md` · `docs/MOBILE_APP_PIPELINE_PLAN.md` (the generated-app pipeline, not this app) · `docs/EXPO_SDK_58_UPGRADE_PLAN.md` · `docs/UI_MASTER_PLAN.md` · `docs/LIVE_PREVIEW_ARCHITECTURE.md` · `docs/DEPLOYMENT_ONE_CLICK_PLAN.md`
