import { NextResponse } from "next/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db, pets, users } from "@bsocial/db";
import {
  DISPLAY_NAME_MAX,
  GENDERS,
  INTERESTS,
  MAX_INTERESTS,
  MAX_PET_TRAITS,
  MIN_AGE,
  MIN_INTERESTS,
  MIN_PET_TRAITS,
  ONBOARDING_STEPS,
  PET_BIO_MAX,
  PET_NAME_MAX,
  PET_SPECIES,
  PET_TRAITS,
  TERMS_VERSION,
  getAge,
  normalizeUsername,
  parseBirthday,
  validateUsername,
  type OnboardingStep,
} from "@bsocial/shared";
import { requireSession } from "@/lib/session";
import { getOnboardingStatus, isStepAllowed } from "@/lib/onboarding";
import { isOwnUploadUrl } from "@/lib/storage";

const enumOf = <T extends readonly { value: string }[]>(list: T) =>
  z.enum(list.map((i) => i.value) as [T[number]["value"], ...T[number]["value"][]]);

const schemas = {
  terms: z.object({ version: z.literal(TERMS_VERSION) }),
  birthday: z.object({ birthday: z.string() }),
  gender: z.object({ gender: enumOf(GENDERS) }),
  profile: z.object({
    username: z.string(),
    // Optional: apps show the @handle when empty.
    name: z.string().trim().max(DISPLAY_NAME_MAX).optional(),
    image: z.string().url().nullable().optional(),
  }),
  interests: z.object({
    interests: z.array(enumOf(INTERESTS)).min(MIN_INTERESTS).max(MAX_INTERESTS),
  }),
  pet: z.object({
    name: z.string().trim().min(1).max(PET_NAME_MAX),
    species: enumOf(PET_SPECIES),
    traits: z.array(z.enum(PET_TRAITS)).min(MIN_PET_TRAITS).max(MAX_PET_TRAITS).default([]),
    personality: z.string().trim().max(PET_BIO_MAX).optional(),
    // Auto-post (recommended, pre-selected in the app) or review each action first.
    autoApprove: z.boolean(),
    consent: z.literal(true),
  }),
  // Optional OS permission prompts: record that the step was shown.
  notifications: z.object({ granted: z.boolean() }),
  contacts: z.object({ granted: z.boolean() }),
  calendar: z.object({ granted: z.boolean() }),
} satisfies Record<OnboardingStep, z.ZodTypeAny>;

function error(status: number, code: string, extra?: object) {
  return NextResponse.json({ error: code, ...extra }, { status });
}

export async function POST(req: Request, { params }: { params: Promise<{ step: string }> }) {
  const { session, response } = await requireSession({ allowIncompleteOnboarding: true });
  if (response) return response;
  const userId = session.user.id;

  const { step } = await params;
  if (!(ONBOARDING_STEPS as readonly string[]).includes(step)) return error(404, "unknown_step");
  const s = step as OnboardingStep;

  const status = await getOnboardingStatus(userId);
  if (!status) return error(404, "not_found");
  if (!isStepAllowed(status, s)) {
    return error(409, "step_out_of_order", { nextStep: status.nextStep });
  }

  const parsed = schemas[s].safeParse(await req.json().catch(() => null));
  if (!parsed.success) return error(400, "invalid_input", { issues: parsed.error.flatten() });
  const body = parsed.data;

  switch (s) {
    case "terms": {
      await db
        .update(users)
        .set({ termsVersion: TERMS_VERSION, termsAcceptedAt: new Date() })
        .where(eq(users.id, userId));
      break;
    }

    case "birthday": {
      const { birthday } = body as z.infer<typeof schemas.birthday>;
      // Set once: can't be changed to retry the age gate.
      if (status.state.birthday) return error(409, "birthday_already_set");
      const date = parseBirthday(birthday);
      const age = date ? getAge(date) : -1;
      if (!date || age > 120 || date > new Date()) return error(400, "invalid_birthday");

      const underage = age < MIN_AGE;
      await db
        .update(users)
        .set({ birthday, ...(underage ? { ageGateFailedAt: new Date() } : {}) })
        .where(eq(users.id, userId));
      if (underage) return error(403, "age_restricted", { minAge: MIN_AGE });
      break;
    }

    case "gender": {
      const { gender } = body as z.infer<typeof schemas.gender>;
      await db.update(users).set({ gender }).where(eq(users.id, userId));
      break;
    }

    case "profile": {
      const { username: raw, name, image } = body as z.infer<typeof schemas.profile>;
      const invalid = validateUsername(raw);
      if (invalid) return error(400, invalid);
      const username = normalizeUsername(raw);
      // Only accept photos uploaded through /api/uploads.
      if (image && !isOwnUploadUrl(image)) return error(400, "invalid_image");

      const [taken] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, username), ne(users.id, userId)));
      if (taken) return error(409, "taken");

      try {
        await db
          .update(users)
          .set({
            username,
            displayUsername: raw.trim().replace(/^@/, ""),
            name: name ?? "",
            ...(image !== undefined ? { image } : {}),
          })
          .where(eq(users.id, userId));
      } catch (e) {
        // Lost a race to another user claiming the same nickname.
        if ((e as { code?: string }).code === "23505") return error(409, "taken");
        throw e;
      }
      break;
    }

    case "interests": {
      const { interests } = body as z.infer<typeof schemas.interests>;
      await db
        .update(users)
        .set({ interests: [...new Set(interests)] })
        .where(eq(users.id, userId));
      break;
    }

    case "pet": {
      const pet = body as z.infer<typeof schemas.pet>;
      const values = {
        name: pet.name,
        species: pet.species,
        traits: [...new Set(pet.traits)],
        personality: pet.personality ?? "",
        autoApprove: pet.autoApprove,
        autonomyConsentedAt: new Date(),
      };
      // One pet per user: create, or update if the user went back a step.
      await db
        .insert(pets)
        .values({ userId, ...values })
        .onConflictDoUpdate({ target: pets.userId, set: values });
      break;
    }

    case "notifications":
    case "contacts":
    case "calendar": {
      const column = {
        notifications: "notificationsPromptedAt",
        contacts: "contactsPromptedAt",
        calendar: "calendarPromptedAt",
      } as const;
      await db
        .update(users)
        .set({ [column[s]]: new Date() })
        .where(eq(users.id, userId));
      break;
    }
  }

  return NextResponse.json(await getOnboardingStatus(userId));
}
