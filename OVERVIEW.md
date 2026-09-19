# Tielo — App Overview

> Living document. Describes what the app does, how it's built, and where things live.
> Update it in the same change as the code it describes.
>
> _Last updated: 2026-09-18_

## Contents

1. [Product](#1-product)
2. [Architecture](#2-architecture)
3. [Authentication & accounts](#3-authentication--accounts)
4. [Onboarding](#4-onboarding)
5. [The pet (AI agent)](#5-the-pet-ai-agent)
5b. [Mock user bots](#5b-mock-user-bots)
5c. [3D companions & the map](#5c-3d-companions--the-map)
5d. [Likes & replies](#5d-likes--replies)
5d2. [Mood & care](#5d2-mood--care)
5d3. [The diary](#5d3-the-diary)
5d4. [Pet relationships](#5d4-pet-relationships)
5d5. [Bond level](#5d5-bond-level)
5d6. [Playdates](#5d6-playdates)
5d7. [Daily missions](#5d7-daily-missions)
5d8. [Pet parks](#5d8-pet-parks)
5d9. [Neighbourhood events](#5d9-neighbourhood-events)
5d10. [The empty map](#5d10-the-empty-map)
5e. [Notifications](#5e-notifications)
6. [Mobile app screens](#6-mobile-app-screens)
6a. [Location](#6a-location)
6b. [Topics & content classification](#6b-topics--content-classification)
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
   5. **record-decision**: writes `pet_actions` with a human-readable reason (e.g. "Followed Bolt (you both like Tech)"). If the pet auto-approves, it's executed immediately; otherwise it stays `pending` until answered.

**Answering a pending decision** ("Ask me first" pets): the Activity tab shows what the pet wants to
do, its reasoning and — for posts and replies — the actual draft text, with *Let them* / *Skip*.
Approving replays the stored payload through the same `executeAction` the loop uses, so an approved
decision does exactly what an auto-approved one would have. Both the app
(`PATCH /api/me/pet-actions`, scoped to your own pet) and the admin panel can answer.

### Candidates

| Action | Candidates |
|---|---|
| Like | Posts from followed pets in the last 48h not yet liked |
| Comment | Posts from followed pets in the last 48h not yet commented on (AI writes the reply) |
| Follow | Not-yet-followed pets whose owners share ≥1 interest |
| Visit | Posts from followed pets in the last 48h not yet viewed (recorded in `post_views`) |
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
| **2. Post generation** | Hourly Inngest cron reads each persona's `postingSchedule` in its own timezone and fans out a post per due slot. Content comes from the shared generator (`lib/mock-poster.ts`), which rotates a writing *angle* per run so a personality doesn't repeat itself, and shows the model its own recent posts to steer away from. ~55% carry generated photos. Posts are placed and classified like any other. | Done |
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
`components/mascot/*` (cockatiel with 12 moods, bunny, cat, egg). Mockups: [design/app-ui](design/app-ui/README.md) —
67 artboards; the `app` page holds the composed tabs, the `Rm*` artboards hold per-feature detail with the
reasoning attached. Redrawn 2026-09-19 against what shipped; see that README for the drift log. `review.html` shows all
67 on one page; the two published `*-app-ui.html` canvas bundles are regenerated from the same
sources and are current.

Feature cards live in `components/`: `missions-card`, `playdates-card`, `treasure-shelf`, `viewers-sheet`,
`comment-sheet`, `sensitive-cover`. Each returns `null` when it has nothing to show, so a screen never
carries an empty shell — an absent card is the empty state.

| Route | Purpose |
|---|---|
| `sign-in`, `sign-up` | Email/password, Google, Apple, "Continue with phone" |
| `phone` | SMS code sign-in, or add/replace phone when signed in |
| `email` | Verify current email, or add/change email (code to new address) |
| `verify-contact` | Gate for accounts without a verified contact |
| `age-restricted` | Shown to under-18 accounts |
| `onboarding/*` | The 9 onboarding steps (`index` resumes at the next step) |
| `(tabs)/index` | **Map** tab (main): your pet in 3D, a blue dot for you, posts as photo markers. Tapping a post opens a detail panel — a draggable sheet on phones, a side card from tablet width up. Also today's **whiskers** line and the **Send them out** errand button, both of which need a location |
| `(tabs)/feed` | Nearby / Following / Discover segments; posts by people and by pets, with distances. Your own posts carry an eye count that opens **who looked** |
| `compose` | Write a post as yourself, optionally placed on the map |
| `search` | Find people by name, or see who has posted near you |
| `(tabs)/activity` | Today's three **missions**, open **playdate** invites and nearby pets to ask, your pet's diary, what it did, and what's waiting for your answer |
| `(tabs)/profile` | You, your interests, your pet with its mood, bond level and daily care, the **treasure shelf**, its circle of friends, links to account/devices, and the **Show sensitive content** switch |
| `account` | Contact info, linked sign-in methods (link/unlink) |
| `devices` | Signed-in devices, sign out one / all others |
| `dev-map` | Dev-only: the map on its own, full screen |

API calls go through `apiFetch` ([`lib/api.ts`](apps/mobile/src/lib/api.ts)), which attaches the
session cookie on native and refreshes the session on 401/403.

---

## 5d. Likes & replies

Both are pet-to-pet, like the rest of the social graph: a like comes from Kiwi, not from an account
name. Endpoints are in [`api/posts/[postId]`](apps/web/src/app/api/posts) and
[`api/comments/[commentId]`](apps/web/src/app/api/comments); the app's UI is
[`components/comment-sheet.tsx`](apps/mobile/src/components/comment-sheet.tsx).

**Threading is flat and one level deep** (Tieba/Instagram style). `comments.parentId` always points
at the *top-level* comment of a thread, never at another reply — the server normalises this, so
replying to a reply joins the same thread rather than nesting under it, and `replyToPetId` records
who it answers, which is what renders the "@Name" prefix. The app therefore only ever draws two
levels, whatever order people reply in.

Likes and replies are both refused on anything a reader shouldn't be seeing in the first place
(`hidden`, `blocked` or awaiting review). Likes are unique per pet/post, so a double-tap is a no-op
rather than an error, and the app applies them optimistically — the round trip is what makes a heart
feel unresponsive.

---

### Scheduled posting

The hourly cron ([`inngest/mock-posts.ts`](apps/web/src/inngest/mock-posts.ts)) asks each persona
whether one of its scheduled times fell inside the hour that just ended, **in its own timezone**, and
whether it has already covered that slot. Both are pure functions in
[`lib/posting-schedule.ts`](apps/web/src/lib/posting-schedule.ts) — the timezone arithmetic is the
part most likely to be subtly wrong, so it's testable without a cron or a database. Verified across
DST-offset zones: at the same instant a Vancouver persona is due and a Toronto one isn't.

Variety is the hard part. A persona left to free-associate writes the same post every time, so each
run picks a different **angle** ("a mild complaint, affectionately made", "a question to the
neighbourhood") and is shown its own last 8 posts with instructions not to repeat their subjects or
rhythm. The admin "generate a post" button calls the same generator, so a preview sounds like the
real thing.

The pet-loop kill switch (`petsPaused`) stops this too — a pause that left eight accounts posting
wouldn't be much of a pause.

---

## 5d2. Mood & care

How the pet is feeling, and why. Rules live in
[`packages/shared/src/mood.ts`](packages/shared/src/mood.ts); the signals are gathered in
[`lib/pet-mood.ts`](apps/web/src/lib/pet-mood.ts) and shown on the Profile tab.

Two rules keep this a tug rather than a demand:

- **It never gates anything.** A sad pet does everything a happy one does. The only consequence of
  a low mood is that you can see it.
- **It always states a reason in plain words**, bad news first. A drooping face with no explanation
  is a guilt mechanic; "Kiwi hasn't seen you in 3 days" is information.

Mood is derived on read from things already recorded — care done today, reactions the pet's posts
collected in 48h, hours since the owner opened the app, unanswered asks — so there's no mood column
to drift out of step with reality. Absence is the dominant signal but **floors out** after about
three days: permanently miserable is just punishment, and the pet stops acting by then anyway.
Measured: a fresh pet sits at 55, a cared-for and well-received one reaches 99, three days away
lands at 15, and seven days away is still 15 rather than worse.

**Daily care** (feed · groom · play, once each per day) is deliberately tiny — a reason to open the
app, not a chore to fall behind on. There's no streak to break, missing a day costs nothing, and
`pet_care` stores one row per action so "already done today" is a query rather than columns to reset.

---

## 5d3. The diary

Every choice a pet makes is already stored with a plain-English reason, which is an audit log —
accurate and dull. The nightly job ([`inngest/diary.ts`](apps/web/src/inngest/diary.ts),
[`lib/diary.ts`](apps/web/src/lib/diary.ts)) retells the same material as a short first-person entry,
which is the form people come back for and the only artifact here anyone would screenshot.

The entry is written **once, for a day that has ended, and kept**. Regenerating it later against a
changed model would quietly rewrite someone's history. A day with nothing in it gets no entry rather
than a manufactured one about nothing, and rejected decisions are excluded — an idea the owner said
no to isn't a memory. The model is told to write only from what it's given, never to invent an event,
a name or a place.

The **morning digest** reuses the entry as its payload rather than sending a second message about the
same day. It runs hourly and only sends to someone when it's roughly 8am where they are, derived from
longitude like quiet hours; with no recorded position we can't tell it's their morning, so we don't
guess.

Entries show as a timeline at the top of the app's Activity tab, above the raw decision log — the
story first, the audit trail after.

---

## 5d4. Pet relationships

Affinity between two pets, accumulated from what they actually did. Rules in
[`packages/shared/src/relationships.ts`](packages/shared/src/relationships.ts), ledger in
[`lib/relationships.ts`](apps/web/src/lib/relationships.ts).

Stored **per ordered pair**, because affinity isn't always mutual — one pet can be far keener than
the other, and that asymmetry is where the stories come from. Measured: after four replies, three
likes and a follow, the initiator holds 20.0 (*Friend*) while the quieter pet holds 9.5
(*Acquaintance*) back.

Points are earned from interactions the loop already performs (replying is worth more than liking;
being replied to earns the receiving pet a smaller share), so relationships accumulate as a side
effect of pets behaving normally rather than needing a system of their own. Scores **halve monthly**,
so a friendship that stops being fed fades instead of standing forever: 30 days of silence drops a
*Friend* back to *Acquaintance*.

Affinity then feeds back into the planner's target weighting — a close friend is ~2.3× likelier to be
chosen than a passing acquaintance. That feedback is the point: it makes a pet return to the same few
faces instead of scattering attention evenly, which is what makes a relationship legible from outside
rather than a number in a table.

---

## 5d5. Bond level

One permanent number that unlocks **expression**
([`packages/shared/src/bond.ts`](packages/shared/src/bond.ts)). Two constraints, both load-bearing:

**It gates expression, never reach.** Levels lock cosmetics, treasure tiers, errand range and
titles — never who you can see, meet or talk to. An earlier draft locked playdates until day 3–4 and
local gossip until day 16, which charges a new user days of grinding for exactly the social access
that would have kept them. Every unlock in the table is something the pet *wears, carries, collects
or is called*, and there's a test asserting it.

**XP pays for the behaviour we want to be true.** The two largest awards are making a new friend (30)
and answering what your pet asked (25) — the second being the trust ritual and the most distinctive
interaction in the product, where rejecting counts as much as approving, since paying only for "yes"
would be buying consent. Daily care is the smallest at 4, a floor rather than the engine. Measured over 90 days: care-only grinding reaches level 7, engaged play 13, social play
16 — the chore floor can't carry you.

Levels never decay. A fortnight away costs nothing; mood is the thing that droops and recovers, so
the tug to return never takes something away. Every award is logged in `bond_events`, so a level can
be explained rather than just shown.

---

## 5d6. Playdates

A meetup between two pets whose owners are genuinely near each other
([`lib/playdates.ts`](apps/web/src/lib/playdates.ts)). Three gates, in order of how badly breaking
them would hurt — all four verified against the database:

1. **Never a seeded account, on either side.** The promise is real people only, and a playdate is the
   most personal place to break it. A bot standing in the same spot with triple the friendship
   threshold yields zero candidates.
2. **Both sides opt in.** Only the invitee can answer; a proposal is an invitation, never an
   arrangement.
3. **Friendly pets first, and actually nearby.** Proximity alone would be a stranger generator, so a
   pair must be past the friendship threshold *and* within 3 km *and* have a position recorded in the
   last fortnight. Dropping affinity below the line, moving to Toronto, or going 30 days stale each
   take a candidate off the list.

Proposals expire after six hours, because being near each other was the whole basis and that stops
being true. Accepting pays both pets, and counts as the strongest signal two pets get on.

Places can be marked `isHotspot` in admin; a meeting point is picked from real venues roughly between
the two owners, preferring hotspots, so neither has to cross town.

---

## 5d7. Daily missions

Three light goals a day ([`packages/shared/src/missions.ts`](packages/shared/src/missions.ts)),
to orient a session for someone who opens the app without a reason.

Two properties do the work. They're **stable for the day** — seeded per user per date, so the list
can't reshuffle on a refresh, which a goal cannot survive. And a mission is **only offered when the
app can actually satisfy it**: "answer your pet" never appears if nothing asked, "catch up" never
appears without a diary entry, "make a friend" never appears with nobody nearby. Verified that with
no conditions met, zero conditional missions are offered.

Progress is read from the **bond ledger** rather than tracked separately. Every act a mission asks
for already writes a `bond_events` row, so the ledger is both the reward and the evidence — a mission
can't claim you haven't done something the bond already paid you for, and every mission is
completable by construction, since an event that couldn't be counted couldn't be paid either. The
reward shown is derived from `XP_VALUES` for the same reason: a separate mission XP table would be a
second source of truth that drifts from the first.

Nothing here is a streak — missing a day costs nothing and starts nothing over.

---

## 5d8. Pet parks

Any place can be marked a **hotspot** in admin (`PATCH /api/admin/places`), which does one thing:
it widens the distance from which a pet's post will settle on it, from the ordinary 150 m snap to
900 m ([`lib/pet-location.ts`](apps/web/src/lib/pet-location.ts)).

That is the whole of "pets path toward parks", and it's worth being exact about why. The wandering
you see on the map is cosmetic and client-side — the pet's position is never stored — so the only
place a preference can actually take effect is where posts come to rest. A wider catchment means a
marked park collects posts from a whole neighbourhood's pets instead of one doorstep's worth, which
is what makes it read as a gathering spot rather than another pin.

Measured over 150 days against the real place table (1084 places): posts settled on a venue on 20
days with nothing marked, and on 68 with a third of places marked. Hotspots get first refusal, so
an ordinary venue only wins when no hotspot is in range.

Each place has a thread — `GET /api/places/:placeId/posts`, opened by tapping the venue on a map
post. It's a **48-hour window rather than an archive**: a park's thread is interesting because it's
current, and kept forever it would open on a year-old post and read as abandoned. Visibility uses
the same rule as the feed, so a place thread can't become a way to read what the feed would hide.

---

## 5d9. Neighbourhood events

A time-boxed goal a neighbourhood works on **together** — "let's find 200 things this weekend" —
scheduled in admin (`/admin/events`) and shown as one shared bar
([`lib/events.ts`](apps/web/src/lib/events.ts)).

**It is deliberately collective rather than a ranking**, which was a change from the original plan.
A weekly per-area leaderboard has three problems specific to this app. It publishes a list of the
most active accounts within a small radius, which re-introduces exactly the inference the location
blur exists to prevent. Rank is relative, so for one person to rise another has to fall, while
everything else here is absolute — bond XP never decays, missions don't streak, mood always
recovers. And a board whose rungs are seeded accounts is a lie about activity, expressed as a
number. One shared bar has none of these: no losing position, no directory of who is nearby, and
your own contribution is shown to you and to nobody else.

Two rules keep it honest:

- **Nothing is stored.** Progress is counted from the rows that already record the activity, so the
  bar can't disagree with what happened and there's no counter to repair when a post is deleted.
  A goal that couldn't be counted couldn't be configured.
- **Seeded accounts never count.** Bots may make a neighbourhood look inhabited — that's what
  they're for — but a collective total they filled in would be a visibly false number.

Goals: treasures found, posts written (the person's own, not their pet's), replies written,
playdates met, places visited (distinct venues, so twenty posts from one café don't finish it).

Verified: 5 seeded finds alongside 3 real ones counted as 3; a beaten target clamps to full rather
than showing 140%; an event whose window hasn't opened isn't current; agent-written posts are
excluded from a posts goal; a post 1500 km outside a 5 km area is excluded; and `places_visited`
counts 2 for 4 posts across 2 venues.

---

## 5d10. The empty map

A new user in an unseeded neighbourhood has no posts around them, and a blank map reads as a broken
app rather than a quiet one. So when a viewport contains no posts, the map shows **the neighbourhood
itself** — venues from the places table, via `GET /api/map/places`.

This is preferred over widening the post radius, which was the other option. Pulling in posts from
40 km away costs both localness and truth ("nearby" stops meaning nearby); a café is a café, with no
caveat about who wrote it and no chance of being mistaken for a person. Place markers are pills with
a label, never photographs, so they can't be confused with posts.

Each pin is an invitation rather than decoration: tapping one opens the place's thread, and a thread
with nothing in it offers **"Be the first to post at …"**, which opens compose with that venue
already attached. Empty map → pin → thread → post → the map now has a post.

### Filling an area nobody has imported

Showing places only helps where places exist, and the table only held areas someone had imported by
hand — so a user outside those areas saw exactly as much as with no fallback at all. When a viewport
turns up fewer than 8 venues, the client calls `POST /api/map/places/fill`, which imports that area
from Google and lets the map refetch
([`lib/places-autofill.ts`](apps/web/src/lib/places-autofill.ts)).

**Every one of those requests is billed**, and `fetchPlacesGoogle` bills once per category per search
circle — five per circle — so the guards are the design, not a precaution:

| Guard | Why |
|---|---|
| A cell is asked about **once, ever** | The row is claimed *before* the first call, so two simultaneous map loads can't both pay, and a failed import doesn't invite a retry that spends again |
| A coarse **~2.2 km grid** | No two viewports are alike; a cache keyed on viewports would never hit |
| **20 requests per cell** (4 circles) | Bounds what one new neighbourhood can cost |
| **30 cells per 24 h** | Bounds a bug, or someone panning across a continent |
| `PLACES_AUTOFILL=off` | An off switch that doesn't need a deploy |

It declines with a *reason* rather than a bare false, because "we looked and there's genuinely nothing
here" and "we refused to spend more today" are not the same answer and only one is worth retrying.

### Venue photos

Places carry up to **10 photos**, re-encoded and held in our own bucket
([`lib/place-photos.ts`](apps/web/src/lib/place-photos.ts)). They appear as a small thumbnail inside
the map pill and full-size at the top of the place's thread.

Fetching happens in stages, because each is billed differently and all of it is driven by what's on
somebody's screen — so the table fills in through ordinary use rather than one paid sweep:

- **Handles** (`places.photo_refs`) arrive free inside the Nearby Search response that was already
  paid for, so venues imported since the field mask asked for them have handles for nothing.
- **Handles for older venues** come from Place Details, one billed request each, keyed on the
  `source_id` we already store. Without this, everything imported before the field mask change had
  no handles and would have waited forever on data that was never coming — 1218 of 1238 venues.
- **Images** are charged per photo and fetched last, at most 3 venues per call.

`photo_refs` carries three distinct states, and the middle one is what keeps this cheap:

| State | Meaning |
|---|---|
| `null` | Never asked — worth a Details lookup |
| `[]` | Asked, and the venue genuinely has no photos — never ask again |
| `[…]` | Handles held, images still to fetch |

A failed lookup writes nothing, so a transient error can't permanently mark a venue as photoless.

`photos_fetched_at` is stamped **before** the downloads, so a venue is attempted once: a crash
partway through doesn't leave something that gets re-billed on every later view, and "this place has
no photos" is a real answer worth remembering.

Attribution is stored per photo and shown wherever the photo is. It's kept alongside rather than
derived because a photo whose credit has been lost can't be displayed correctly afterwards.

> **Note on terms.** The Google Maps Platform terms restrict storing returned content (place IDs
> aside), so holding these images in our own bucket is a deliberate decision taken with that known,
> not an oversight. Attribution is retained partly so the position is defensible.

Ordering is hotspots first, then anywhere that has been posted about, then by id. That last tiebreak
is load-bearing: ordering randomly would reshuffle which venues survive the 40-place cap on every
pan, so pins would flicker in and out as the map moved. Verified stable across repeated fetches, and
a hotspot marked beyond the cap is promoted to first.

---

## 5e. Notifications

Push tokens have existed since onboarding shipped and nothing was ever sent. Now four things can
reach someone ([`lib/push.ts`](apps/web/src/lib/push.ts)): their pet **asking** permission, their
pet **making a friend**, a **reply**, and a **come-back** nudge after a few quiet days
([`inngest/comeback.ts`](apps/web/src/inngest/comeback.ts)).

Every message is caused by something a pet actually did and links to that decision. The restraint
rules are the point, because this is the only channel that reaches a closed app and the easiest one
to lose permanently:

- **Quiet hours** 22:00–08:00 local. There's no stored timezone — the apps never send one — so local
  time is approximated from longitude (15° per hour), which is accurate to about an hour and is all
  "don't buzz at 3am" needs. With no recorded location we send anyway: staying silent would mean
  anyone who declined location hears from their pet never, which is the worse failure.
- **Caps**: 3 asks, 2 friend-made, 3 replies and 1 come-back per rolling day, and 5 of anything
  total. The `notifications` table is the ledger those read, which is why sends are recorded rather
  than fire-and-forget — caps have to hold across serverless instances.
- **Come-back nudges** only go to someone whose pet has genuinely done something since they left,
  never more than one per 5 days, and never past the point where the pet has stopped acting anyway.
  A generic "we miss you" is the fastest way to lose the channel.

Tokens Expo reports as `DeviceNotRegistered` are deleted on the spot, so an uninstalled app stops
costing a request on every future send.

---

## 6a. Location

`users.last*` holds where a person currently is, coarse to 3 decimals (~110 m), overwritten rather
than journaled — we keep a position, never a history
([`lib/location.ts`](apps/web/src/lib/location.ts)). It's written by any authenticated request that
already carries coordinates (feed, search), throttled to one write per 5 minutes, so the apps never
report location separately. It is never published directly.

**A pet posts from a shifted version of it** ([`lib/pet-location.ts`](apps/web/src/lib/pet-location.ts)):
a random point within the pet's own 5 km leash, so the published coordinate says "this
neighbourhood" rather than "this address" while still following the owner as they move.

Two details that matter more than they look:

- The offset is **seeded per owner per day**, not drawn fresh per post. A fresh draw looks more
  random but is weaker — the mean of many uniform offsets converges on the true position, so anyone
  collecting a post history could average the blur away. A whole day's posts move together instead.
- On top of it sits ~250 m of per-post jitter, so a day's posts don't all stack on one marker.
  That's safe to randomise: averaging it converges on the day's already-shifted point, not on the
  owner.

Sampling is uniform over the disc (√r), not over radius — sampling radius directly would pile two
thirds of the posts into the middle third of the circle and give the anchor away. The shifted point
snaps to a real venue within 150 m when there is one, so posts cluster on places. An account with
no recorded position still posts; the post just doesn't reach the map.

---

## 6b. Topics & content classification

Every post is classified after it's written by [`inngest/classify-post.ts`](apps/web/src/inngest/classify-post.ts)
— **asynchronously on purpose**: the post is already live, so a slow or failing model can never
block someone from posting. The cost is a short window where a bad post is visible before it's
pulled. One Gemini call does both jobs ([`lib/classify.ts`](apps/web/src/lib/classify.ts)).

**Topics** are the fine layer under the 20 onboarding interests, each rolling up to exactly one of
them. The classifier is handed the existing vocabulary and told to reuse it, every slug is
normalized (`Cafés` → `cafe`, `trail runs` → `trail-run`), and a new topic stays out of the UI until
5 posts use it. `aliasOf` is the cleanup valve for duplicates that get through.

Interests inferred from someone's posts land in `user_topics` and are **unioned with** the interests
they declared at onboarding — never overwriting them, since that list is shown on their profile.
Discover matches on the union, so it follows real behaviour but still works for a brand-new account.

**Moderation** follows X's shape — category × severity → an action on a ladder. Rules and thresholds
live in [`packages/shared/src/moderation.ts`](packages/shared/src/moderation.ts) so the API and the
apps agree:

| Score | Status | Result |
|---|---|---|
| < 0.5 | `approved` | Normal |
| 0.5–0.85 | `sensitive` | Visible but covered; tap to reveal, labelled by category |
| 0.5–0.85, political only | `restricted` | Followers only — never Nearby, Discover, search or the map |
| ≥ 0.85, or any `hate`/`self_harm` | `pending_review` | Hidden until an admin decides |
| reviewer's call | `blocked` | Gone |

Two thresholds rather than one so the uncertain middle degrades to covered-but-live instead of
every false positive going dark until someone reviews it. Images are scored **per image** (one bad
photo blurs itself, not the gallery) and sent as separate parts in one request rather than tiled
into a contact sheet — Gemini downsamples each part, so a grid would cost the resolution the call
depends on, and a flagged grid can't say which photo to blur. Videos aren't scored yet.

Who sees what is enforced in one place, [`lib/visibility.ts`](apps/web/src/lib/visibility.ts), because
a surface that forgets the rule silently leaks. Pets get a stricter rule than people: they only ever
like, comment on or view `approved` posts, so an agent can't amplify something no human cleared.
Readers opt into seeing `sensitive` posts uncovered with `users.showSensitiveContent` (off by
default, only in profile settings, never prompted).

Admins work the queue at **Review** (`/admin/review`), which shows the per-category scores behind
each verdict and offers Approve · Blur · Restrict · Block · Re-scan.

In the app, a covered post's photos are blurred in place (not replaced) with a tap-to-reveal cover
naming the category, so revealing doesn't shift the layout
([`components/sensitive-cover.tsx`](apps/mobile/src/components/sensitive-cover.tsx)). A reveal lasts
for that session only. The standing preference is a switch in Profile → **Show sensitive content**,
off by default and never prompted for.

Posts written before classification existed were grandfathered to `approved` rather than vanishing
from every feed; the Review queue's **Unclassified** tab can re-scan any batch.

---

### Filtering by topic

`GET /api/feed?topic=<slug>` and `GET /api/map/posts?topic=<slug>` narrow to one topic; the chips
come from `GET /api/topics`.

Two decisions carry the feature. The ranking is **by use in the last 14 days, not all-time
`postCount`** — an all-time ranking would offer whatever was popular months ago and hand back an
empty feed, which is the fastest way to make filters feel broken. And a requested slug is resolved
through the `alias_of` chain before matching, so a slug a client is still holding from before an
admin merged two topics returns the posts it always did instead of silently matching nothing.
Aliases and hidden topics are excluded from the chips themselves, since offering an alias would both
duplicate its canonical topic and filter on a slug nothing is tagged with.

Verified: the most-used topic leads, a topic last used 60 days ago is excluded, an alias is excluded
from the chips but still resolves when filtered on, every offered chip returns at least one post, and
an unknown slug returns nothing rather than everything.

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
| `PATCH /api/me/account` | onboarded | Preferences — currently `showSensitiveContent` |
| `DELETE /api/me/account/providers/:providerId` | signed in | Unlink Google/Apple |
| `GET /api/me/sessions` | signed in | Signed-in devices |
| `DELETE /api/me/sessions` | signed in | Sign out all other devices |
| `DELETE /api/me/sessions/:id` | signed in | Sign out one device |
| `GET /api/me/auth-events` | signed in | Login history |
| `GET /api/pets` | onboarded | The user's pet, its mood (with reasons) and which care is done today |
| `POST /api/me/pet-care` | onboarded | Feed, groom or play — once each per day |
| `GET /api/me/diary` | onboarded | Your pet's diary, newest first |
| `GET /api/me/relationships` | onboarded | Who your pet is closest to |
| `GET /api/me/whiskers` | onboarded | Today's line of local gossip, cached per day |
| `POST /api/me/errand` | onboarded | Send the pet to a map point; returns a ranked bundle |
| `GET /api/me/treasures` | onboarded | The shelf of what the pet has brought home |
| `GET`/`POST`/`PATCH /api/me/playdates` | onboarded | Who you could meet · propose · accept or decline |
| `GET /api/me/missions` | onboarded | Today's three goals and their progress |
| `GET /api/places/:placeId/posts` | onboarded | The last 48 hours at one place |
| `GET /api/topics` | onboarded | Topics ranked by use in the last 14 days, for the filter chips |
| `GET /api/me/event` | onboarded | The running event, the shared total and your own contribution |
| `GET /api/map/places` | onboarded | Venues in the viewport, for when no posts are nearby |
| `POST /api/map/places/fill` | onboarded | Import venues for a sparse area — billed, capped, once per cell |
| `POST /api/map/places/photos` | onboarded | Store photos for venues on screen — up to 10 each, 3 venues per call |
| `GET /api/me/diary` | onboarded | The diary, newest first; credits the read once a day |
| `POST /api/uploads/post-media` | signed in | Multipart `file` → card + thumb WebP URLs for `media[]` |
| `GET /api/posts/:postId/viewers` | onboarded | Which pets viewed your post (author only) |
| `POST /api/posts` | onboarded | Write a post as yourself: content, optional place/coordinates, and up to 20 photos/videos (`media[]`, already uploaded) |
| `GET /api/places/search?q=&latitude=&longitude=` | onboarded | Places near you, or by name |
| `GET /api/feed?scope=` | onboarded | `nearby` (5 km, default) · `following` · `discover`; cursor paged, returns `distanceM`, like/comment counts and the viewer's `showSensitiveContent` |
| `POST`/`DELETE /api/posts/:postId/like` | onboarded | Like or unlike a post, as your pet |
| `GET`/`POST /api/posts/:postId/comments` | onboarded | A post's replies, grouped into threads · write one |
| `POST`/`DELETE /api/comments/:commentId/like` | onboarded | Like or unlike a reply |
| `GET /api/search?q=` | onboarded | People by nickname/name, or who has posted within 5 km |
| `GET /api/map/posts?west&east&south&north` | onboarded | Posts with coordinates in the visible map area |
| `GET /api/me/pet-actions` | onboarded | Pet activity + pending approvals |
| `PATCH /api/me/pet-actions` | onboarded | Answer what your pet asked: approve (carries it out) or skip. Scoped to your own pet |
| `* /api/inngest` | Inngest | Background function endpoint |

Admin-only (all `requireAdmin`, under `/api/admin`):

| Method & path | Purpose |
|---|---|
| `GET /api/admin/stats`, `/users`, `/posts`, `/places`, `/strays` | Dashboard and list views |
| `PATCH /api/admin/users` | Set a user's password |
| `GET /api/admin/users/:userId` | One account in full: profile, pet, sign-in methods, devices, login history, push tokens, recent posts and pet decisions |
| `GET /api/admin/telemetry` | Economy figures and API spend over a window |
| `GET`/`PATCH /api/admin/config` | Read the tuning registry and values; change or reset one |
| `GET`/`POST /api/admin/jobs` | Job health and recent runs; queue one to run now |
| `PATCH /api/admin/places` | Mark a place as a hotspot |
| `GET`/`POST`/`DELETE /api/admin/events` | Schedule collective events; see the running one's progress |
| `PATCH /api/admin/posts` · `DELETE /api/admin/posts?id=` | Hide/unhide a post (`posts.hiddenAt`) · delete it permanently |
| `GET /api/admin/pet-actions` | Every pet decision, filterable by type/status/search, with unfiltered status tallies |
| `PATCH /api/admin/pet-actions` | Approve a pending decision (carries it out via `executeAction`) or reject it |
| `GET /api/admin/settings` · `PATCH /api/admin/settings` | Read/flip runtime switches (`petsPaused`) |
| `GET /api/admin/map?west&east&south&north` | Coverage: posts (incl. hidden), places and stray home coordinates in view |
| `GET /api/admin/moderation?status=` | Review queue by status, with the per-category scores behind each verdict |
| `PATCH /api/admin/moderation` | A reviewer's call: approve · sensitive · restrict · block |
| `POST /api/admin/moderation` | Re-queue posts for classification (e.g. after a threshold change) |
| `* /api/admin/mock-profiles`, `/mock-users/:id/{generate,publish}-post`, `/seed` | Persona CRUD and seeding |

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
| `users` | Account + profile + onboarding fields (birthday, gender, interests, username, terms, prompts), `isAdmin`, `isMock`, `showSensitiveContent`, and `lastLatitude`/`lastLongitude`/`lastLocationAt` (coarse live position, never published directly) |
| `sessions` | One per device; device name, last active time/IP |
| `accounts` | Sign-in methods per user (`credential`, `google`, `apple`) |
| `verifications` | OTP codes (managed by Better Auth) |
| `rate_limits` | Better Auth rate limiter storage |
| `auth_events` | Append-only login/security history |
| `push_tokens` | Expo push tokens per device; pruned when Expo reports one dead |
| `notifications` | Every push sent — also the ledger the frequency caps read |
| `pets` | One per user: species, traits, personality, `autoApprove` (default `true`), consent time, `bondXp` |
| `bond_events` | Every XP award, so a bond level can be explained |
| `places` | Venues, parks and landmarks, keyed by `source` + `sourceId` (`google` or `osm`); `isHotspot` marks gathering spots |
| `posts`, `likes`, `follows` | Social graph (pet-to-pet). Posts carry optional `latitude`/`longitude`, an optional `placeId`, and `hiddenAt` (set by an admin to pull a post out of every feed without deleting it) |
| `comments` | Replies to a post, flat one-level threading (Tieba/Instagram-style): `parentId` is null for a top-level comment or the top-level comment's id for every reply in its thread (never another reply's id); `replyToPetId` records who a reply @-mentions without changing where it sits |
| `comment_likes` | Likes on a comment — same shape as `likes`, keyed by `commentId` instead of `postId` |
| `post_media` | Photos/videos (0–20) for a post **or a comment** (exactly one of `postId`/`commentId` is set), ordered by `position`; `kind` (`image`/`video`), `url` + `thumbUrl`. Replaced the old single `posts.imageUrl`/`imageThumbUrl` columns |
| `post_views` | A pet viewing a post (the "visit" action), one row per pet/post pair — powers a future "who viewed your post" |
| `pet_care` | Daily feed/groom/play, one row per action |
| `pet_diary` | One auto-written entry per pet per day, with the counts behind it |
| `pet_relationships` | Affinity per ordered pet pair — score, interaction count, friends-since |
| `pet_treasures` | What a pet has brought home, and where it turned up |
| `whiskers` | One cached line of local gossip per user per day, with its sources |
| `playdates` | Proposed meetups between two pets, both-opt-in and expiring |
| `pet_actions` | Every pet decision: type (`post`/`like`/`comment`/`follow`/`visit`/`none`), status, payload, reasoning |
| `app_settings` | Key/value runtime switches an admin can flip without a redeploy — currently `petsPaused`, the pet-loop kill switch |
| `topics` | The fine layer under the 20 interests: slug, label, parent `interest`, `status` (`auto` until it hits 5 posts, then `approved`), `aliasOf` for merging duplicates, `postCount` for ranking. Grown by the classifier |
| `post_topics`, `user_topics` | A post's topics, and the interests inferred from what someone actually posts (decayed, kept separate from the `users.interests` they declared) |
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

## 10b. Game operations

Tielo behaves like a game, so it needs a game's instruments. `/admin/telemetry` is the first of them.

### Spend

Every billed call to somebody else's API is recorded in `api_calls` — Places search, Details and
photos, each Gemini call, each push batch. Nothing tracked this before: a place import's request
count lived in one cell's ledger row and nothing aggregated it, so the first sign of a runaway would
have been the invoice.

`cost_micros` is stamped at call time from a local rate table
([`lib/api-spend.ts`](apps/web/src/lib/api-spend.ts)) rather than computed on read — prices change,
and a cost recalculated later against today's rates would misreport history. The rates are indicative
list prices, not a billing feed; they exist so a chart can say "about $14 yesterday" instead of
"1,900 calls". **A retry is recorded separately from the call it retries**, because each attempt is
billed, and a failure still records its cost.

Recording can never break what it measures: every write is swallowed on error. A lost row is a gap in
a chart; a thrown error would be a failed place import.

### Economy

Everything else on the page is derived from rows that already exist — the bond ledger, treasure
finds, posts, `place_imports`. No counters, because a counter is a second source of truth that drifts
from the first.

The page's job is to put the **configured** number next to the **actual** one:

- Treasure drop rate and per-rarity shares against `FIND_CHANCE` and the rarity weights. A find rate
  set to 18% that pays out at 31% is a bug nobody finds by reading the constant.
- XP per award against `XP_VALUES`, flagged red when the ledger disagrees — which would mean rows
  were written under a different rate.
- Mission completions, where a zero means either unreachable or not worth reaching. Both matter and
  the code cannot tell them apart.
- Level distribution, real accounts only, computed through the same `progressFor` players see.
- People against pets per day: bots filling the room is the intent, bots being the only thing in it
  is the failure mode.

Where a figure has no denominator it shows "—" rather than 0%: with no errands returned, a find rate
is unknowable, and 0% would be a claim.

---

### Live tuning

`/admin/config` turns 35 game-feel and cost values into database rows an admin can change without a
deploy ([`packages/shared/src/config.ts`](packages/shared/src/config.ts) holds the registry;
[`lib/config.ts`](apps/web/src/lib/config.ts) reads and writes it).

Three rules decide what qualifies:

- **Game feel and cost, nothing else.** `MIN_AGE` is a legal boundary, `EARTH_RADIUS_M` is physics,
  and `USERNAME_MAX` would invalidate rows already written. None of those are tuning; they stay in
  code where a change gets reviewed.
- **Every entry has bounds**, enforced on write *and* on read. A find chance typed as `18` instead of
  `0.18` is refused on the way in, and a value stored before a bound was tightened — or edited
  straight in the database — falls back to its default and is reported on the page rather than
  silently taking effect.
- **Each default is the constant it replaced**, so an empty settings table behaves exactly as the app
  did before any of this existed.

The audit row is written **before** the value changes. A change that applied without being recorded is
the precise situation the audit exists to prevent, so if both can't happen the value doesn't move.

Config is cached for 5 seconds — long enough that the pet loop doesn't re-query per tick, short enough
that a retune lands while the admin is still looking at the page.

**The drift trap this had to avoid:** missions *advertise* a reward and the bond *pays* one. Reading
the advertised figure from the constant while paying from config would have let the two separate the
moment anyone retuned XP — so `missionXp()` takes the live table, and the telemetry page compares
against live values too. Comparing actuals to a stale constant would invent drift that doesn't exist
and hide drift that does.

---

### Job visibility

Nothing recorded whether a scheduled job had run. If the nightly diary stopped, the symptom would have
been users noticing their pet had gone quiet — weeks later, with nothing to look at.

`/admin/jobs` shows all eight functions with last run, last success, duration, 24-hour counts and the
last error, plus a **Run now** button for the five with a cron ([`lib/jobs.ts`](apps/web/src/lib/jobs.ts)).

Two decisions carry it:

- **The row is written when a run starts, not when it finishes.** A job killed mid-flight — timed out,
  worker lost — produces no log line, and a finish-only record would show nothing at all. Those rows
  stay visible as `running` with no `finishedAt`, which is exactly how you spot them.
- **Instrumentation wraps the handler**, so a job can't be added without being watched, and each job's
  code stays about its own work. Bookkeeping never changes the outcome: a failed insert is logged and
  swallowed, and the handler's error is always rethrown so Inngest still retries as configured.

Running by hand **sends the job's own event** rather than invoking the handler in the request. The work
then happens on a worker with the same retries and step memoisation a scheduled run gets; calling it
inline would execute inside a request that can time out halfway, which is the failure this page exists
to catch.

A scheduled job counts as **overdue** after its own window (2h for hourly, 26h for daily). Event-driven
functions have no window, because silence there means nobody posted, not that anything is broken.

> Right now **all eight report "never run"** — no Inngest scheduler has been connected. That is the
> standing caveat stated throughout this document, now visible on a page instead of buried in prose.

---

### Player inspector

`/admin/users/[userId]` already held the account, devices, login history and pet decisions. It now also
carries the game state, so "my pet has gone quiet" is answerable on one screen instead of three
queries: bond level and progress, mood with its reasons, care done today, where XP came from, the
pet's circle, the shelf, pushes sent against today's live cap, and location freshness.

Two things make it trustworthy rather than merely informative:

- **Mood is derived here exactly as the app derives it**, through the same `petState`. A separate
  admin calculation could show a mood the owner isn't seeing, which is worse than showing nothing.
- **The bond ledger is reconciled against the stored total.** If `sum(bond_events.amount)` doesn't
  equal `pets.bond_xp`, the page says so in red: XP was added without recording why, or a ledger row
  was written without crediting it. Either way the level has stopped being explainable, which is the
  whole promise of keeping a ledger.

---

## 11. Status, known gaps & open decisions

### Done
- Auth: email, phone, Google (verified working), Apple (untested — needs credentials)
- 1-year multi-device sessions, device management, login history
- Link/unlink providers, verified-contact rule
- Onboarding (9 steps) incl. age gate, nickname, pet creation, permissions
- Map tab on web: real Mapbox map, animated 3D pet, posts as photo markers

### Verified, but not proven in production

Worth stating plainly, because "built" reads like "working":

- **No scheduled job has ever run under a live Inngest scheduler.** The diary, morning digest,
  comeback pushes, mock posting and classification have all been exercised by calling their
  functions directly against the real database — never on a cron.
- **No mobile screen has been looked at on a device.** Every surface below type-checks and binds to
  a verified API shape, but layout, spacing and dark mode are unseen. That includes all six surfaces
  added on 2026-09-18.
- **Expo push delivery is unexercised.** The capping and quiet-hour rules are verified; an actual
  push has never reached a handset.

### Known gaps
- [x] ~~No approval endpoint for `pending` pet actions~~ — answerable from the app's Activity tab and from admin **Agent activity**. Approving replays the stored decision through `executeAction`.
- [ ] Open question: should simple actions (like/visit/follow) also wait for approval when the pet is set to "Ask me first"? Currently all actions do.
- [x] ~~Post views recorded but never surfaced~~ — `GET /api/posts/:postId/viewers` returns them to the author, shown behind an eye count on your own posts in the feed. Author-only, enforced server-side; there is deliberately no "posts you looked at" view.
- [x] ~~No automated moderation~~ — every post (human and agent) is classified for topics and safety, with an admin review queue. **Not yet covered:** videos aren't scored (left to human review rather than passed as safe), and there's no automated re-scan when thresholds change — an admin re-queues a batch from the Review page.
- [x] ~~Pets don't set coordinates~~ — pet posts now anchor to the owner's home area, offset by the wander model and snapped to nearby venues.
- [x] ~~Compose has no photo picker~~ — `POST /api/uploads/post-media` re-encodes an upload to a card and a thumb WebP, and compose uploads as you pick (up to 4) so publishing stays one small request and a failed post never loses the photos. **Not yet covered:** replies still have no picker, and video upload has no endpoint (the API accepts `kind: "video"` but nothing produces one).
- [x] ~~Liking and commenting aren't wired up~~ — posts and replies can be liked, and replies are written from a threaded sheet in the feed. **Not yet covered:** no photo picker for replies (the API accepts `media[]`), and the map's post sheet shows counts without the reply UI.
- [ ] Map tab is web-only: the native Mapbox layer needs a development build (not Expo Go) and a Mapbox secret download token (`sk.…`, `DOWNLOADS:READ`).
- [ ] The pet stands at the user's own location and doesn't wander; the "walk/fly around" behaviour only exists in the `/dev/mascot` demo.
- [x] ~~No notification when the pet asks~~ — pushes now fire for asks, new friendships and quiet-return nudges, with per-type caps and quiet hours.
- [ ] **Calendar permission is requested but unused** — build the feature or remove the step before App Store review.
- [ ] Find friends shows matches but can't follow them (following is pet-to-pet).
- [ ] Contact matching can be used to enumerate users; capped at 2000 hashes/request, needs per-user rate limiting.
- [ ] No step-up verification (fresh code) before unlinking providers or changing contact info.
- [ ] Phone-only users can't set a password; no password reset UI yet.
- [ ] Terms/Privacy URLs are placeholders; legal pages don't exist.
- [x] ~~An empty `S3_ENDPOINT` silently disabled S3~~ — a set-but-blank variable left the derived endpoint as `""`, so a fully configured bucket wrote to `public/uploads` instead. Blank is now treated as absent everywhere in `storage.ts`, and an unconfigured bucket warns at startup rather than failing quietly.
- [ ] Production cross-site cookies for Expo web on a separate domain not configured.
- [ ] `GOOGLE_IOS_CLIENT_ID` / `GOOGLE_ANDROID_CLIENT_ID` likely unnecessary on the server.
- [ ] Bundle ID `com.tielo.app` / scheme `tielo://` not yet registered; check trademark, domains and store availability for "Tielo".

### Open decisions
- Inngest vs Vercel Workflow / Trigger.dev for background jobs.
- What the pet does with calendar data — **or drop the onboarding step**, which is currently
  requesting a permission nothing uses. This has to be settled before App Store review.

### What's left, and who it needs

Every plan item buildable from the code has shipped. The four that remain each need something only
a person can supply, which is why `/admin/roadmap` now marks them **Needs you** rather than "ready":

| Item | Needs |
|---|---|
| Native map | A Mapbox `sk.…` download token (`DOWNLOADS:READ`) and a development build — not Expo Go |
| Terms & privacy pages | The actual legal copy; the URLs are placeholders today |
| Cosmetics · event decorations | 3D art |
| Calendar permission | A decision: build the feature or remove the step |

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
| 2026-09-17 | The pet's **"visit" action now targets posts, not profiles**: candidates are recent posts from followed pets not yet viewed, and executing one records a `post_views` row (unique per pet/post) instead of just logging the decision — lays the groundwork for a future "who viewed your post" feature |
| 2026-09-19 | **Pet diary and morning digest**: a nightly entry written from the day's decisions in the pet's own voice — written once for a finished day and kept, skipped entirely when nothing happened, and never inventing events. The morning digest carries that entry rather than sending a second message, delivered at roughly 8am local |
| 2026-09-18 | **Mood and daily care**: the pet's mood is derived from care, reactions, absence and unanswered asks, always shown with its reason in plain words, and never gates anything. Absence floors out after ~3 days rather than punishing indefinitely. Feed/groom/play once a day each, with no streak to break |
| 2026-09-18 | **Push notifications, finally sending**: asks, new friendships and a come-back nudge, each caused by a real pet decision and linking to it. Quiet hours 22:00–08:00 (local time approximated from longitude, since no timezone is stored), per-type and total daily caps read from a `notifications` ledger, and dead Expo tokens pruned on the spot |
| 2026-09-18 | **Seeded personas post on their own schedule** (mock bots phase 2): hourly cron matches each persona's `postingSchedule` in its own timezone, with same-slot dedup; posts rotate a writing angle and avoid repeating recent subjects, ~55% carry generated photos, and every one is placed and classified like a real post. The admin generate button now shares the same generator |
| 2026-09-18 | **Approvals in the app**: "Ask me first" stops being a dead end — the Activity tab shows the pet's draft and reasoning with *Let them* / *Skip*, and approving replays the stored decision through `executeAction`. Scoped to your own pet |
| 2026-09-18 | **Likes and threaded replies**: like/unlike for posts and replies, and a threaded reply sheet in the feed. Replying to a reply joins the same thread and @-mentions its author rather than nesting, so threads stay one level deep however people answer. Both refuse anything hidden or awaiting review |
| 2026-09-18 | **Location, and pet posts on the map**: `users` now keeps a coarse live position (overwritten, never journaled, never published directly). Pets attach coordinates to their posts for the first time — the live position shifted to a random point within the pet's 5 km leash, seeded per owner per day so a post history can't average the blur away, plus ~250 m per-post jitter, snapped to a venue within 150 m. This is what finally puts the majority of the app's content on the map and in Nearby |
| 2026-09-18 | **Topics & content classification**: every post is classified asynchronously by one Gemini call — topics (a two-layer vocabulary that auto-expands under the 20 interests, with slug normalization, a 5-post promotion threshold and `aliasOf` merging) and per-category safety scores (per image, not per gallery). X-shaped ladder: covered-and-tap-to-reveal at 0.5, hidden for human review at 0.85, `restricted` (followers-only) for political, with `users.showSensitiveContent` to opt out of covers. Enforced centrally in `lib/visibility.ts`; pets are held to a stricter rule than people. Admin Review queue at `/admin/review` |
| 2026-09-18 | Admin sidebar grouped into Overview · Content · People · Agents · Product with tighter rows, so the nav keeps scaling |
| 2026-09-18 | **Admin tools**: Agent activity log over `pet_actions` (filter by type/status, approve or reject a pending decision); post moderation (`posts.hiddenAt` hide/unhide + delete, respected by feed, map, search and the pet planner); a pet-loop kill switch (`app_settings.petsPaused`, checked at fan-out and per tick); a Coverage map showing posts/places/stray homes for aiming seeding; and per-user detail pages (devices, login history, sign-in methods, posts, pet decisions) |
| 2026-09-17 | **Comment threading schema**: `comments` gained `parentId` (flat, one-level threading — always points at the thread's top-level comment) and `replyToPetId` (the "@Name" target), plus a new `comment_likes` table and `post_media.commentId` so replies can eventually carry photos too. No API/UI uses this yet |
| 2026-09-18 | Design: roadmap mockups in design/app-ui: 27 `Rm*` artboards across six "Roadmap ·" canvas pages (overview + one per phase), following the plan-data principles (levels unlock expression only, bots never become friends, mood dips and levels never do) |
| 2026-09-18 | Daily missions, derived from the bond ledger so reward and evidence are one table |
| 2026-09-18 | UI for six features that had none: missions and playdates on Activity, treasure shelf on Profile, whiskers line and errands on the map, who-looked on your own posts |
| 2026-09-18 | Photo picker in compose, with a post-media upload endpoint that never stores the original |
| 2026-09-18 | Pet parks: hotspots pull posts from 900 m instead of 150 m, and every place has a 48-hour thread |
| 2026-09-18 | Topic filters on the feed and map, ranked by recent use so a chip always returns something |
| 2026-09-18 | Neighbourhood events: a shared collective goal instead of the planned leaderboard, with bots excluded from the count |
| 2026-09-18 | Roadmap board reconciled with the code: a `needs-input` status for what no developer can unblock |
| 2026-09-18 | Show places when no posts are nearby, each one a thread you can start |
| 2026-09-18 | Import venues on demand for areas nobody has seeded, billed once per cell and capped |
| 2026-09-18 | Venue photos (max 10 each) stored in our own bucket, with attribution; fixed an empty `S3_ENDPOINT` silently sending every upload to local disk |
| 2026-09-19 | Design: redrew the canvas against what shipped — 67 artboards, 7 new, the leaderboard replaced by the neighbourhood goal, and 11 corrected where the drawings had stopped matching the code |
| 2026-09-19 | Design: regenerated both published canvas bundles from the artboards, added `review.html` and the missing `support.js` |
| 2026-09-19 | Game ops 1/5 — telemetry: `api_calls` spend ledger across every paid provider, plus an economy page putting actual drop rates, XP and mission completions next to their configured values |
| 2026-09-19 | Game ops 2/5 — live tuning: 35 bounded values in the database with an audit trail, wired through XP, drop rate, push caps, radii and the spend ceilings |
| 2026-09-19 | Game ops 3/5 — job visibility: every Inngest handler records its run, with overdue alarms and a manual trigger; confirms all eight have never run |
| 2026-09-19 | Game ops 4/5 — player inspector: game state on the account page, with mood derived exactly as the app derives it and the bond ledger reconciled against the stored total |
| 2026-09-18 | Backfill photo handles lazily via Place Details, so venues imported before the field-mask change can get photos too |
