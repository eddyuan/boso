import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { accounts, authEvents, db, petActions, pets, posts, pushTokens, sessions, users } from "@bsocial/db";
import { mediaByPostId } from "@/lib/post-media";
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
  });
}
