import { and, desc, eq, gt, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db, notifications, petActions, pets, users } from "@bsocial/db";
import { PET_OWNER_INACTIVE_DAYS } from "@bsocial/shared";
import { inngest } from "./client";
import { sendPush } from "../lib/push";
import { isPetsPaused } from "../lib/settings";
import { tracked } from "@/lib/jobs";

/**
 * The one message that reaches someone who has stopped opening the app.
 *
 * Deliberately narrow: it only goes to people whose pet has actually done
 * something since they left, and it says what that was. A generic "we miss
 * you!" is the fastest way to lose notification permission for good, and this
 * channel doesn't grow back once someone turns it off.
 */

/** Long enough to be a real absence, short enough to still be recoverable. */
const AWAY_DAYS = 3;
/** Past this the pet stops acting anyway, so there's nothing new to report. */
const GIVE_UP_DAYS = PET_OWNER_INACTIVE_DAYS;
/** Don't nudge the same person more often than this, whatever the caps allow. */
const MIN_GAP_DAYS = 5;

export const comebackNudges = inngest.createFunction(
  { id: "comeback-nudges" },
  // Late morning UTC — the per-user quiet-hours check in lib/push.ts is what
  // actually protects anyone whose morning this isn't.
  // Also runnable on demand from /admin/jobs, which is how a missed
  // nightly gets caught up without waiting for tomorrow.
  [{ cron: "0 17 * * *" }, { event: "admin/run.comeback-nudges" }],
  async ({step}) =>
    tracked("comeback-nudges", async () => {
    if (await step.run("check-paused", () => isPetsPaused())) return { sent: 0, paused: true };

    const now = Date.now();
    const awaySince = new Date(now - AWAY_DAYS * 86_400_000);
    const giveUpBefore = new Date(now - GIVE_UP_DAYS * 86_400_000);
    const lastNudgeCutoff = new Date(now - MIN_GAP_DAYS * 86_400_000);

    const candidates = await step.run("find-quiet-owners", () =>
      db
        .select({ userId: users.id, petId: pets.id, petName: pets.name, lastActiveAt: users.lastActiveAt })
        .from(users)
        .innerJoin(pets, eq(pets.userId, users.id))
        .where(
          and(
            eq(users.isMock, false),
            isNotNull(users.onboardingCompletedAt),
            isNull(users.ageGateFailedAt),
            lt(users.lastActiveAt, awaySince),
            // Beyond this the pet has gone quiet too, so there's no news.
            gt(users.lastActiveAt, giveUpBefore),
            sql`not exists (
              select 1 from ${notifications}
              where ${notifications.userId} = ${users.id}
                and ${notifications.type} = 'quiet_return'
                and ${notifications.createdAt} > ${lastNudgeCutoff}
            )`,
          ),
        ),
    );

    let sent = 0;
    for (const candidate of candidates) {
      // Step output is JSON, so timestamps arrive as strings.
      const lastActive = candidate.lastActiveAt ? new Date(candidate.lastActiveAt) : awaySince;
      // Only worth a message if there's something to actually report.
      const [latest] = await db
        .select({ reasoning: petActions.reasoning, type: petActions.type })
        .from(petActions)
        .where(
          and(
            eq(petActions.petId, candidate.petId),
            gt(petActions.createdAt, lastActive),
            sql`${petActions.type} <> 'none'`,
          ),
        )
        .orderBy(desc(petActions.createdAt))
        .limit(1);
      if (!latest) continue;

      const result = await sendPush(candidate.userId, {
        type: "quiet_return",
        title: `${candidate.petName} has been busy`,
        body: latest.reasoning || `${candidate.petName} got up to something while you were away.`,
        data: { screen: "activity" },
      });
      if (result.sent) sent += 1;
    }

    return { considered: candidates.length, sent };
  }),
);
