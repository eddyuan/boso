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
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const actionTypeEnum = pgEnum("action_type", [
  "post",
  "follow",
  "like",
  "comment",
  "visit", // pet viewed a post (post_views)
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

// Content classification ladder — rules live in @bsocial/shared/moderation.
export const moderationStatusEnum = pgEnum("moderation_status", [
  "pending",
  "approved",
  "sensitive",
  "restricted",
  "pending_review",
  "blocked",
]);

export const topicStatusEnum = pgEnum("topic_status", ["auto", "approved", "hidden"]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "pet_ask", // an "ask me first" pet wants permission
  "pet_friend", // someone's pet followed yours
  "pet_reply", // a pet replied to your post
  "quiet_return", // you've been away a while and something happened
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
  /**
   * Opt-in to seeing `sensitive` posts without the tap-to-reveal cover. Off by
   * default and only surfaced in profile settings — never prompted for.
   */
  showSensitiveContent: boolean("show_sensitive_content").notNull().default(false),

  /**
   * Where the person is now, coarse (3dp, ~110 m) and overwritten rather than
   * journaled — we keep a position, never a history. Used for proximity
   * queries and as the anchor a pet's posts are shifted from; never published
   * directly (see apps/web/src/lib/pet-location.ts).
   */
  lastLatitude: doublePrecision("last_latitude"),
  lastLongitude: doublePrecision("last_longitude"),
  lastLocationAt: timestamp("last_location_at"),

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
  /** Bond XP. Levels are derived from it and never decay (see @bsocial/shared/bond). */
  bondXp: integer("bond_xp").notNull().default(0),
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
    /** Marked in admin: pets path toward these and they carry a local thread. */
    isHotspot: boolean("is_hotspot").notNull().default(false),
    /**
     * Photo handles from the provider, captured during the place import because
     * they arrive in the same (already-billed) response — fetching the images
     * themselves is a separate charge, so that happens later and only for venues
     * somebody actually looks at. Shape: { name, attribution }[].
     */
    photoRefs: jsonb("photo_refs"),
    /** Set once we've tried to turn refs into stored images, so we try once. */
    photosFetchedAt: timestamp("photos_fetched_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("places_source_idx").on(t.source, t.sourceId),
    index("places_latlng_idx").on(t.latitude, t.longitude),
  ],
);

/**
 * Venue photos, re-encoded and held in our own bucket.
 *
 * Attribution travels with every row. The provider requires it to be shown
 * wherever the photo appears, and a photo whose credit has been lost can't be
 * displayed correctly later — so it's stored alongside rather than derived.
 */
export const placePhotos = pgTable(
  "place_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    placeId: uuid("place_id")
      .notNull()
      .references(() => places.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    thumbUrl: text("thumb_url").notNull(),
    width: integer("width"),
    height: integer("height"),
    /** Who took it, as the provider reported it. */
    attribution: text("attribution"),
    /** The provider's photo handle, so the same photo isn't stored twice. */
    sourceName: text("source_name"),
    /** Display order, 0 first. */
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("place_photos_place_idx").on(t.placeId, t.position),
    uniqueIndex("place_photos_source_idx").on(t.placeId, t.sourceName),
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
  /**
   * Set by an admin to take a post out of circulation without deleting it —
   * every read path (feed, map, search, pet candidates) filters these out.
   * Kept rather than deleted so a moderation call can be reversed and reviewed.
   */
  hiddenAt: timestamp("hidden_at"),
  /**
   * Set by the classification job (lib/classify.ts). `hiddenAt` stays separate:
   * that's an admin's manual override, this is the pipeline's own verdict, and
   * a reader needs both to come out clean.
   */
  moderationStatus: moderationStatusEnum("moderation_status").notNull().default("pending"),
  /** Raw per-category confidences, kept so thresholds can move without re-running the model. */
  moderationScores: jsonb("moderation_scores"),
  /** The categories that tripped — drives the label on the blur cover. */
  sensitiveCategories: text("sensitive_categories").array().notNull().default(sql`'{}'::text[]`),
  moderatedAt: timestamp("moderated_at"),
  moderationModel: text("moderation_model"),
  // Human review outcome, when a post went through the admin queue.
  reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const postMediaKindEnum = pgEnum("post_media_kind", ["image", "video"]);

/**
 * A post's (or comment's) photos/videos — a separate table rather than
 * columns on `posts`, since a post can carry up to `MAX_POST_MEDIA` (see
 * src/lib/post-media in the web app) rather than exactly one. `position` is
 * display order, not upload order, so an admin (or eventually a person) can
 * reorder a gallery. Exactly one of `postId` / `commentId` is set.
 */
export const postMedia = pgTable(
  "post_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id").references(() => posts.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id").references(() => comments.id, { onDelete: "cascade" }),
    kind: postMediaKindEnum("kind").notNull().default("image"),
    url: text("url").notNull(),
    /** Small WebP for markers and list rows; a video's poster frame for `video`. */
    thumbUrl: text("thumb_url"),
    position: integer("position").notNull().default(0),
    /** Per-image scores: one bad photo in a gallery blurs itself, not the post. */
    moderationScores: jsonb("moderation_scores"),
    blurred: boolean("blurred").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("post_media_post_idx").on(t.postId, t.position),
    index("post_media_comment_idx").on(t.commentId, t.position),
    check("post_media_one_owner", sql`(${t.postId} is null) != (${t.commentId} is null)`),
  ],
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

// A pet visiting (viewing) a post — powers "who viewed your post".
export const postViews = pgTable(
  "post_views",
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
  (t) => [uniqueIndex("post_views_pair_idx").on(t.petId, t.postId)],
);

/**
 * Flat, one-level threading (Instagram/Tieba-style): every reply's `parentId`
 * points at the top-level comment of its thread, never at another reply, so a
 * thread never gets deeper than two levels. `replyToPetId` records who a
 * specific reply is addressed to (for an "@Name" prefix) without changing
 * where it sits in the thread — so replying to a reply still attaches to the
 * same top-level comment, just @-mentioning that reply's author.
 */
export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  postId: uuid("post_id")
    .notNull()
    .references(() => posts.id, { onDelete: "cascade" }),
  petId: uuid("pet_id")
    .notNull()
    .references(() => pets.id, { onDelete: "cascade" }),
  // Null for a top-level comment; the top-level comment's id for every reply in its thread.
  parentId: uuid("parent_id").references((): AnyPgColumn => comments.id, { onDelete: "cascade" }),
  // Who this reply @-mentions, when it's replying to another reply rather than the thread starter.
  replyToPetId: uuid("reply_to_pet_id").references(() => pets.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  authoredByAgent: boolean("authored_by_agent").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const commentLikes = pgTable(
  "comment_likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    commentId: uuid("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("comment_likes_pair_idx").on(t.petId, t.commentId)],
);

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

// ---------------------------------------------------------------------------
// Runtime settings — admin-flippable switches that must not need a redeploy
// ---------------------------------------------------------------------------

/**
 * Small key/value store for operational flags (currently the pet-loop kill
 * switch). Separate from env vars because an admin has to be able to stop the
 * agents from the panel at 3am, which a redeploy cannot do quickly enough.
 */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// Topics — the fine layer under the 20 onboarding interests
// ---------------------------------------------------------------------------

/**
 * One row per distinct topic. The classifier creates these on the fly, so the
 * vocabulary grows with what people actually post about; `status` keeps a topic
 * out of the UI until it's popular enough to be worth showing, and `aliasOf`
 * is the cleanup valve for the duplicates that will get through anyway.
 */
export const topics = pgTable(
  "topics",
  {
    slug: text("slug").primaryKey(),
    label: text("label").notNull(),
    /** Parent interest (an INTERESTS value from @bsocial/shared). */
    interest: text("interest").notNull(),
    status: topicStatusEnum("status").notNull().default("auto"),
    /** Points at the canonical topic when an admin merges duplicates. */
    aliasOf: text("alias_of").references((): AnyPgColumn => topics.slug, { onDelete: "set null" }),
    /** Denormalized popularity — what the topic ranking sorts by. */
    postCount: integer("post_count").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("topics_rank_idx").on(t.interest, t.postCount)],
);

export const postTopics = pgTable(
  "post_topics",
  {
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    topic: text("topic")
      .notNull()
      .references(() => topics.slug, { onDelete: "cascade" }),
    confidence: doublePrecision("confidence").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("post_topics_pair_idx").on(t.postId, t.topic),
    index("post_topics_topic_idx").on(t.topic),
  ],
);

/**
 * Interests inferred from what someone actually posts, kept separate from the
 * `users.interests` they picked at onboarding: that list is shown on their
 * profile, and silently rewriting it with guesses would be unexplainable.
 * Matching reads both. Scores decay (see @bsocial/shared/topics).
 */
export const userTopics = pgTable(
  "user_topics",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    topic: text("topic")
      .notNull()
      .references(() => topics.slug, { onDelete: "cascade" }),
    score: doublePrecision("score").notNull().default(0),
    postCount: integer("post_count").notNull().default(0),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("user_topics_pair_idx").on(t.userId, t.topic),
    index("user_topics_rank_idx").on(t.userId, t.score),
  ],
);

/**
 * Every push we've sent. Doubles as the ledger the frequency caps read, which
 * is why it's a table rather than fire-and-forget: without a record there's no
 * way to honour "at most three of these a day" across serverless instances.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    /** Deep-link target and anything the app needs to route, e.g. { actionId }. */
    data: jsonb("data"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_created_idx").on(t.userId, t.createdAt)],
);

/**
 * Daily care: feed, groom, play. One row per action, which makes "already done
 * today" a query rather than a set of columns to reset, and leaves a history
 * worth reading later.
 */
export const petCare = pgTable(
  "pet_care",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    /** A CARE_KINDS value from @bsocial/shared. */
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("pet_care_pet_created_idx").on(t.petId, t.createdAt)],
);

/**
 * One auto-written entry per pet per day, from that day's decision log.
 *
 * pet_actions already stores every choice with a human-readable reason; this
 * turns the log into something worth reading. Stored rather than generated on
 * demand because it's a record of a day that has ended — regenerating it later
 * against a changed model would quietly rewrite someone's history.
 */
export const petDiary = pgTable(
  "pet_diary",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    /** The day being written about, in UTC. */
    day: date("day", { mode: "string" }).notNull(),
    /** A few sentences in the pet's own voice. */
    entry: text("entry").notNull(),
    /** Counts behind the entry: { posts, likes, comments, follows, views }. */
    stats: jsonb("stats"),
    /** Mood score at the time of writing, so the timeline can show the arc. */
    moodScore: integer("mood_score"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pet_diary_day_idx").on(t.petId, t.day)],
);

/**
 * How two pets feel about each other, accumulated from what they actually did.
 *
 * Stored per ordered pair (a→b and b→a are separate rows) because affinity
 * isn't always mutual — one pet can be far keener than the other, and that
 * asymmetry is where the interesting stories come from.
 *
 * `score` rises with interaction and decays with silence, so a friendship that
 * stops being fed fades rather than standing forever.
 */
export const petRelationships = pgTable(
  "pet_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    otherPetId: uuid("other_pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    score: doublePrecision("score").notNull().default(0),
    /** Interactions counted so far, for "you two have met 14 times". */
    interactions: integer("interactions").notNull().default(0),
    lastInteractionAt: timestamp("last_interaction_at"),
    /** When the pair first crossed into being a named friendship. */
    becameFriendsAt: timestamp("became_friends_at"),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("pet_relationships_pair_idx").on(t.petId, t.otherPetId),
    index("pet_relationships_rank_idx").on(t.petId, t.score),
  ],
);

/**
 * One playful line of local intel a day, grounded in real nearby activity.
 *
 * Cached per user per day rather than generated on read: it's the same line all
 * day, and regenerating it on every app open would both cost a model call each
 * time and let the "news" change under someone mid-morning.
 */
export const whiskers = pgTable(
  "whiskers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: date("day", { mode: "string" }).notNull(),
    line: text("line").notNull(),
    /** Post ids behind the line, so it can be tapped through to the truth. */
    sourcePostIds: uuid("source_post_ids").array().notNull().default(sql`'{}'::uuid[]`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("whiskers_day_idx").on(t.userId, t.day)],
);

/** What a pet has brought home. One row per find. */
export const petTreasures = pgTable(
  "pet_treasures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    /** A TREASURES id from @bsocial/shared. */
    kind: text("kind").notNull(),
    /** Where it turned up, so the shelf can say "found near Kits Beach". */
    placeId: uuid("place_id").references(() => places.id, { onDelete: "set null" }),
    foundAt: timestamp("found_at").notNull().defaultNow(),
  },
  (t) => [index("pet_treasures_pet_idx").on(t.petId, t.foundAt)],
);

/** Every XP award, so the bond level can be explained rather than just shown. */
export const bondEvents = pgTable(
  "bond_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    petId: uuid("pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    /** An XP_VALUES key from @bsocial/shared. */
    event: text("event").notNull(),
    amount: integer("amount").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("bond_events_pet_idx").on(t.petId, t.createdAt)],
);

export const playdateStatusEnum = pgEnum("playdate_status", ["proposed", "accepted", "declined", "expired"]);

/**
 * A meetup between two pets whose owners are actually near each other.
 *
 * Both sides must opt in, and a seeded account can never be either side — the
 * product promise is real people only, and a playdate is the most personal
 * place that promise could be broken.
 */
export const playdates = pgTable(
  "playdates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromPetId: uuid("from_pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    toPetId: uuid("to_pet_id")
      .notNull()
      .references(() => pets.id, { onDelete: "cascade" }),
    /** Where they'd meet — a real venue between the two owners. */
    placeId: uuid("place_id").references(() => places.id, { onDelete: "set null" }),
    status: playdateStatusEnum("status").notNull().default("proposed"),
    /** Proposals go stale rather than lingering: proximity was the whole basis. */
    expiresAt: timestamp("expires_at").notNull(),
    respondedAt: timestamp("responded_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("playdates_to_idx").on(t.toPetId, t.status),
    index("playdates_from_idx").on(t.fromPetId, t.status),
  ],
);

export const eventGoalEnum = pgEnum("event_goal", [
  "treasures_found",
  "posts_written",
  "replies_written",
  "playdates_met",
  "places_visited",
]);

/**
 * A time-boxed thing a neighbourhood does together.
 *
 * Deliberately **collective, not competitive**. A ranking would publish a list
 * of the most active accounts within a small radius, which re-introduces exactly
 * the inference the location blur exists to prevent, and rank is relative — for
 * one person to rise another has to fall, while everything else here is absolute
 * (bond XP never decays, missions don't streak, mood always recovers). One
 * shared bar has neither problem: there is no losing position and no directory
 * of who is active near you.
 *
 * Progress is never stored. It's counted from the same rows that already record
 * the activity, so the bar can't disagree with what happened, and an event whose
 * goal can't be counted can't be configured.
 */
export const liveEvents = pgTable(
  "live_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    /** One line shown under the title. */
    blurb: text("blurb"),
    goal: eventGoalEnum("goal").notNull(),
    /** How many, in total, from everyone taking part. */
    target: integer("target").notNull(),
    startsAt: timestamp("starts_at").notNull(),
    endsAt: timestamp("ends_at").notNull(),
    /**
     * Centre of the area taking part, or null for everywhere. A radius without a
     * centre is meaningless, so the two are set together.
     */
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    radiusKm: doublePrecision("radius_km"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("live_events_window_idx").on(t.startsAt, t.endsAt)],
);

/**
 * Which areas we've already asked Google about.
 *
 * Every Places request is billed, and the map asks for venues whenever someone
 * pans somewhere quiet — so without a record of what's been tried, a single user
 * wandering the map could re-buy the same neighbourhood repeatedly. A row is
 * written *before* the fetch rather than after, so two simultaneous requests for
 * the same cell can't both pay for it, and a crashed import doesn't invite a
 * retry that spends again.
 *
 * Keyed by a coarse grid cell rather than an exact viewport: viewports are never
 * twice the same, which would make a cache of them useless.
 */
export const placeImports = pgTable(
  "place_imports",
  {
    /** Grid cell, as "lat,lng" rounded to PLACE_CELL_DEGREES. */
    cell: text("cell").primaryKey(),
    /** Billed requests this cell cost. 0 while claimed but not yet finished. */
    requests: integer("requests").notNull().default(0),
    /** Places written. 0 is a real answer: some areas genuinely have none. */
    found: integer("found").notNull().default(0),
    /** Set when the import finished; null means it was claimed and never completed. */
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("place_imports_created_idx").on(t.createdAt)],
);

export const apiProviderEnum = pgEnum("api_provider", ["google_places", "gemini", "expo_push"]);

/**
 * Every billed call to somebody else's API.
 *
 * Nothing recorded what these cost. A place import, a venue photo, a diary
 * entry, a classification and a whisper are all charged per call, and the only
 * trace was a request count buried in one cell's ledger row — so the first
 * anyone would learn of a runaway was the invoice.
 *
 * One row per call rather than a counter, because the useful questions are
 * shaped per-call ("what did we spend on photos yesterday", "which pet is
 * expensive") and a counter answers none of them. `cost_micros` is stored at
 * call time from the rate table in config: prices change, and a cost recomputed
 * later against today's rates would misreport history.
 */
export const apiCalls = pgTable(
  "api_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: apiProviderEnum("provider").notNull(),
    /** What was called: "nearby_search", "place_details", "place_photo", "text", "image", "object". */
    kind: text("kind").notNull(),
    /** Billed units — usually 1, but a batched call can be worth more. */
    units: integer("units").notNull().default(1),
    /** Millionths of a dollar, so a $0.007 photo is an integer. */
    costMicros: integer("cost_micros").notNull().default(0),
    /** Whether the call came back usable, so failures can be counted separately. */
    ok: boolean("ok").notNull().default(true),
    /** Free-form: the model id, the cell, the place id — whatever helps later. */
    meta: jsonb("meta"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("api_calls_day_idx").on(t.createdAt),
    index("api_calls_provider_idx").on(t.provider, t.createdAt),
  ],
);

/**
 * Who changed which tuning value, when, and what it was before.
 *
 * A live-tuning panel without this makes "why did retention drop on Tuesday"
 * unanswerable — the number that caused it has already been overwritten. The old
 * value is stored alongside the new one so a change can be read, and reverted,
 * without reconstructing it from two rows.
 */
export const configAudit = pgTable(
  "config_audit",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    /** Null when the key had never been set and was running on its default. */
    fromValue: doublePrecision("from_value"),
    toValue: doublePrecision("to_value").notNull(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("config_audit_key_idx").on(t.key, t.createdAt)],
);
