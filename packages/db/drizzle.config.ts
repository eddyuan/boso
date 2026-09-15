import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "drizzle-kit";

// Single source of truth for DATABASE_URL: apps/web/.env.local
// (drizzle-kit runs with cwd = packages/db)
const webEnv = resolve(process.cwd(), "../../apps/web/.env.local");
if (!process.env.DATABASE_URL && existsSync(webEnv)) {
  process.loadEnvFile(webEnv);
}

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
