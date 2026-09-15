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
} from "drizzle-orm/pg-core";

export const actionTypeEnum = pgEnum("action_type", [
  "post",
  "follow",
  "like",
  "comment",
]);

export const actionStatusEnum = pgEnum("action_status", [
  "pending", // awaiting user approval
  "approved",
  "rejected",
  "executed",
  "failed",
]);

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
  // Last authenticated API request from any device (throttled, see apps/web/src/lib/session.ts)
  lastActiveAt: timestamp("last_active_at"),
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
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  // Free-text description of voice/interests fed into the agent's system prompt.
  personality: text("personality").notNull().default(""),
  // If true, pet actions post immediately; if false, they queue as "pending" for user review.
  autoApprove: boolean("auto_approve").notNull().default(false),
  maxActionsPerDay: text("max_actions_per_day").notNull().default("2"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  // Whether a human wrote this or the agent generated it (for transparency in the UI).
  authoredByAgent: boolean("authored_by_agent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
