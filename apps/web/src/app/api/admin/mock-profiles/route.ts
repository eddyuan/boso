import { NextResponse } from "next/server";
import { z } from "zod";
import { desc, eq, sql } from "drizzle-orm";
import { db, mockProfiles, users } from "@bsocial/db";
import { requireSession } from "@/lib/session";

const PAGE_SIZE = 30;

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().optional(),
});

export async function GET(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const url = new URL(req.url);
  const parsed = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid_query" }, { status: 400 });

  const { page, search } = parsed.data;
  const offset = (page - 1) * PAGE_SIZE;

  const conditions = [];
  if (search) {
    const q = `%${search}%`;
    conditions.push(
      sql`(${users.name} ilike ${q} or ${users.email} ilike ${q} or ${mockProfiles.location} ilike ${q})`,
    );
  }

  const where = conditions.length ? sql.join(conditions, sql` and `) : sql`true`;

  const [rows, totalRow] = await Promise.all([
    db
      .select({
        id: mockProfiles.id,
        userId: mockProfiles.userId,
        userName: users.name,
        userEmail: users.email,
        userImage: users.image,
        gender: mockProfiles.gender,
        age: mockProfiles.age,
        location: mockProfiles.location,
        latitude: mockProfiles.latitude,
        longitude: mockProfiles.longitude,
        background: mockProfiles.background,
        personalityTraits: mockProfiles.personalityTraits,
        tone: mockProfiles.tone,
        postingSchedule: mockProfiles.postingSchedule,
        interests: mockProfiles.interests,
        createdAt: mockProfiles.createdAt,
        updatedAt: mockProfiles.updatedAt,
      })
      .from(mockProfiles)
      .innerJoin(users, eq(users.id, mockProfiles.userId))
      .where(where)
      .orderBy(desc(mockProfiles.createdAt))
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)`.mapWith(Number) })
      .from(mockProfiles)
      .innerJoin(users, eq(users.id, mockProfiles.userId))
      .where(where),
  ]);

  return NextResponse.json({
    profiles: rows,
    total: totalRow[0]?.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  });
}

const createSchema = z.object({
  userId: z.string().min(1),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  age: z.number().int().min(0).max(120).optional(),
  location: z.string().max(200).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  background: z.string().max(2000).optional(),
  personalityTraits: z.array(z.string().max(50)).max(20).optional(),
  tone: z.string().max(200).optional(),
  postingSchedule: z
    .object({
      frequency: z.enum(["daily", "weekly", "custom"]),
      times: z.array(z.string().regex(/^\d{2}:\d{2}$/)),
      timezone: z.string().max(50),
    })
    .optional(),
  interests: z.array(z.string().max(50)).max(30).optional(),
});

export async function POST(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  // Check if profile already exists for this user
  const existing = await db.query.mockProfiles.findFirst({
    where: eq(mockProfiles.userId, data.userId),
  });

  if (existing) {
    return NextResponse.json({ error: "profile_exists" }, { status: 409 });
  }

  const [profile] = await db
    .insert(mockProfiles)
    .values({
      userId: data.userId,
      gender: data.gender,
      age: data.age,
      location: data.location,
      latitude: data.latitude,
      longitude: data.longitude,
      background: data.background,
      personalityTraits: data.personalityTraits ?? [],
      tone: data.tone,
      postingSchedule: data.postingSchedule,
      interests: data.interests ?? [],
    })
    .returning();

  return NextResponse.json({ profile });
}

const updateSchema = createSchema.partial().extend({
  id: z.string().uuid(),
});

export async function PATCH(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten() }, { status: 400 });
  }

  const { id, ...data } = parsed.data;

  const [profile] = await db
    .update(mockProfiles)
    .set({
      ...(data.gender !== undefined && { gender: data.gender }),
      ...(data.age !== undefined && { age: data.age }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.latitude !== undefined && { latitude: data.latitude }),
      ...(data.longitude !== undefined && { longitude: data.longitude }),
      ...(data.background !== undefined && { background: data.background }),
      ...(data.personalityTraits !== undefined && { personalityTraits: data.personalityTraits }),
      ...(data.tone !== undefined && { tone: data.tone }),
      ...(data.postingSchedule !== undefined && { postingSchedule: data.postingSchedule }),
      ...(data.interests !== undefined && { interests: data.interests }),
    })
    .where(eq(mockProfiles.id, id))
    .returning();

  if (!profile) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ profile });
}

export async function DELETE(req: Request) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  // Check if profile exists
  const existing = await db.query.mockProfiles.findFirst({
    where: eq(mockProfiles.id, id),
  });

  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await db.delete(mockProfiles).where(eq(mockProfiles.id, id));

  return NextResponse.json({ ok: true });
}
