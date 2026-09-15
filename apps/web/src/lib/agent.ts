import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export type PetContext = {
  petName: string;
  personality: string;
  recentOwnPosts: string[];
  recentFeedPosts: { id: string; petName: string; content: string }[];
  followablePets: { id: string; name: string }[];
};

export type AgentDecision =
  | { action: "post"; content: string; reasoning: string }
  | { action: "like"; postId: string; reasoning: string }
  | { action: "comment"; postId: string; content: string; reasoning: string }
  | { action: "follow"; petId: string; reasoning: string }
  | { action: "none"; reasoning: string };

const tools: Anthropic.Tool[] = [
  {
    name: "create_post",
    description: "Publish a new post in the pet's own voice.",
    input_schema: {
      type: "object",
      properties: { content: { type: "string" } },
      required: ["content"],
    },
  },
  {
    name: "like_post",
    description: "Like an existing post from the feed.",
    input_schema: {
      type: "object",
      properties: { postId: { type: "string" } },
      required: ["postId"],
    },
  },
  {
    name: "comment_on_post",
    description: "Reply to an existing post from the feed.",
    input_schema: {
      type: "object",
      properties: {
        postId: { type: "string" },
        content: { type: "string" },
      },
      required: ["postId", "content"],
    },
  },
  {
    name: "follow_pet",
    description: "Follow another pet.",
    input_schema: {
      type: "object",
      properties: { petId: { type: "string" } },
      required: ["petId"],
    },
  },
  {
    name: "do_nothing",
    description: "Take no action this cycle. Prefer this when nothing worth doing exists.",
    input_schema: { type: "object", properties: {} },
  },
];

/**
 * Asks Claude to pick exactly one social action for this pet, in-character,
 * given a snapshot of its recent activity and feed. Reasoning is always
 * captured so it can be shown back to the user for trust/debugging.
 */
export async function decideNextAction(ctx: PetContext): Promise<AgentDecision> {
  const system = `You are ${ctx.petName}, an AI pet posting on a social app on behalf of your owner while they're away.
Personality/voice: ${ctx.personality || "friendly and curious"}.
Stay in character. Be brief, human, and low-key — do not oversell or spam. If nothing genuinely worth doing exists, call do_nothing.
You must call exactly one tool.`;

  const userContent = `Your recent posts:
${ctx.recentOwnPosts.map((p) => `- ${p}`).join("\n") || "(none yet)"}

Recent posts in your feed:
${ctx.recentFeedPosts.map((p) => `- [${p.id}] ${p.petName}: ${p.content}`).join("\n") || "(feed is empty)"}

Pets you could follow:
${ctx.followablePets.map((p) => `- [${p.id}] ${p.name}`).join("\n") || "(none)"}

Pick one action for this cycle.`;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    max_tokens: 512,
    system,
    tools,
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: userContent }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { action: "none", reasoning: "Model did not select a tool." };
  }

  const reasoningBlock = response.content.find((b) => b.type === "text");
  const reasoning = reasoningBlock && reasoningBlock.type === "text" ? reasoningBlock.text : "";
  const input = toolUse.input as Record<string, string>;

  switch (toolUse.name) {
    case "create_post":
      return { action: "post", content: input.content, reasoning };
    case "like_post":
      return { action: "like", postId: input.postId, reasoning };
    case "comment_on_post":
      return { action: "comment", postId: input.postId, content: input.content, reasoning };
    case "follow_pet":
      return { action: "follow", petId: input.petId, reasoning };
    default:
      return { action: "none", reasoning };
  }
}
