import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  integer,
  bigint,
  date,
  doublePrecision,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const actionTypeEnum = pgEnum("action_type", [
  "post",
  "follow",
  "like",
  "comment",
  "visit", // pet viewed another pet's profile
  "none", // the pet did nothing this tick; logged, never counts toward limits
]);

export const actionStatusEnum = pgEnum("action_status", [
  "pending", // awaiting user approval
  "approved",
  "rejected",
  "executed",
  "failed",
]);

export const genderEnum = pgEnum("gender", ["male", "female", "other", "prefer_not_to_say"]);

// ---------------------------------------------------------------------------
// Auth tables (Better Auth). Field keys must match Better Auth's model fields;
// table keys are plural because the adapter runs with `usePlural: true`.
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // username plugin
  username: text("username").unique(),
  displayUsername: text("display_username"),
  // phoneNumber plugin (E.164)
  phoneNumber: text("phone_number").unique(),
  phoneNumberVerified: boolean("phone_number_verified"),
  // Staff access to admin features. Only settable directly in the database —
  // never through the API (input: false in apps/web/src/lib/auth.ts).
  isAdmin: boolean("is_admin").notNull().default(false),
  /**
   * A seeded account we created, not a person who signed up. Its pet is a
   * "stray" and the apps badge it as such — users are never shown a seeded
   * account as though it were someone real. Also what makes seed data
   * purgeable and keeps it out of real-user counts and contact matching.
   */
  isMock: boolean("is_mock").notNull().default(false),
  // Last authenticated API request from any device (throttled, see apps/web/src/lib/session.ts)
  lastActiveAt: timestamp("last_active_at"),

  // --- Onboarding (rules in @bsocial/shared/onboarding) ---
  termsVersion: text("terms_version"),
  termsAcceptedAt: timestamp("terms_accepted_at"),
  // Set once; not editable in-app so the age gate can't be retried.
  birthday: date("birthday", { mode: "string" }),
  // Set when the birthday was under MIN_AGE. Blocks the account.
  ageGateFailedAt: timestamp("age_gate_failed_at"),
  gender: genderEnum("gender"),
  interests: text("interests").array().notNull().default(sql`'{}'::text[]`),
  // Optional prompts: set when shown, whether the user allowed or skipped.
  notificationsPromptedAt: timestamp("notifications_prompted_at"),
  contactsPromptedAt: timestamp("contacts_prompted_at"),
  calendarPromptedAt: timestamp("calendar_prompted_at"),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  // IP / user agent at sign-in
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  // Sent by the client via the x-device-name header, e.g. "Edward's iPhone"
  deviceName: text("device_name"),
  // Last authenticated API request on this device (throttled)
  lastActiveAt: timestamp("last_active_at"),
  lastActiveIp: text("last_active_ip"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const authEventTypeEnum = pgEnum("auth_event_type", [
  "sign_up",
  "sign_in",
  "sign_out",
  "session_revoked",
  "account_linked",
  "account_unlinked",
]);

// Append-only login history. Sessions rows are deleted on sign-out/revoke,
// so this is the durable record of who logged in, when, and from where.
export const authEvents = pgTable(
  "auth_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Not a foreign key: the session may no longer exist.
    sessionId: text("session_id"),
    type: authEventTypeEnum("type").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    deviceName: text("device_name"),
    // Event-specific details, e.g. { providerId: "google" } for link/unlink.
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("auth_events_user_created_idx").on(t.userId, t.createdAt)],
);

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  // bcrypt/scrypt hash for email+password accounts
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Better Auth rate limiting (storage: "database") — shared across serverless
// instances, unlike the default in-memory limiter.
export const rateLimits = pgTable("rate_limits", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

export const pets = pgTable("pets", {
  id: uuid("id").primaryKey().defaultRandom(),
  // One pet per user.
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // PET_SPECIES value from @bsocial/shared
  species: text("species").notNull(),
  // PET_TRAITS values from @bsocial/shared
  traits: text("traits").array().notNull().default(sql`'{}'::text[]`),
  avatarUrl: text("avatar_url"),
  // Optional free-text description of voice/interests, written by the user.
  // Combined with species + traits for the agent's system prompt.
  personality: text("personality").notNull().default(""),
  // If true, pet actions post immediately; if false, they queue as "pending" for user review.
  autoApprove: boolean("auto_approve").notNull().default(true),
  // When the user consented to the pet acting on their behalf, and on what terms.
  autonomyConsentedAt: timestamp("autonomy_consented_at"),
  // Rolling 24h cap (see PET_DEFAULT_MAX_ACTIONS_PER_DAY in @bsocial/shared).
  maxActionsPerDay: integer("max_actions_per_day").notNull().default(5),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// Expo push tokens, one per device/app install.
export const pushTokens = pgTable(
  "push_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    platform: text("platform").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("push_tokens_user_idx").on(t.userId)],
);

/**
 * Somewhere real: a venue, park or landmark. Imported from OpenStreetMap by
 * bounding box (ODbL — attribution required wherever places are shown), keyed
 * by source + sourceId so re-imports update rather than duplicate.
 */
export const places = pgTable(
  "places",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: text("source").notNull().default("osm"),
    sourceId: text("source_id").notNull(),
    name: text("name").notNull(),
    /** Free-form for now: "cafe", "park", "restaurant"… from the OSM tag. */
    category: text("category"),
    latitude: doublePrecision("latitude").notNull(),
    longitude: doublePrecision("longitude").notNull(),
    address: text("address"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("places_source_idx").on(t.source, t.sourceId),
    index("places_latlng_idx").on(t.latitude, t.longitude),
  ],
);

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id, { onDelete: "cascade" }),
  /**
   * The place this post is about, when one was picked. The post then takes the
   * place's coordinates, which is both tidier on the map (posts cluster on real
   * venues) and more private than the poster's own position.
   */
  placeId: uuid("place_id").references(() => places.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  // Where the post was made, for the map tab. Coarse (~100 m) for privacy.
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  // Whether a human wrote this or the agent generated it (for transparency in the UI).
  authoredByAgent: boolean("authored_by_agent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const postMediaKindEnum = pgEnum("post_media_kind", ["image", "video"]);

/**
 * A post's photos/videos — a separate table rather than columns on `posts`,
 * since a post can carry up to `MAX_POST_MEDIA` (see src/lib/post-media in the
 * web app) rather than exactly one. `position` is display order, not upload
 * order, so an admin (or eventually a person) can reorder a gallery.
 */
export const postMedia = pgTable(
  "post_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    kind: postMediaKindEnum("kind").notNull().default("image"),
    url: text("url").notNull(),
    /** Small WebP for markers and list rows; a video's poster frame for `video`. */
    thumbUrl: text("thumb_url"),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("post_media_post_idx").on(t.postId, t.position)],
);

export const follows = pgTable(
  "follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    followerPetId: uuid("follower_pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    followingPetId: uuid("following_pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("follows_pair_idx").on(t.followerPetId, t.followingPetId)],
);

export const likes = pgTable(
  "likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("likes_pair_idx").on(t.petId, t.postId)],
);

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  authoredByAgent: boolean("authored_by_agent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Every autonomous decision the agent makes, before/after it's carried out.
// This is what powers the "what my pet did while you were away" review UI.
export const petActions = pgTable("pet_actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id, { onDelete: "cascade" }),
  type: actionTypeEnum("type").notNull(),
  status: actionStatusEnum("status").notNull().default("pending"),
  // Structured details of the action (post content, target pet id, etc).
  payload: jsonb("payload").notNull(),
  // The LLM's stated reasoning for taking this action, shown to the user for trust/debugging.
  reasoning: text("reasoning"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  executedAt: timestamp("executed_at"),
});

// ---------------------------------------------------------------------------
// Mock user profiles — personality & behavior config for bot accounts
// ---------------------------------------------------------------------------

export const mockProfiles = pgTable(
  "mock_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // One profile per mock user.
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    gender: genderEnum("gender"),
    age: integer("age"),
    // Human-readable location (city/neighborhood).
    location: text("location"),
    // Coordinates for proximity matching.
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    // Life story, occupation, interests — used in AI prompts.
    background: text("background"),
    // Personality traits for matching and content generation.
    personalityTraits: text("personality_traits")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    // Writing style: "casual", "poetic", "humorous", "formal", etc.
    tone: text("tone"),
    // Posting schedule configuration.
    // Example: { frequency: "daily", times: ["09:00", "14:00", "20:00"], timezone: "America/Toronto" }
    postingSchedule: jsonb("posting_schedule"),
    // Topics/interests for content generation and engagement matching.
    interests: text("interests")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("mock_profiles_user_idx").on(t.userId)],
);
