import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { classifyPost } from "@/inngest/classify-post";
import { runPetTick, schedulePetTicks } from "@/inngest/functions";
import { comebackNudges } from "@/inngest/comeback";
import { morningDigest, writeDiaries } from "@/inngest/diary";
import { runMockPost, scheduleMockPosts } from "@/inngest/mock-posts";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [schedulePetTicks, runPetTick, classifyPost, scheduleMockPosts, runMockPost, comebackNudges, writeDiaries, morningDigest],
});
