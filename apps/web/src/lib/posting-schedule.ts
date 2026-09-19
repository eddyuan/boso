/**
 * Deciding whether a seeded persona is due to post.
 *
 * A persona carries `{ frequency, times: ["09:00", …], timezone }`. The poster
 * runs hourly, so "due" means: one of its times falls inside the hour that just
 * ended, *in its own timezone*, and it hasn't already posted since that time
 * came round.
 *
 * Pure on purpose — the timezone arithmetic is the part most likely to be
 * subtly wrong, and this way it can be tested without a database or a cron.
 */

export type PostingSchedule = {
  frequency: "daily" | "weekly" | "custom";
  times: string[];
  timezone: string;
};

export function parseSchedule(value: unknown): PostingSchedule | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<PostingSchedule>;
  if (!Array.isArray(v.times) || v.times.length === 0) return null;
  const frequency = v.frequency === "weekly" || v.frequency === "custom" ? v.frequency : "daily";
  return { frequency, times: v.times, timezone: v.timezone || "UTC" };
}

/** Wall-clock parts in a given zone, without pulling in a date library. */
export function zonedParts(at: Date, timeZone: string): { hour: number; minute: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(at).map((p) => [p.type, p.value]));
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return {
    // "24" is midnight in some locales' 2-digit hour formatting.
    hour: Number(parts.hour) % 24,
    minute: Number(parts.minute),
    weekday: Math.max(0, weekdays.indexOf(String(parts.weekday))),
  };
}

const toMinutes = (hhmm: string): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
};

/**
 * The scheduled slot this persona is due for right now, as minutes-from-midnight
 * in its own zone, or null when it isn't due.
 *
 * A slot counts as due when it falls within the hour that just ended, so an
 * hourly cron can't miss one by drifting a few seconds.
 */
export function dueSlot(schedule: PostingSchedule, now: Date): number | null {
  const { hour, minute, weekday } = zonedParts(now, schedule.timezone);

  // Weekly personas only post on the same weekday their schedule started, which
  // we approximate as Saturday — enough to keep them quieter than daily ones.
  if (schedule.frequency === "weekly" && weekday !== 6) return null;

  const nowMinutes = hour * 60 + minute;
  for (const time of schedule.times) {
    const slot = toMinutes(time);
    if (slot === null) continue;
    // Within the hour that just ended: [now - 60, now].
    if (slot <= nowMinutes && nowMinutes - slot < 60) return slot;
  }
  return null;
}

/**
 * True when the persona has already covered this slot. Compared against its own
 * timezone so a post at 09:05 satisfies the 09:00 slot but not tomorrow's.
 */
export function alreadyPosted(lastPostAt: Date | null, slot: number, schedule: PostingSchedule, now: Date): boolean {
  if (!lastPostAt) return false;
  const last = zonedParts(lastPostAt, schedule.timezone);
  const current = zonedParts(now, schedule.timezone);
  const lastMinutes = last.hour * 60 + last.minute;

  // Different day in that zone? Then it can't have covered today's slot.
  const sameDay = now.getTime() - lastPostAt.getTime() < 24 * 3600 * 1000 && last.weekday === current.weekday;
  if (!sameDay) return false;

  return lastMinutes >= slot;
}
