import type { ErrandTuning } from "@bsocial/shared";
import { desc, eq } from "drizzle-orm";
import { appSettings, configAudit, db, users } from "@bsocial/db";
import {
  CONFIG_BY_KEY,
  coerceConfigValue,
  configDefaults,
  resolveConfig,
  type ConfigIssue,
} from "@bsocial/shared";

/**
 * Reading and writing the live tuning values.
 *
 * Stored in `app_settings` beside the operational switches, because they want
 * the same properties: effective immediately, across every serverless instance
 * and the Inngest workers, with no redeploy.
 *
 * Bounds are applied on read as well as on write. A value edited straight in the
 * database, or stored before a bound was tightened, falls back to its default and
 * is reported as an issue rather than taking effect.
 */

/** Keys under this prefix are tuning values; anything else in the table is a switch. */
const PREFIXES = ["xp.", "treasures.", "missions.", "pets.", "playdates.", "relationships.", "map.", "errand.", "whiskers.", "push.", "moderation.", "cost."];

const isConfigKey = (key: string) => PREFIXES.some((p) => key.startsWith(p));

export type LiveConfig = {
  values: Record<string, number>;
  issues: ConfigIssue[];
};

/**
 * Cached for a few seconds.
 *
 * The pet loop reads config once per tick and the push sender once per message;
 * without a cache a busy minute would be hundreds of identical queries. Kept
 * short so a retune takes effect while an admin is still looking at the page —
 * a minute-long cache would have them wondering whether Save worked.
 */
const TTL_MS = 5_000;
let cache: { at: number; config: LiveConfig } | null = null;

export async function getConfig(): Promise<LiveConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.config;

  try {
    const rows = await db.select().from(appSettings);
    const stored: Record<string, unknown> = {};
    for (const row of rows) if (isConfigKey(row.key)) stored[row.key] = row.value;
    const config = resolveConfig(stored);
    cache = { at: Date.now(), config };
    return config;
  } catch (error) {
    // A database blip must not stop pets acting or pushes sending; the defaults
    // are the behaviour the app shipped with, so they are always a safe answer.
    console.error("[config] could not read settings, using defaults:", error);
    return { values: configDefaults(), issues: [] };
  }
}

/** A single value, for call sites that need exactly one. */
export async function getConfigValue(key: string): Promise<number> {
  const { values } = await getConfig();
  const field = CONFIG_BY_KEY.get(key);
  if (!field) throw new Error(`unknown config key: ${key}`);
  return values[key] ?? field.default;
}

/** Drops the cache, so a write is visible to the next read in this instance. */
export function invalidateConfigCache(): void {
  cache = null;
}

export type WriteResult = { ok: true } | { ok: false; reason: string };

/**
 * Sets one value, refusing anything the registry wouldn't accept.
 *
 * The audit row is written first. A change that took effect without being
 * recorded is exactly the situation the audit exists to prevent, so if the two
 * can't both happen the value must not change.
 */
export async function setConfigValue(key: string, value: number, actorId: string): Promise<WriteResult> {
  const field = CONFIG_BY_KEY.get(key);
  if (!field) return { ok: false, reason: "unknown key" };

  const { issue } = coerceConfigValue(field, value);
  if (issue) return { ok: false, reason: issue.reason };

  const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  const from = typeof existing?.value === "number" ? existing.value : null;
  if (from === value) return { ok: true };

  await db.insert(configAudit).values({ key, fromValue: from, toValue: value, actorId });
  await db
    .insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value } });

  invalidateConfigCache();
  return { ok: true };
}

/** Removes a stored value so the key runs on its default again. */
export async function resetConfigValue(key: string, actorId: string): Promise<WriteResult> {
  const field = CONFIG_BY_KEY.get(key);
  if (!field) return { ok: false, reason: "unknown key" };

  const [existing] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  if (!existing) return { ok: true };

  await db.insert(configAudit).values({
    key,
    fromValue: typeof existing.value === "number" ? existing.value : null,
    toValue: field.default,
    actorId,
  });
  await db.delete(appSettings).where(eq(appSettings.key, key));
  invalidateConfigCache();
  return { ok: true };
}

export type AuditRow = {
  id: string;
  key: string;
  fromValue: number | null;
  toValue: number;
  actor: string | null;
  createdAt: Date;
};

export async function configHistory(limit = 60): Promise<AuditRow[]> {
  const rows = await db
    .select({
      id: configAudit.id,
      key: configAudit.key,
      fromValue: configAudit.fromValue,
      toValue: configAudit.toValue,
      actor: users.name,
      createdAt: configAudit.createdAt,
    })
    .from(configAudit)
    .leftJoin(users, eq(users.id, configAudit.actorId))
    .orderBy(desc(configAudit.createdAt))
    .limit(limit);
  return rows;
}

/** The errand floors and ceilings, shaped for `capabilitiesAt`. */
export function errandTuning(values: Record<string, number>): ErrandTuning {
  return {
    radiusStartM: values["errands.radiusStartM"]!,
    radiusMaxM: values["errands.radiusMaxM"]!,
    bundleStart: values["errands.bundleStart"]!,
    bundleMax: values["errands.bundleMax"]!,
    perDayStart: values["errands.perDayStart"]!,
    perDayMax: values["errands.perDayMax"]!,
  };
}
