import {
  DEFAULT_LOCALE,
  formatDay as formatDayShared,
  formatDistance as formatDistanceShared,
  formatTimeAgo as formatTimeAgoShared,
  measurementFor,
  resolveLocale,
  translatorFor,
  type Locale,
  type MeasurementSystem,
  type Phrase,
  type PluralKey,
  type TVars,
  type TranslationKey,
} from '@bsocial/shared';
import { getLocales } from 'expo-localization';
import { Fragment, createContext, useContext, useMemo, type ReactNode } from 'react';

import { authClient } from '@/lib/auth-client';

/**
 * Language and formatting for the whole app, in one place.
 *
 * Two separate questions, deliberately not conflated:
 *
 *   **Which language do the words come in?** The person's choice if they made one
 *   (stored on their account, so it follows them to a new phone), otherwise the
 *   device's. Stored as `null` rather than `"en"` when they haven't chosen, so
 *   somebody who never opens the picker keeps tracking their phone — including
 *   when we later add their language.
 *
 *   **Which region's conventions do numbers, dates and distances follow?** Always
 *   the device's. These are properties of where you are, not of what you read: a
 *   Japanese speaker in Texas wants Japanese words and miles. So the tag handed to
 *   `Intl` is the chosen language pinned to the *device's* region — `ja-US`, not
 *   `ja-JP` — which is exactly what makes that come out right.
 */

type I18n = {
  locale: Locale;
  /** Whether the person has chosen, as opposed to inheriting the device's. */
  chosen: boolean;
  /** The full BCP-47 tag for `Intl`: chosen language + device region. */
  tag: string;
  measurement: MeasurementSystem;
  t: (key: TranslationKey, vars?: TVars) => string;
  /** Count-aware; picks the plural form and exposes `{count}`. */
  n: (key: PluralKey, count: number, vars?: TVars) => string;
  /**
   * Renders a phrase the server chose — a mood reason, for instance. The server
   * decides *which* sentence applies; this decides what it says.
   */
  p: (phrase: Phrase) => string;
  /**
   * A translated sentence with React nodes interpolated into it — a link, a bold
   * word. The alternative is splicing the sentence around the node in JSX, which
   * bakes English word order into the layout: the legal line's two links and the
   * list of possible companions both read backwards in a language that puts them
   * somewhere else. This keeps the whole sentence, and its order, in the
   * catalogue.
   */
  rich: (key: TranslationKey, parts: Record<string, ReactNode>) => ReactNode;
  /** A bare number, grouped the way the region groups them. */
  num: (value: number) => string;
  /** "320 m" or "1,050 ft", in the device's units. */
  distance: (metres: number) => string;
  /** "now", "12 min ago", "5 days ago". */
  timeAgo: (iso: string | Date) => string;
  /** "Today", "Yesterday", "Tuesday", "3 March". */
  day: (day: string | Date) => string;
};

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { data: session } = authClient.useSession();
  // `locale` is declared on the session (see auth.ts additionalFields) precisely
  // so the first screen renders in the right language instead of switching.
  const stored = (session?.user as { locale?: string | null } | undefined)?.locale ?? null;

  const value = useMemo<I18n>(() => {
    const device = getLocales()[0];
    const locale = resolveLocale(stored ?? device?.languageCode ?? DEFAULT_LOCALE);
    // Region from the device, language from the choice — see the note above.
    const region = device?.regionCode;
    const tag = region ? `${locale}-${region}` : locale;
    const measurement = measurementFor(tag);
    const { t, n, p } = translatorFor(locale);

    return {
      locale,
      chosen: !!stored,
      tag,
      measurement,
      t,
      n,
      p,
      rich: (key, parts) => interpolateNodes(t(key), parts),
      num: (value) => new Intl.NumberFormat(tag).format(value),
      distance: (metres) => formatDistanceShared(metres, tag, measurement),
      timeAgo: (iso) => formatTimeAgoShared(iso, tag),
      day: (day) => formatDayShared(day, locale, tag),
    };
  }, [stored]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Splits a translated string on its `{placeholders}` and swaps in nodes.
 *
 * A placeholder with no node given is left as literal text, which makes a typo
 * visible on screen rather than silently dropping a word.
 */
function interpolateNodes(text: string, parts: Record<string, ReactNode>): ReactNode {
  return text.split(/(\{\w+\})/g).map((piece, i) => {
    const name = /^\{(\w+)\}$/.exec(piece)?.[1];
    const node = name ? parts[name] : undefined;
    return <Fragment key={i}>{node ?? piece}</Fragment>;
  });
}

/**
 * Throws when used outside the provider rather than falling back to English.
 * A silent fallback here would be a screen that is quietly the wrong language
 * forever, which is the hardest version of this bug to notice.
 */
export function useT(): I18n {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useT must be used inside <I18nProvider>');
  return value;
}
