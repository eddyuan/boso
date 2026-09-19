import { eq } from "drizzle-orm";
import { db, users } from "@bsocial/db";
import {
  DEFAULT_LOCALE,
  languageNameFor,
  resolveLocale,
  translatorFor,
  type Locale,
  type Translator,
} from "@bsocial/shared";

/**
 * Which language to write to somebody in, server-side.
 *
 * The server composes things the device never sees — push notifications, diary
 * entries, the pet's own posts — so it can't read the phone's locale. It reads the
 * stored column, and falls back rather than failing: a missing locale should send
 * an English notification, not no notification.
 */
export async function localeFor(userId: string): Promise<Locale> {
  try {
    const [row] = await db.select({ locale: users.locale }).from(users).where(eq(users.id, userId));
    return resolveLocale(row?.locale);
  } catch (error) {
    console.error("[locale] could not read a locale, falling back:", error);
    return DEFAULT_LOCALE;
  }
}

/** A bound translator for one person. */
export async function translatorForUser(userId: string): Promise<Translator> {
  return translatorFor(await localeFor(userId));
}

/**
 * The line that puts a model in the right language.
 *
 * Said outright rather than implied: nothing steers a model's output language as
 * reliably as naming the language, and every one of our prompts embeds other
 * people's posts, which is exactly what makes a model drift into *their*
 * language. Stated even for English for that reason — it is a guard, not a
 * translation.
 */
export function languageInstruction(locale: Locale): string {
  return `Write in ${languageNameFor(locale)}.`;
}

/**
 * For replies, where the language of the thing being answered outranks the
 * owner's setting: being answered in your own language is the point of a reply,
 * and the owner's locale is only the tie-break when the post gives no signal.
 */
export function replyLanguageInstruction(locale: Locale): string {
  return `Reply in the same language the post is written in. If that is unclear, write in ${languageNameFor(locale)}.`;
}
