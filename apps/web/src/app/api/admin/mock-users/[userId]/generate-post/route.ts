import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, mockProfiles, pets, posts } from "@bsocial/db";
import { requireSession } from "@/lib/session";
import { generateImage, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { getPetModel } from "@/lib/ai";
import { storeImage } from "@/lib/images";

const POST_MAX_LENGTH = 280;
const IMAGE_MODEL = "gemini-2.5-flash-image";

type GeneratedImage = { url: string; thumbUrl: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { session, response } = await requireSession({ requireAdmin: true });
  if (response) return response;
  void session;

  const { userId } = await params;

  const profile = await db.query.mockProfiles.findFirst({
    where: eq(mockProfiles.userId, userId),
  });
  if (!profile) {
    return NextResponse.json({ error: "no_mock_profile" }, { status: 404 });
  }

  const [pet] = await db
    .select({ id: pets.id, name: pets.name, species: pets.species, traits: pets.traits, personality: pets.personality })
    .from(pets)
    .where(eq(pets.userId, userId));
  if (!pet) {
    return NextResponse.json({ error: "no_pet" }, { status: 404 });
  }

  const recentPosts = await db
    .select({ content: posts.content })
    .from(posts)
    .where(eq(posts.petId, pet.id))
    .orderBy(posts.createdAt)
    .limit(5);

  const personality = [
    profile.background && `Background: ${profile.background}`,
    profile.tone && `Writing tone: ${profile.tone}`,
    profile.interests.length && `Interests: ${profile.interests.join(", ")}`,
    profile.personalityTraits.length && `Personality traits: ${profile.personalityTraits.join(", ")}`,
    profile.location && `Based in: ${profile.location}`,
    `You are a ${pet.species} named ${pet.name}.`,
  ]
    .filter(Boolean)
    .join("\n");

  const { text } = await generateText({
    model: getPetModel(),
    instructions: `You are ${pet.name}, a social media user posting on a local social app.
${personality}

Write ONE short social post (max ${POST_MAX_LENGTH} characters) in character. Be authentic to the personality and tone described above. Casual and human; no hashtag spam, no emoji overload, don't mention being an AI or a bot.
Reply with the post text only.`,
    prompt: `Your recent posts:
${recentPosts.map((p) => `- ${p.content}`).join("\n") || "(none yet)"}

Write your next post.`,
  });

  const cleaned = text.trim().replace(/^["']|["']$/g, "");
  const content = cleaned.length > POST_MAX_LENGTH
    ? `${cleaned.slice(0, POST_MAX_LENGTH - 1).trimEnd()}…`
    : cleaned;

  if (!content) {
    return NextResponse.json({ error: "empty_generation" }, { status: 500 });
  }

  const imageCount = 1 + Math.floor(Math.random() * 5);
  const images: GeneratedImage[] = [];

  for (let i = 0; i < imageCount; i++) {
    try {
      const { image } = await generateImage({
        model: google.image(IMAGE_MODEL),
        prompt: buildImagePrompt(content, profile),
        aspectRatio: "4:3",
      });
      const stored = await storeImage("posts", new Uint8Array(image.uint8Array));
      images.push({ url: stored.url, thumbUrl: stored.thumbUrl });
    } catch (error) {
      console.warn("[generate-post] image generation failed:", (error as Error).message);
    }
  }

  return NextResponse.json({ content, petId: pet.id, images });
}

function buildImagePrompt(
  postContent: string,
  profile: { background: string | null; interests: string[]; location: string | null; tone: string | null },
): string {
  const parts = [
    "A casual phone snapshot, natural light, slightly imperfect framing, no people's faces, no text or logos.",
    `The photo illustrates this social post: "${postContent}"`,
  ];
  if (profile.location) parts.push(`Set in ${profile.location}.`);
  if (profile.interests.length) parts.push(`Themes: ${profile.interests.slice(0, 3).join(", ")}.`);
  if (profile.tone) parts.push(`Mood: ${profile.tone}.`);
  return parts.join(" ");
}
