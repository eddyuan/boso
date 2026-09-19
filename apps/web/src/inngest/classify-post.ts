import { eq } from "drizzle-orm";
import { db, pets, postMedia, posts } from "@bsocial/db";
import { INTERESTS, SENSITIVE_THRESHOLD, verdictFromScores, type ModerationScores } from "@bsocial/shared";
import { inngest } from "./client";
import { classifyImages, classifyText, emptyTextClassification, mergeScores, type TextClassification } from "../lib/classify";
import { attachPostTopics, knownTopicSlugs, refreshUserTopics } from "../lib/topics";

const INTEREST_VALUES = INTERESTS.map((i) => i.value);
const IMAGE_BATCH = 8;

/**
 * Classifies a post after it's written: what it's about, and whether it's safe.
 *
 * Runs asynchronously on purpose. The post is already live when this starts, so
 * a slow or failing model never blocks someone from posting — the cost is a
 * short window where a bad post is visible before it's pulled.
 */
export const classifyPost = inngest.createFunction(
  {
    id: "classify-post",
    concurrency: { key: "event.data.postId", limit: 1 },
    // A post left `pending` is invisible to no one but is also never amplified,
    // so failing loudly after a few tries is better than silently giving up.
    retries: 3,
  },
  { event: "post/created" },
  async ({ event, step }) => {
    const postId = event.data.postId;

    const post = await step.run("load-post", async () => {
      const [row] = await db
        .select({
          id: posts.id,
          content: posts.content,
          petId: posts.petId,
          userId: pets.userId,
          authoredByAgent: posts.authoredByAgent,
        })
        .from(posts)
        .innerJoin(pets, eq(pets.id, posts.petId))
        .where(eq(posts.id, postId));
      return row ?? null;
    });
    if (!post) return { skipped: "post not found" };

    const media = await step.run("load-media", () =>
      db
        .select({ id: postMedia.id, url: postMedia.url, kind: postMedia.kind })
        .from(postMedia)
        .where(eq(postMedia.postId, postId)),
    );

    const text: TextClassification = await step.run("classify-text", async () => {
      if (!post.content.trim()) return emptyTextClassification();
      return classifyText(post.content, INTEREST_VALUES, await knownTopicSlugs());
    });

    // Videos aren't scored yet — a frame grab would be needed, so they're left
    // to human review rather than quietly passed as safe.
    const images = media.filter((m) => m.kind === "image");
    const imageScores = await step.run("classify-images", async () => {
      const out: ModerationScores[] = [];
      for (let i = 0; i < images.length; i += IMAGE_BATCH) {
        const batch = images.slice(i, i + IMAGE_BATCH);
        out.push(...(await classifyImages(batch.map((m) => m.url))));
      }
      return out;
    });

    const scores = mergeScores([text.scores as ModerationScores, ...imageScores]);
    const verdict = verdictFromScores(scores);

    await step.run("record-verdict", async () => {
      await db
        .update(posts)
        .set({
          moderationStatus: verdict.status,
          moderationScores: scores,
          sensitiveCategories: verdict.categories,
          moderatedAt: new Date(),
          moderationModel: process.env.PET_AI_MODEL || "google:gemini-3.8-flash",
        })
        .where(eq(posts.id, postId));

      // Blur just the offending photo rather than the whole gallery.
      for (const [i, image] of images.entries()) {
        const s = imageScores[i];
        if (!s) continue;
        const blurred = Object.values(s).some((v) => (v ?? 0) >= SENSITIVE_THRESHOLD);
        await db.update(postMedia).set({ moderationScores: s, blurred }).where(eq(postMedia.id, image.id));
      }
    });

    const attached = await step.run("attach-topics", () => attachPostTopics(postId, text.topics));

    // A pet's posts say nothing about what its owner is interested in.
    if (!post.authoredByAgent && attached.length > 0) {
      await step.run("refresh-user-topics", () => refreshUserTopics(post.userId));
    }

    return { postId, status: verdict.status, categories: verdict.categories, topics: attached };
  },
);
