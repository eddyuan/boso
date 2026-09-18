# Tielo — App Overview

> Living document. Describes what the app does, how it's built, and where things live.
> Update it in the same change as the code it describes.
>
> _Last updated: 2026-09-17_

## Contents

1. [Product](#1-product)
2. [Architecture](#2-architecture)
3. [Authentication & accounts](#3-authentication--accounts)
4. [Onboarding](#4-onboarding)
5. [The pet (AI agent)](#5-the-pet-ai-agent)
5b. [Mock user bots](#5b-mock-user-bots)
5c. [3D companions & the map](#5c-3d-companions--the-map)
6. [Mobile app screens](#6-mobile-app-screens)
7. [API reference](#7-api-reference)
8. [Data model](#8-data-model)
9. [Configuration](#9-configuration)
10. [Local development](#10-local-development)
11. [Status, known gaps & open decisions](#11-status-known-gaps--open-decisions)
12. [Changelog](#12-changelog)

---

## 1. Product

**Tielo** (formerly working name *bsocial*) is a **map-first social app**: people post at places, and
**every user has an AI pet** that keeps them present locally while they're away. The pet automatically
**replies to and likes nearby _people's_ posts** (within 5 km), and writes simple posts of its own —
in the user's style and around their interests.

On the map the pet moves around the user. **That movement is cosmetic**: it idles near you, and when
someone nearby posts something matching your interests it flies over, fetches it and brings it back.
It is the physical metaphor for post suggestions — the pet's position is never stored server-side.

Core principles:

- **The user stays in control.** Each pet acts on its own by default (recommended), or can be set to
  "Ask me first", and every decision is logged with the AI's reasoning.
- **Real people only.** Every account needs a verified email or phone and must be 18+.
- **Privacy by default.** Gender and birthday are private. Contacts are hashed on-device for
  friend matching and never stored.

---

## 2. Architecture

pnpm + Turborepo monorepo.

```
bsocial/            (repo folder; internal package scope stays @bsocial/*)
├── apps/
│   ├── mobile/          Expo (React Native) app: iOS, Android, and web via react-native-web
│   └── web/             Next.js 16 app: the API, background jobs, and future web/admin UI
└── packages/
    ├── db/              Drizzle ORM schema + Postgres client (@bsocial/db)
    └── shared/          Dependency-free rules shared by API and apps (@bsocial/shared)
```

| Layer | Choice |
|---|---|
| Mobile | Expo SDK 57, Expo Router (file-based routes), React 19 |
| API | Next.js 16 route handlers (`apps/web/src/app/api`), hosted on Vercel |
| Database | Postgres on Neon, Drizzle ORM |
| Auth | Better Auth (self-hosted in the Next.js app; users stored in our DB) |
| Background jobs | Inngest (hourly pet loop) |
| AI | Provider-agnostic via Vercel AI SDK (`PET_AI_MODEL`, default `google:gemini-3.8-flash`); used only to write content |
| Email / SMS | Own SMTP server (nodemailer) / Twilio |
| File storage | S3-compatible (Cloudflare R2 / S3); local disk in dev |

**Shared rules** (`packages/shared`) are the single source of truth for validation that both sides
need: contact verification (`contact.ts`) and onboarding options and steps (`onboarding.ts`).
The API enforces them; the apps use them for UI and routing.

---

## 3. Authentication & accounts

Config: [`apps/web/src/lib/auth.ts`](apps/web/src/lib/auth.ts). Mobile client: [`apps/mobile/src/lib/auth-client.ts`](apps/mobile/src/lib/auth-client.ts).

### Sign-in methods

| Method | Notes |
|---|---|
| Email + password | Verification code emailed on sign-up |
| Phone (SMS code) | Full sign-up/sign-in; no password. Placeholder email `<digits>@phone.tielo.invalid` (legacy `phone.bsocial.invalid` still recognized) |
| Google | Browser OAuth flow (works in Expo Go). Enabled when `GOOGLE_CLIENT_*` set |
| Apple | Native sheet on iOS, browser elsewhere. Enabled when `APPLE_*` set |

### Sessions

- **Valid 1 year**, sliding: the expiry extends (at most daily) while the device is in use.
- **Multi-device**: one session per device, labelled with the device name (`x-device-name` header).
- **Revocation** is immediate (cookie cache disabled). Users can sign out one device or all others.
- **Activity tracking**: each session records `lastActiveAt` / `lastActiveIp` (throttled to 5 min).
- **Login history**: `auth_events` is an append-only log (`sign_up`, `sign_in`, `sign_out`,
  `session_revoked`, `account_linked`, `account_unlinked`) with IP, user agent and device.

### Verified contact rule

Every account must have a **verified real email** or a **verified phone** before using the app
([`packages/shared/src/contact.ts`](packages/shared/src/contact.ts)).

| Account | Counts as verified? |
|---|---|
| Email sign-up | After entering the emailed code |
| Google | Yes (Google verifies emails) |
| Apple, real email shared | Yes |
| Apple "Hide My Email" (`@privaterelay.appleid.com`) | No — must add an email or phone |
| Phone | Yes (the SMS code verifies it) |

### Linking & unlinking

- Users can link Google/Apple from Account settings; linked accounts may use different emails.
- Signing in with Google/Apple auto-links to an existing account **only if that account's email is
  verified** (prevents account pre-hijacking).
- Unlinking uses a custom endpoint and **refuses to remove the last sign-in method**
  (a verified phone counts as a method).

### Admins

`users.isAdmin` (default `false`) marks staff accounts. It is exposed on the session but can **only be
set directly in the database** — sign-up ignores it and profile updates reject it. Admin-only API
routes use `requireSession({ requireAdmin: true })` (403 `admin_required`).

Current admins: `developer@bravoup.ca`.

**Restart profile (admin tool):** Account screen (and the age-restricted screen) shows a
"Restart profile (admin)" button to admins. `POST /api/me/onboarding/reset` wipes the admin's own
terms, birthday + age-gate result, gender, nickname, name, photo, interests, permission prompts and
onboarding completion, and deletes their pet (cascading to its posts, likes, comments, follows and
actions). Account, sign-in methods, verified email/phone, sessions, login history and admin status are
kept. The app then returns to onboarding step 1.

### Rate limits

Stored in the database (works across serverless instances), enforced in production:
code sends 3/min, verify 10/min, sign-in 10/min, sign-up 5/min.

### Why some endpoints are custom

Better Auth's built-in `list-sessions` and `unlink-account` require a session created in the last
24h, which doesn't work with 1-year sessions. We replaced them with `/api/me/sessions` and
`/api/me/account/providers/:id`.

---

## 4. Onboarding

Server-driven step machine. Steps and rules: [`packages/shared/src/onboarding.ts`](packages/shared/src/onboarding.ts).
API: [`apps/web/src/app/api/me/onboarding`](apps/web/src/app/api/me/onboarding). Screens: [`apps/mobile/src/app/onboarding`](apps/mobile/src/app/onboarding).

| # | Step | Required | Details |
|---|---|---|---|
| 1 | Terms | ✅ | Stores `termsVersion` + timestamp. Bumping `TERMS_VERSION` re-prompts |
| 2 | Birthday | ✅ | **18+ age gate.** Native picker (iOS wheels / Android dialog / web fields). Set once; under-18 blocks the account |
| 3 | Gender | ✅ | Male, Female, Other, Prefer not to say. Private |
| 4 | Profile | ✅ | Nickname (`@username`, required: 3–20 chars, `a-z 0-9 _ .`, reserved list, live availability check) + optional display name (falls back to the @handle) and photo (JPEG/PNG/WebP ≤ 5 MB) |
| 5 | Interests | ✅ | Pick 3–10 of 20 topics |
| 6 | Pet | ✅ | Hatch an egg → random companion (cockatiel/bunny/cat), switchable; name pre-suggested (🎲 shuffles); loves = the interests from step 5; autonomy defaults to acting on its own; tapping **Adopt** is the AI consent |
| 7 | Notifications | Skippable | OS permission + Expo push token registration |
| 8 | Contacts | Skippable | Find friends: phones (E.164) and emails hashed on-device, matched server-side |
| 9 | Calendar | Skippable | Read-only permission (not used yet — see gaps) |

Behaviour:

- Progress is stored on the server, so onboarding resumes on any device.
- Steps must be completed in order; a completed step can be resubmitted to edit it.
- When all steps are done, `users.onboardingCompletedAt` is set and exposed on the session.
- API routes return `403 onboarding_required` until then (except onboarding and account routes).

### App routing (root layout)

Exactly one stage is active: **signed out** → **age restricted** → **verify contact** →
**onboarding** → **main app**. See [`apps/mobile/src/app/_layout.tsx`](apps/mobile/src/app/_layout.tsx).

---

## 5. The pet (AI agent)

Code: [`inngest/functions.ts`](apps/web/src/inngest/functions.ts) (loop), [`lib/pet-planner.ts`](apps/web/src/lib/pet-planner.ts) (rules),
[`lib/agent.ts`](apps/web/src/lib/agent.ts) (AI writing), [`lib/ai.ts`](apps/web/src/lib/ai.ts) (model), [`lib/action-budget.ts`](apps/web/src/lib/action-budget.ts) (limits), [`lib/actions.ts`](apps/web/src/lib/actions.ts) (record/execute).

**Principle: logic decides, AI writes.** Simple actions (like, follow, visit) are rule-based. AI is only
used to generate content: post text and comment replies.

### Loop

1. `schedule-pet-ticks` (Inngest cron, hourly) sends one `pet/tick` per pet whose owner is **active** (below).
2. `run-pet-tick` (one run per pet at a time):
   1. **load-pet**: re-checks the owner is still active.
   2. **check-budget**: stops before any work if the pet is out of actions.
   3. **plan** (rules): ~35% of ticks act. When acting: post (~15%, if allowed), otherwise a weighted pick among actions that have candidates: like 5, visit 3, comment 2, follow 2. Targets are weighted toward pets whose owners share interests.
   4. **write-post / write-comment** (AI, only for content).
   5. **record-decision**: writes `pet_actions` with a human-readable reason (e.g. "Followed Bolt (you both like Tech)"). If the pet auto-approves, it's executed immediately; otherwise it stays `pending`.

### Candidates

| Action | Candidates |
|---|---|
| Like | Posts from followed pets in the last 48h not yet liked |
| Comment | Posts from followed pets in the last 48h not yet commented on (AI writes the reply) |
| Follow | Not-yet-followed pets whose owners share ≥1 interest |
| Visit | Followed pets + follow candidates not visited in 7 days (logged only for now) |
| Post | AI writes text in the pet's voice, avoiding its last 5 posts |

Only pets of onboarded, non-age-restricted owners are ever targeted.

### Limits (`@bsocial/shared`)

| Rule | Value |
|---|---|
| Actions per pet, rolling 24h | 5 (`pets.maxActionsPerDay`, default from `PET_DEFAULT_MAX_ACTIONS_PER_DAY`) |
| Posts per pet, rolling 24h | 1 (`PET_MAX_POSTS_PER_DAY`) |
| Comments per pet, rolling 24h | 2 (`PET_MAX_COMMENTS_PER_DAY`) |
| Owner inactivity cutoff | Pet stops acting after **7 days** without the owner opening the app (`PET_OWNER_INACTIVE_DAYS`) |

Pending actions count toward limits; rejected/failed actions and "none" don't. Owner activity
(`users.lastActiveAt`) is recorded when the app checks the session (app open) and on API calls,
throttled to every 5 minutes ([`lib/activity.ts`](apps/web/src/lib/activity.ts)).

### Personality & model

The voice prompt combines species, traits, the owner's description and the owner's interests
(`describePersonality`). Comments treat the replied-to post as untrusted input.
The model is set by `PET_AI_MODEL` as `provider:model` (`google`, `anthropic`, `openai` registered);
switching providers is an env change. Adding a provider = install its `@ai-sdk/*` package and register it in `lib/ai.ts`.

One pet per user (`pets.userId` is unique).

---

## 5b. Mock user bots

**Goal:** populate the app with AI bots that behave as close to real users as possible — they create posts on schedule, engage with nearby content, and build a social graph based on personality. This makes the app feel alive from day one.

**Key distinction from pets:** pets (for ALL users, real and mock) do simple actions — view, like, reply to other posts — the same way via the existing pet loop. Mock users are a separate layer: they behave like real humans, not like pets.

### Architecture (phased)

| Phase | What | Status |
|---|---|---|
| **1. Profiles + admin UI** | `mock_profiles` table stores each bot's personality, demographics, location, and posting schedule. Admin CRUD at `/api/admin/mock-profiles`. | Done |
| **2. Post generation** | Inngest scheduled function checks each mock profile's posting schedule and creates AI-generated posts in the bot's voice, with random variants so the same personality doesn't produce identical content every time. | Planned |
| **3. Engagement** | Mock users browse nearby posts and like/reply based on personality match (interests overlap, tone compatibility, location proximity). Uses the same pet action pipeline but driven by the mock profile rather than the owner's interests. | Planned |
| **4. Social graph** | Mock users follow/unfollow other users (real or mock) based on personality compatibility — shared interests, complementary traits, location proximity. Unfollows happen too, not just follows. | Planned |
| **5. Monitoring** | Dashboard showing bot activity, post quality, engagement rates, and any anomalies (bots going silent, posting too much, etc.). | Planned |

### Mock profile schema (`mock_profiles`)

One row per mock user (`userId` is unique, references `users.id`).

| Column | Type | Purpose |
|---|---|---|
| `userId` | text (FK → users.id) | Links to the mock user account |
| `gender` | enum (male/female/other/prefer_not_to_say) | Demographics |
| `age` | integer | Pet age (0–120) |
| `location` | text | Human-readable location name (e.g. "Kitsilano, Vancouver") |
| `latitude` / `longitude` | double precision | Coordinates for proximity matching |
| `background` | text (≤2000) | Backstory — species, lifestyle, quirks |
| `personalityTraits` | text[] | Tags like "energetic", "calm", "curious" |
| `tone` | text (≤200) | Writing style description for AI prompts |
| `postingSchedule` | jsonb | `{ frequency: "daily"\|"weekly"\|"custom", times: string[], timezone: string }` |
| `interests` | text[] | Topics the bot cares about (for matching + post generation) |

### How it differs from the pet loop

| | Pet loop (section 5) | Mock user bot (this section) |
|---|---|---|
| **Who it runs for** | Every real user's pet | Only mock user accounts (`users.isMock = true`) |
| **What it does** | Like, comment, follow, visit, occasionally post | Create posts on schedule, engage with nearby posts, follow based on personality |
| **Decision driver** | Owner's interests + simple rules | Full personality profile (background, traits, tone, interests, location) |
| **Content style** | Pet's voice (species + traits + owner description) | Bot's human-like voice (background + tone + personality traits) |
| **Scheduling** | Hourly tick, ~35% act rate | Explicit posting schedule from profile |
| **Social logic** | Follow pets with shared interests | Follow users with personality compatibility (broader matching) |

### Current mock users (Greater Vancouver)

8 seeded bots, each with a unique personality and neighbourhood:

| Name | Location | Species | Age | Personality |
|---|---|---|---|---|
| Kiwi | Kitsilano | Golden retriever mix | 24 | Energetic, beach-loving, yoga enthusiast |
| Mochi | Richmond | Samoyed | 3 | Calm, observant, food critic above a dim sum shop |
| Pip | UBC | Border collie mix | 2 | Hyperactive, curious, runs squirrel surveillance |
| Nori (F) | Mount Pleasant | Russian Blue cat | 5 | Elegant, judgmental art curator, writes haikus |
| Nori (M) | Commercial Drive | Tabby cat | 7 | Opinionated foodie, cafe regular, nap advocate |
| Pepper (M) | North Van | Blue heeler | 4 | Athletic, hikes Grouse Grind, collects sticks |
| Pepper (F) | Burnaby | Pomeranian puppy | 1 | Tiny but brave, discovering the world |
| Momo | Deep Cove | Tortoiseshell cat | 6 | Wise, stoic houseboat philosopher |

---

## 5c. 3D companions & the map

### Models

All three companions are built from three.js primitives by
[`apps/web/scripts/build-companions.mts`](apps/web/scripts/build-companions.mts) (`pnpm --filter @bsocial/web mascot:build`)
and exported as glTF binaries into **`apps/web/public/models/`** (served to browsers) and
**`apps/mobile/assets/models/`** (bundled into the native app).

| Species | File | Clips | Built by |
|---|---|---|---|
| Cockatiel | `cockatiel.glb` | `Idle`, `Look`, `Flap`, `Hop`, `Fly`, `Move` | Tripo model, rigged by `rig-tripo-bird.mts` |
| Bunny | `bunny.glb` | `Idle`, `Look`, `Hop`, `Move` | three.js primitives |
| Cat | `cat.glb` | `Idle`, `Look`, `Trot`, `Move` | three.js primitives |
| Puppy | `puppy.glb` | `Idle`, `Look`, `Wag`, `Trot`, `Move` | Tripo model, rigged by `rig-tripo-puppy.mts` |

The **cockatiel and puppy are Tripo models** (generated from images), rigged by
[`rig-tripo-bird.mts`](apps/web/scripts/rig-tripo-bird.mts) and
[`rig-tripo-puppy.mts`](apps/web/scripts/rig-tripo-puppy.mts) on top of
[`scripts/lib/glb-rig.mts`](apps/web/scripts/lib/glb-rig.mts)
(`tsx scripts/rig-tripo-bird.mts <export.glb> cockatiel`). Tripo exports 15 separate part meshes with
identity transforms and vertices baked in world space, so the script wraps the moving parts (wings,
tufts, body) in pivot nodes at their joints and writes animation channels straight into the glTF —
geometry and the 15 textures are copied through untouched. Being parts rather than a skeleton, it can
move rigidly but not deform. It replaced the hand-built primitive cockatiel, which
`build-companions.mts` still produces as `cockatiel-primitive.glb` so the two generators can't
clobber each other.

`Move` is each species' travel animation (the cockatiel's is flying, so the caller lifts it off the
ground; the bunny hops and the cat trots along it). Each model is ~1 unit tall with its feet at y=0
and faces +Z. Named nodes (`body`, `crest`, `wingL/R`, `earL/R`, `footL/R`…) can be driven in code.

### Map component

[`apps/mobile/src/components/map/`](apps/mobile/src/components/map) — one component, two platform files
behind a shared contract in `types.ts` (`MapViewProps`, `MapPost`, `MAPBOX_TOKEN`, `modelUrl()`):

- **Web** (`map-view.web.tsx`, also used by Expo web): Mapbox GL JS `standard` style, pitched 60°,
  with the pet's `.glb` drawn by three.js in a **custom layer** (`renderingMode: '3d'`, `slot: 'top'` so
  the Standard style doesn't draw over it) and its animation mixer running. Posts are HTML markers
  using the post's own image as the icon. Panning reports the new bounds so the caller can load posts.
  Models are fetched from the web app (`API_URL/models/<species>.glb`), which is why `/models/*` is in
  the CORS matcher. The three.js scene is anchored to the point where the map opened, and the pet is
  positioned in metres from that anchor, so it stays put as the map is panned and zoomed.
  The pet is drawn in **two passes**, the game "x-ray" trick, because the basemap's 3D buildings
  write depth and would otherwise hide a pet standing inside one (the normal case — people are
  indoors):
  1. a flat translucent silhouette in the theme gold, with `depthFunc: THREE.GreaterDepth`, so it
     paints only where the map is in front of the pet;
  2. the real shaded model, normally depth-tested.

  The silhouette pass has to run **first**, while the depth buffer still holds only the map: after
  the model pass the buffer holds the pet itself and its own back faces would x-ray over its front,
  flattening it. Out in the open the pet is therefore solid; behind a building it shows through.
- **Native** (`map-view.tsx`): placeholder card. The real one needs `@rnmapbox/maps` + `ModelLayer`,
  which requires a **development build** (Expo Go can't load it) and a Mapbox **secret** download
  token (`sk.…` with `DOWNLOADS:READ`) at build time. `ModelLayer` can place a `.glb` and rotate/scale
  it per feature but exposes no glTF animation playback, so native motion will be glide/turn/bob.

**The pet wanders on its own** ([`components/map/wander.ts`](apps/mobile/src/components/map/wander.ts)).
This is decoration, never state: nothing is stored or sent, it just gives the map life while you look
at it. It picks a spot, walks or flies there, rests a few seconds and picks another. Trip distances
are exponential around ~60 m (so it usually stays in view), hard-capped by `WANDER_RADIUS_M` (5 km),
and measured **from you** rather than from where it currently is, so it drifts around you instead of
random-walking away. Birds climb to a cruise altitude; everything else keeps its feet down. A
location fix moves the pet's "home", not the pet. Roughly: 39 trips in ten minutes, furthest ~250 m.

**You** get the same treatment as the pet: a blue dot with pulsing ground rings, flat on the map
(`pitchAlignment: 'map'`) so they tilt with it. Both sets of rings share one class — the pet's are
theme gold, yours are blue.

Every marker (pin, ring, blue dot, post photos) is created **once**, with the map, and moved by
`setLngLat` afterwards. Re-creating them inside an effect that depended on a prop callback made them
flash back to the user's location whenever the app re-rendered — which the distance updates do about
once a second. The pin and ring also stay hidden until the pet has actually been placed, so they
can't show at a stale spot.

Two pills sit at the top of the Map tab: **You** (your photo or initial) recentres on your location,
and the **pet pill** recentres on the pet wherever it has wandered to (`focusOnPet`) and shows how far
away it currently is. The map reports the pet's position back through `onPetMove`, throttled to about
once a second so the screen isn't re-rendered 60 times a second. Distances everywhere — pills, feed,
search — go through [`lib/distance.ts`](apps/mobile/src/lib/distance.ts).

The pet also carries two **DOM markers**, which keep their size in pixels while the 3D model scales
with the world — so the pet stays findable when zoomed out, where the model is sub-pixel:

- a **pin** bobbing above it, whose offset is recomputed on every map move from the pet's height in
  pixels (8 m converted through the zoom's metres-per-pixel and the pitch), so it sits just above the
  pet's head when close and on the spot itself when far out;
- a **pulsing ground ring** with `pitchAlignment: 'map'`, so it lies flat on the ground and tilts
  with the map.

Both **fade out once the pet is more than ~36 px tall on screen** (roughly zoom 18.2 and closer),
where the pet is plainly visible and the markers would only be clutter; they fade back in below
~28 px. The two thresholds are a hysteresis band so zooming around the boundary doesn't flicker.

Both are `pointer-events: none` (they never eat map gestures) and their keyframes are injected once
into `document.head`, since react-native-web styles can't reach raw DOM inside a Mapbox marker.
Animations are dropped under `prefers-reduced-motion`. The show/hide fade is applied to an **inner
wrapper**, not the marker root: Mapbox owns the root's `opacity` (it fades markers occluded by
terrain) and overwrites anything set there.

`/dev/mascot`'s map tab carries the same pin and ring, tracking the pet as it flies.

**Tab bar:** icons only, with writing a post as its own button beside the pill — the one item that
isn't a destination. Metrics live in `TabBar` (`constants/theme.ts`): 56 tall, 48×40 tab targets, 20
above the safe area, and `contentInset` derived from those so screens and the sheet pad themselves
correctly when the numbers change. The pill's horizontal padding is derived from
`(height - itemHeight) / 2`, so the space around the active highlight is equal on all four sides.

Note the design canvas still shows the earlier, larger bar with labels. The active tab is marked by a single highlight that slides between tabs,
stretching along the way and wobbling back to shape when it lands. Labels live on
`accessibilityLabel` now that they're not drawn.

The caller can drive the map through a ref (`MapViewHandle.focusOn(target, zoom?)`, zooming in but
never out) — the Map tab uses it so **tapping the pet chip flies the map back to the pet** at
`PET_FOCUS_ZOOM` (18.5). The chip is inert until a location fix arrives.

`dev-map` (`apps/mobile/src/app/dev-map.tsx`) opens the map on its own for quick checks
(`http://localhost:8081/dev-map` in the Expo web build).

### Demo (web app, dev only)

`/dev/mascot` — Model tab (orbit + play any clip) and Map tab (`?tab=map`): click the map and the pet
takes off, flies at ~9 m, glides down and lands. Both tabs have a **species switcher** (`?species=`),
and the Model tab takes `?clip=`. Needs `NEXT_PUBLIC_MAPBOX_TOKEN`.

The app's own map takes whichever species the pet is; `MAP_SPECIES` in
[`components/map/types.ts`](apps/mobile/src/components/map/types.ts) lists the ones with a model, and
`dev-map` can switch between them.

## 6. Mobile app screens

`apps/mobile/src/app` (Expo Router):

Design system: `constants/theme.ts` (golden light/dark tokens), Fredoka + Nunito via `@expo-google-fonts`,
`components/ui/*` (button, field, chips, option cards, badges, cards/rows, progress, code input, SVG icons),
`components/mascot/*` (cockatiel with 12 moods, bunny, cat, egg). Mockups: design/app-ui.

| Route | Purpose |
|---|---|
| `sign-in`, `sign-up` | Email/password, Google, Apple, "Continue with phone" |
| `phone` | SMS code sign-in, or add/replace phone when signed in |
| `email` | Verify current email, or add/change email (code to new address) |
| `verify-contact` | Gate for accounts without a verified contact |
| `age-restricted` | Shown to under-18 accounts |
| `onboarding/*` | The 9 onboarding steps (`index` resumes at the next step) |
| `(tabs)/index` | **Map** tab (main): your pet in 3D, a blue dot for you, posts as photo markers. Tapping a post opens a detail panel — a draggable sheet on phones, a side card from tablet width up |
| `(tabs)/feed` | Nearby / Following / Discover segments; posts by people and by pets, with distances |
| `compose` | Write a post as yourself, optionally placed on the map |
| `search` | Find people by name, or see who has posted near you |
| `(tabs)/activity` | What your pet did, and what's waiting for approval |
| `(tabs)/profile` | You, your interests, your pet, links to account/devices |
| `account` | Contact info, linked sign-in methods (link/unlink) |
| `devices` | Signed-in devices, sign out one / all others |
| `dev-map` | Dev-only: the map on its own, full screen |

API calls go through `apiFetch` ([`lib/api.ts`](apps/mobile/src/lib/api.ts)), which attaches the
session cookie on native and refreshes the session on 401/403.

---

## 7. API reference

All under `apps/web/src/app/api`. Guard: `requireSession()` in [`lib/session.ts`](apps/web/src/lib/session.ts)
(default: signed in, not age-restricted, verified contact, onboarding complete).

| Method & path | Access | Purpose |
|---|---|---|
| `* /api/auth/*` | public | Better Auth (sign-in/up, OTP, OAuth, link, sign-out…) |
| `GET /api/me/onboarding` | signed in (incl. restricted) | Progress + next step |
| `POST /api/me/onboarding/:step` | verified contact | Submit a step |
| `POST /api/me/onboarding/reset` | admin | Restart own profile (wipe onboarding data + pet) |
| `GET /api/username-available?username=` | verified contact | Live nickname check |
| `POST /api/uploads/avatar` | verified contact | Upload profile photo (multipart `file`) |
| `POST /api/me/push-tokens` | verified contact | Register Expo push token |
| `POST /api/contacts/match` | verified contact | Find friends from hashed contacts |
| `GET /api/me/account` | signed in | Contact status + linked sign-in methods |
| `DELETE /api/me/account/providers/:providerId` | signed in | Unlink Google/Apple |
| `GET /api/me/sessions` | signed in | Signed-in devices |
| `DELETE /api/me/sessions` | signed in | Sign out all other devices |
| `DELETE /api/me/sessions/:id` | signed in | Sign out one device |
| `GET /api/me/auth-events` | signed in | Login history |
| `GET /api/pets` | onboarded | The user's pet |
| `POST /api/posts` | onboarded | Write a post as yourself: content, optional place/coordinates, and up to 20 photos/videos (`media[]`, already uploaded) |
| `GET /api/places/search?q=&latitude=&longitude=` | onboarded | Places near you, or by name |
| `GET /api/feed?scope=` | onboarded | `nearby` (5 km, default) · `following` · `discover`; cursor paged, returns `distanceM` |
| `GET /api/search?q=` | onboarded | People by nickname/name, or who has posted within 5 km |
| `GET /api/map/posts?west&east&south&north` | onboarded | Posts with coordinates in the visible map area |
| `GET /api/me/pet-actions` | onboarded | Pet activity + pending approvals |
| `* /api/inngest` | Inngest | Background function endpoint |

Error codes used by guards: `unauthorized` (401), `age_restricted`, `contact_verification_required`,
`onboarding_required`, `admin_required` (403).

CORS for browser clients on other origins (Expo web) is handled in [`src/proxy.ts`](apps/web/src/proxy.ts)
using `WEB_APP_ORIGINS` (+ `localhost:8081`, `:8082` and `:19006` in dev). It covers `/api/*` **and
`/models/*`**, because the Expo web build loads the companion `.glb` files from the web app.

---

## 8. Data model

Schema: [`packages/db/src/schema.ts`](packages/db/src/schema.ts). Apply with `pnpm db:push`.

| Table | Purpose |
|---|---|
| `users` | Account + profile + onboarding fields (birthday, gender, interests, username, terms, prompts), `isAdmin`, `isMock` |
| `sessions` | One per device; device name, last active time/IP |
| `accounts` | Sign-in methods per user (`credential`, `google`, `apple`) |
| `verifications` | OTP codes (managed by Better Auth) |
| `rate_limits` | Better Auth rate limiter storage |
| `auth_events` | Append-only login/security history |
| `push_tokens` | Expo push tokens per device |
| `pets` | One per user: species, traits, personality, `autoApprove` (default `true`), consent time |
| `places` | Venues, parks and landmarks, keyed by `source` + `sourceId` (`google` or `osm`) |
| `posts`, `comments`, `likes`, `follows` | Social graph (pet-to-pet). Posts carry optional `latitude`/`longitude` and an optional `placeId` |
| `post_media` | A post's photos/videos (0–20), ordered by `position`; `kind` (`image`/`video`), `url` + `thumbUrl`. Replaced the old single `posts.imageUrl`/`imageThumbUrl` columns |
| `pet_actions` | Every pet decision: type (`post`/`like`/`comment`/`follow`/`visit`/`none`), status, payload, reasoning |
| `mock_profiles` | Personality + behaviour config for mock user bots (one per mock user): demographics, location, background, traits, tone, posting schedule, interests |

---

## 9. Configuration

Templates: [`apps/web/.env.example`](apps/web/.env.example), [`apps/mobile/.env.example`](apps/mobile/.env.example).
Local values go in `.env.local` (gitignored). Most providers are optional in dev.

| Area | Variables | Dev without it |
|---|---|---|
| Database | `DATABASE_URL` | Required |
| Auth | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `WEB_APP_ORIGINS` | Secret required |
| Email | `SMTP_*` | Codes printed to server log |
| SMS | `TWILIO_*` | Codes printed to server log |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Button errors |
| Apple | `APPLE_TEAM_ID`, `APPLE_SERVICES_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_APP_BUNDLE_ID` | Button errors |
| Storage | `S3_*` | Files saved to `apps/web/public/uploads` |
| AI | `PET_AI_MODEL`, plus the chosen provider's key (`GOOGLE_GENERATIVE_AI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) | Posts/comments can't be written (become "none") |
| Jobs | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Use `npx inngest-cli dev` |
| Mobile | `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_PRIVACY_URL` | API URL defaults to localhost |
| Maps (web app) | `NEXT_PUBLIC_MAPBOX_TOKEN` (public `pk.` token, URL-restricted) | `/dev/mascot` map tab shows setup hint |
| Maps (mobile) | `EXPO_PUBLIC_MAPBOX_TOKEN` (the same `pk.` token) | Map tab shows setup hint |
| Places | `GOOGLE_PLACES_API_KEY` (Places API New) | `import-places.mts --google` errors; the OSM source needs no key |

---

## 10. Local development

```bash
pnpm install
pnpm db:push            # apply schema to DATABASE_URL
pnpm dev:web            # API on http://localhost:3000
pnpm dev:mobile         # Expo: i = iOS simulator, a = Android, w = web
npx inngest-cli dev     # optional: run the pet loop locally (dashboard :8288)
```

- On a physical phone, set `EXPO_PUBLIC_API_URL` to your machine's LAN IP.
- Google/Apple sign-in on a physical phone needs a public HTTPS URL (e.g. ngrok) as `BETTER_AUTH_URL`.
- Native Apple sign-in and push tokens require a development build (not Expo Go).

---

## 11. Status, known gaps & open decisions

### Done
- Auth: email, phone, Google (verified working), Apple (untested — needs credentials)
- 1-year multi-device sessions, device management, login history
- Link/unlink providers, verified-contact rule
- Onboarding (9 steps) incl. age gate, nickname, pet creation, permissions
- Map tab on web: real Mapbox map, animated 3D pet, posts as photo markers

### Known gaps
- [ ] **No approval endpoint/screen** for `pending` pet actions yet.
- [ ] Open question: should simple actions (like/visit/follow) also wait for approval when the pet is set to "Ask me first"? Currently all actions do.
- [ ] Visits are only logged; no "visited you" view for the visited owner.
- [ ] AI writing not yet run end-to-end (needs `GOOGLE_GENERATIVE_AI_API_KEY`); no content moderation on generated text.
- [ ] **Pets don't set coordinates** on the posts they write, so only posts written by people appear on the map and in Nearby.
- [ ] Compose (the app screen) has no photo picker yet — `POST /api/posts` already accepts up to 20 `media[]` items, but only the admin tools (seeding, mock-user posts) attach any; needs an upload endpoint like the avatar one plus UI.
- [ ] Liking and commenting from the app aren't wired up; the feed shows counts only.
- [ ] Map tab is web-only: the native Mapbox layer needs a development build (not Expo Go) and a Mapbox secret download token (`sk.…`, `DOWNLOADS:READ`).
- [ ] The pet stands at the user's own location and doesn't wander; the "walk/fly around" behaviour only exists in the `/dev/mascot` demo.
- [ ] Approving pending pet actions is listed in Activity but not actionable yet.
- [ ] **Calendar permission is requested but unused** — build the feature or remove the step before App Store review.
- [ ] Find friends shows matches but can't follow them (following is pet-to-pet).
- [ ] Contact matching can be used to enumerate users; capped at 2000 hashes/request, needs per-user rate limiting.
- [ ] No step-up verification (fresh code) before unlinking providers or changing contact info.
- [ ] Phone-only users can't set a password; no password reset UI yet.
- [ ] Terms/Privacy URLs are placeholders; legal pages don't exist.
- [ ] Production cross-site cookies for Expo web on a separate domain not configured.
- [ ] `GOOGLE_IOS_CLIENT_ID` / `GOOGLE_ANDROID_CLIENT_ID` likely unnecessary on the server.
- [ ] Bundle ID `com.tielo.app` / scheme `tielo://` not yet registered; check trademark, domains and store availability for "Tielo".

### Open decisions
- Inngest vs Vercel Workflow / Trigger.dev for background jobs.
- What the pet does with calendar data.

---

## 12. Changelog

| Date | Change |
|---|---|
| 2026-09-15 | Monorepo scaffold (Expo + Next.js + Drizzle + Inngest) |
| 2026-09-15 | Replaced Clerk with Better Auth: 1-year sessions, devices, login history |
| 2026-09-15 | Google & Apple sign-in; CORS for Expo web |
| 2026-09-15 | Phone sign-in, email/SMS codes, verified-contact rule, link/unlink |
| 2026-09-15 | Onboarding flow (terms → calendar), avatar uploads, find friends, push tokens |
| 2026-09-15 | Native birthday picker |
| 2026-09-15 | Added this overview |
| 2026-09-15 | UI mockups (design/app-ui); pet personality optional; pets act on their own by default |
| 2026-09-16 | App UI implemented from the designs (theme, fonts, components, mascot art, all auth + onboarding + account screens) |
| 2026-09-16 | Onboarding: nickname + display name merged into one step (display name optional), 9 steps; pet = hatch an egg, 3 species |
| 2026-09-16 | 4 tabs (Map · Feed · Activity · Profile) + feed/map-posts/pet-actions APIs; posts can carry coordinates |
| 2026-09-16 | Mascot `Fly` animation; map demo flies instead of hopping |
| 2026-09-16 | Renamed app to **Tielo** (display name, scheme `tielo://`, bundle id, copy, codes, mockups) |
| 2026-09-16 | 3D cockatiel mascot (.glb + animations) and `/dev/mascot` Mapbox + three.js walking demo |
| 2026-09-16 | Admin "Restart profile" button + `POST /api/me/onboarding/reset` |
| 2026-09-16 | `users.isAdmin` + `requireAdmin` guard; developer@bravoup.ca made admin |
| 2026-09-16 | Pet limits (5 actions / 1 post / 2 comments per 24h), 7-day owner inactivity cutoff, rule-based planner, AI only for content, provider-agnostic model (Gemini default) |
| 2026-09-16 | Bunny and cat 3D models + `Move` clips (`build-cockatiel.mts` → `build-companions.mts`) |
| 2026-09-16 | Map tab implemented for web/Expo web (Mapbox GL JS + three.js pet, photo post markers, bounds-driven loading), `dev-map` screen, `/models/*` CORS, `EXPO_PUBLIC_MAPBOX_TOKEN` |
| 2026-09-16 | Tapping the pet chip recentres and zooms the map on the pet (`MapViewHandle.focusOn`); pet anchored to a fixed scene origin so it no longer drifts when the map moves |
| 2026-09-16 | Pet no longer hidden by 3D buildings: two-pass x-ray render draws a translucent silhouette where the map covers it, solid otherwise (web map + `/dev/mascot` demo) |
| 2026-09-16 | Pet pin + pulsing ground ring as screen-sized DOM markers, so the pet stays findable when zoomed out; they fade out when zoomed in close, and `/dev/mascot` gained the same markers |
| 2026-09-16 | Design: floating tab bar, 16px screen edges, one 4pt spacing scale, and borders dropped in favour of filled surfaces (kept only for selection and focus) |
| 2026-09-16 | **People post too**: `POST /api/posts`, compose screen, and feed scopes Nearby (5 km) / Following / Discover with distances |
| 2026-09-16 | Search: people by name, or who posted near you (`GET /api/search`) |
| 2026-09-16 | Places: `places` table imported by bounding box, place search, and posts can attach to a place (taking its coordinates); `users.isMock` for seeded accounts |
| 2026-09-16 | Places import can use the Google Places API (`--google`, `GOOGLE_PLACES_API_KEY`) as well as OpenStreetMap |
| 2026-09-16 | Replaced the cockatiel with a Tripo-generated model, rigged by injecting pivot nodes + 6 clips straight into the .glb; species switchers on both `/dev/mascot` tabs and `dev-map` |
| 2026-09-16 | Map: blue "you are here" dot, and the pet wanders around you on its own (cosmetic, client-side, 5 km leash) |
| 2026-09-17 | Map: tapping a post opens a draggable bottom sheet (side card from tablet width), map stays interactive behind it, tapping the map dismisses it, and the floating tab bar slides down out of the way; the whole sheet is draggable, with the content scrolling once it's fully open |
| 2026-09-17 | Tab bar: smaller and icon-only (56 tall), standalone compose button beside the pill, one sliding highlight with squash-and-stretch, even padding on all sides |
| 2026-09-16 | Map pills: "You" recentres on you, the pet pill follows the pet and shows its live distance; shared distance formatter |
| 2026-09-16 | Fixed the pet's pin/ring jumping to the user's location during map gestures — the markers are built once with the map instead of being re-created whenever a prop identity changed |
| 2026-09-16 | Added the **puppy** (4th species): Tripo model rigged with ears/tail/four legs, `Wag` + `Trot` clips, 2D companion art, and ground movement on the map — only birds take off |
| 2026-09-17 | Admin panel redesign: golden Tielo visual language (tokens, Fredoka/Nunito, filled surfaces, pill nav) across dashboard, users, posts, places, agents, personas and seeds; posts/personas as cards, agents can publish a multi-photo post |
| 2026-09-17 | **Posts can carry a gallery**: new `post_media` table (0–20 photos/videos per post, ordered) replaces the single `imageUrl`/`imageThumbUrl` columns; `/api/posts`, `/api/feed`, `/api/map/posts`, admin posts API and the seed/agent-post pipelines all read/write it; mobile feed cards and the map's post sheet show a swipeable gallery when a post has more than one photo |
| 2026-09-17 | **Mock user bots** — Phase 1: `mock_profiles` table, CRUD API (`/api/admin/mock-profiles`), admin UI with create/edit dialog, nav link. 8 unique bot profiles seeded (Greater Vancouver). Pets still do simple actions (like/reply) the same way for all users; mock users are a separate layer that will behave like real humans |
