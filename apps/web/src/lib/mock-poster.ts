import { desc, eq } from "drizzle-orm";
import { generateImage, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { db, pets, posts } from "@bsocial/db";
import { getPetModel } from "./ai";
import { storeImage } from "./images";

/**
 * Writing a post in a seeded persona's voice.
 *
 * Shared by the admin "generate a post" button and the scheduled poster, so a
 * bot sounds the same however its post was triggered.
 */

const POST_MAX_LENGTH = 280;
const IMAGE_MODEL = "gemini-2.5-flash-image";
/** How many recent posts to show the model so it doesn't repeat itself. */
const RECENT_FOR_VARIETY = 8;

export type GeneratedImage = { url: string; thumbUrl: string };
export type GeneratedPost = { content: string; images: GeneratedImage[] };

/**
 * Only the fields that shape the writing. Deliberately not the whole row:
 * callers include an Inngest step, whose output is JSON, so `createdAt` and
 * friends arrive as strings and would fight the table's inferred type.
 */
export type PersonaVoice = {
  background: string | null;
  tone: string | null;
  location: string | null;
  interests: string[];
  personalityTraits: string[];
};
export type PetRow = { id: string; name: string; species: string };

/**
 * Angles to push the model off its own default. A persona left to free-associate
 * writes the same "beautiful morning at the beach" post every time; naming a
 * different shape of observation each run is what actually produces variety.
 */
const ANGLES = [
  "something small you noticed today that most people would walk past",
  "a mild complaint, affectionately made",
  "a recommendation, specific enough to act on",
  "a question to the neighbourhood",
  "something that happened to you just now",
  "a comparison between two nearby places",
  "an update on something ongoing in your life",
  "an opinion you know is slightly unreasonable",
];

export function describePersona(profile: PersonaVoice, pet: PetRow): string {
  return [
    profile.background && `Background: ${profile.background}`,
    profile.tone && `Writing tone: ${profile.tone}`,
    profile.interests.length > 0 && `Interests: ${profile.interests.join(", ")}`,
    profile.personalityTraits.length > 0 && `Personality traits: ${profile.personalityTraits.join(", ")}`,
    profile.location && `Based in: ${profile.location}`,
    `You are a ${pet.species} named ${pet.name}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateMockPost(
  profile: PersonaVoice,
  pet: PetRow,
  options: { imageCount?: number; rng?: () => number } = {},
): Promise<GeneratedPost> {
  const rng = options.rng ?? Math.random;

  const recent = await db
    .select({ content: posts.content })
    .from(posts)
    .where(eq(posts.petId, pet.id))
    .orderBy(desc(posts.createdAt))
    .limit(RECENT_FOR_VARIETY);

  const angle = ANGLES[Math.floor(rng() * ANGLES.length)]!;

  const { text } = await generateText({
    model: getPetModel(),
    system: `You are ${pet.name}, a real person posting on a local, map-based social app.
${describePersona(profile, pet)}

Write ONE short post (max ${POST_MAX_LENGTH} characters), in character.
This one should be: ${angle}.
Ground it in your actual neighbourhood. Casual and human — no hashtag spam, no
emoji pile-ups, never mention being an AI. Don't open with a greeting.
Reply with the post text only.`,
    prompt: `Your recent posts (do not repeat their subjects, openings or rhythm):
${recent.map((p) => `- ${p.content}`).join("\n") || "(none yet)"}

Write your next post.`,
  });

  const cleaned = text.trim().replace(/^["']|["']$/g, "");
  const content =
    cleaned.length > POST_MAX_LENGTH ? `${cleaned.slice(0, POST_MAX_LENGTH - 1).trimEnd()}…` : cleaned;
  if (!content) throw new Error("empty_generation");

  const images: GeneratedImage[] = [];
  const wanted = options.imageCount ?? 0;
  for (let i = 0; i < wanted; i++) {
    try {
      const { image } = await generateImage({
        model: google.image(IMAGE_MODEL),
        prompt: buildImagePrompt(content, profile),
        aspectRatio: "4:3",
      });
      const stored = await storeImage("posts", new Uint8Array(image.uint8Array));
      images.push({ url: stored.url, thumbUrl: stored.thumbUrl });
    } catch (error) {
      // A missing photo is worth far less than a missing post — carry on.
      console.warn("[mock-poster] image generation failed:", (error as Error).message);
    }
  }

  return { content, images };
}

export function buildImagePrompt(postContent: string, profile: PersonaVoice): string {
  const parts = [
    "A casual phone snapshot, natural light, slightly imperfect framing, no people's faces, no text or logos.",
    `The photo illustrates this social post: "${postContent}"`,
  ];
  if (profile.location) parts.push(`Set in ${profile.location}.`);
  if (profile.interests.length > 0) parts.push(`Themes: ${profile.interests.slice(0, 3).join(", ")}.`);
  if (profile.tone) parts.push(`Mood: ${profile.tone}.`);
  return parts.join(" ");
}

/** The persona's pet, which is who the post is actually attributed to. */
export async function petForMockUser(userId: string): Promise<PetRow | null> {
  const [pet] = await db
    .select({ id: pets.id, name: pets.name, species: pets.species })
    .from(pets)
    .where(eq(pets.userId, userId));
  return pet ?? null;
}
