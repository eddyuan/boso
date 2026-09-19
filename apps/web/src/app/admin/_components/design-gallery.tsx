"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Palette, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Phone } from "./design-kit";
import {
  ComposeScreen,
  FeedScreen,
  HatchScreen,
  MapScreen,
  SearchScreen,
  SignInScreen,
} from "./design-screens-today";
import {
  AccessoriesScreen,
  ApprovalsScreen,
  CommentsScreen,
  DiaryScreen,
  ErrandScreen,
  LeaderboardScreen,
  LiveEventScreen,
  MissionsScreen,
  NotificationsScreen,
  PetHomeScreen,
  PetParkScreen,
  PetProfileScreen,
  PlaydateScreen,
  TreasuresScreen,
  WhiskersScreen,
} from "./design-screens-roadmap";
import {
  BondJourneyScreen,
  InviteCatchUpScreen,
  LevelCurveTable,
  LevelUpScreen,
  PetHomeFreshScreen,
  ShelfStatesScreen,
} from "./design-screens-levels";
import type { Effort } from "./plan-data";

type GroupId = "today" | "quick" | "bonding" | "levels" | "map" | "events" | "social" | "comeback";

const GROUPS: Record<GroupId, { label: string; hex: string; soft: string }> = {
  today: { label: "In the app today", hex: "#8A5A00", soft: "#FFF0C2" },
  quick: { label: "Foundation quick wins", hex: "#2F9E5E", soft: "#DDF2E4" },
  bonding: { label: "Pet bonding", hex: "#C98A12", soft: "#FFF0C2" },
  levels: { label: "Bond level system", hex: "#0F8B7D", soft: "#DCF2ED" },
  map: { label: "Map play", hex: "#2F7BEA", soft: "#E2EDFC" },
  events: { label: "Live events & seasons", hex: "#E05780", soft: "#FCE4EE" },
  social: { label: "Pet-to-pet social", hex: "#8B5CF6", soft: "#EDE7FC" },
  comeback: { label: "Come back", hex: "#E8633A", soft: "#FBE3DA" },
};

type Entry = {
  id: string;
  title: string;
  blurb: string;
  group: GroupId;
  effort?: Effort;
  Screen: () => React.ReactElement;
};

const ENTRIES: Entry[] = [
  // today
  { id: "signin", title: "Sign in", blurb: "Email, Google, Apple or phone — with the verified, 18+ promise up front.", group: "today", Screen: SignInScreen },
  { id: "hatch", title: "Hatch your pet", blurb: "Onboarding step 6: crack the egg, meet your species, name them and consent to autonomy.", group: "today", Screen: HatchScreen },
  { id: "map", title: "Map tab", blurb: "The home tab: wandering 3D pet, photo post markers, and the post detail sheet.", group: "today", Screen: MapScreen },
  { id: "feed", title: "Feed", blurb: "Nearby / Following / Discover, with pet and human posts and fetched-for-you labels.", group: "today", Screen: FeedScreen },
  { id: "compose", title: "Compose", blurb: "Post as yourself with a gallery and a place pin, visible within 5 km.", group: "today", Screen: ComposeScreen },
  { id: "search", title: "Search", blurb: "People by name and everyone posting nearby, with shared-interest chips.", group: "today", Screen: SearchScreen },

  // quick wins
  { id: "approvals", title: "Approvals + push", blurb: "Pending asks become first-class cards: the pet's draft, its reasoning, approve or pass.", group: "quick", effort: "M", Screen: ApprovalsScreen },
  { id: "comments", title: "Post & threaded replies", blurb: "The schema exists — this is the like/comment UI with one-level threads and @mentions.", group: "quick", effort: "M", Screen: CommentsScreen },

  // bonding
  { id: "pet-home", title: "Pet home — mood & care", blurb: "Mood and energy with reasons, daily feed/groom/play, and the bond level driving it.", group: "bonding", effort: "M", Screen: PetHomeScreen },
  { id: "accessories", title: "Bond cosmetics", blurb: "Collars unlock early; scarves & hats share one slot that opens together at Level 12.", group: "bonding", effort: "L", Screen: AccessoriesScreen },
  { id: "diary", title: "Pet diary", blurb: "A nightly auto-written scrapbook from the decision log, made to be shared.", group: "bonding", effort: "M", Screen: DiaryScreen },

  // bond level system
  { id: "level-fresh", title: "Level 1 — fresh hatch", blurb: "New-account pet home: feed enabled, care and every roadmap feature shown locked with its level number.", group: "levels", Screen: PetHomeFreshScreen },
  { id: "level-up", title: "Level-up ceremony", blurb: "A pet moment, not a toast: what just unlocked plus a teaser for the next gate. Used at milestones 3/5/7/10/12/15/20.", group: "levels", Screen: LevelUpScreen },
  { id: "level-journey", title: "Bond journey", blurb: "The in-app unlock roadmap: reached, current, next-with-XP-away and far-locked states down one timeline.", group: "levels", Screen: BondJourneyScreen },
  { id: "level-shelf", title: "Shelf unlock states", blurb: "Wearing, available, next-up glowing with progress, and far-locked. Desire is always visible, never hidden.", group: "levels", Screen: ShelfStatesScreen },
  { id: "level-catchup", title: "Friend-invite catch-up", blurb: "The wall-bender: one social gate can open early via a friend's bond invite, so nobody is kept from people.", group: "levels", Screen: InviteCatchUpScreen },

  // map play
  { id: "errand", title: "Fetch errand", blurb: "Send the pet across the map and watch it bring back a ranked bundle of posts.", group: "map", effort: "M", Screen: ErrandScreen },
  { id: "treasures", title: "Treasures & shelf", blurb: "Neighbourhood finds from wandering, with rarity tiers and Pets of Vancouver cards.", group: "map", effort: "M", Screen: TreasuresScreen },
  { id: "pet-park", title: "Pet park hotspot", blurb: "Real places become gathering spots, complete with an ephemeral local thread.", group: "map", effort: "L", Screen: PetParkScreen },

  // events
  { id: "missions", title: "Daily missions", blurb: "Three light goals a day with progress and cosmetic/XP rewards and a streak.", group: "events", effort: "M", Screen: MissionsScreen },
  { id: "leaderboard", title: "Neighbourhood leaderboard", blurb: "Weekly most-social pet per area, with a podium and your own-rank chase card.", group: "events", effort: "M", Screen: LeaderboardScreen },
  { id: "live-event", title: "Weekend live event", blurb: "A rare migratory visitor on the map, countdown banner and event-only quests.", group: "events", effort: "L", Screen: LiveEventScreen },

  // social
  { id: "pet-profile", title: "Pet relationship profile", blurb: "Affinity status, shared moments, and gift / wave / playdate actions between pets.", group: "social", effort: "L", Screen: PetProfileScreen },
  { id: "playdate", title: "Nearby playdate", blurb: "Co-located owners get a both-opt-in invite with a meeting point and time options.", group: "social", effort: "L", Screen: PlaydateScreen },
  { id: "whiskers", title: "Whiskers gossip", blurb: "One playful local-intel card grounded in real nearby posts, with sources linked.", group: "social", effort: "M", Screen: WhiskersScreen },

  // comeback
  { id: "notifications", title: "Smart come-back alerts", blurb: "Event-driven pushes with caps and quiet hours, plus the morning digest preview.", group: "comeback", effort: "M", Screen: NotificationsScreen },
];

const FILTERS: { id: GroupId | "all"; label: string }[] = [
  { id: "all", label: "All screens" },
  { id: "today", label: "Today" },
  { id: "quick", label: "Quick wins" },
  { id: "bonding", label: "Bonding" },
  { id: "levels", label: "Levels" },
  { id: "map", label: "Map play" },
  { id: "events", label: "Events" },
  { id: "social", label: "Pet-to-pet" },
  { id: "comeback", label: "Come back" },
];

export function DesignGallery() {
  const [filter, setFilter] = useState<GroupId | "all">("all");

  const visible = useMemo(
    () => (filter === "all" ? ENTRIES : ENTRIES.filter((e) => e.group === filter)),
    [filter],
  );

  const orderedGroups = useMemo(() => {
    const ids = new Set(visible.map((e) => e.group));
    return (Object.keys(GROUPS) as GroupId[]).filter((g) => ids.has(g));
  }, [visible]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
            <Palette className="h-5 w-5 text-primary-ink" />
            App design
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The full Tielo app as screen designs — what exists today plus the roadmap ideas, all in the
            cream-and-gold product language. Designs only; nothing here is wired up.
          </p>
        </div>
        <Link
          href="/admin/roadmap"
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-[12.5px] font-extrabold text-foreground transition-colors hover:bg-accent"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary-ink" />
          See the feature graph
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Filters */}
      <div className="sticky top-0 z-30 -mx-1 mt-5 flex gap-1.5 overflow-x-auto px-1 py-2 [scrollbar-width:none]">
        {FILTERS.map((f) => {
          const on = filter === f.id;
          const g = f.id === "all" ? null : GROUPS[f.id];
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-bold transition-colors",
                on ? "border-transparent text-white" : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
              style={on ? { backgroundColor: g?.hex ?? "#2B1F16" } : undefined}
              aria-pressed={on}
            >
              {g && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: on ? "#FFFFFF" : g.hex }} />}
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Sections */}
      <div className="mt-4 space-y-14">
        {orderedGroups.map((gid) => {
          const g = GROUPS[gid];
          const entries = visible.filter((e) => e.group === gid);
          return (
            <section key={gid}>
              <div className="mb-7 flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: g.hex }} />
                <h2 className="font-display text-[17px] font-semibold tracking-tight">{g.label}</h2>
                <span className="rounded-full px-2 py-0.5 text-[11px] font-extrabold" style={{ background: g.soft, color: g.hex }}>
                  {entries.length}
                </span>
                <span className="h-px flex-1" style={{ background: "var(--border)" }} />
              </div>

              {gid === "levels" && (
                <div className="mb-12">
                  <LevelCurveTable />
                </div>
              )}

              <div className="grid grid-cols-1 justify-items-center gap-x-8 gap-y-12 sm:justify-items-start md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {entries.map((e) => (
                  <figure key={e.id} className="group w-[320px]">
                    <div className="transition-transform duration-300 group-hover:-translate-y-1.5">
                      <Phone>
                        <e.Screen />
                      </Phone>
                    </div>
                    <figcaption className="mt-4 px-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
                          style={{ background: g.soft, color: g.hex }}
                        >
                          {e.group === "today" ? "Shipped" : e.group === "levels" ? "System" : "Idea"}
                        </span>
                        {e.effort && (
                          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">
                            {e.effort} effort
                          </span>
                        )}
                      </div>
                      <p className="mt-1.5 font-display text-[15px] font-semibold leading-tight">{e.title}</p>
                      <p className="mt-1 text-[12.5px] font-semibold leading-snug text-muted-foreground">{e.blurb}</p>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <p className="mt-14 rounded-2xl border border-border bg-card p-4 text-[12.5px] font-semibold leading-relaxed text-muted-foreground">
        These are static design renders for direction and critique — photo tiles use generated placeholder
        imagery. Once an idea is approved on the{" "}
        <Link href="/admin/roadmap" className="font-extrabold text-primary-ink underline underline-offset-2">
          roadmap board
        </Link>
        , it gets specced against the real schema and Inngest loop.
      </p>
    </div>
  );
}
