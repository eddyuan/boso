import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { openai } from "@ai-sdk/openai";
import { createProviderRegistry, type LanguageModel } from "ai";

// Provider-agnostic model access. Pick the pet's model with PET_AI_MODEL as
// "<provider>:<model>", e.g. "google:gemini-3.8-flash",
// "anthropic:claude-sonnet-5", "openai:<model>". Each provider reads its own
// API key from env (GOOGLE_GENERATIVE_AI_API_KEY, ANTHROPIC_API_KEY,
// OPENAI_API_KEY). To add another provider: install its @ai-sdk/* package and
// register it below.
const registry = createProviderRegistry({ google, anthropic, openai });

export const DEFAULT_PET_AI_MODEL = "google:gemini-3.8-flash";

export function getPetModel(): LanguageModel {
  const id = process.env.PET_AI_MODEL || DEFAULT_PET_AI_MODEL;
  // Throws a clear error for an unknown provider prefix.
  return registry.languageModel(id as Parameters<typeof registry.languageModel>[0]);
}
