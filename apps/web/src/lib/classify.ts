import { generateObject } from "ai";
import { z } from "zod";
import {
  MAX_TOPICS_PER_POST,
  SENSITIVE_CATEGORY_VALUES,
  type ModerationScores,
  type SensitiveCategory,
} from "@bsocial/shared";
import { getPetModel } from "./ai";

/**
 * One model, two jobs: what a post is about, and whether it's safe. Both come
 * back from the same call because the text is the same input and Gemini is what
 * we already pay for.
 *
 * Images are sent as separate parts in one request rather than tiled into a
 * contact sheet: Gemini downsamples each part anyway, so a grid would drop every
 * photo to a couple of hundred pixels — exactly the resolution where "weapon or
 * phone" gets decided wrong — and a flagged grid can't tell you which photo to
 * blur.
 */

const scoreShape = Object.fromEntries(
  SENSITIVE_CATEGORY_VALUES.map((c) => [c, z.number().min(0).max(1)]),
) as Record<SensitiveCategory, z.ZodNumber>;

const textSchema = z.object({
  topics: z
    .array(
      z.object({
        slug: z.string().min(2).max(40),
        label: z.string().min(2).max(60),
        interest: z.string().min(2).max(40),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(MAX_TOPICS_PER_POST),
  scores: z.object(scoreShape),
});

export type TextClassification = z.infer<typeof textSchema>;

/** All-zero scores, for a post with no text to classify. */
export function emptyTextClassification(): TextClassification {
  return {
    topics: [],
    scores: Object.fromEntries(SENSITIVE_CATEGORY_VALUES.map((c) => [c, 0])) as Record<SensitiveCategory, number>,
  };
}

const imageSchema = z.object({
  images: z.array(z.object({ index: z.number().int().min(0), scores: z.object(scoreShape) })),
});

const CATEGORY_GUIDE = `
- adult: nudity, sexual acts, sexualised depictions
- violence: gore, graphic injury, death, credible threats
- political: elections, parties, candidates, activism, contested policy
- hate: slurs or attacks targeting a protected group
- self_harm: suicide, self-injury, eating-disorder promotion
- illegal: sale of drugs, weapons, or other regulated goods
- spam: scams, engagement bait, bulk repetition`;

/**
 * Topics + text safety. `knownTopics` is fed back in so the model reuses the
 * vocabulary we already have instead of inventing a synonym for it.
 */
export async function classifyText(
  content: string,
  interests: readonly string[],
  knownTopics: string[],
): Promise<TextClassification> {
  const { object } = await generateObject({
    model: getPetModel(),
    schema: textSchema,
    system: `You classify short social posts for a local, map-based social app.

TOPICS — return up to ${MAX_TOPICS_PER_POST}, most relevant first, each with:
- "interest": exactly one of these parent categories: ${interests.join(", ")}
- "slug": lowercase kebab-case, singular, no accents (e.g. "ramen", "trail-running")
- "label": the human name (e.g. "Ramen")
REUSE an existing topic whenever one fits. Existing topics: ${knownTopics.join(", ") || "(none yet)"}
Only invent a slug when nothing existing fits. Prefer specific over generic, but
never invent a topic the post doesn't actually support.

SAFETY — score every category 0–1 for how strongly the text matches:${CATEGORY_GUIDE}
Score what is depicted or advocated, not what is merely mentioned in passing:
a restaurant review that says "this sauce is a crime" is not illegal content.`,
    prompt: content,
  });
  return object;
}

/** Per-image safety. Returns one score set per input, in the order given. */
export async function classifyImages(urls: string[]): Promise<ModerationScores[]> {
  if (urls.length === 0) return [];

  const { object } = await generateObject({
    model: getPetModel(),
    schema: imageSchema,
    system: `You are moderating photos attached to a social post.
Score EVERY image 0–1 in each category:${CATEGORY_GUIDE}
Return one entry per image, using "index" to identify it (0-based, in the order supplied).`,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `Score these ${urls.length} image(s).` },
          ...urls.map((url) => ({ type: "image" as const, image: new URL(url) })),
        ],
      },
    ],
  });

  // Re-key by index: the model can return them out of order or drop one.
  return urls.map((_, i) => object.images.find((r) => r.index === i)?.scores ?? {});
}

/** The worst score per category across the post's text and every image. */
export function mergeScores(all: ModerationScores[]): ModerationScores {
  const merged: ModerationScores = {};
  for (const c of SENSITIVE_CATEGORY_VALUES) {
    merged[c] = Math.max(0, ...all.map((s) => s[c] ?? 0));
  }
  return merged;
}
