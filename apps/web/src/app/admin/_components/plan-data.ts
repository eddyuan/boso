/**
 * The build plan for /admin/roadmap.
 *
 * Ordered by the loop each phase closes, not by feature theme. The reasoning:
 * Tielo doesn't lack features, it has loops that dead-end. A pet acts, logs a
 * decision — and you can't approve it, can't like the reply, can't see who
 * looked. Adding points and levels on top of that is a scoreboard for a game
 * with no ball. So the order is: fill the world, close the loop, earn the
 * return, then give long-term players something to chase.
 *
 * Every item records what already exists in the codebase, because a surprising
 * amount of this is half-built — schema shipped, UI missing.
 */

export type Effort = "S" | "M" | "L";

export type Status =
  /**
   * Built, type-checked and verified against the real database. Not the same as
   * proven in production: nothing scheduled has run under a live Inngest
   * scheduler yet, and no mobile screen here has been looked at on a device.
   * See "Known gaps" in OVERVIEW.md before treating one of these as done.
   */
  | "shipped"
  /** Everything it depends on exists; can be picked up today. */
  | "ready"
  /** Waiting on an earlier item. */
  | "blocked"
  /**
   * Not blocked by code — blocked on something only a person can supply: a
   * credential, legal copy, artwork, or a decision. Distinct from "ready"
   * because nobody can pick these up, and from "blocked" because no amount of
   * building the rest of the plan will clear them.
   */
  | "needs-input";

export type Item = {
  id: string;
  title: string;
  /** One line: what the user gets. */
  summary: string;
  /** Why this earns engagement — the argument for building it at all. */
  why: string;
  effort: Effort;
  /** 1–5. How much this moves "do people want to open the app". */
  impact: number;
  status: Status;
  /** What's already in the repo, so nobody re-derives it. */
  existing?: string[];
  /** The actual work. */
  todo: string[];
  /** Item ids that must land first. */
  needs?: string[];
};

export type Phase = {
  id: string;
  label: string;
  title: string;
  /** The question this phase answers for a user. */
  question: string;
  goal: string;
  /** Why this phase sits here in the order. */
  rationale: string;
  accent: string;
  items: Item[];
};

export const PRINCIPLES: { title: string; body: string }[] = [
  {
    title: "Gate expression, never reach",
    body:
      "Levels may lock cosmetics, treasure tiers, errand range and titles. They must never lock who you can see, meet or talk to. This is a local social app: charging people days of grinding for access to other people attacks the exact thing that would have made them stay.",
  },
  {
    title: "Pay for the behaviour you want to be true",
    body:
      "XP should reward approving what your pet decided and meeting other pets — the distinctive moments. Daily care is a habit floor worth a few points, not the main earner. If tapping a food bowl is the fastest way to level, that becomes the game.",
  },
  {
    title: "Bots fill the room, never the friendship",
    body:
      "Seeded accounts may make a neighbourhood look inhabited — posts, park crowds, leaderboard texture. They must never be the other half of a reciprocal bond: no playdates, best-friend bonds or gifts with a bot. The product promise is real people only.",
  },
  {
    title: "Levels never decay. Mood does.",
    body:
      "Progress you earned is permanent, so leaving for two weeks is never punished. Mood is the thing that droops and recovers — it creates the tug to return without ever taking something away.",
  },
];

export const PHASES: Phase[] = [
  // -------------------------------------------------------------------------
  {
    id: "phase-0",
    label: "Track 0",
    title: "Can't ship without these",
    question: "Does the app work at all on a phone?",
    goal: "Remove the things that block a real launch, regardless of engagement.",
    rationale:
      "Runs in parallel with everything else. It's on the board so it competes honestly — a roadmap of only growth features quietly lets growth features win, and right now the main tab doesn't work on the platform most people will use.",
    accent: "#d9453f",
    items: [
      {
        id: "native-map",
        title: "Native map",
        summary: "The Map tab — the app's home screen — only works on web today.",
        why:
          "Everything downstream of the map (errands, parks, playdates, treasures) is decoration on a screen most users can't load. This is the single largest gap between the app as designed and the app as shipped.",
        effort: "L",
        impact: 5,
        status: "needs-input",
        existing: [
          "Web/Expo-web map is complete: Mapbox GL + three.js pet, markers, wander",
          "map-view.tsx is already a platform-split placeholder with a shared contract",
          "All four .glb companions ship in apps/mobile/assets/models",
        ],
        todo: [
          "Development build with @rnmapbox/maps (Expo Go can't load it)",
          "Mapbox secret download token (sk.…, DOWNLOADS:READ) in the build",
          "ModelLayer placement; no glTF animation on native, so glide/turn/bob",
          "Decide the native fallback for the two-pass x-ray render",
        ],
      },
      {
        id: "legal",
        title: "Terms & privacy pages",
        summary: "Both URLs are placeholders; the pages don't exist.",
        why: "Onboarding step 1 links to them and app review will check. Cheap, and it blocks submission.",
        effort: "S",
        impact: 2,
        status: "needs-input",
        existing: ["EXPO_PUBLIC_TERMS_URL / PRIVACY_URL already wired into onboarding"],
        todo: ["Write both pages", "Host them", "Point TERMS_VERSION at the published revision"],
      },
      {
        id: "calendar",
        title: "Use or drop the calendar permission",
        summary: "Onboarding asks for calendar access and nothing reads it.",
        why:
          "An unused sensitive permission is a straightforward app-review rejection, and it costs trust in the one flow where you're asking people to trust an autonomous agent.",
        effort: "S",
        impact: 2,
        status: "needs-input",
        existing: ["Step 9 requests it and records calendarPromptedAt"],
        todo: ["Either ship a feature that uses it, or delete the step and the permission"],
      },
      {
        id: "photo-picker",
        title: "Photo picker in compose",
        summary: "People can't attach photos to their own posts.",
        why:
          "The map is a wall of photo markers; a text-only post is close to invisible on it. Right now only admin tooling can attach media, so real users produce the weakest content on the map.",
        effort: "M",
        impact: 4,
        status: "shipped",
        existing: [
          "POST /api/posts already accepts up to 20 media[]",
          "post_media, galleries and the upload/resize pipeline all shipped",
        ],
        todo: ["expo-image-picker in compose", "An upload endpoint like /api/uploads/avatar", "Reorder + remove before posting"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "phase-1",
    label: "Phase 1",
    title: "Give the map something to show",
    question: "Is there anything here?",
    goal: "A new user's first screen has life on it within 5 km, in any seeded city.",
    rationale:
      "Nothing else matters first. Every engagement mechanic assumes content exists to engage with, and today pets — the majority of activity — don't attach coordinates, so they never appear on the map or in Nearby. The first session is an empty map.",
    accent: "#2f9e5e",
    items: [
      {
        id: "pet-coords",
        title: "Pet posts get coordinates",
        summary: "Pets attach a location to what they write, so their posts land on the map.",
        why:
          "The single highest-leverage change on this board. It turns the map from empty to populated without acquiring one extra user, and every map feature below is dead without it.",
        effort: "S",
        impact: 5,
        status: "shipped",
        existing: [
          "posts.latitude/longitude exist and the map reads them",
          "The wander system already models where a pet roams (5 km leash)",
          "places table is imported and posts can attach to a place",
        ],
        todo: [
          "Planner samples a point from the owner's wander radius when posting",
          "Prefer snapping to a nearby place so posts cluster on real venues",
          "Same for the mock-bot posting path",
        ],
      },
      {
        id: "bots-posting",
        title: "Mock bots actually post",
        summary: "The 8 personas have schedules and voices but never post on their own.",
        why:
          "A neighbourhood needs ambient activity before real users arrive, and this is the only lever that works at zero users. Phase 1 of the bot system shipped months of groundwork and stops one step short of the payoff.",
        effort: "M",
        impact: 5,
        status: "shipped",
        needs: ["pet-coords"],
        existing: [
          "mock_profiles: background, tone, traits, interests, postingSchedule",
          "Admin can already generate + publish a post in a persona's voice, with images",
          "Classification runs on agent posts automatically",
        ],
        todo: [
          "Inngest cron reads postingSchedule and fires per persona",
          "Vary content so one personality doesn't repeat itself",
          "Spread coordinates around the persona's neighbourhood",
        ],
      },
      {
        id: "seed-gaps",
        title: "Seed by coverage, not by guess",
        summary: "Use the admin coverage map to find empty areas and seed them deliberately.",
        why: "Density in the few blocks where users actually are beats a thin scatter across a whole city.",
        effort: "S",
        impact: 3,
        status: "shipped",
        existing: ["/admin/map shows post density, places and stray homes", "Seeding tools and place import already exist"],
        todo: ["Pick launch neighbourhoods", "Seed to a target posts-per-km²", "Re-check coverage after each run"],
      },
      {
        id: "topic-filters",
        title: "Topic filters on feed and map",
        summary: "Browse by what posts are about, using the topics already being extracted.",
        why:
          "Makes a thin feed feel deliberate instead of sparse — a person who cares about food sees a food map, not four random posts. Pure presentation over data already collected.",
        effort: "S",
        impact: 3,
        status: "shipped",
        existing: [
          "Every post is classified into topics automatically",
          "topics table ranks by popularity; post_topics is indexed for lookup",
        ],
        todo: ["Topic chips on Feed", "Filter map markers by topic", "Only surface topics past the promotion threshold"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "phase-2",
    label: "Phase 2",
    title: "Make actions have consequences",
    question: "Does anything I do matter?",
    goal: "Every loop in the app closes: you can react, approve, and see that you were seen.",
    rationale:
      "This is the actual engagement bug. The pet does something interesting, and then every thread dead-ends — you can't like the reply, can't approve the ask, can't see who looked at your post. All three have shipped schemas and missing UI, which makes this the cheapest real engagement work available.",
    accent: "#2f7bea",
    items: [
      {
        id: "like-comment",
        title: "Likes and threaded replies",
        summary: "React to posts and hold a conversation under them.",
        why:
          "The core dopamine moment of any social app, and the payoff for the product's best trick: your pet wrote something charming and a stranger replied to it. Today the feed shows a like count nobody can increment.",
        effort: "M",
        impact: 5,
        status: "shipped",
        existing: [
          "likes and comment_likes tables shipped",
          "Flat one-level threading shipped: comments.parentId + replyToPetId",
          "post_media.commentId means replies can carry photos",
        ],
        todo: [
          "Like/unlike endpoints for posts and comments",
          "Comment list + composer sheet with @mention rendering",
          "Respect moderation status — no replying under a covered post",
        ],
      },
      {
        id: "approvals",
        title: "Approvals, in the app",
        summary: "Approve or reject what your pet wants to do, with the reasoning shown.",
        why:
          "'Ask me first' is currently a dead end — pending actions pile up and count against the budget with no way to answer them. This is the product's trust ritual and its most distinctive interaction; it's also the natural thing to send a notification about.",
        effort: "M",
        impact: 5,
        status: "shipped",
        existing: [
          "pet_actions stores the full payload and plain-English reasoning",
          "Admins can already approve/reject; executeAction replays the stored decision",
          "Activity tab lists pending items — they just aren't actionable",
        ],
        todo: [
          "User-facing approve/reject endpoint (mirror the admin one)",
          "Approve/reject on the Activity card, showing the draft and the reason",
          "Push when the pet asks, deep-linked to the decision",
        ],
      },
      {
        id: "who-looked",
        title: "Who sniffed around your post",
        summary: "Show the pets that viewed your post.",
        why:
          "Pure curiosity, and the cheapest retention hook on the board — the data is already being written on every pet visit and shown to nobody. 'Three pets sniffed at your post' is a reason to open the app.",
        effort: "S",
        impact: 3,
        status: "shipped",
        existing: ["post_views records a unique row per pet/post on every visit action"],
        todo: ["Viewer list on the post detail sheet", "A weekly line in the diary once that exists"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "phase-3",
    label: "Phase 3",
    title: "Earn the return visit",
    question: "Why would I open this tomorrow?",
    goal: "Something happened while you were away, and you hear about it once — warmly, not naggingly.",
    rationale:
      "Only worth building once the loop closes: a notification that drags someone back to a dead end burns the permission you asked for. Push tokens have been registered this whole time and nothing has ever been sent.",
    accent: "#e8633a",
    items: [
      {
        id: "comeback-push",
        title: "Come-back notifications",
        summary: "'Kiwi made a new friend' — real events, capped and quiet-houred.",
        why:
          "The re-engagement loop, and the only mechanism that reaches someone who has closed the app. Every message points at a real decision the pet made, so it reads as news rather than nagging.",
        effort: "M",
        impact: 5,
        status: "shipped",
        needs: ["approvals"],
        existing: ["Expo push tokens registered per device", "pet_actions is a stream of real, describable events"],
        todo: [
          "Triggers: pending ask, new friendship, gift, long absence",
          "Per-type frequency caps and quiet hours",
          "Deep link to the exact post or decision",
        ],
      },
      {
        id: "diary",
        title: "Pet diary",
        summary: "A nightly auto-written scrapbook of what your pet got up to.",
        why:
          "Turns an audit log into a story worth reading, and it's the most screenshot-able artifact the product can make — which is also how it gets shared. Built entirely from data already stored.",
        effort: "M",
        impact: 4,
        status: "shipped",
        existing: ["Every decision already carries human-readable reasoning", "12 mood art states exist for the illustrations"],
        todo: ["Nightly Inngest job summarising the day", "Shareable card", "Browsable timeline on Profile"],
      },
      {
        id: "digest",
        title: "Morning digest",
        summary: "One friendly recap instead of a dozen buzzes.",
        why: "The respectful default for people who don't want event-by-event pings, and it reuses the diary as its payload.",
        effort: "S",
        impact: 3,
        status: "shipped",
        needs: ["diary", "comeback-push"],
        todo: ["One send at local morning", "Skip quiet nights", "Per-user choice between digest and live pings"],
      },
      {
        id: "mood",
        title: "Mood and energy",
        summary: "A pet that's bright after a good day and mopes when you've been gone.",
        why:
          "The emotional pull for return visits, and the cheapest way to make the companion feel alive rather than mechanical. It must tug, never gate — a sad pet does not lock features.",
        effort: "M",
        impact: 4,
        status: "shipped",
        existing: ["12 mood art states already drawn", "Interaction history is all there in pet_actions"],
        todo: ["Derive mood from recent activity and time since check-in", "Overnight decay", "Show the reason, never just a face"],
      },
      {
        id: "care",
        title: "Daily care",
        summary: "Feed, groom, play — thirty seconds a day.",
        why:
          "A habit floor. Deliberately small: it should be a reason to open the app, not the thing you do once you're there, and it must never gate anything.",
        effort: "S",
        impact: 3,
        status: "shipped",
        needs: ["mood"],
        todo: ["Once-daily actions resetting at midnight", "A short mascot animation each", "Small mood nudge, small XP"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "phase-4",
    label: "Phase 4",
    title: "Give the pets lives of their own",
    question: "Why this app and not any other?",
    goal: "Pets form relationships with each other, and those stories are worth telling people about.",
    rationale:
      "The differentiator, and the reason to build all of the above first: relationships need a populated map (phase 1) and visible interactions (phase 2) before there's anything to form a relationship out of.",
    accent: "#8b5cf6",
    items: [
      {
        id: "relationships",
        title: "Pet relationships",
        summary: "Friendships, rivalries and favourites emerge from repeated interactions.",
        why:
          "Nothing else on this board is hard to copy; this is. It generates stories people screenshot — 'my cockatiel and the dog down the street have a thing going' — entirely out of the decision log you already keep.",
        effort: "L",
        impact: 5,
        status: "shipped",
        needs: ["like-comment", "pet-coords"],
        existing: ["Every interaction between two pets is already logged with a reason"],
        todo: [
          "pet_relationships with an affinity score that decays",
          "Planner weights actions toward and away by affinity",
          "A relationship view: how these two pets got here",
        ],
      },
      {
        id: "playdates",
        title: "Playdates",
        summary: "When two owners are nearby and their pets are friendly, both can opt into a meetup.",
        why:
          "The moment the app stops being parallel play and becomes a reason to be in the same place as someone. Both-opt-in keeps it safe; friendly-pets-first means it's earned, not random.",
        effort: "L",
        impact: 4,
        status: "shipped",
        needs: ["relationships"],
        todo: [
          "Proximity match on owner location plus affinity",
          "Both-opt-in invite, then a shared animation at a meeting point",
          "Co-authored post afterwards",
          "Never with a seeded account — real people only",
        ],
      },
      {
        id: "pet-parks",
        title: "Pet park hotspots",
        summary: "Real parks and cafés become gathering spots with their own local thread.",
        why: "Gives the map destinations instead of scatter, and concentrates thin activity where it reads as busy.",
        effort: "L",
        impact: 4,
        status: "shipped",
        needs: ["pet-coords"],
        existing: ["places table with categories, imported per area"],
        todo: ["Mark hotspots in admin", "Pets path toward them while wandering", "Place-scoped ephemeral thread"],
      },
      {
        id: "errands",
        title: "Fetch errands",
        summary: "Send your pet across the map; it comes back with a bundle of posts.",
        why:
          "Makes the fetch metaphor real. The pet already flies over and brings things back as pure decoration — this is the version you can actually press.",
        effort: "M",
        impact: 4,
        status: "shipped",
        needs: ["pet-coords"],
        existing: ["Wander/flight animation and pathing already implemented on the web map"],
        todo: ["Pick a destination on the map", "Travel + return animation", "Results ranked by interest and topic overlap"],
      },
      {
        id: "whiskers",
        title: "Whiskers — local gossip",
        summary: "Your pet whispers one playful line of real local intel a day.",
        why: "A daily reason to look, written from real nearby activity rather than invented.",
        effort: "M",
        impact: 3,
        status: "shipped",
        needs: ["relationships"],
        todo: ["Nightly digest of local signals", "One AI-written line with its sources", "Tap through to the real posts"],
      },
    ],
  },

  // -------------------------------------------------------------------------
  {
    id: "phase-5",
    label: "Phase 5",
    title: "Give long-term players something to chase",
    question: "What am I working toward?",
    goal: "A progression people stay for, that never costs anyone access to other people.",
    rationale:
      "Last on purpose. An XP curve tuned against guesses is worse than no curve; by this point there's real engagement data to tune against, and — critically — enough in the app that the rewards are worth wanting.",
    accent: "#c98a12",
    items: [
      {
        id: "bond-level",
        title: "Bond level",
        summary: "One permanent level that unlocks expression — never access.",
        why:
          "The spine for cosmetics, treasures and titles. Permanent and non-decaying, so a fortnight away is never punished. It must gate what your pet looks like and can carry, not who you can meet: the earlier draft locked playdates until day 3–4 and Whiskers until day 16, which charges new users for the social access that would have kept them.",
        effort: "L",
        impact: 4,
        status: "shipped",
        needs: ["care", "approvals"],
        todo: [
          "bond_level + XP rules in @bsocial/shared",
          "XP weighted to approvals and social moments; care is a small floor",
          "Level-up moments at real milestones, not every level",
          "Audit every unlock: if it gates reach, move it to level 1",
        ],
      },
      {
        id: "cosmetics",
        title: "Cosmetics",
        summary: "Collars, scarves and hats that render on the 3D companion.",
        why: "The long tail of any collection loop, and the payoff that makes levels worth having. Visible to other people, which is what makes it matter.",
        effort: "L",
        impact: 4,
        status: "needs-input",
        needs: ["bond-level"],
        existing: ["Models expose named nodes (body, crest, earL/R…) that accessories can attach to"],
        todo: ["Inventory + equipped state", "Attach to named glTF nodes", "Show on other people's pets"],
      },
      {
        id: "treasures",
        title: "Wander treasures",
        summary: "Pets bring home neighbourhood trinkets from long wanders.",
        why: "A reason to let the pet roam somewhere new, and a collection tied to actual places rather than abstract points.",
        effort: "M",
        impact: 3,
        status: "shipped",
        needs: ["pet-coords"],
        todo: ["Weighted find per long trip", "Neighbourhood-tagged rarity", "Shelf on Profile"],
      },
      {
        id: "missions",
        title: "Daily missions",
        summary: "Three light goals a day, scored from things already tracked.",
        why: "Orients a session for people who open the app without a reason. Only works once there are enough actions worth setting goals about.",
        effort: "M",
        impact: 3,
        status: "shipped",
        needs: ["like-comment", "bond-level"],
        todo: ["Three a day, mixed fixed and random", "Progress from existing signals", "Rewards feed the cosmetic economy"],
      },
      {
        id: "events",
        title: "Live events and leaderboards",
        summary: "A time-boxed goal a neighbourhood works on together, as one shared bar.",
        why:
          "Time-boxed reasons to return, without the costs of a ranking. A per-area leaderboard would publish who is most active within a small radius (undoing the location blur), make progress relative so one person rises only as another falls, and read as false wherever seeded accounts filled its rungs. A collective bar keeps the pull and has none of those.",
        effort: "L",
        impact: 3,
        status: "shipped",
        needs: ["missions"],
        todo: ["Map decorations (needs 3D art, same dependency as cosmetics)", "Event-only treasure tiers"],
      },
    ],
  },
];

export const ALL_ITEMS: Item[] = PHASES.flatMap((p) => p.items);
export const ITEM_BY_ID = new Map(ALL_ITEMS.map((i) => [i.id, i]));
export const PHASE_OF = new Map(PHASES.flatMap((p) => p.items.map((i) => [i.id, p] as const)));

/** Ready, high-impact and small — what to pick up first. */
/**
 * What to do next — which is now nothing a developer can pick up alone.
 *
 * Every item that was buildable from the code has shipped. What's left is
 * blocked on inputs only a person can supply, so this list is those, ordered by
 * what would unblock the most.
 */
export const START_HERE = ["native-map", "legal", "cosmetics", "calendar"];
