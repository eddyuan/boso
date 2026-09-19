/**
 * Bond Level system designs for /admin/app-design.
 * A single permanent "Bond Level" gates enrichment features (never safety or
 * core expression). This file holds the full 1–20 level curve as DATA, an
 * admin-width curve table, and phone renders of every unlock STATE:
 * fresh-account locked UI, almost-there, shelf locked/equipped, level-up
 * ceremony, the bond-journey roadmap, and the friend-invite catch-up shortcut.
 */

import {
  ArrowLeft,
  Award,
  BookOpen,
  Brush,
  Check,
  Compass,
  Crown,
  Feather,
  Footprints,
  Gamepad2,
  Gem,
  Heart,
  Lock,
  PartyPopper,
  Settings2,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  Soup,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  Avatar,
  Btn,
  C,
  Card,
  Chip,
  IconCircle,
  MapBack,
  PetFace,
  Progress,
  Screen,
  StatusBar,
  TabBar,
} from "./design-kit";

// ---------------------------------------------------------------------------
// Curve data
// ---------------------------------------------------------------------------

export type LevelKind = "core" | "care" | "map" | "social" | "expression" | "community";
export type Ceremony = "toast" | "celebration" | "grand";

export const KIND_STYLE: Record<LevelKind, { label: string; hex: string; soft: string }> = {
  core: { label: "Core", hex: "#8A5A00", soft: "#FFF0C2" },
  care: { label: "Care", hex: "#2F9E5E", soft: "#DDF2E4" },
  map: { label: "Map play", hex: "#2F7BEA", soft: "#E2EDFC" },
  social: { label: "Social", hex: "#8B5CF6", soft: "#EDE7FC" },
  expression: { label: "Expression", hex: "#E05780", soft: "#FCE4EE" },
  community: { label: "Community", hex: "#E8633A", soft: "#FBE3DA" },
};

export type LevelRow = {
  level: number;
  cum: number; // cumulative XP needed to reach this level
  step: number | null; // XP needed from previous level
  pace: string;
  unlock: string;
  kind: LevelKind;
  ceremony: Ceremony;
};

export const LEVELS: LevelRow[] = [
  { level: 1, cum: 0, step: null, pace: "Hatch", unlock: "Map, feed, pet home & feeding — the core loop from second one", kind: "core", ceremony: "grand" },
  { level: 2, cum: 60, step: 60, pace: "~5 min", unlock: "Groom & play daily care; give Kiwi a nickname", kind: "care", ceremony: "toast" },
  { level: 3, cum: 180, step: 120, pace: "Day 1", unlock: "Fetch errands — send Kiwi on short flights (500 m)", kind: "map", ceremony: "celebration" },
  { level: 4, cum: 320, step: 140, pace: "Day 2", unlock: "Treasure shelf — wandering finds start coming home", kind: "map", ceremony: "toast" },
  { level: 5, cum: 470, step: 150, pace: "Day 3–4", unlock: "Pet friends & playdates — relationship profiles and co-located both-opt-in invites", kind: "social", ceremony: "celebration" },
  { level: 6, cum: 640, step: 170, pace: "Day 5", unlock: "Collar slot + two starter collars", kind: "expression", ceremony: "toast" },
  { level: 7, cum: 820, step: 180, pace: "Day 6", unlock: "Pet diary begins — nightly auto-written entries", kind: "core", ceremony: "celebration" },
  { level: 8, cum: 1000, step: 180, pace: "Day 8", unlock: "Pet park hotspots — real gathering places and their local threads", kind: "map", ceremony: "toast" },
  { level: 9, cum: 1230, step: 230, pace: "Day 10", unlock: "Errand range extends to 1 km; fetch bundles grow to 4 posts", kind: "map", ceremony: "toast" },
  { level: 10, cum: 1480, step: 250, pace: "~2 weeks", unlock: "Bigger fetch bundles (5 posts); flight replay in the diary", kind: "map", ceremony: "celebration" },
  { level: 11, cum: 1780, step: 300, pace: "Day 16", unlock: "Whiskers — the daily local-gossip card in the feed", kind: "social", ceremony: "toast" },
  { level: 12, cum: 2130, step: 350, pace: "~2.5 weeks", unlock: "Scarves & hats unlock together; Epic treasures can appear on long wanders", kind: "expression", ceremony: "celebration" },
  { level: 13, cum: 2530, step: 400, pace: "~3 weeks", unlock: "Diary share-card styles (3 templates)", kind: "expression", ceremony: "toast" },
  { level: 14, cum: 2980, step: 450, pace: "~3.5 weeks", unlock: "Host a pet-park gathering at a real place", kind: "community", ceremony: "toast" },
  { level: 15, cum: 3480, step: 500, pace: "~1 month", unlock: "Legendary treasure tier; custom shelf themes", kind: "map", ceremony: "celebration" },
  { level: 16, cum: 4080, step: 600, pace: "~5 weeks", unlock: "Errands reach 3 km with multi-stop flights", kind: "map", ceremony: "toast" },
  { level: 17, cum: 4780, step: 700, pace: "~6 weeks", unlock: "Friendship titles & best-friend bonds", kind: "social", ceremony: "toast" },
  { level: 18, cum: 5580, step: 800, pace: "~7 weeks", unlock: "Co-host weekend events; pin one local thread", kind: "community", ceremony: "toast" },
  { level: 19, cum: 6480, step: 900, pace: "~8 weeks", unlock: "Season-veteran badge & legacy cosmetics kept forever", kind: "expression", ceremony: "toast" },
  { level: 20, cum: 7500, step: 1020, pace: "~9–10 weeks", unlock: "Elder Bond — mentor gifts for new pets & the Elder crown", kind: "social", ceremony: "grand" },
];

export const XP_SOURCES: { label: string; xp: string }[] = [
  { label: "Feed Kiwi", xp: "+15" },
  { label: "Groom", xp: "+15" },
  { label: "Play", xp: "+20" },
  { label: "Answer an approval", xp: "+10" },
  { label: "Errand returned", xp: "+30" },
  { label: "Read last night's diary", xp: "+10" },
  { label: "Playdate together", xp: "+40" },
  { label: "Event quest", xp: "+50" },
  { label: "Kiwi's own finds & friends (banked)", xp: "+10–40" },
];

const NEVER_GATED = ["Map & feed", "Posting", "Pet autonomy + approvals", "Safety & consent settings"];

const CEREMONY_META: Record<Ceremony, { label: string; hex: string; soft: string }> = {
  toast: { label: "Toast", hex: "#7D6B5B", soft: "#F7EADA" },
  celebration: { label: "Celebration", hex: "#C98A12", soft: "#FFF0C2" },
  grand: { label: "Full ceremony", hex: "#E05780", soft: "#FCE4EE" },
};

// ---------------------------------------------------------------------------
// Admin-width curve table
// ---------------------------------------------------------------------------

export function LevelCurveTable() {
  return (
    <div className="space-y-4">
      {/* Rule stat tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { k: "20", sub: "Bond levels", icon: <Star className="h-4 w-4" /> },
          { k: "~9–10 wks", sub: "Casual pace to max", icon: <TrendingUp className="h-4 w-4" /> },
          { k: "150 / day", sub: "XP cap, mixed actions", icon: <Zap className="h-4 w-4" /> },
          { k: "Never", sub: "Levels decay. Mood does.", icon: <ShieldCheck className="h-4 w-4" /> },
        ].map((s) => (
          <div key={s.sub} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-ink">
              {s.icon}
            </span>
            <div className="leading-tight">
              <p className="font-display text-[15px] font-semibold">{s.k}</p>
              <p className="text-[11.5px] font-semibold text-muted-foreground">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* XP sources */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-[11px] font-extrabold uppercase tracking-widest text-muted-foreground">
          XP sources · roughly half should arrive while the user is away
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {XP_SOURCES.map((s) => (
            <span
              key={s.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-[12px] font-bold"
            >
              {s.label}
              <span className="font-display text-[12px] font-semibold text-primary-ink">{s.xp}</span>
            </span>
          ))}
          <span className="inline-flex items-center rounded-full bg-foreground px-3 py-1.5 text-[12px] font-extrabold text-background">
            cap 150 XP / day
          </span>
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[12px] font-semibold text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Never level-gated:
          {NEVER_GATED.map((n) => (
            <span key={n} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-foreground">
              {n}
            </span>
          ))}
          <span className="text-muted-foreground">· season events stay open to everyone, every time</span>
        </p>
      </div>

      {/* The table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-secondary/60 text-[10.5px] uppercase tracking-widest text-muted-foreground">
                <th className="px-4 py-2.5 font-extrabold">Level</th>
                <th className="px-4 py-2.5 font-extrabold">XP needed</th>
                <th className="px-4 py-2.5 font-extrabold">Typical pace</th>
                <th className="px-4 py-2.5 font-extrabold">Unlock</th>
                <th className="px-4 py-2.5 font-extrabold">Type</th>
                <th className="px-4 py-2.5 font-extrabold">Moment</th>
              </tr>
            </thead>
            <tbody>
              {LEVELS.map((r) => {
                const k = KIND_STYLE[r.kind];
                const cm = CEREMONY_META[r.ceremony];
                return (
                  <tr
                    key={r.level}
                    className="border-b border-border/70 last:border-0"
                    style={
                      r.ceremony === "grand"
                        ? { background: "linear-gradient(90deg, #FFF6E0 0%, #FFFFFF 60%)" }
                        : r.ceremony === "celebration"
                          ? { background: "#FFFBF2" }
                          : undefined
                    }
                  >
                    <td className="px-4 py-2.5">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full font-display text-[13px] font-semibold"
                        style={{
                          background: r.level === 20 ? C.primary : r.ceremony === "grand" ? "#FCE4EE" : C.element,
                          color: C.text,
                        }}
                      >
                        {r.level}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-bold tabular-nums">
                      {r.step === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <>
                          {r.step.toLocaleString()}
                          <span className="block text-[10.5px] font-semibold text-muted-foreground">
                            {r.cum.toLocaleString()} total
                          </span>
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-muted-foreground">{r.pace}</td>
                    <td className="px-4 py-2.5 font-semibold leading-snug">{r.unlock}</td>
                    <td className="px-4 py-2.5">
                      <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-extrabold" style={{ background: k.soft, color: k.hex }}>
                        {k.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-extrabold"
                        style={{ background: cm.soft, color: cm.hex }}
                      >
                        {r.ceremony === "grand" && <Crown className="h-3 w-3" />}
                        {r.ceremony === "celebration" && <Sparkles className="h-3 w-3" />}
                        {cm.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-border bg-secondary/40 px-4 py-2.5 text-[11.5px] font-semibold text-muted-foreground">
          Catch-up valve: a friend&apos;s bond invite can open one social gate early (so nobody is kept from people),
          and the curve bends if a player hasn&apos;t reached Level 5 by day five.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function MockTopBar({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-4 pt-12">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white" style={{ color: C.text, boxShadow: "0 1px 3px rgb(43 31 22 / 0.08)" }}>
        <ArrowLeft className="h-4.5 w-4.5" />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate font-display text-[17px] font-semibold">{title}</p>
        {sub && <p className="truncate text-[10px] font-bold" style={{ color: C.sec }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

const CONFETTI = [
  { left: "8%", top: "12%", c: C.primary, r: "-18deg", s: 7 },
  { left: "22%", top: "8%", c: C.cheek, r: "12deg", s: 5 },
  { left: "78%", top: "10%", c: C.blue, r: "24deg", s: 6 },
  { left: "90%", top: "22%", c: C.green, r: "-10deg", s: 5 },
  { left: "6%", top: "38%", c: C.pink, r: "30deg", s: 6 },
  { left: "93%", top: "46%", c: C.primary, r: "-26deg", s: 7 },
  { left: "14%", top: "68%", c: C.blue, r: "8deg", s: 5 },
  { left: "84%", top: "72%", c: C.green, r: "-14deg", s: 6 },
  { left: "30%", top: "84%", c: C.cheek, r: "20deg", s: 5 },
  { left: "68%", top: "88%", c: C.primary, r: "-22deg", s: 6 },
  { left: "46%", top: "5%", c: C.purple, r: "6deg", s: 5 },
  { left: "56%", top: "92%", c: C.pink, r: "-8deg", s: 5 },
];

// ---------------------------------------------------------------------------
// 1 · Level-up ceremony
// ---------------------------------------------------------------------------

export function LevelUpScreen() {
  return (
    <Screen>
      <div className="relative h-full w-full overflow-hidden" style={{ background: "radial-gradient(120% 70% at 50% 0%, #FFE9B0 0%, #FFF6EC 58%)" }}>
        <StatusBar />
        {CONFETTI.map((p, i) => (
          <span
            key={i}
            className="absolute rounded-[2px]"
            style={{ left: p.left, top: p.top, width: p.s, height: p.s * 1.5, background: p.c, transform: `rotate(${p.r})` }}
          />
        ))}

        <div className="relative flex h-full flex-col items-center px-5 pb-6 pt-16">
          <Chip bg={C.text} fg={C.primary} icon={<Sparkles className="h-3 w-3" />} className="uppercase tracking-widest">
            Bond level up
          </Chip>

          {/* Pet with burst */}
          <div className="relative mt-6 flex items-center justify-center">
            <span className="absolute h-44 w-44 rounded-full" style={{ background: "radial-gradient(circle, #FFD466 0%, rgb(255 197 61 / 0) 70%)" }} />
            <PetFace species="cockatiel" size={128} mood="excited" />
          </div>

          <h2 className="mt-3 text-center font-display text-[26px] font-semibold leading-tight">
            Kiwi reached <span style={{ color: C.ink }}>Level 5</span>
          </h2>
          <p className="mt-1 text-[11.5px] font-bold" style={{ color: C.sec }}>
            4 days together · 470 bond XP earned
          </p>

          {/* Unlock card */}
          <Card className="mt-5 w-full p-3.5" style={{ boxShadow: "0 10px 24px -10px rgb(201 138 18 / 0.45)" }}>
            <p className="flex items-center gap-1 text-[9.5px] font-extrabold uppercase tracking-widest" style={{ color: C.cheek }}>
              <PartyPopper className="h-3 w-3" /> Newly unlocked
            </p>
            <div className="mt-2 flex items-center gap-3">
              <IconCircle size={42} bg={C.pinkSoft} fg={C.pink}>
                <Footprints className="h-5 w-5" />
              </IconCircle>
              <div className="flex-1 leading-snug">
                <p className="text-[13.5px] font-extrabold">Friends &amp; playdates</p>
                <p className="text-[10.5px] font-semibold leading-snug" style={{ color: C.sec }}>
                  Pet friendship profiles are open — and when Pip&apos;s human is nearby, Kiwi can ask for a playdate.
                </p>
              </div>
            </div>
          </Card>

          {/* Next teaser */}
          <Card className="mt-2.5 w-full p-3">
            <div className="flex items-center gap-3">
              <IconCircle size={36} bg={C.element} fg={C.sec}>
                <Lock className="h-4 w-4" />
              </IconCircle>
              <div className="flex-1 leading-tight">
                <p className="text-[12px] font-extrabold">Next: Collars at Level 6</p>
                <p className="text-[10px] font-bold" style={{ color: C.sec }}>Two starter collars for Kiwi</p>
              </div>
              <span className="rounded-full px-2 py-1 text-[10.5px] font-extrabold" style={{ background: C.soft, color: C.ink }}>
                170 XP
              </span>
            </div>
          </Card>

          <div className="flex-1" />
          <Btn icon={<Heart className="h-4 w-4" />} className="w-full">
            Go say hi to Pip
          </Btn>
        </div>
      </div>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// 2 · Bond journey (the level roadmap, inside the app)
// ---------------------------------------------------------------------------

const JOURNEY: { level: number; title: string; icon: React.ReactNode; kind: LevelKind }[] = [
  { level: 1, title: "Hatched together", icon: <Feather className="h-4 w-4" />, kind: "core" },
  { level: 2, title: "Groom & play", icon: <Brush className="h-4 w-4" />, kind: "care" },
  { level: 3, title: "Fetch errands", icon: <Compass className="h-4 w-4" />, kind: "map" },
  { level: 4, title: "Treasure shelf", icon: <Gem className="h-4 w-4" />, kind: "map" },
  { level: 5, title: "Friends & playdates", icon: <Users className="h-4 w-4" />, kind: "social" },
  { level: 6, title: "Collars", icon: <Star className="h-4 w-4" />, kind: "expression" },
  { level: 7, title: "Pet diary", icon: <BookOpen className="h-4 w-4" />, kind: "core" },
  { level: 8, title: "Pet park hotspots", icon: <Footprints className="h-4 w-4" />, kind: "map" },
  { level: 9, title: "1 km flights", icon: <Zap className="h-4 w-4" />, kind: "map" },
  { level: 12, title: "Scarves & hats · Epic finds", icon: <Gem className="h-4 w-4" />, kind: "expression" },
  { level: 15, title: "Legendary treasures", icon: <Award className="h-4 w-4" />, kind: "map" },
  { level: 20, title: "Elder Bond & crown", icon: <Crown className="h-4 w-4" />, kind: "social" },
];

export function BondJourneyScreen() {
  const current = 4;
  return (
    <Screen>
      <StatusBar />
      <MockTopBar
        title="Bond journey"
        sub="Kiwi · Level 4 of 20"
        action={
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white" style={{ color: C.text, boxShadow: "0 1px 3px rgb(43 31 22 / 0.08)" }}>
            <Share2 className="h-4 w-4" />
          </span>
        }
      />

      <div className="h-full overflow-hidden px-4 pb-24 pt-3">
        {/* Current-level card */}
        <Card className="p-3.5" style={{ background: `linear-gradient(120deg, ${C.soft} 0%, #FFFFFF 80%)` }}>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white" style={{ boxShadow: `0 0 0 2.5px ${C.primary}` }}>
              <PetFace species="cockatiel" size={36} mood="happy" />
            </div>
            <div className="flex-1">
              <p className="font-display text-[16px] font-semibold leading-none">Level {current}</p>
              <p className="mt-1 text-[10px] font-bold" style={{ color: C.sec }}>120 / 150 XP to Level 5</p>
              <div className="mt-1.5"><Progress value={120 / 150} h={6} /></div>
            </div>
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-white/70 px-2.5 py-2 text-[10.5px] font-bold" style={{ color: C.ink }}>
            <Zap className="h-3 w-3" /> Pip is nearby — tomorrow&apos;s playdate earns +40, enough to unlock friends.
          </p>
        </Card>

        {/* Timeline */}
        <div className="relative mt-4 pl-1">
          <span className="absolute bottom-3 left-[19px] top-3 w-[2px]" style={{ background: C.element }} />
          <div className="space-y-1">
            {JOURNEY.map((n) => {
              const reached = n.level < current;
              const isCurrent = n.level === current;
              const isNext = n.level === 5;
              const k = KIND_STYLE[n.kind];
              return (
                <div key={n.level} className="relative flex items-center gap-3 rounded-2xl px-1 py-1.5"
                  style={isCurrent ? { background: C.surface, boxShadow: "0 4px 14px -6px rgb(43 31 22 / 0.18)" } : undefined}
                >
                  <span
                    className="z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: reached ? C.primary : isCurrent ? "#FFFFFF" : isNext ? k.soft : C.element,
                      color: reached ? C.text : isNext ? k.hex : C.sec,
                      boxShadow: isCurrent ? `0 0 0 2.5px ${C.primary}` : undefined,
                    }}
                  >
                    {reached ? <Check className="h-4 w-4" strokeWidth={3} /> : isCurrent ? <PetFace species="cockatiel" size={26} mood="happy" /> : isNext ? <Lock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  </span>
                  <div className="flex-1 leading-tight">
                    <p className="text-[12px] font-extrabold" style={{ color: reached || isCurrent ? C.text : isNext ? C.text : C.sec }}>
                      {n.title}
                    </p>
                    <p className="text-[9.5px] font-bold" style={{ color: C.sec }}>
                      {reached ? `Unlocked at Level ${n.level}` : isCurrent ? "You are here" : isNext ? "Next · 30 XP away" : `Level ${n.level}`}
                    </p>
                  </div>
                  {isNext && (
                    <span className="rounded-full px-2 py-1 text-[9.5px] font-extrabold" style={{ background: k.soft, color: k.hex }}>
                      Social
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 pl-10 text-[10px] font-bold" style={{ color: C.sec }}>
            16 more levels to the Elder Bond crown
          </p>
        </div>
      </div>

      <TabBar active="profile" />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// 3 · Shelf unlock states
// ---------------------------------------------------------------------------

type ShelfState = "wearing" | "available" | "next" | "locked";

function ShelfTile({ name, level, nextXp, state, icon }: { name: string; level?: number; nextXp?: number; state: ShelfState; icon?: React.ReactNode }) {
  const dim = state === "locked";
  return (
    <div
      className="flex flex-col items-center rounded-[16px] p-2.5"
      style={{
        background: state === "next" ? "#FFFFFF" : C.surface,
        boxShadow:
          state === "wearing"
            ? `0 0 0 2.5px ${C.primary}`
            : state === "next"
              ? `0 0 0 2px ${C.primary}, 0 8px 18px -8px rgb(201 138 18 / 0.6)`
              : "0 1px 2px rgb(43 31 22 / 0.05)",
        opacity: dim ? 0.75 : 1,
      }}
    >
      <span
        className="relative flex h-12 w-12 items-center justify-center rounded-2xl"
        style={{ background: dim ? C.element : C.soft, color: dim ? C.sec : C.ink }}
      >
        {state === "locked" || state === "next" ? <Lock className="h-4 w-4" /> : icon}
        {state === "wearing" && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full" style={{ background: C.green }}>
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
          </span>
        )}
      </span>
      <p className="mt-1.5 text-[9.5px] font-extrabold leading-tight" style={{ color: dim ? C.sec : C.text }}>{name}</p>
      {state === "wearing" && <span className="text-[9px] font-extrabold" style={{ color: C.green }}>Wearing</span>}
      {state === "available" && <span className="text-[9px] font-extrabold" style={{ color: C.green }}>Equip</span>}
      {state === "next" && <span className="rounded-full px-1.5 py-px text-[8.5px] font-extrabold" style={{ background: C.soft, color: C.ink }}>Lv {level} · {nextXp ?? 0} XP</span>}
      {state === "locked" && <span className="text-[9px] font-extrabold" style={{ color: C.sec }}>Level {level}</span>}
    </div>
  );
}

export function ShelfStatesScreen() {
  return (
    <Screen>
      <StatusBar />
      <MockTopBar title="Kiwi's look" sub="Cosmetics earned through bond" />
      <div className="h-full overflow-hidden px-4 pb-24 pt-3">
        <div className="flex justify-center"><SegPillsHats /></div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <ShelfTile name="Day crown" state="wearing" icon={<Crown className="h-5 w-5" />} />
          <ShelfTile name="Picnic bow" state="available" icon={<Star className="h-5 w-5" />} />
          <ShelfTile name="Rain scarf" state="available" icon={<Feather className="h-5 w-5" />} />
          <ShelfTile name="Party beanie" level={15} nextXp={1350} state="next" />
          <ShelfTile name="Stargazer cap" level={18} state="locked" />
          <ShelfTile name="Elder crown" level={20} state="locked" />
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl p-3" style={{ background: C.soft }}>
          <Sparkles className="h-4 w-4 shrink-0" style={{ color: C.ink }} />
          <p className="text-[10.5px] font-bold leading-snug" style={{ color: C.ink }}>
            Scarves &amp; hats opened together at <b>Level 12</b>. The party beanie waits at <b>Level 15</b> — 1,350 XP away.
            Locked items are always shown, never hidden.
          </p>
        </div>

        <p className="mb-2 mt-4 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Treasures</p>
        <div className="grid grid-cols-3 gap-2">
          <ShelfTile name="Gold feather" state="available" icon={<Feather className="h-5 w-5" />} />
          <ShelfTile name="Epic finds" state="available" icon={<Gem className="h-5 w-5" />} />
          <ShelfTile name="Legendary" level={15} state="locked" />
        </div>
      </div>
      <TabBar active="profile" />
    </Screen>
  );
}

function SegPillsHats() {
  const opts = ["Collars", "Scarves & hats"];
  return (
    <div className="flex gap-1 rounded-full p-1" style={{ background: C.element }}>
      {opts.map((o, i) => (
        <span
          key={o}
          className="rounded-full px-4 py-1.5 text-[11.5px] font-extrabold"
          style={i === 1 ? { background: C.surface, color: C.text, boxShadow: "0 1px 3px rgb(43 31 22 / 0.12)" } : { color: C.sec }}
        >
          {o}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4 · Fresh account — Level 1 pet home with locked affordances
// ---------------------------------------------------------------------------

function CareTile({ label, icon, locked }: { label: string; icon: React.ReactNode; locked?: boolean }) {
  return (
    <Card className="flex flex-col items-center gap-1.5 p-3" style={locked ? { background: C.bg, boxShadow: `inset 0 0 0 1.5px ${C.selected}` } : undefined}>
      <span
        className="flex h-11 w-11 items-center justify-center rounded-2xl"
        style={{ background: locked ? C.element : C.soft, color: locked ? C.sec : C.ink }}
      >
        {locked ? <Lock className="h-4 w-4" /> : icon}
      </span>
      <p className="text-[10.5px] font-extrabold" style={{ color: locked ? C.sec : C.text }}>{label}</p>
      {locked ? (
        <span className="rounded-full px-1.5 py-px text-[8.5px] font-extrabold" style={{ background: C.element, color: C.sec }}>Lv 2</span>
      ) : (
        <span className="text-[9.5px] font-extrabold" style={{ color: C.green }}>Done</span>
      )}
    </Card>
  );
}

export function PetHomeFreshScreen() {
  return (
    <Screen>
      <StatusBar />
      <div className="flex items-center justify-between px-4 pt-12">
        <p className="font-display text-[22px] font-semibold">Kiwi</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white" style={{ color: C.text, boxShadow: "0 1px 3px rgb(43 31 22 / 0.08)" }}>
          <Settings2 className="h-4 w-4" />
        </span>
      </div>

      <div className="h-full overflow-hidden px-4 pb-24 pt-3">
        {/* Room */}
        <Card className="flex flex-col items-center gap-1 p-4 text-center" style={{ background: `linear-gradient(160deg, ${C.soft} 0%, #FFFFFF 85%)` }}>
          <PetFace species="cockatiel" size={86} mood="excited" />
          <div className="flex items-center gap-1.5">
            <Chip bg={C.surface} fg={C.ink} className="text-[10px]">Level 1</Chip>
            <Chip bg={C.gsoft} fg={C.green} className="text-[10px]">Feeling curious</Chip>
          </div>
          <div className="mt-2 w-full space-y-1.5 text-left">
            <div className="flex items-center justify-between text-[9.5px] font-extrabold" style={{ color: C.sec }}>
              <span>ENERGY</span><span>Full of it</span>
            </div>
            <Progress value={0.92} fill={C.primary} />
            <div className="flex items-center justify-between pt-0.5 text-[9.5px] font-extrabold" style={{ color: C.sec }}>
              <span>BOND</span><span>Just hatched</span>
            </div>
            <Progress value={0.04} fill={C.cheek} />
          </div>
        </Card>

        {/* Care */}
        <p className="mb-2 mt-4 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Daily care</p>
        <div className="grid grid-cols-3 gap-2">
          <CareTile label="Feed" icon={<Soup className="h-5 w-5" />} />
          <CareTile label="Groom" icon={<Brush className="h-5 w-5" />} locked />
          <CareTile label="Play" icon={<Gamepad2 className="h-5 w-5" />} locked />
        </div>

        {/* Next unlock card */}
        <Card className="mt-3 p-3.5">
          <div className="flex items-center gap-3">
            <IconCircle size={40} bg={C.bsoft} fg={C.blue}>
              <Compass className="h-5 w-5" />
            </IconCircle>
            <div className="flex-1 leading-tight">
              <p className="text-[12.5px] font-extrabold">Errands unlock at Level 3</p>
              <p className="text-[10px] font-bold" style={{ color: C.sec }}>Groom & play tomorrow — 120 XP to go</p>
            </div>
          </div>
          <div className="mt-2.5"><Progress value={60 / 180} fill={C.blue} track={C.bsoft} /></div>
        </Card>

        {/* Locked feature row */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            { l: "Shelf", lv: 4 },
            { l: "Friends", lv: 5 },
            { l: "Playdates", lv: 5 },
            { l: "Diary", lv: 7 },
          ].map((x) => (
            <span key={x.l} className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-[10px] font-extrabold"
              style={{ borderColor: C.selected, color: C.sec, background: C.surface }}>
              <Lock className="h-2.5 w-2.5" /> {x.l} · Lv {x.lv}
            </span>
          ))}
        </div>
      </div>
      <TabBar active="profile" />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// 5 · Friend-invite catch-up (the wall-bender)
// ---------------------------------------------------------------------------

export function InviteCatchUpScreen() {
  return (
    <Screen>
      <MapBack variant="day">
        <StatusBar />
        <div className="absolute inset-0" style={{ background: "rgb(43 31 22 / 0.32)" }} />

        <div className="absolute inset-x-3 bottom-12">
          <Card className="p-4">
            {/* pets */}
            <div className="flex items-center justify-center gap-5">
              <Avatar species="puppy" size={58} bg={C.gsoft} mood="excited" />
              <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: C.pinkSoft, color: C.pink }}>
                <Heart className="h-4.5 w-4.5" fill="currentColor" />
              </span>
              <Avatar species="cockatiel" size={58} bg={C.soft} mood="happy" />
            </div>

            <h3 className="mt-3 text-center font-display text-[20px] font-semibold leading-tight">Pip wants to be friends!</h3>
            <p className="mt-1.5 text-center text-[11.5px] font-semibold leading-snug" style={{ color: C.sec }}>
              Playdates open at <b>Level 5</b> — Kiwi is at Level 4. Accept Pip&apos;s bond now and
              playdates unlock immediately.
            </p>

            <div className="mt-3 flex items-center gap-2 rounded-xl p-2.5" style={{ background: C.soft }}>
              <Zap className="h-4 w-4 shrink-0" style={{ color: C.ink }} />
              <p className="text-[10px] font-bold leading-snug" style={{ color: C.ink }}>
                A friend&apos;s bond invite can open one social gate early — the curve bends so nobody is kept from people.
              </p>
            </div>

            <div className="mt-3 space-y-2">
              <Btn icon={<Check className="h-4 w-4" strokeWidth={3} />} className="w-full">Accept &amp; unlock now</Btn>
              <div className="flex h-10 items-center justify-center gap-1.5 text-[12px] font-extrabold" style={{ color: C.sec }}>
                Wait for Level 5
              </div>
            </div>
          </Card>
        </div>
      </MapBack>
    </Screen>
  );
}
