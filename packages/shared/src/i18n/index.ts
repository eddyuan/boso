import { en, type TranslationKey } from "./en";

export { en };
export type { TranslationKey };

/**
 * Translation, shared by both apps and the server.
 *
 * One catalogue in one place, because push notifications are built on the server
 * and screens are built on the device — two catalogues would drift, and the one
 * that drifts is always the one you can't see.
 *
 * English is the only locale so far. That's deliberate: the plumbing is worth
 * proving before any translation exists, and a second locale is then a file rather
 * than a refactor.
 */

export const LOCALES = [
  { code: "en", label: "English", endonym: "English" },
] as const;

export type Locale = (typeof LOCALES)[number]["code"];

export const DEFAULT_LOCALE: Locale = "en";

/** Catalogues keyed by locale. New locales are checked against `en`'s keys. */
const CATALOGUES: Record<Locale, Partial<Record<TranslationKey, string>>> = { en };

/**
 * Narrows anything — a device tag like `en-GB`, a stored column, `undefined` — to
 * a locale we actually have. Region is dropped: `en-GB` and `en-US` differ in
 * units and dates, which `Intl` handles from the full tag, not in wording.
 */
export function resolveLocale(input: string | null | undefined): Locale {
  if (!input) return DEFAULT_LOCALE;
  const base = input.toLowerCase().split(/[-_]/)[0];
  return (LOCALES.find((l) => l.code === base)?.code ?? DEFAULT_LOCALE) as Locale;
}

export type TVars = Record<string, string | number>;

/**
 * Looks up a key and fills its placeholders.
 *
 * Falls back to English rather than to the key itself: a partially translated
 * locale should read as mixed language, not as `pet.circle`. A key that exists in
 * no catalogue returns the key, which is loud enough to catch in review.
 */
export function translate(locale: Locale, key: TranslationKey, vars?: TVars, count?: number): string {
  const resolved = count === undefined ? key : pluralKey(locale, key, count);
  const table = CATALOGUES[locale] ?? {};
  const raw = table[resolved] ?? en[resolved] ?? table[key] ?? en[key] ?? key;
  return interpolate(raw, count === undefined ? vars : { count, ...vars });
}

/**
 * Picks the `_one` / `_other` variant through `Intl.PluralRules`.
 *
 * Not a hand-rolled `n === 1`: English has two forms, Polish three and Arabic six,
 * and the shortcut mistranslates every language that isn't English without ever
 * looking broken in development.
 */
function pluralKey(locale: Locale, key: TranslationKey, count: number): TranslationKey {
  const category = new Intl.PluralRules(locale).select(count);
  const candidate = `${key}_${category}` as TranslationKey;
  if (candidate in en) return candidate;
  const other = `${key}_other` as TranslationKey;
  return other in en ? other : key;
}

function interpolate(text: string, vars?: TVars): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/** A bound translator, so screens don't thread the locale through every call. */
export type Translator = {
  locale: Locale;
  t: (key: TranslationKey, vars?: TVars) => string;
  /** Count-aware: resolves the plural category and exposes `{count}`. */
  n: (key: TranslationKey, count: number, vars?: TVars) => string;
};

export function translatorFor(locale: Locale): Translator {
  return {
    locale,
    t: (key, vars) => translate(locale, key, vars),
    n: (key, count, vars) => translate(locale, key, vars, count),
  };
}

// ---------------------------------------------------------------------------
// Formatting
//
// Not translation, and more likely to be got wrong: a US reader wants miles, and
// no amount of translated text fixes a screen that says "320 m".
// ---------------------------------------------------------------------------

/**
 * Places that read distance in miles.
 *
 * A short list rather than a library: `Intl` exposes no measurement system, and
 * these are the ones that matter. Everywhere else is metric.
 */
const IMPERIAL_REGIONS = new Set(["US", "GB", "LR", "MM"]);

export type MeasurementSystem = "metric" | "imperial";

/** Derived from the *full* tag, since `en-US` and `en-GB` differ from `en-DE`. */
export function measurementFor(tag: string | null | undefined): MeasurementSystem {
  const region = tag?.toUpperCase().split(/[-_]/)[1];
  return region && IMPERIAL_REGIONS.has(region) ? "imperial" : "metric";
}

const METRES_PER_MILE = 1609.344;
const METRES_PER_FOOT = 0.3048;
/**
 * Where imperial switches from feet to miles — about 460 m.
 *
 * Higher than the usual 1000 ft on purpose. This is a local app where the
 * difference between 180 m and 320 m is the whole point, and "0.2 mi" throws that
 * away; "1,050 ft" keeps it. Miles only take over once the number stops being
 * walking distance.
 */
const FEET_TO_MILES_AT = 1500;

/**
 * "320 m", "1.2 km", "350 ft", "0.8 mi".
 *
 * Rounded coarsely on purpose: the precision would be false, and a jittering
 * number is distracting. The unit comes from `Intl.NumberFormat`, so it's
 * abbreviated the way each locale abbreviates it.
 */
export function formatDistance(metres: number, tag = "en", system?: MeasurementSystem): string {
  const unitSystem = system ?? measurementFor(tag);
  const fmt = (value: number, unit: string, digits = 0) =>
    new Intl.NumberFormat(tag, {
      style: "unit",
      unit,
      unitDisplay: "short",
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(value);

  if (unitSystem === "imperial") {
    const feet = metres / METRES_PER_FOOT;
    if (feet < FEET_TO_MILES_AT) {
      // Coarser as it grows, so the number stops jittering at a walk.
      const step = feet < 200 ? 10 : 50;
      return fmt(Math.max(5, Math.round(feet / step) * step), "foot");
    }
    return fmt(metres / METRES_PER_MILE, "mile", 1);
  }
  if (metres < 100) return fmt(Math.max(1, Math.round(metres / 5) * 5), "meter");
  const rounded = Math.round(metres / 10) * 10;
  return rounded < 1000 ? fmt(rounded, "meter") : fmt(metres / 1000, "kilometer", 1);
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
