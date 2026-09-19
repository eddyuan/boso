# Tielo app UI — design canvas

**Last updated: 2026-09-19**

67 artboards across 12 canvas pages. Each `*.dc.html` file is one self-contained
artboard: a `<helmet>` block holding the shared design tokens and component
classes, then a `.screen` (390 × 844 phone frame) or `.sheet` (wide spec sheet).
`canvas.json` places them on pages and records each frame's box.

The kit is identical in every roadmap artboard, so a new one should be started by
copying an existing file's `<helmet>` verbatim rather than re-deriving it.

## How to review

```sh
open design/app-ui/review.html
```

One self-contained page with all 67 artboards, grouped by canvas page, with a jump nav and a
50/75/100% zoom. The shared kit is inlined once rather than per artboard, so it opens straight from
disk with no server and no network beyond the Google Fonts link.

`open design/app-ui/tielo-app-ui.html` opens the same set in the canvas editor instead, with its
pages and positions.

Individual artboards also open on their own (`open design/app-ui/RmMissions.dc.html`). That needs
`support.js`, which is a small local shim — the canvas editor's own script was never committed, so
without it `<x-dc>` and `<helmet>` fall back to unknown inline elements and the layout comes out
subtly wrong.

`review.html` is generated from `canvas.json` plus the artboard bodies. Regenerate it after changing
any artboard, or it goes stale in exactly the way the published bundles did.

## Pages

| Page | What's on it |
|---|---|
| `app` | The four tabs as built, plus compose, search and the layout scale. The third tab is the **pet**, not an activity feed |
| `auth`, `onboarding`, `account` | Sign-in, the nine onboarding steps, account and devices |
| `mascot-emotions`, `system` | The 12 mascot moods, and the UI kit |
| `rm-overview` | Principles, the phase map, and **what changed during the build** |
| `rm-fill` … `rm-chase` | One page per roadmap phase, feature by feature |

The `app` page holds the *composed* tabs with no annotations — the visual
reference. The `rm-*` pages hold per-feature deep dives with `.why` blocks
explaining the rule behind each decision. That split is deliberate: the composed
screens answer "what does this look like", the roadmap screens answer "why is it
like that".

## Redrawn 2026-09-19

These were redrawn against what actually shipped. Several features changed shape
during the build and two were replaced outright, so the earlier drawings had
stopped describing the product.

**Replaced**

- `ActivityTab` → **`PetTab`**. The third tab held three unrelated jobs — an inbox, a goals board and a
  log — and read as thin however full it was. It's the pet now: one subject with several sections, and
  the only tab that always has something in it. `ProfileTab` shrank to just the person, since it had
  been carrying both identities at once.
- `RmLeaderboard` → **`RmNeighbourhoodGoal`**. A weekly per-area ranking
  publishes who is most active within a few streets, makes progress relative so
  one person rises only as another falls, and reads as false wherever seeded
  accounts fill its rungs. It is now one shared bar, and the artboard explains why.
- `RmProfile` and `RmActivityToday` → folded into `ProfileTab` / `ActivityTab`,
  which now show the real composition rather than duplicating it twice.

**New, for things that had no design at all**

`RmMapPlaces` · `RmPlaceThread` · `RmPlaceThreadEmpty` · `RmFeedOwnPost` ·
`RmSensitiveCover` · `RmErrandNothing` · `RmNeighbourhoodGoal`

**Corrected against the code**

| Artboard | Was | Is |
|---|---|---|
| `RmMissions` | +15/+30/+20, a weekly prize at 15 missions | Derived from the bond ledger (25/12/8/10/12/5/30); no streak, no prize |
| `RmBondLevel` | "+30 approve, +20 meet, +5 care (15/day)" | 30 friend, 25 answer, 12 errand, 10 post, 8 reply, 6 reaction, 5 diary, 4 care |
| `RmComposePhotos` | "3 of 20", drag to reorder, a cover photo | 4 max, uploaded as picked; no reorder and no cover exist |
| `RmPetHome(Missed)` | Mood **and** an "Energy %" | One 0–100 mood score; there is no energy |
| `RmDiary` | A timeline of timestamps | Prose in the pet's voice; reading it pays +5 once a day |
| `RmErrandSend` | Tap a spot within 5 km, 2 a day, pick topics | One button, 800 m, 72 h, up to 4 things, no allowance |
| `RmPetPark` | "7 pets here", arrival ETA, clears at midnight | The 900 m hotspot pull; a 48 h window; the wander is cosmetic |
| `RmRelationship` | Wave / Gift / Playdate buttons | Playdate only — wave and gift were never built |
| `RmTreasures` | "9 of 30" | The real 12 finds across 4 rarities, 18% find rate |
| `RmPostViewers` | "5 pets visited" | Real total, list capped at 20, author-only |
| `RmLiveEvent` | Weekend quests with cosmetic rewards | The collective bar as it sits on Activity |

**Marked unbuilt rather than quietly drawn as real**

- `RmNotifySettings` — every rule is enforced server-side; the screen doesn't exist.
- `ActivityReactions` — sent pushes are recorded; nothing reads them back yet.
- `RmWardrobe` — slots and levels exist in code; blocked on 3D artwork.

## Two caveats these drawings cannot show

- **No screen here has been rendered on a device.** Every surface is built and
  type-checked against a verified API shape, but layout, spacing and dark mode
  are unseen. Treat the artboards as intent, not screenshots.
- **No scheduled job has run on a scheduler.** Anything that arrives "overnight"
  — the diary, the morning digest, the comeback nudge — has only ever been
  invoked directly.

## The published bundles

`tielo-app-ui.html` (3.6 MB) and `bsocial-app-ui.html` (2.7 MB) are self-contained canvas exports:
the whole editor plus every artboard, inlined. Both are **up to date as of 2026-09-19**.

They're regenerable rather than hand-maintained. Each holds a
`<script type="application/json" id="appifact-doc">` payload with a filename → contents map, so
refreshing one means replacing that map from disk and re-serialising — never editing the inlined
copies by hand. Two details matter when doing it:

- **`<` must be written `\u003c` throughout the payload.** A literal one lets an artboard's markup
  terminate the `<script>` tag it lives in.
- **Serialise with `ensure_ascii=False`.** The originals contain non-ASCII characters and escaping
  them would needlessly rewrite every artboard.

The two bundles differ on purpose:

| | Artboards | Canvas pages |
|---|---|---|
| `tielo-app-ui.html` | all 67 | 12 — including the roadmap |
| `bsocial-app-ui.html` | 25 | 5 — an earlier export, pre-roadmap |

`bsocial-app-ui.html` keeps its own smaller canvas because that's the only one consistent with the
25 artboards it carries; its contents were refreshed, its structure left alone. It's effectively
superseded by the other bundle and could be deleted.

**The `.dc.html` files and `canvas.json` remain the source of truth.** The bundles are exports of
them, and `review.html` is a third view of the same content — all three need regenerating after an
artboard changes.
