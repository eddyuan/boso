import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { db, notifications, pushTokens, users } from "@bsocial/db";

/**
 * Sending a push, and — more importantly — deciding not to.
 *
 * Every message here is triggered by something a pet actually did, and links to
 * the decision that caused it. The restraint rules are the point: this is the
 * only channel that reaches someone who has closed the app, and it's the
 * easiest one to burn permanently.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type NotificationType = "pet_ask" | "pet_friend" | "pet_reply" | "quiet_return";

/**
 * At most this many of each type per rolling day. A pet that asks fourteen
 * questions in an afternoon should ask on-screen, not in the notification tray.
 */
const DAILY_CAP: Record<NotificationType, number> = {
  pet_ask: 3,
  pet_friend: 2,
  pet_reply: 3,
  quiet_return: 1,
};

/** Across all types, so several well-behaved categories can't gang up. */
const DAILY_CAP_TOTAL = 5;

/** Local hours we never send in. */
const QUIET_FROM = 22;
const QUIET_UNTIL = 8;

export type PushMessage = {
  type: NotificationType;
  title: string;
  body: string;
  /** Routed by the app; include what it needs to open the right screen. */
  data?: Record<string, unknown>;
};

/**
 * Rough local hour from longitude (15° per hour).
 *
 * We don't store a timezone — the apps never send one — and this is accurate to
 * about an hour, which is all "don't buzz at 3am" actually needs. It errs
 * toward silence at the edges rather than guessing wrong in the loud direction.
 */
function localHour(now: Date, longitude: number | null): number | null {
  if (longitude === null) return null;
  const offsetHours = Math.round(longitude / 15);
  return (((now.getUTCHours() + offsetHours) % 24) + 24) % 24;
}

export function isQuietHour(hour: number | null): boolean {
  // Unknown location: send anyway. Staying silent would mean anyone who never
  // granted location hears from their pet exactly never, which is a worse
  // failure than the occasional badly-timed buzz. The daily caps still apply.
  if (hour === null) return false;
  return hour >= QUIET_FROM || hour < QUIET_UNTIL;
}

/**
 * Sends a push if the rules allow it. Returns why not, so callers (and tests)
 * can see the decision rather than a silent no-op.
 */
export async function sendPush(
  userId: string,
  message: PushMessage,
  now: Date = new Date(),
): Promise<{ sent: boolean; reason?: string }> {
  const [user] = await db
    .select({ longitude: users.lastLongitude })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return { sent: false, reason: "no_user" };

  if (isQuietHour(localHour(now, user.longitude))) return { sent: false, reason: "quiet_hours" };

  const since = new Date(now.getTime() - 24 * 3600 * 1000);
  const recent = await db
    .select({ type: notifications.type, count: sql<number>`count(*)`.mapWith(Number) })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), gt(notifications.createdAt, since)))
    .groupBy(notifications.type);

  const total = recent.reduce((n, r) => n + r.count, 0);
  if (total >= DAILY_CAP_TOTAL) return { sent: false, reason: "daily_total_cap" };

  const ofType = recent.find((r) => r.type === message.type)?.count ?? 0;
  if (ofType >= DAILY_CAP[message.type]) return { sent: false, reason: "type_cap" };

  const tokens = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(eq(pushTokens.userId, userId));
  if (tokens.length === 0) return { sent: false, reason: "no_tokens" };

  const delivered = await deliver(
    tokens.map((t) => t.token),
    message,
  );
  if (!delivered) return { sent: false, reason: "delivery_failed" };

  // Logged after delivery so a failed send doesn't consume someone's budget.
  await db.insert(notifications).values({
    userId,
    type: message.type,
    title: message.title,
    body: message.body,
    data: message.data ?? null,
  });

  return { sent: true };
}

/** Posts to Expo and prunes tokens it tells us are dead. */
async function deliver(tokens: string[], message: PushMessage): Promise<boolean> {
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          title: message.title,
          body: message.body,
          data: message.data ?? {},
          sound: "default",
        })),
      ),
    });
    if (!res.ok) {
      console.error("[push] expo rejected the batch:", res.status, await res.text());
      return false;
    }

    const payload = (await res.json()) as { data?: { status: string; details?: { error?: string } }[] };
    const dead = (payload.data ?? [])
      .map((ticket, i) => (ticket.details?.error === "DeviceNotRegistered" ? tokens[i]! : null))
      .filter((t): t is string => t !== null);

    // An uninstalled app keeps its token forever otherwise, and every future
    // send wastes a request on it.
    if (dead.length > 0) await db.delete(pushTokens).where(inArray(pushTokens.token, dead));

    return true;
  } catch (error) {
    console.error("[push] delivery failed:", error);
    return false;
  }
}
