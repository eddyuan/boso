import { NextResponse } from "next/server";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import {
  accounts,
  authEvents,
  bondEvents,
  db,
  notifications,
  petActions,
  petCare,
  petTreasures,
  pets,
  posts,
  pushTokens,
  sessions,
  users,
} from "@bsocial/db";
import { TREASURE_BY_ID, progressFor } from "@bsocial/shared";
import { getConfig } from "@/lib/config";
import { mediaByPostId } from "@/lib/post-media";
import { petState } from "@/lib/pet-mood";
import { relationshipsFor } from "@/lib/relationships";
import { requireSession } from "@/lib/session";

const RECENT_LIMIT = 20;

/** Everything about one account on a single screen, for investigating a report. */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const { userId } = await params;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      emailVerified: users.emailVerified,
      phoneNumber: users.phoneNumber,
      phoneNumberVerified: users.phoneNumberVerified,
      username: users.username,
      image: users.image,
      isAdmin: users.isAdmin,
      isMock: users.isMock,
      gender: users.gender,
      birthday: users.birthday,
      interests: users.interests,
      ageGateFailedAt: users.ageGateFailedAt,
      onboardingCompletedAt: users.onboardingCompletedAt,
      createdAt: users.createdAt,
      lastActiveAt: users.lastActiveAt,
      lastLatitude: users.lastLatitude,
      lastLongitude: users.lastLongitude,
      lastLocationAt: users.lastLocationAt,
      showSensitiveContent: users.showSensitiveContent,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const [pet] = await db
    .select({
      id: pets.id,
      name: pets.name,
      species: pets.species,
      traits: pets.traits,
      personality: pets.personality,
      autoApprove: pets.autoApprove,
      maxActionsPerDay: pets.maxActionsPerDay,
      bondXp: pets.bondXp,
      createdAt: pets.createdAt,
    })
    .from(pets)
    .where(eq(pets.userId, userId));

  const [providers, deviceRows, events, tokens, postRows, actionRows, stats] = await Promise.all([
    db
      .select({ providerId: accounts.providerId, createdAt: accounts.createdAt })
      .from(accounts)
      .where(eq(accounts.userId, userId)),
    db
      .select({
        id: sessions.id,
        deviceName: sessions.deviceName,
        userAgent: sessions.userAgent,
        ipAddress: sessions.ipAddress,
        lastActiveAt: sessions.lastActiveAt,
        expiresAt: sessions.expiresAt,
        createdAt: sessions.createdAt,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.lastActiveAt)),
    db
      .select({
        id: authEvents.id,
        type: authEvents.type,
        ipAddress: authEvents.ipAddress,
        deviceName: authEvents.deviceName,
        createdAt: authEvents.createdAt,
      })
      .from(authEvents)
      .where(eq(authEvents.userId, userId))
      .orderBy(desc(authEvents.createdAt))
      .limit(RECENT_LIMIT),
    db.select({ id: pushTokens.id, platform: pushTokens.platform }).from(pushTokens).where(eq(pushTokens.userId, userId)),
    pet
      ? db
          .select({
            id: posts.id,
            content: posts.content,
            authoredByAgent: posts.authoredByAgent,
            hiddenAt: posts.hiddenAt,
            latitude: posts.latitude,
            longitude: posts.longitude,
            createdAt: posts.createdAt,
          })
          .from(posts)
          .where(eq(posts.petId, pet.id))
          .orderBy(desc(posts.createdAt))
          .limit(RECENT_LIMIT)
      : Promise.resolve([]),
    pet
      ? db
          .select({
            id: petActions.id,
            type: petActions.type,
            status: petActions.status,
            reasoning: petActions.reasoning,
            createdAt: petActions.createdAt,
          })
          .from(petActions)
          .where(eq(petActions.petId, pet.id))
          .orderBy(desc(petActions.createdAt))
          .limit(RECENT_LIMIT)
      : Promise.resolve([]),
    pet
      ? db
          .select({
            posts: sql<number>`count(*)`.mapWith(Number),
            hidden: sql<number>`count(*) filter (where ${posts.hiddenAt} is not null)`.mapWith(Number),
          })
          .from(posts)
          .where(eq(posts.petId, pet.id))
      : Promise.resolve([{ posts: 0, hidden: 0 }]),
  ]);

  const media = await mediaByPostId(postRows.map((p) => p.id));

  // ------------------------------------------------------------ game state
  // Only meaningful once the account has a pet; everything below hangs off it.
  const dayStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
  const dayAgo = new Date(Date.now() - 86_400_000);

  const [ledger, xpBySource, treasureRows, notifRows, careToday, friends, mood, { values }] = pet
    ? await Promise.all([
        db
          .select({ event: bondEvents.event, amount: bondEvents.amount, createdAt: bondEvents.createdAt })
          .from(bondEvents)
          .where(eq(bondEvents.petId, pet.id))
          .orderBy(desc(bondEvents.createdAt))
          .limit(RECENT_LIMIT),
        db
          .select({
            event: bondEvents.event,
            awards: sql<number>`count(*)`.mapWith(Number),
            xp: sql<number>`coalesce(sum(${bondEvents.amount}), 0)`.mapWith(Number),
          })
          .from(bondEvents)
          .where(eq(bondEvents.petId, pet.id))
          .groupBy(bondEvents.event)
          .orderBy(sql`sum(${bondEvents.amount}) desc`),
        db
          .select({ kind: petTreasures.kind, foundAt: petTreasures.foundAt })
          .from(petTreasures)
          .where(eq(petTreasures.petId, pet.id))
          .orderBy(desc(petTreasures.foundAt))
          .limit(RECENT_LIMIT),
        db
          .select({ type: notifications.type, title: notifications.title, createdAt: notifications.createdAt })
          .from(notifications)
          .where(eq(notifications.userId, userId))
          .orderBy(desc(notifications.createdAt))
          .limit(RECENT_LIMIT),
        db.select({ kind: petCare.kind }).from(petCare).where(and(eq(petCare.petId, pet.id), gt(petCare.createdAt, dayStart))),
        relationshipsFor(pet.id, 8),
        // Derived on read, exactly as the app derives it — so this page can't
        // show a mood the owner isn't seeing.
        petState(pet.id, userId).catch(() => null),
        getConfig(),
      ])
    : [[], [], [], [], [], [], null, { values: {} as Record<string, number> }];

  const pushedToday = pet
    ? await db
        .select({ type: notifications.type, count: sql<number>`count(*)`.mapWith(Number) })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), gt(notifications.createdAt, dayAgo)))
        .groupBy(notifications.type)
    : [];

  return NextResponse.json({
    user,
    pet: pet ?? null,
    providers,
    sessions: deviceRows,
    authEvents: events,
    pushTokens: tokens,
    posts: postRows.map((p) => ({ ...p, media: media.get(p.id) ?? [] })),
    petActions: actionRows,
    stats: stats[0] ?? { posts: 0, hidden: 0 },
    game: pet
      ? {
          bond: progressFor(pet.bondXp ?? 0),
          // The stored total and the sum of the ledger must agree. A gap means XP
          // was added without recording why, or a ledger row was written without
          // crediting it — either way the level can no longer be explained.
          ledgerAgrees: xpBySource.reduce((n, x) => n + x.xp, 0) === (pet.bondXp ?? 0),
          ledgerSum: xpBySource.reduce((n, x) => n + x.xp, 0),
          mood: mood?.mood ?? null,
          careToday: careToday.map((c) => c.kind),
          ledger,
          xpBySource,
          treasures: treasureRows.map((t) => ({
            kind: t.kind,
            label: TREASURE_BY_ID.get(t.kind)?.label ?? t.kind,
            rarity: TREASURE_BY_ID.get(t.kind)?.rarity ?? "common",
            foundAt: t.foundAt,
          })),
          friends,
          notifications: notifRows,
          // Against the live caps, so "why did they stop hearing from us" is
          // answerable without cross-referencing the config page.
          pushBudget: {
            total: values["push.dailyTotal"] ?? 5,
            usedTotal: pushedToday.reduce((n, r) => n + r.count, 0),
            byType: pushedToday,
          },
          location: {
            latitude: user.lastLatitude ?? null,
            longitude: user.lastLongitude ?? null,
            at: user.lastLocationAt ?? null,
          },
        }
      : null,
  });
}
