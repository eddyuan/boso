# Tielo — design guidelines

**Last updated: 2026-09-19**

Five artboards: colour tokens, the spacing scale, components, layout patterns, and the mascot.
**Nothing in this folder depends on a language.**

```sh
open design/app-ui/review.html
```

| Artboard | What it holds |
|---|---|
| `DesignSystem` | Colour tokens, light and dark |
| `Layout` | The 4px spacing scale and what each step is for |
| `Components` | Every class in the kit, in the states it ships in |
| `Patterns` | The five shapes every screen takes, drawn as blocks |
| `MascotEmotions` | Twelve moods and where each is used |

## Why the screen mock-ups are gone

This folder used to hold 67 artboards — a drawing of nearly every screen, with its real copy baked in.
That was useful while the product was being designed and became a liability once it shipped:

- **Two sources of copy.** Once strings live in a translation catalogue
  (`packages/shared/src/i18n`), a screen drawn with English sentences in it is a second, competing
  answer to "what does this say" — and the one nobody updates.
- **It stops being true the moment a second language ships.** A layout sized to fit English text is
  wrong in German, and a mock-up can't express that it has to stretch.
- **It went stale constantly.** A large share of the design work in this repo's history has been
  re-drawing artboards to match code that had moved on. That cost is now gone.

The screens remain in git history if a specific composition is ever wanted again — this is a reduction,
not a loss.

## What replaced them

`Patterns` draws the five structures (list, detail, sheet over context, map with overlays,
single-purpose form) as **grey blocks rather than sentences**, so the structure is the subject. It also
states the rules that only start to matter once text is translated: rows grow rather than truncate,
buttons size to content, and **no sentence is ever built by concatenating fragments** — word order
differs by language, so a whole sentence gets a whole key.

`Components` shows each class in its real states, labelled with single words, so it can't drift back into
being about copy.

## Working in here

Each `*.dc.html` is self-contained: a `<helmet>` with the shared tokens and component classes, then a
`.screen` (390px phone frame) or `.sheet` (wide reference sheet). Start a new one by copying an existing
file's `<helmet>` verbatim rather than re-deriving it. `canvas.json` places them.

`support.js` is a small local shim — the canvas editor's own script was never committed, and without it
`<x-dc>` and `<helmet>` fall back to unknown inline elements and the layout comes out subtly wrong.

Three views of the same source, all generated: `review.html` (one page) and the two `*-app-ui.html`
canvas bundles. **Regenerate all three after changing an artboard** or they go stale — which has happened
more than once. Each bundle carries a `<script type="application/json" id="appifact-doc">` payload with a
filename → contents map; refresh it by replacing that map from disk, never by editing the inlined copies.
Two details matter: `<` must be written `<` throughout (a literal one lets an artboard terminate its
own `<script>`), and serialise with `ensure_ascii=False` to match the originals.

> `bsocial-app-ui.html` and `tielo-app-ui.html` now carry identical content. The second is a leftover from
> before the rename and is a deletion candidate — kept only because removing a published artifact is your
> call, not mine.
