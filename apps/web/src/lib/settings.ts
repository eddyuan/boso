import { eq } from "drizzle-orm";
import { appSettings, db } from "@bsocial/db";

/**
 * Operational switches an admin can flip from the panel, stored in the database
 * so they take effect immediately across every serverless instance and the
 * Inngest workers — an env var would need a redeploy.
 */
export type AppSettings = {
  /** Stops the hourly pet loop from scheduling or acting. The panic button. */
  petsPaused: boolean;
};

export const DEFAULT_SETTINGS: AppSettings = {
  petsPaused: false,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(appSettings);
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    petsPaused: typeof stored.petsPaused === "boolean" ? stored.petsPaused : DEFAULT_SETTINGS.petsPaused,
  };
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } });
}

/** Read one flag without loading the rest. Used on the hot path in the pet loop. */
export async function isPetsPaused(): Promise<boolean> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, "petsPaused"));
  return row?.value === true;
}
