// Onboarding rules and option lists shared by the API (validation) and the
// apps (UI + routing). Dependency-free.

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

// Bump when the terms or privacy policy change materially; users who accepted
// an older version are asked again.
export const TERMS_VERSION = "2026-09-15";

// ---------------------------------------------------------------------------
// Birthday / age gate
// ---------------------------------------------------------------------------

export const MIN_AGE = 18;

// Parses a strict YYYY-MM-DD calendar date (rejects e.g. 2001-02-30).
export function parseBirthday(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

export function getAge(birthday: Date, now = new Date()): number {
  let age = now.getUTCFullYear() - birthday.getUTCFullYear();
  const beforeBirthdayThisYear =
    now.getUTCMonth() < birthday.getUTCMonth() ||
    (now.getUTCMonth() === birthday.getUTCMonth() && now.getUTCDate() < birthday.getUTCDate());
  if (beforeBirthdayThisYear) age -= 1;
  return age;
}

// ---------------------------------------------------------------------------
// Gender
// ---------------------------------------------------------------------------

export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export type Gender = (typeof GENDERS)[number]["value"];

// ---------------------------------------------------------------------------
// Nickname (@username)
// ---------------------------------------------------------------------------

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

// Handles that could impersonate the service or staff, or collide with routes.
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "root", "system", "support", "help", "helpdesk",
  "security", "official", "staff", "team", "moderator", "mod", "tielo", "bsocial",
  "api", "app", "www", "mail", "settings", "account", "login", "signin",
  "signup", "logout", "about", "terms", "privacy", "explore", "home",
  "notifications", "search", "me", "you", "null", "undefined", "anonymous",
  "pet", "pets", "claude", "anthropic",
]);

export type UsernameError = "too_short" | "too_long" | "invalid_characters" | "invalid_format" | "reserved";

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

// Letters, numbers, underscores and periods; must start with a letter or
// number; no consecutive or trailing periods (so "@name." reads cleanly).
export function validateUsername(value: string): UsernameError | null {
  const u = normalizeUsername(value);
  if (u.length < USERNAME_MIN) return "too_short";
  if (u.length > USERNAME_MAX) return "too_long";
  if (!/^[a-z0-9._]+$/.test(u)) return "invalid_characters";
  if (!/^[a-z0-9]/.test(u) || u.endsWith(".") || u.includes("..")) return "invalid_format";
  if (RESERVED_USERNAMES.has(u)) return "reserved";
  return null;
}

export const USERNAME_ERROR_MESSAGES: Record<UsernameError | "taken", string> = {
  too_short: `At least ${USERNAME_MIN} characters`,
  too_long: `At most ${USERNAME_MAX} characters`,
  invalid_characters: "Only letters, numbers, _ and .",
  invalid_format: "Must start with a letter or number, and can't end with or repeat a period",
  reserved: "This nickname isn't available",
  taken: "This nickname is taken",
};

// ---------------------------------------------------------------------------
// Display name
// ---------------------------------------------------------------------------

export const DISPLAY_NAME_MAX = 50;

// Display names are optional; show the @handle when there isn't one.
export function getDisplayName(user: { name?: string | null; username?: string | null }): string {
  return user.name?.trim() || (user.username ? `@${user.username}` : "");
}

// ---------------------------------------------------------------------------
// Interests
// ---------------------------------------------------------------------------

export const INTERESTS = [
  { value: "music", label: "Music", emoji: "🎵" },
  { value: "movies", label: "Movies & TV", emoji: "🎬" },
  { value: "gaming", label: "Gaming", emoji: "🎮" },
  { value: "sports", label: "Sports", emoji: "⚽" },
  { value: "fitness", label: "Fitness", emoji: "💪" },
  { value: "food", label: "Food", emoji: "🍜" },
  { value: "travel", label: "Travel", emoji: "✈️" },
  { value: "fashion", label: "Fashion", emoji: "👗" },
  { value: "art", label: "Art & Design", emoji: "🎨" },
  { value: "photography", label: "Photography", emoji: "📷" },
  { value: "books", label: "Books", emoji: "📚" },
  { value: "tech", label: "Tech", emoji: "💻" },
  { value: "science", label: "Science", emoji: "🔬" },
  { value: "nature", label: "Nature", emoji: "🌿" },
  { value: "animals", label: "Animals", emoji: "🐾" },
  { value: "humor", label: "Memes & Humor", emoji: "😂" },
  { value: "anime", label: "Anime", emoji: "🌸" },
  { value: "cars", label: "Cars", emoji: "🚗" },
  { value: "finance", label: "Money & Finance", emoji: "📈" },
  { value: "wellness", label: "Wellness", emoji: "🧘" },
] as const;

export type Interest = (typeof INTERESTS)[number]["value"];
export const MIN_INTERESTS = 3;
export const MAX_INTERESTS = 10;

// ---------------------------------------------------------------------------
// Pet
// ---------------------------------------------------------------------------

// Three companions, each with its own 3D model and way of moving on the map.
export const PET_SPECIES = [
  { value: "cockatiel", label: "Cockatiel", moves: "Flies", names: ["Mochi", "Kiwi", "Pip", "Sunny", "Peaches"] },
  { value: "bunny", label: "Bunny", moves: "Hops", names: ["Biscuit", "Clover", "Momo", "Hazel", "Pudding"] },
  { value: "cat", label: "Cat", moves: "Trots", names: ["Miso", "Pepper", "Luna", "Tofu", "Maple"] },
  { value: "puppy", label: "Puppy", moves: "Runs", names: ["Bao", "Nori", "Suki", "Waffle", "Coco"] },
] as const;

export type PetSpecies = (typeof PET_SPECIES)[number]["value"];

export function getPetSpecies(value: string) {
  return PET_SPECIES.find((s) => s.value === value) ?? PET_SPECIES[0];
}

export const PET_TRAITS = [
  "playful", "witty", "kind", "curious", "chill", "dramatic",
  "sarcastic", "wholesome", "nerdy", "adventurous", "shy", "bold",
] as const;

export type PetTrait = (typeof PET_TRAITS)[number];
// Personality traits are optional.
export const MIN_PET_TRAITS = 0;
export const MAX_PET_TRAITS = 3;
export const PET_NAME_MAX = 30;

// Autonomy limits, over a rolling 24h window (timezone-independent, no
// midnight burst). Checked before calling the model, so capped pets cost nothing.
export const PET_DEFAULT_MAX_ACTIONS_PER_DAY = 5;
// Posts are the most visible action; cap them separately.
export const PET_MAX_POSTS_PER_DAY = 1;
// Comments are AI-written and visible on others' posts; cap them too.
export const PET_MAX_COMMENTS_PER_DAY = 2;
export const PET_ACTION_WINDOW_HOURS = 24;
// A pet only acts while its owner has been active in the app recently; after
// this many days without the owner opening the app, the pet goes quiet.
export const PET_OWNER_INACTIVE_DAYS = 7;
export const PET_BIO_MAX = 300;

// ---------------------------------------------------------------------------
// Step machine
// ---------------------------------------------------------------------------

// Required steps come first; contacts and calendar are optional (skippable)
// but still shown once, right after the required steps.
export const ONBOARDING_STEPS = [
  "terms",
  "birthday",
  "gender",
  // Nickname (@username, required) + display name and photo (optional).
  "profile",
  "interests",
  "pet",
  "notifications",
  "contacts",
  "calendar",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingState = {
  termsVersion: string | null;
  birthday: string | null;
  gender: Gender | null;
  username: string | null;
  name: string | null;
  interests: string[];
  hasPet: boolean;
  notificationsPromptedAt: string | null;
  contactsPromptedAt: string | null;
  calendarPromptedAt: string | null;
};

// Next step still to do, or null when onboarding is finished.
export function getNextOnboardingStep(s: OnboardingState): OnboardingStep | null {
  const done: Record<OnboardingStep, boolean> = {
    terms: s.termsVersion === TERMS_VERSION,
    birthday: !!s.birthday,
    gender: !!s.gender,
    profile: !!s.username,
    interests: s.interests.length >= MIN_INTERESTS,
    pet: s.hasPet,
    notifications: !!s.notificationsPromptedAt,
    contacts: !!s.contactsPromptedAt,
    calendar: !!s.calendarPromptedAt,
  };
  return ONBOARDING_STEPS.find((step) => !done[step]) ?? null;
}
