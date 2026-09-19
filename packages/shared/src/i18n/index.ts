import { en, type TranslationKey } from "./en";
import { zhHans } from "./zh-Hans";
import { zhHant } from "./zh-Hant";

export { en, zhHans, zhHant };
export * from "./content";
export type { TranslationKey };

/**
 * Translation, shared by both apps and the server.
 *
 * One catalogue in one place, because push notifications are built on the server
 * and screens are built on the device — two catalogues would drift, and the one
 * that drifts is always the one you can't see.
 *
 * English is the source. `zh-Hans.ts` and `zh-Hant.ts` are each typed as a
 * *complete* record of `en`'s keys, so adding an English string without translating
 * it stops the build rather than quietly shipping English into a Chinese screen.
 * A third locale is a file and one `LOCALES` line — no resolver change.
 */

/**
 * `label` is the English name, for AI prompts — a model steers most reliably on
 * "Write in Simplified Chinese". `endonym` is the name in the language itself,
 * which is what goes in the picker: somebody scanning for their own language is
 * looking for the word they'd recognise, not our word for it.
 */
export const LOCALES = [
  { code: "en", label: "English", endonym: "English" },
  { code: "zh-Hans", label: "Simplified Chinese", endonym: "简体中文" },
  { code: "zh-Hant", label: "Traditional Chinese", endonym: "繁體中文" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";

/** Catalogues keyed by locale. New locales are checked against `en`'s keys. */
const CATALOGUES: Record<Locale, Partial<Record<TranslationKey, string>>> = { en, "zh-Hans": zhHans, "zh-Hant": zhHant };

/**
 * Splits a BCP-47 tag into the parts we care about.
 *
 * Positional indexing doesn't work here: the region is the second subtag in
 * `en-GB` but the third in `zh-Hans-CN`, and reading `[1]` on the latter yields
 * "hans". So each subtag is identified by its shape — a script is four letters, a
 * region is two letters or three digits.
 */
function parseTag(input: string): { language: string; script?: string; region?: string } {
  const [language = "", ...rest] = input.toLowerCase().split(/[-_]/);
  let script: string | undefined;
  let region: string | undefined;
  for (const part of rest) {
    if (!script && /^[a-z]{4}$/.test(part)) script = part;
    else if (!region && /^([a-z]{2}|\d{3})$/.test(part)) region = part;
  }
  return { language, script, region };
}

/**
 * Regions that imply a Chinese script when the tag doesn't name one.
 *
 * `zh-TW` carries no script subtag but unambiguously means Traditional, and a
 * device set to Taiwan is the common way this arrives — far more common than the
 * explicit `zh-Hant`. Without this, Taiwan and Hong Kong would land on Simplified
 * for the wrong reason: not "we have no Traditional catalogue" but "we didn't
 * look".
 */
const TRADITIONAL_REGIONS = new Set(["tw", "hk", "mo"]);

/**
 * What we'd serve if we had every catalogue, for a language where script matters.
 *
 * Separate from what we *do* have, so adding `zh-Hant.ts` is a line in `LOCALES`
 * and nothing else: `zh-TW` already resolves through here and would start landing
 * on it.
 */
function preferredTag({ language, script, region }: ReturnType<typeof parseTag>): string {
  if (language !== "zh") return language;
  if (script === "hant" || script === "hans") return `zh-${script}`;
  return region && TRADITIONAL_REGIONS.has(region) ? "zh-hant" : "zh-hans";
}

/**
 * When we don't have the preferred catalogue, the next best one — not English.
 *
 * Both Chinese catalogues exist now, so nothing currently routes through this. It
 * stays because the shape is the point: a reader of one script is far better served
 * by the other than by a language they may not read at all, and that should be a
 * stated fallback rather than something that falls out of a truncated tag.
 */
const NEXT_BEST: Record<string, string> = { "zh-hant": "zh-hans", "zh-hans": "zh-hant" };

/**
 * Narrows anything — a device tag like `en-GB` or `zh-Hant-TW`, a stored column,
 * `undefined` — to a locale we actually have.
 *
 * Region is dropped, because `en-GB` and `en-US` differ in units and dates rather
 * than in wording, and `Intl` handles that from the full tag. **Script is kept**,
 * because it is wording: `zh-Hans` and `zh-Hant` are different writing systems,
 * not different spellings, and collapsing them to a bare `zh` made the distinction
 * unrepresentable.
 */
export function resolveLocale(input: string | null | undefined): Locale {
  if (!input) return DEFAULT_LOCALE;
  const parsed = parseTag(input);
  const wanted = preferredTag(parsed);
  for (const candidate of [wanted, NEXT_BEST[wanted], parsed.language]) {
    if (!candidate) continue;
    const found = LOCALES.find((l) => l.code.toLowerCase() === candidate);
    if (found) return found.code;
  }
  return DEFAULT_LOCALE;
}

export type TVars = Record<string, string | number>;

/**
 * The base of a plural family — `map.postsAround`, given `map.postsAround_one`
 * and `map.postsAround_other` in the catalogue.
 *
 * Derived from the catalogue rather than declared, so `n()` accepts exactly the
 * keys that actually have plural forms. Passing a key with no `_other` variant is
 * then a compile error instead of a string that silently renders as its own key.
 */
export type PluralKey = TranslationKey extends unknown
  ? Extract<TranslationKey, `${string}_other`> extends `${infer Base}_other`
    ? Base
    : never
  : never;

/**
 * Looks up a key and fills its placeholders.
 *
 * Falls back to English rather than to the key itself: a partially translated
 * locale should read as mixed language, not as `pet.circle`. A key that exists in
 * no catalogue returns the key, which is loud enough to catch in review.
 */
export function translate(
  locale: Locale,
  key: TranslationKey | PluralKey,
  vars?: TVars,
  count?: number,
): string {
  const resolved = count === undefined ? (key as TranslationKey) : pluralKey(locale, key, count);
  const table = CATALOGUES[locale] ?? {};
  const raw = table[resolved] ?? en[resolved] ?? key;
  return interpolate(locale, raw, count === undefined ? vars : { count, ...vars });
}

/**
 * Picks the `_one` / `_other` variant through `Intl.PluralRules`.
 *
 * Not a hand-rolled `n === 1`: English has two forms, Polish three and Arabic six,
 * and the shortcut mistranslates every language that isn't English without ever
 * looking broken in development.
 */
function pluralKey(locale: Locale, key: TranslationKey | PluralKey, count: number): TranslationKey {
  const category = new Intl.PluralRules(locale).select(count);
  const candidate = `${key}_${category}` as TranslationKey;
  if (candidate in en) return candidate;
  const other = `${key}_other` as TranslationKey;
  // Falling back to the bare key covers the case where a caller passed a plain
  // key with a count; it renders the singular wording rather than nothing.
  return other in en ? other : (key as TranslationKey);
}

/**
 * Fills `{placeholders}`, and runs numbers through `Intl.NumberFormat`.
 *
 * Numbers get grouped the way the locale groups them — `13,460` against `13.460`
 * — which matters here because the counts on screen get into the thousands. Done
 * centrally rather than at the call sites, since `{count}` reaches every plural
 * in the catalogue and formatting it at each one would be forgotten somewhere.
 *
 * An unfilled placeholder is left as-is rather than blanked: `{name} is waiting`
 * shows the bug, an empty string hides it.
 */
function interpolate(locale: Locale, text: string, vars?: TVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => {
    if (!(name in vars)) return whole;
    const value = vars[name];
    return typeof value === "number" ? new Intl.NumberFormat(locale).format(value) : String(value);
  });
}

/**
 * A sentence the server chose but the client words.
 *
 * Some sentences can only be *decided* where the data is — which of seven mood
 * reasons applies depends on signals the client never sees — but must be
 * *written* where the reader is. Passing a key and its values instead of a
 * finished sentence is what lets both be true at once. Before this existed, the
 * server sent English prose and the client had no way to translate it.
 */
export type Phrase = {
  key: TranslationKey | PluralKey;
  /** Set for a plural family; `key` is then the family base. */
  count?: number;
  vars?: TVars;
};

export function translatePhrase(locale: Locale, phrase: Phrase): string {
  return translate(locale, phrase.key, phrase.vars, phrase.count);
}

/** A bound translator, so screens don't thread the locale through every call. */
export type Translator = {
  locale: Locale;
  t: (key: TranslationKey, vars?: TVars) => string;
  /** Count-aware: resolves the plural category and exposes `{count}`. */
  n: (key: PluralKey, count: number, vars?: TVars) => string;
  /** Renders a `Phrase` — a sentence chosen server-side. */
  p: (phrase: Phrase) => string;
};

export function translatorFor(locale: Locale): Translator {
  return {
    locale,
    t: (key, vars) => translate(locale, key, vars),
    n: (key, count, vars) => translate(locale, key, vars, count),
    p: (phrase) => translatePhrase(locale, phrase),
  };
}

// ---------------------------------------------------------------------------
// Formatting
//
// Not translation, and more likely to be got wrong.
// ---------------------------------------------------------------------------

/**
 * "40 m", "320 m", "1.2 km".
 *
 * **Always metric, always the Latin symbol.** `m` and `km` are what apps show
 * worldwide, and they're read as distance even by someone who can't read a word of
 * the surrounding sentence — which `公里`, `公尺` and `呎` are not. This used to run
 * each value through `Intl.NumberFormat`'s `style: "unit"`, which localises the
 * unit *name* along with the number and so produced `2.4 公里` on a Chinese screen
 * and `140 呎` for a Chinese reader on an American phone. Both were wrong for the
 * same reason: a unit symbol is notation, not vocabulary.
 *
 * The *number* is still formatted per locale, because the decimal separator is
 * genuinely local — a German reader expects `1,2 km`. Only the symbol is fixed.
 *
 * Rounded coarsely on purpose: the precision would be false, and a jittering
 * number is distracting.
 */
export function formatDistance(metres: number, tag = "en"): string {
  const fmt = (value: number, unit: "m" | "km", digits = 0) =>
    `${new Intl.NumberFormat(tag, {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(value)} ${unit}`;

  if (metres < 100) return fmt(Math.max(1, Math.round(metres / 5) * 5), "m");
  // Rounded first, so 999 m reads as "1.0 km" rather than "1000 m".
  const rounded = Math.round(metres / 10) * 10;
  return rounded < 1000 ? fmt(rounded, "m") : fmt(metres / 1000, "km", 1);
}

/**
 * "now", "12 min ago", "3 hr ago", "5 days ago" — via `Intl.RelativeTimeFormat`,
 * so it's the locale's own phrasing rather than a translated template.
 */
export function formatTimeAgo(iso: string | Date, tag = "en"): string {
  const then = typeof iso === "string" ? new Date(iso) : iso;
  const seconds = Math.max(0, (Date.now() - then.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(tag, { numeric: "auto", style: "narrow" });
  // Tested in seconds, not rounded minutes: rounding first turned 30 seconds into
  // "1m ago" when it should read as just now.
  if (seconds < 45) return rtf.format(0, "second");
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, "minute");
  if (minutes < 1440) return rtf.format(-Math.round(minutes / 60), "hour");
  return rtf.format(-Math.round(minutes / 1440), "day");
}

/** "Today", "Yesterday", then the locale's own day name or date. */
export function formatDay(day: string | Date, locale: Locale, tag = "en"): string {
  const date = typeof day === "string" ? new Date(`${day}T12:00:00Z`) : day;
  const days = Math.round((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return translate(locale, "common.today");
  if (days === 1) return translate(locale, "common.yesterday");
  if (days < 7) return new Intl.DateTimeFormat(tag, { weekday: "long" }).format(date);
  return new Intl.DateTimeFormat(tag, { month: "long", day: "numeric" }).format(date);
}

/** The language name to put in an AI prompt, so the pet writes in it. */
export function languageNameFor(locale: Locale): string {
  return LOCALES.find((l) => l.code === locale)?.label ?? "English";
}
