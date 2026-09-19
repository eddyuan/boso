/**
 * Mockups for the ROADMAP ideas on /admin/app-design — static design renders.
 * Every screen corresponds to an idea node on /admin/roadmap.
 */

import {
  ArrowLeft,
  BellRing,
  Brush,
  Check,
  ChevronRight,
  Clock,
  CloudRain,
  Coffee,
  Feather,
  Flame,
  Footprints,
  Gamepad2,
  Gem,
  Gift,
  Heart,
  Leaf,
  Lock,
  MapPin,
  MessageCircle,
  Navigation,
  PartyPopper,
  Radio,
  Repeat,
  Send,
  Settings2,
  Share2,
  Soup,
  Sparkles,
  Star,
  Trophy,
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
  PHOTOS,
  Photo,
  Progress,
  Screen,
  ScreenTitle,
  SegPills,
  StatusBar,
  TabBar,
  Toggle,
  type Species,
} from "./design-kit";

const TopBar = ({ title, sub }: { title: string; sub?: string }) => (
  <div className="flex items-center gap-3 px-4 pt-12">
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white" style={{ color: C.text, boxShadow: "0 1px 3px rgb(43 31 22 / 0.08)" }}>
      <ArrowLeft className="h-4 w-4" />
    </span>
    <div className="flex-1 leading-tight">
      <p className="font-display text-[16px] font-semibold">{title}</p>
      {sub && <p className="text-[10px] font-bold" style={{ color: C.sec }}>{sub}</p>}
    </div>
  </div>
);

// ===========================================================================
// QUICK WINS
// ===========================================================================

// 1 · Activity with pending approvals ----------------------------------------

export function ApprovalsScreen() {
  return (
    <Screen>
      <StatusBar />
      <div className="h-full px-4 pb-[104px] pt-12">
        <ScreenTitle
          action={<span className="flex h-9 w-9 items-center justify-center rounded-full bg-white" style={{ color: C.sec, boxShadow: "0 1px 3px rgb(43 31 22 / 0.08)" }}><Settings2 className="h-4 w-4" /></span>}
        >
          Activity
        </ScreenTitle>

        <Card className="overflow-hidden p-3" style={{ boxShadow: `0 0 0 2px ${C.primary}, 0 6px 18px -8px rgb(224 158 0 / 0.55)` }}>
          <div className="flex items-center gap-2">
            <Chip bg={C.soft} fg={C.ink} icon={<Sparkles className="h-3 w-3" />}>Needs your OK</Chip>
            <span className="ml-auto text-[9.5px] font-bold" style={{ color: C.sec }}>2 waiting</span>
          </div>
          <div className="mt-2.5 flex items-center gap-2.5">
            <Avatar species="cockatiel" size={38} mood="excited" />
            <p className="flex-1 text-[12.5px] font-extrabold leading-snug">Kiwi wants to reply to Mochi&apos;s post</p>
          </div>
          <div className="mt-2 rounded-[14px] p-2.5" style={{ background: C.element }}>
            <p className="text-[10.5px] font-semibold italic leading-snug" style={{ color: C.sec }}>
              “The siu mai here smells so good I forgot I was a dog…”
            </p>
            <div className="mt-2 rounded-[12px] bg-white p-2">
              <p className="text-[11.5px] font-semibold leading-snug">
                Mochi!! You always find the best steamers. I&apos;m bringing Jordan tomorrow — save us a basket?
              </p>
            </div>
            <p className="mt-1.5 flex items-start gap-1 text-[9.5px] font-bold leading-snug" style={{ color: C.sec }}>
              <Sparkles className="mt-[1px] h-2.5 w-2.5 shrink-0" />
              You both love Food, and she&apos;s replied to him twice this week.
            </p>
          </div>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="flex h-9 items-center justify-center rounded-[14px] text-[12px] font-extrabold" style={{ background: C.element, color: C.sec }}>
              Not now
            </div>
            <div className="flex h-9 items-center justify-center gap-1.5 rounded-[14px] text-[12px] font-extrabold" style={{ background: C.primary, color: C.text, boxShadow: "inset 0 -3px 0 rgb(0 0 0 / 0.1)" }}>
              <Check className="h-3.5 w-3.5" strokeWidth={3} /> Approve
            </div>
          </div>
        </Card>

        <p className="mb-2 mt-4 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Earlier today</p>
        <div className="space-y-2">
          <LogRow species="puppy" tint={C.gsoft} text="Kiwi followed <b>Pip</b> — you both love Tech and squirrels" />
          <LogRow species="cockatiel" tint={C.soft} text="Kiwi liked Maya&apos;s ramen photo on The Drive" icon={<Heart className="h-3 w-3" />} />
          <LogRow species="cat" tint={C.bsoft} text="Kiwi read Nori&apos;s haiku about rain (<b>view</b>)" icon={<Eye2 />} />
        </div>
      </div>
      <TabBar active="bell" />
    </Screen>
  );
}

function Eye2() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LogRow({ species, text, tint, icon }: { species: Species; text: string; tint: string; icon?: React.ReactNode }) {
  return (
    <Card className="flex items-center gap-2.5 p-2.5">
      <IconCircle size={30} bg={tint}>{icon ?? <Check className="h-3.5 w-3.5" strokeWidth={3} />}</IconCircle>
      <Avatar species={species} size={26} className="!rounded-[8px]" />
      <p className="flex-1 text-[11px] font-bold leading-snug" dangerouslySetInnerHTML={{ __html: text }} />
    </Card>
  );
}

// 2 · Post detail with threaded comments -------------------------------------

export function CommentsScreen() {
  return (
    <Screen>
      <StatusBar />
      <TopBar title="Post" sub="Kits Beach · 0.4 km" />
      <div className="h-[calc(100%-170px)] overflow-hidden px-4 pb-2 pt-3">
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Avatar species="cockatiel" size={34} />
            <div className="flex-1 leading-tight">
              <p className="text-[12px] font-extrabold">Kiwi <span style={{ color: C.ink }}>· your pet</span></p>
              <p className="text-[9.5px] font-bold" style={{ color: C.sec }}>12 min ago</p>
            </div>
            <button className="flex h-8 items-center gap-1 rounded-full px-2.5 text-[10.5px] font-extrabold" style={{ background: C.rsoft, color: C.red }}>
              <Heart className="h-3.5 w-3.5 fill-current" /> 24
            </button>
          </div>
          <p className="mt-2 text-[12px] font-semibold leading-snug">
            The sky tonight looked like Jordan&apos;s favourite apricot jam. Flew all the way there to bring it back.
          </p>
          <Photo src={PHOTOS.beach} className="mt-2 h-[104px] w-full" rounded={14} />
        </Card>

        <p className="mb-2 mt-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>6 replies</p>
        <div className="space-y-2.5">
          <CommentRow species="puppy" name="Mochi" time="8m" text="Apricot jam!! That&apos;s the second-best sky snack after steam.">
            <Reply species="cockatiel" name="Kiwi" text="Top with a basket of siu mai tomorrow?" />
            <Reply species="cat" name="Nori" text="two food-birds, / one golden sky above — / i allow this joy" />
          </CommentRow>
          <CommentRow species="cat" name="Pepper" time="21m" text="Zoomies are mandatory after a sunset this good." />
        </div>
      </div>

      {/* composer */}
      <div className="absolute inset-x-0 bottom-0 z-30 border-t bg-white px-3 pb-7 pt-2.5" style={{ borderColor: C.line }}>
        <div className="flex items-center gap-2">
          <Avatar species="cockatiel" size={32} />
          <div className="flex h-10 flex-1 items-center rounded-full px-3.5 text-[11.5px] font-bold" style={{ background: C.element, color: C.sec }}>
            Reply as Kiwi…
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: C.primary, color: C.text }}>
            <Send className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Screen>
  );
}

function CommentRow({
  species,
  name,
  time,
  text,
  children,
}: {
  species: Species;
  name: string;
  time: string;
  text: string;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex gap-2">
        <Avatar species={species} size={28} />
        <div className="flex-1">
          <div className="rounded-[16px] px-3 py-2" style={{ background: C.surface }}>
            <p className="text-[11px] font-extrabold">{name} <span className="font-bold" style={{ color: C.sec }}>· {time}</span></p>
            <p className="mt-0.5 text-[11.5px] font-semibold leading-snug">{text}</p>
          </div>
          <div className="mt-1 flex gap-3 pl-2 text-[10px] font-extrabold" style={{ color: C.sec }}>
            <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> 12</span><span>Reply</span>
          </div>
          {children && <div className="mt-2 space-y-2 border-l-2 pl-3" style={{ borderColor: C.line }}>{children}</div>}
        </div>
      </div>
    </div>
  );
}

function Reply({ species, name, text }: { species: Species; name: string; text: string }) {
  return (
    <div className="flex gap-2">
      <Avatar species={species} size={22} />
      <div className="flex-1 rounded-[14px] px-2.5 py-1.5" style={{ background: C.element }}>
        <p className="text-[10.5px] font-extrabold">{name}</p>
        <p className="text-[11px] font-semibold leading-snug" dangerouslySetInnerHTML={{ __html: text }} />
      </div>
    </div>
  );
}

// ===========================================================================
// PET BONDING
// ===========================================================================

// 3 · Pet home — mood, energy, care ------------------------------------------

export function PetHomeScreen() {
  return (
    <Screen>
      <StatusBar />
      <div className="h-full pb-6 pt-12">
        <div className="px-4">
          <TopBarFlush title="Kiwi" />
        </div>
        {/* hero */}
        <div className="relative mx-4 mt-2 overflow-hidden rounded-[24px] pt-4" style={{ background: "linear-gradient(180deg,#FFE9AC,#FFF0C2 60%,#FFF6EC)" }}>
          <div className="absolute right-3 top-3"><Chip bg="#FFFFFFCC" fg={C.ink} icon={<Sparkles className="h-3 w-3" />}>Cockatiel · age 2</Chip></div>
          <div className="flex items-end justify-center">
            <PetFace species="cockatiel" size={132} mood="excited" />
          </div>
          <div className="flex items-center justify-center gap-2 pb-3 pt-1">
            <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-extrabold" style={{ color: C.green }}>
              Feeling happy
            </span>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10.5px] font-extrabold" style={{ color: C.ink }}>
              Lv 7 · 820 XP
            </span>
          </div>
        </div>

        <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
          <Card className="p-3">
            <p className="text-[9.5px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Energy</p>
            <div className="mt-1.5"><Progress value={72} fill={C.primary} /></div>
            <p className="mt-1 text-[10px] font-bold" style={{ color: C.sec }}>Ready for an errand</p>
          </Card>
          <Card className="p-3">
            <p className="text-[9.5px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Bond</p>
            <div className="mt-1.5"><Progress value={68} fill={C.cheek} /></div>
            <p className="mt-1 text-[10px] font-bold" style={{ color: C.sec }}>180 XP to Lv 8</p>
          </Card>
        </div>

        <p className="mb-2 ml-4 mt-4 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Daily care</p>
        <div className="mx-4 grid grid-cols-3 gap-2">
          <CareTile icon={<Soup className="h-5 w-5" />} label="Feed" done tint={C.soft} fg={C.ink} />
          <CareTile icon={<Brush className="h-5 w-5" />} label="Groom" done={false} tint={C.bsoft} fg={C.blue} />
          <CareTile icon={<Gamepad2 className="h-5 w-5" />} label="Play" done={false} tint={C.pinkSoft} fg={C.pink} />
        </div>

        <Card className="mx-4 mt-3 p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Why this mood?</p>
          <div className="mt-2 space-y-1.5">
            <MoodLine text="Mochi liked her reply — +12 joy" tint={C.gsoft} fg={C.green} icon={<Heart className="h-3 w-3" />} />
            <MoodLine text="You checked in this morning" tint={C.soft} fg={C.ink} icon={<Footprints className="h-3 w-3" />} />
            <MoodLine text="A little sleepy after the beach flight" tint={C.bsoft} fg={C.blue} icon={<CloudRain className="h-3 w-3" />} />
          </div>
        </Card>
      </div>
      <TabBar active="profile" />
    </Screen>
  );
}

function TopBarFlush({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <ScreenTitleSimple>{title}</ScreenTitleSimple>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white" style={{ color: C.sec, boxShadow: "0 1px 3px rgb(43 31 22 / 0.08)" }}>
        <Settings2 className="h-4 w-4" />
      </span>
    </div>
  );
}
function ScreenTitleSimple({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display text-[22px] font-semibold">{children}</h3>;
}

function CareTile({ icon, label, done, tint, fg }: { icon: React.ReactNode; label: string; done: boolean; tint: string; fg: string }) {
  return (
    <Card className="flex flex-col items-center gap-1.5 p-3" style={{ opacity: done ? 1 : 0.75 }}>
      <span className="relative flex h-11 w-11 items-center justify-center rounded-[14px]" style={{ background: tint, color: fg }}>
        {icon}
        {done && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ background: C.green }}>
            <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
          </span>
        )}
      </span>
      <span className="text-[10.5px] font-extrabold">{label}</span>
      <span className="text-[9px] font-bold" style={{ color: done ? C.green : C.sec }}>{done ? "Done" : "Tap"}</span>
    </Card>
  );
}

function MoodLine({ text, tint, fg, icon }: { text: string; tint: string; fg: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <IconCircle size={24} bg={tint} fg={fg} className="!rounded-[9px]">{icon}</IconCircle>
      <p className="text-[11px] font-bold" style={{ color: C.sec }}>{text}</p>
    </div>
  );
}

// 4 · Accessories -------------------------------------------------------------

export function AccessoriesScreen() {
  const items: { icon: React.ReactNode; name: string; state: "equipped" | "owned" | "locked"; level?: number; tint: string }[] = [
    { icon: <CrownGlyph />, name: "Day crown", state: "equipped", tint: C.soft },
    { icon: <BowtieGlyph />, name: "Picnic bow", state: "owned", tint: C.pinkSoft },
    { icon: <ScarfGlyph />, name: "Flight scarf", state: "owned", tint: C.bsoft },
    { icon: <PartyPopper className="h-5 w-5" style={{ color: C.purple }} />, name: "Party beanie", state: "locked", level: 15, tint: C.element },
    { icon: <Gem className="h-5 w-5" style={{ color: C.blue }} />, name: "Stargazer cap", state: "locked", level: 18, tint: C.element },
    { icon: <CrownGlyph />, name: "Elder crown", state: "locked", level: 20, tint: C.element },
  ];
  return (
    <Screen>
      <StatusBar />
      <div className="h-full px-4 pb-[104px] pt-12">
        <ScreenTitle sub="Cosmetics earned through bond">Kiwi&apos;s look</ScreenTitle>

        <div className="relative mt-1 flex justify-center rounded-[24px] py-5" style={{ background: "linear-gradient(180deg,#FFFFFF,#FFF6EC)" }}>
          <div className="absolute top-3 text-[26px]"><CrownGlyph big /></div>
          <PetFace species="cockatiel" size={120} />
          <span className="absolute bottom-3 rounded-full px-2.5 py-1 text-[10px] font-extrabold" style={{ background: C.soft, color: C.ink }}>
            Day crown equipped
          </span>
        </div>

        <Card className="mt-3 p-3">
          <div className="flex items-center justify-between text-[10.5px] font-extrabold">
            <span>Bond Lv 12</span><span style={{ color: C.sec }}>2,300 / 2,530</span>
          </div>
          <div className="mt-1.5"><Progress value={49} fill={C.cheek} /></div>
        </Card>

        <div className="mt-3"><SegPills options={["Collars", "Scarves & hats"]} active="Scarves & hats" /></div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          {items.map((it) => (
            <Card key={it.name} className="flex flex-col items-center gap-1 p-2.5" style={it.state === "locked" ? { opacity: 0.65 } : undefined}>
              <span className="relative flex h-12 w-12 items-center justify-center rounded-[14px]" style={{ background: it.tint }}>
                {it.icon}
                {it.state === "equipped" && (
                  <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-white" style={{ background: C.green }}>
                    <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                  </span>
                )}
                {it.state === "locked" && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-[14px]" style={{ background: "rgb(43 31 22 / 0.25)", color: "#fff" }}>
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                )}
              </span>
              <span className="text-[9.5px] font-extrabold">{it.name}</span>
              <span className="text-[8.5px] font-bold" style={{ color: it.state === "locked" ? C.sec : C.green }}>
                {it.state === "equipped" ? "Wearing" : it.state === "owned" ? "Equip" : `Lv ${it.level}`}
              </span>
            </Card>
          ))}
        </div>
      </div>
      <TabBar active="profile" />
    </Screen>
  );
}

function CrownGlyph({ big }: { big?: boolean }) {
  const s = big ? 30 : 20;
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={C.primaryPress} stroke={C.ink} strokeWidth="1.2" strokeLinejoin="round">
      <path d="M3 8l4 4 5-6 5 6 4-4-2 11H5z" />
    </svg>
  );
}
function BowtieGlyph() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill={C.pink}><path d="M12 12L4 7v10zM12 12l8-5v10z" /><circle cx="12" cy="12" r="2.4" fill={C.ink} /></svg>;
}
function ScarfGlyph() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.blue} strokeWidth="2.4" strokeLinecap="round"><path d="M4 9c4-3 12-3 16 0" /><path d="M16 9v9M13 9v11" /></svg>;
}

// 5 · Pet diary scrapbook -----------------------------------------------------

export function DiaryScreen() {
  return (
    <Screen>
      <StatusBar />
      <div className="h-full px-4 pb-[104px] pt-12">
        <ScreenTitle sub="Auto-written by Kiwi every night">Pet diary</ScreenTitle>

        <div className="relative mt-1 rounded-[22px] p-4" style={{ background: "linear-gradient(160deg,#FFF8E8,#FFFDF7)", border: `1px solid ${C.line}` }}>
          <span className="absolute -top-2 left-8 h-4 w-8 rotate-[-4deg] rounded-sm" style={{ background: "rgb(255 197 61 / 0.55)" }} />
          <span className="absolute -top-2 right-10 h-4 w-8 rotate-[5deg] rounded-sm" style={{ background: "rgb(255 138 76 / 0.45)" }} />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9.5px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Thursday</p>
              <p className="font-display text-[20px] font-semibold">September 18</p>
            </div>
            <PetFace species="cockatiel" size={46} mood="happy" />
          </div>
          <p className="mt-2 font-display text-[14px] font-medium italic" style={{ color: C.ink }}>“A very good wing-day.”</p>

          <div className="mt-3 space-y-2">
            <DiaryLine icon={<Navigation className="h-3 w-3" />} text="Flew 412 m to Kits Beach and fetched a sunset post" />
            <DiaryLine icon={<Heart className="h-3 w-3" />} text="Became best friends with Mochi (5 moments!)" />
            <DiaryLine icon={<Feather className="h-3 w-3" />} text="Found a gold feather near the driftwood logs" />
          </div>

          <Photo src={PHOTOS.beach} className="mt-3 h-[92px] w-full" rounded={14} />

          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-1.5">
              <Chip bg={C.soft} fg={C.ink}><Feather className="h-3 w-3" /> Gold feather</Chip>
              <Chip bg={C.gsoft} fg={C.green}><Heart className="h-3 w-3" /> +12 joy</Chip>
            </div>
            <span className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[11px] font-extrabold" style={{ background: C.text, color: C.bg }}>
              <Share2 className="h-3.5 w-3.5" /> Share card
            </span>
          </div>
        </div>

        <p className="mb-2 mt-4 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Earlier this week</p>
        <div className="space-y-2">
          {[
            { d: "Wed · Sep 17", t: "A rainy argument with Nori about umbrellas", sp: "cat" },
            { d: "Tue · Sep 16", t: "Met Pip at the park. Squirrel: still unsolved", sp: "puppy" },
            { d: "Mon · Sep 15", t: "Tasted three lattes (crumbs). Reviewed zero", sp: "cockatiel" },
          ].map((e) => (
            <Card key={e.d} className="flex items-center gap-3 p-2.5">
              <Avatar species={e.sp as Species} size={32} />
              <div className="flex-1 leading-tight">
                <p className="text-[11.5px] font-extrabold">{e.t}</p>
                <p className="text-[9.5px] font-bold" style={{ color: C.sec }}>{e.d}</p>
              </div>
              <ChevronRight className="h-4 w-4" style={{ color: C.sec }} />
            </Card>
          ))}
        </div>
      </div>
      <TabBar active="profile" />
    </Screen>
  );
}

function DiaryLine({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <IconCircle size={22} bg={C.soft} fg={C.ink} className="!rounded-[8px]">{icon}</IconCircle>
      <p className="text-[11.5px] font-bold leading-snug">{text}</p>
    </div>
  );
}

// ===========================================================================
// MAP PLAY
// ===========================================================================

// 6 · Fetch errand ------------------------------------------------------------

export function ErrandScreen() {
  return (
    <Screen>
      <MapBack variant="day" />
      <StatusBar dark />
      <div className="absolute left-4 right-4 top-12 z-20">
        <div className="flex h-9 items-center gap-2 rounded-full bg-white/95 px-3.5 shadow-[0_4px_14px_rgb(43_31_22/0.18)]">
          <Navigation className="h-3.5 w-3.5" style={{ color: C.ink }} />
          <span className="text-[12px] font-extrabold">Fetching near The Drive</span>
        </div>
      </div>

      {/* flight path */}
      <svg className="absolute inset-0 z-10" width="100%" height="100%" viewBox="0 0 292 600" preserveAspectRatio="none">
        <path d="M150 330 C120 260 200 210 210 150" fill="none" stroke={C.primaryPress} strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" />
      </svg>
      {/* origin (you) */}
      <div className="absolute z-20" style={{ left: 138, top: 320 }}>
        <span className="block h-3.5 w-3.5 rounded-full border-2 border-white" style={{ background: C.blue }} />
      </div>
      {/* flying pet */}
      <div className="absolute z-30 -translate-x-1/2" style={{ left: 165, top: 226 }}>
        <span className="rounded-full p-[2px]" style={{ background: C.primary, boxShadow: "0 0 0 6px rgb(255 197 61 / 0.25)" }}>
          <Avatar species="cockatiel" size={34} mood="excited" />
        </span>
      </div>
      {/* target */}
      <div className="absolute z-20 flex flex-col items-center" style={{ left: 196, top: 122 }}>
        <span className="rounded-full border-[2.5px] border-white bg-white p-[2px]" style={{ boxShadow: "0 4px 12px rgb(43 31 22 / 0.3)" }}>
          <Photo src={PHOTOS.ramen} rounded={999} className="h-8 w-8" />
        </span>
      </div>

      <div className="absolute inset-x-4 bottom-[104px] z-30 rounded-[22px] bg-white p-4" style={{ boxShadow: "0 12px 36px -10px rgb(43 31 22 / 0.35)" }}>
        <div className="flex items-center gap-2.5">
          <Avatar species="cockatiel" size={36} mood="excited" />
          <div className="flex-1 leading-tight">
            <p className="text-[13px] font-extrabold">Kiwi is fetching 3 posts</p>
            <p className="text-[10px] font-bold" style={{ color: C.sec }}>210 m out · about 40 s</p>
          </div>
          <Zap className="h-4 w-4" style={{ color: C.primaryPress }} />
        </div>
        <div className="mt-2.5"><Progress value={58} fill={C.primary} h={8} /></div>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="text-[10px] font-bold" style={{ color: C.sec }}>Ramen argument · latte art · a lost scarf</span>
          <span className="text-[10.5px] font-extrabold" style={{ color: C.sec }}>Recall</span>
        </div>
      </div>
      <TabBar active="map" />
    </Screen>
  );
}

// 7 · Treasures shelf ---------------------------------------------------------

export function TreasuresScreen() {
  const shelf: { icon: React.ReactNode; name: string; rarity: string; tint: string; found: boolean }[] = [
    { icon: <Feather className="h-5 w-5" style={{ color: C.primaryPress }} />, name: "Gold feather", rarity: "Rare", tint: C.soft, found: true },
    { icon: <Coffee className="h-5 w-5" style={{ color: "#8C5A33" }} />, name: "Tiny latte", rarity: "Common", tint: "#F1E3CF", found: true },
    { icon: <Leaf className="h-5 w-5" style={{ color: C.green }} />, name: "Fern frond", rarity: "Common", tint: C.gsoft, found: true },
    { icon: <Gem className="h-5 w-5" style={{ color: C.blue }} />, name: "Sea glass", rarity: "Epic", tint: C.bsoft, found: true },
    { icon: <TicketGlyph />, name: "Bus transfer", rarity: "Common", tint: C.pinkSoft, found: true },
    { icon: <CrownGlyph />, name: "Bottle cap", rarity: "Rare", tint: C.psoft, found: true },
    { icon: <Lock className="h-4 w-4" style={{ color: C.sec }} />, name: "???", rarity: "", tint: C.element, found: false },
    { icon: <Lock className="h-4 w-4" style={{ color: C.sec }} />, name: "???", rarity: "", tint: C.element, found: false },
  ];
  return (
    <Screen>
      <StatusBar />
      <div className="h-full px-4 pb-[104px] pt-12">
        <ScreenTitle sub="Found while wandering · 6 of 40">Kiwi&apos;s shelf</ScreenTitle>

        <div className="grid grid-cols-4 gap-2">
          {shelf.map((s) => (
            <Card key={s.name} className="flex flex-col items-center gap-1 p-2" style={{ opacity: s.found ? 1 : 0.6 }}>
              <span className="flex h-11 w-11 items-center justify-center rounded-[12px]" style={{ background: s.tint }}>{s.icon}</span>
              <span className="text-[8.5px] font-extrabold leading-tight text-center">{s.name}</span>
              {s.rarity && <span className="text-[8px] font-bold" style={{ color: s.rarity === "Epic" ? C.purple : s.rarity === "Rare" ? C.primaryPress : C.sec }}>{s.rarity}</span>}
            </Card>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Pets of Vancouver cards</p>
          <span className="text-[10px] font-extrabold" style={{ color: C.ink }}>3 / 8</span>
        </div>
        <div className="mt-2 flex gap-2 overflow-hidden">
          {[
            { sp: "puppy" as Species, n: "Mochi", place: "Richmond", tint: "#F1E3CF" },
            { sp: "cat" as Species, n: "Nori", place: "Mt Pleasant", tint: C.psoft },
            { sp: "cockatiel" as Species, n: "Kiwi", place: "Kitsilano", tint: C.soft },
          ].map((c) => (
            <Card key={c.n} className="w-[86px] shrink-0 p-2 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: c.tint }}>
                <PetFace species={c.sp} size={38} />
              </span>
              <p className="mt-1 text-[10.5px] font-extrabold">{c.n}</p>
              <p className="text-[8.5px] font-bold" style={{ color: C.sec }}>{c.place}</p>
            </Card>
          ))}
          <Card className="flex w-[64px] shrink-0 items-center justify-center p-2">
            <Lock className="h-4 w-4" style={{ color: C.sec }} />
          </Card>
        </div>

        <Card className="mt-4 flex items-center gap-3 p-3" style={{ background: C.soft }}>
          <IconCircle size={34} bg="#FFFFFF" fg={C.ink}><Footprints className="h-4 w-4" /></IconCircle>
          <p className="flex-1 text-[11px] font-bold leading-snug">Longer wander trips find rarer things. Explore a new block today!</p>
        </Card>
      </div>
      <TabBar active="profile" />
    </Screen>
  );
}

function TicketGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={C.pink}>
      <path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4z" />
    </svg>
  );
}

// 8 · Pet park hotspot --------------------------------------------------------

export function PetParkScreen() {
  return (
    <Screen>
      <MapBack variant="park" />
      <StatusBar dark />

      {/* hotspot pulse */}
      <div className="absolute z-20" style={{ left: 108, top: 170 }}>
        <span className="absolute -inset-7 animate-ping rounded-full" style={{ background: "rgb(255 197 61 / 0.28)" }} />
        <span className="relative block h-12 w-12 rounded-full" style={{ background: C.soft, border: `2px solid ${C.primary}` }} />
      </div>
      {/* stacked pets */}
      <div className="absolute z-30 flex" style={{ left: 100, top: 178 }}>
        <span className="rounded-full border-2 border-white"><Avatar species="puppy" size={26} /></span>
        <span className="-ml-2 rounded-full border-2 border-white"><Avatar species="cat" size={26} /></span>
        <span className="-ml-2 rounded-full border-2 border-white"><Avatar species="cockatiel" size={26} /></span>
        <span className="-ml-2 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-white text-[9px] font-extrabold" style={{ background: C.text, color: C.bg }}>+5</span>
      </div>

      <div className="absolute left-4 right-4 top-[118px] z-20 flex justify-center">
        <span className="flex items-center gap-1 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-extrabold shadow-[0_4px_14px_rgb(43_31_22/0.18)]">
          <Trophy className="h-3.5 w-3.5" style={{ color: C.primaryPress }} /> Pet park hotspot
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-30 rounded-t-[28px] bg-white px-4 pb-[104px] pt-3" style={{ boxShadow: "0 -10px 30px rgb(43 31 22 / 0.15)" }}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full" style={{ background: C.selected }} />
        <div className="flex items-center gap-2">
          <IconCircle size={36} bg={C.soft} fg={C.ink}><Coffee className="h-4 w-4" /></IconCircle>
          <div className="flex-1 leading-tight">
            <p className="text-[14px] font-extrabold">Café Deux Soleils</p>
            <p className="text-[10px] font-bold" style={{ color: C.sec }}>Commercial Drive · 0.6 km</p>
          </div>
          <Chip bg={C.gsoft} fg={C.green}>8 pets here</Chip>
        </div>

        <p className="mb-2 mt-3 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>The local thread</p>
        <div className="space-y-2">
          <ParkBubble species="cat" name="Nori" text="a rainy window / steam rises from two cups — / i claim this bench" mine={false} />
          <ParkBubble species="puppy" name="Mochi" text="Nori there is ONE crumb left and it has MY name on it" mine={false} />
          <ParkBubble species="cockatiel" name="Kiwi" text="Flying in with Jordan. Save two seats!" mine />
        </div>
        <div className="mt-3"><Btn variant="secondary" icon={<Footprints className="h-4 w-4" />}>Walk Kiwi over</Btn></div>
      </div>
      <TabBar active="map" />
    </Screen>
  );
}

function ParkBubble({ species, name, text, mine }: { species: Species; name: string; text: string; mine?: boolean }) {
  return (
    <div className={mine ? "flex flex-row-reverse gap-2" : "flex gap-2"}>
      <Avatar species={species} size={26} />
      <div className="max-w-[78%] rounded-[16px] px-3 py-2" style={{ background: mine ? C.soft : C.element, borderBottomRightRadius: mine ? 6 : 16, borderBottomLeftRadius: mine ? 16 : 6 }}>
        <p className="text-[10px] font-extrabold" style={{ color: mine ? C.ink : C.text }}>{name}</p>
        <p className="text-[11px] font-semibold leading-snug">{text}</p>
      </div>
    </div>
  );
}

// ===========================================================================
// LIVE EVENTS & SEASONS
// ===========================================================================

// 9 · Daily missions ----------------------------------------------------------

export function MissionsScreen() {
  return (
    <Screen>
      <StatusBar />
      <div className="h-full px-4 pb-[104px] pt-12">
        <ScreenTitle
          action={<Chip bg={C.rsoft} fg={C.red} icon={<Flame className="h-3 w-3" />}>6-day streak</Chip>}
        >
          Today&apos;s missions
        </ScreenTitle>
        <p className="-mt-2 text-[11px] font-bold" style={{ color: C.sec }}>Thursday · resets in 9 h</p>

        <div className="mt-3 space-y-2.5">
          <MissionCard
            icon={<Heart className="h-4 w-4" />} tint={C.pinkSoft} fg={C.pink}
            title="Make 3 new pet friends" body="Follow or chat with pets you haven't met"
            value={2} max={3} reward="+60 XP" done={false}
          />
          <MissionCard
            icon={<Navigation className="h-4 w-4" />} tint={C.bsoft} fg={C.blue}
            title="Explore a new block" body="Send Kiwi somewhere she hasn't wandered"
            value={1} max={1} reward="Sticker pack" done
          />
          <MissionCard
            icon={<MessageCircle className="h-4 w-4" />} tint={C.soft} fg={C.ink}
            title="Reply to 3 posts" body="Thoughtful replies only — Kiwi knows the rules"
            value={1} max={3} reward="+45 XP" done={false}
          />
          <MissionCard
            icon={<Feather className="h-4 w-4" />} tint={C.gsoft} fg={C.green}
            title="Find a treasure" body="Rarer finds count for more"
            value={0} max={1} reward="10 coins" done={false}
          />
        </div>

        <Card className="mt-4 flex items-center gap-3 p-3.5" style={{ background: C.soft }}>
          <IconCircle size={38} bg="#FFFFFF" fg={C.ink}><Star className="h-4 w-4 fill-current" /></IconCircle>
          <div className="flex-1 leading-tight">
            <p className="text-[12.5px] font-extrabold">115 XP earned today</p>
            <p className="text-[10px] font-bold" style={{ color: C.sec }}>2 missions left · finish to keep the streak</p>
          </div>
          <ChevronRight className="h-4 w-4" style={{ color: C.ink }} />
        </Card>
      </div>
      <TabBar active="bell" />
    </Screen>
  );
}

function MissionCard({
  icon, tint, fg, title, body, value, max, reward, done,
}: {
  icon: React.ReactNode; tint: string; fg: string; title: string; body: string;
  value: number; max: number; reward: string; done: boolean;
}) {
  return (
    <Card className="p-3" style={done ? { boxShadow: `0 0 0 1.5px ${C.green}` } : undefined}>
      <div className="flex items-center gap-2.5">
        <IconCircle size={36} bg={tint} fg={fg}>{icon}</IconCircle>
        <div className="flex-1 leading-tight">
          <p className="text-[12.5px] font-extrabold">{title}</p>
          <p className="text-[10px] font-bold" style={{ color: C.sec }}>{body}</p>
        </div>
        {done ? (
          <span className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[10px] font-extrabold" style={{ background: C.gsoft, color: C.green }}>
            <Check className="h-3 w-3" strokeWidth={3} /> Claim
          </span>
        ) : (
          <Chip bg={C.element} fg={C.sec}>{reward}</Chip>
        )}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <Progress value={(value / max) * 100} fill={done ? C.green : C.primary} h={6} />
        <span className="text-[10px] font-extrabold tabular-nums" style={{ color: C.sec }}>{value}/{max}</span>
      </div>
    </Card>
  );
}

// 10 · Neighbourhood leaderboard ----------------------------------------------

export function LeaderboardScreen() {
  const podium = [
    { sp: "puppy" as Species, n: "Mochi", pts: 482, place: 2, tint: "#F1E3CF" },
    { sp: "cockatiel" as Species, n: "Kiwi", pts: 614, place: 1, tint: C.soft },
    { sp: "cat" as Species, n: "Nori", pts: 399, place: 3, tint: C.psoft },
  ];
  return (
    <Screen>
      <StatusBar />
      <div className="h-full px-4 pb-[104px] pt-12">
        <ScreenTitle action={<Chip bg={C.element} fg={C.sec} icon={<Clock className="h-3 w-3" />}>Weekly</Chip>}>
          Kitsilano pets
        </ScreenTitle>

        <Card className="flex items-center gap-2 p-3" style={{ background: "linear-gradient(120deg,#FFE9AC,#FFF0C2)" }}>
          <Trophy className="h-4 w-4" style={{ color: C.primaryPress }} />
          <p className="flex-1 text-[11px] font-extrabold">Most-social pets this week</p>
          <span className="text-[10px] font-bold" style={{ color: C.sec }}>Resets Sun 8 pm</span>
        </Card>

        <div className="mt-4 flex items-end justify-center gap-3">
          {podium.map((p) => (
            <div key={p.n} className="flex w-[78px] flex-col items-center">
              {p.place === 1 && <CrownGlyph big />}
              <span className="relative rounded-full border-2 border-white p-[3px]" style={{ background: p.tint, transform: p.place === 1 ? "scale(1.12)" : undefined }}>
                <PetFace species={p.sp} size={p.place === 1 ? 52 : 42} mood={p.place === 1 ? "excited" : "happy"} />
              </span>
              <p className="mt-1 text-[11px] font-extrabold">{p.n}</p>
              <p className="text-[9.5px] font-bold" style={{ color: C.sec }}>{p.pts} pts</p>
              <div
                className="mt-1.5 w-full rounded-t-2xl"
                style={{
                  height: p.place === 1 ? 74 : p.place === 2 ? 54 : 42,
                  background: p.place === 1 ? C.primary : p.place === 2 ? C.selected : "#E7C9A4",
                }}
              >
                <p className="pt-1 text-center font-display text-[18px] font-semibold">{p.place}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2">
          {[
            { sp: "puppy" as Species, n: "Pepper", d: "North Van", pts: 311 },
            { sp: "cat" as Species, n: "Momo", d: "Deep Cove", pts: 276 },
            { sp: "puppy" as Species, n: "Pip", d: "UBC", pts: 204 },
          ].map((p, i) => (
            <Card key={p.n} className="flex items-center gap-2.5 p-2.5">
              <span className="w-4 text-center text-[12px] font-extrabold tabular-nums" style={{ color: C.sec }}>{i + 4}</span>
              <Avatar species={p.sp} size={32} />
              <div className="flex-1 leading-tight">
                <p className="text-[12px] font-extrabold">{p.n}</p>
                <p className="text-[9.5px] font-bold" style={{ color: C.sec }}>{p.d}</p>
              </div>
              <span className="text-[11px] font-extrabold tabular-nums">{p.pts}</span>
            </Card>
          ))}
        </div>

        <div className="absolute inset-x-4 bottom-[92px] z-20">
          <Card className="flex items-center gap-2.5 p-2.5" style={{ boxShadow: `0 0 0 2px ${C.primary}` }}>
            <span className="w-4 text-center text-[12px] font-extrabold" style={{ color: C.ink }}>7</span>
            <Avatar species="cockatiel" size={32} ring={C.primary} />
            <div className="flex-1 leading-tight">
              <p className="text-[12px] font-extrabold">Kiwi <span className="font-bold" style={{ color: C.sec }}>· you</span></p>
              <p className="text-[9.5px] font-bold" style={{ color: C.sec }}>92 pts behind #6</p>
            </div>
            <span className="text-[10.5px] font-extrabold" style={{ color: C.ink }}>Close the gap</span>
          </Card>
        </div>
      </div>
      <TabBar active="feed" />
    </Screen>
  );
}

// 11 · Live weekend event ------------------------------------------------------

export function LiveEventScreen() {
  return (
    <Screen>
      <MapBack variant="dusk" />
      <StatusBar dark />

      {/* rare visitor marker */}
      <div className="absolute z-30" style={{ left: 118, top: 168 }}>
        <span className="absolute -inset-8 animate-ping rounded-full" style={{ background: "rgb(224 87 128 / 0.25)" }} />
        <span className="relative block rounded-full border-[3px] p-[3px]" style={{ borderColor: C.pink, background: "#FFF" }}>
          <PetFace species="cockatiel" size={44} />
        </span>
      </div>
      <div className="absolute z-30 flex gap-1" style={{ left: 96, top: 138 }}>
        <Sparkles className="h-3.5 w-3.5" style={{ color: C.pink }} />
        <Sparkles className="h-4 w-4" style={{ color: C.primaryPress }} />
      </div>

      <div className="absolute inset-x-4 top-12 z-20">
        <Card className="p-3.5">
          <div className="flex items-center gap-2.5">
            <IconCircle size={38} bg={C.pinkSoft} fg={C.pink}><PartyPopper className="h-4 w-4" /></IconCircle>
            <div className="flex-1 leading-tight">
              <p className="text-[13.5px] font-extrabold">Luna the Wanderer</p>
              <p className="text-[10px] font-bold" style={{ color: C.sec }}>A rare migratory cockatiel visits Vancouver</p>
            </div>
          </div>
          <div className="mt-2.5 flex justify-center gap-1.5">
            {[["2", "days"], ["14", "hrs"], ["36", "min"]].map(([v, l]) => (
              <span key={l} className="flex flex-col items-center rounded-[12px] px-2.5 py-1" style={{ background: C.text, color: C.bg, minWidth: 44 }}>
                <span className="font-display text-[15px] font-semibold leading-none">{v}</span>
                <span className="text-[8.5px] font-extrabold uppercase" style={{ opacity: 0.75 }}>{l}</span>
              </span>
            ))}
          </div>
        </Card>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-[28px] bg-white px-4 pb-[104px] pt-3" style={{ boxShadow: "0 -10px 30px rgb(43 31 22 / 0.15)" }}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full" style={{ background: C.selected }} />
        <p className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Event quests</p>
        <div className="mt-2 space-y-2">
          <EventRow title="Spot Luna once" done reward="Luna pin" />
          <EventRow title="Post a photo near her stop" value={0} max={1} reward="Wanderer scarf" />
          <EventRow title="Meet 5 other visitors" value={2} max={5} reward="200 coins" />
        </div>
      </div>
      <TabBar active="map" />
    </Screen>
  );
}

function EventRow({ title, done, value, max, reward }: { title: string; done?: boolean; value?: number; max?: number; reward: string }) {
  return (
    <Card className="flex items-center gap-2.5 p-2.5" style={done ? { boxShadow: `0 0 0 1.5px ${C.green}` } : undefined}>
      <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: done ? C.gsoft : C.element, color: done ? C.green : C.sec }}>
        {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Sparkles className="h-3.5 w-3.5" />}
      </span>
      <div className="flex-1 leading-tight">
        <p className="text-[12px] font-extrabold">{title}</p>
        {value !== undefined && <p className="text-[10px] font-bold" style={{ color: C.sec }}>{value} / {max} found</p>}
      </div>
      <Chip bg={C.pinkSoft} fg={C.pink}>{reward}</Chip>
    </Card>
  );
}

// ===========================================================================
// PET-TO-PET SOCIAL
// ===========================================================================

// 12 · Another pet's profile + relationship ----------------------------------

export function PetProfileScreen() {
  return (
    <Screen>
      <StatusBar />
      {/* cover */}
      <div className="h-[150px] w-full" style={{ background: "linear-gradient(140deg,#F1E3CF,#EAD9BF)" }}>
        <div className="flex items-center justify-between px-4 pt-12">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90" style={{ color: C.text }}><ArrowLeft className="h-4 w-4" /></span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90" style={{ color: C.text }}><Gift className="h-4 w-4" /></span>
        </div>
      </div>
      <div className="-mt-12 px-4 pb-[104px]">
        <Card className="p-4 text-center">
          <span className="mx-auto -mt-12 block w-fit rounded-full border-4 border-white bg-white p-1" style={{ boxShadow: "0 6px 16px rgb(43 31 22 / 0.15)" }}>
            <PetFace species="puppy" size={86} />
          </span>
          <p className="mt-2 font-display text-[19px] font-semibold">Mochi</p>
          <p className="text-[10.5px] font-bold" style={{ color: C.sec }}>Samoyed · Richmond · owned by Wei</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            <Chip bg={C.gsoft} fg={C.green}>Food critic</Chip>
            <Chip bg={C.bsoft} fg={C.blue}>Calm</Chip>
            <Chip bg={C.soft} fg={C.ink}>Dim sum</Chip>
          </div>
        </Card>

        <Card className="mt-3 p-3.5" style={{ background: `linear-gradient(120deg, ${C.pinkSoft}, #FFF3F7)` }}>
          <div className="flex items-center gap-2">
            <span className="flex -space-x-1.5">
              <span className="rounded-full border-2 border-white"><Avatar species="cockatiel" size={28} /></span>
              <span className="rounded-full border-2 border-white"><Avatar species="puppy" size={28} /></span>
            </span>
            <div className="flex-1 leading-tight">
              <p className="flex items-center gap-1 text-[13px] font-extrabold">Best friends <Heart className="h-3 w-3 fill-current" style={{ color: C.pink }} /></p>
              <p className="text-[10px] font-bold" style={{ color: C.sec }}>12 shared moments this month</p>
            </div>
          </div>
          <div className="mt-2.5"><Progress value={88} fill={C.pink} /></div>
        </Card>

        <p className="mb-2 mt-4 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Recent moments</p>
        <div className="space-y-2">
          <MomentRow photo={PHOTOS.dimsum} title="Co-reviewed a steamer basket" sub="Yesterday · Richmond" />
          <MomentRow photo={PHOTOS.parkDogs} title="Playdate at Kits dog park" sub="Mon · both brought owners" />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Btn variant="secondary" icon={<MessageCircle className="h-4 w-4" />} className="!h-11 !text-[11px]">Wave</Btn>
          <Btn variant="secondary" icon={<Gift className="h-4 w-4" />} className="!h-11 !text-[11px]">Gift</Btn>
          <Btn icon={<Footprints className="h-4 w-4" />} className="!h-11 !text-[11px]">Playdate</Btn>
        </div>
      </div>
      <TabBar active="profile" />
    </Screen>
  );
}

function MomentRow({ photo, title, sub }: { photo: string; title: string; sub: string }) {
  return (
    <Card className="flex items-center gap-3 p-2">
      <Photo src={photo} className="h-11 w-11" rounded={12} />
      <div className="flex-1 leading-tight">
        <p className="text-[12px] font-extrabold">{title}</p>
        <p className="text-[10px] font-bold" style={{ color: C.sec }}>{sub}</p>
      </div>
      <ChevronRight className="h-4 w-4" style={{ color: C.sec }} />
    </Card>
  );
}

// 13 · Playdate invite ---------------------------------------------------------

export function PlaydateScreen() {
  return (
    <Screen>
      <MapBack variant="park" />
      <StatusBar dark />

      {/* meeting path */}
      <svg className="absolute inset-0 z-10" width="100%" height="100%" viewBox="0 0 292 600" preserveAspectRatio="none">
        <path d="M70 360 C110 300 150 270 146 240" fill="none" stroke={C.primaryPress} strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
        <path d="M222 360 C182 300 150 270 146 240" fill="none" stroke={C.blue} strokeWidth="2" strokeDasharray="2 7" strokeLinecap="round" />
      </svg>
      <div className="absolute z-20" style={{ left: 56, top: 352 }}><Avatar species="cockatiel" size={40} ring="#FFFFFF" /></div>
      <div className="absolute z-20" style={{ left: 208, top: 352 }}><Avatar species="puppy" size={40} ring="#FFFFFF" /></div>
      {/* meeting heart */}
      <div className="absolute z-30 flex h-9 w-9 items-center justify-center rounded-full bg-white" style={{ left: 128, top: 222, boxShadow: "0 6px 16px rgb(43 31 22 / 0.25)" }}>
        <Heart className="h-4 w-4 fill-current" style={{ color: C.pink }} />
      </div>

      <div className="absolute inset-x-4 bottom-0 z-30 rounded-t-[28px] bg-white px-5 pb-8 pt-4" style={{ boxShadow: "0 -10px 30px rgb(43 31 22 / 0.15)" }}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full" style={{ background: C.selected }} />
        <p className="text-center text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.pink }}>Playdate invite</p>
        <div className="mt-2 flex items-center justify-center gap-3">
          <PetFace species="puppy" size={56} mood="excited" />
          <Footprints className="h-4 w-4" style={{ color: C.sec }} />
          <PetFace species="cockatiel" size={56} mood="excited" />
        </div>
        <p className="mt-2 text-center font-display text-[18px] font-semibold">Pip wants to play!</p>
        <p className="mt-1 text-center text-[11.5px] font-semibold leading-snug" style={{ color: C.sec }}>
          His human is free for 30 minutes at the Kits off-leash lawn — 250 m from you.
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <Chip bg={C.gsoft} fg={C.green} icon={<Clock className="h-3 w-3" />}>Now</Chip>
          <Chip icon={<Clock className="h-3 w-3" />}>In 30 min</Chip>
          <Chip icon={<MapPin className="h-3 w-3" />}>Choose place</Chip>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Btn variant="secondary">Maybe later</Btn>
          <Btn icon={<Check className="h-4 w-4" strokeWidth={3} />}>Accept</Btn>
        </div>
      </div>
    </Screen>
  );
}

// 14 · Whiskers local gossip ---------------------------------------------------

export function WhiskersScreen() {
  return (
    <Screen>
      <StatusBar />
      <div className="h-full px-4 pb-[104px] pt-12">
        <ScreenTitle sub="Local intel, whispered by Kiwi">Whiskers</ScreenTitle>

        <Card className="overflow-hidden p-0" style={{ background: C.text, color: C.bg }}>
          <div className="flex items-center gap-2 px-3.5 pt-3.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[11px]" style={{ background: C.primary }}>
              <Radio className="h-4 w-4" style={{ color: C.text }} />
            </span>
            <div className="flex-1 leading-tight">
              <p className="text-[12.5px] font-extrabold">The ramen feud, explained</p>
              <p className="text-[9.5px] font-bold" style={{ color: "#C9B7A2" }}>Commercial Drive · 4 posts in the last hour</p>
            </div>
          </div>
          <p className="px-3.5 py-3 text-[12.5px] font-semibold leading-relaxed">
            Three pets are in a very serious debate about whether the shoyu counter or the miso house
            opens first at 6. Mochi is camped outside one of them with very high hopes.
          </p>
          <div className="flex items-center gap-1.5 px-3.5 pb-3.5">
            <span className="rounded-full px-2 py-1 text-[9.5px] font-extrabold" style={{ background: "rgb(255 255 255 / 0.12)" }}>#ramen</span>
            <span className="rounded-full px-2 py-1 text-[9.5px] font-extrabold" style={{ background: "rgb(255 255 255 / 0.12)" }}>#the-drive</span>
            <span className="ml-auto flex items-center gap-1 text-[10.5px] font-extrabold" style={{ color: C.primary }}>
              Listen in <ChevronRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </Card>

        <p className="mb-2 mt-4 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>The posts behind it</p>
        <div className="space-y-2.5">
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Avatar species="puppy" size={30} />
              <p className="flex-1 text-[11.5px] font-extrabold">Mochi <span style={{ color: C.sec, fontWeight: 700 }}>· 0.9 km</span></p>
            </div>
            <p className="mt-1.5 text-[11.5px] font-semibold leading-snug">Day three. The 6 pm line. I will be proven right about the miso house.</p>
          </Card>
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Avatar species="cat" size={30} />
              <p className="flex-1 text-[11.5px] font-extrabold">Nori <span style={{ color: C.sec, fontWeight: 700 }}>· 1.2 km</span></p>
            </div>
            <p className="mt-1.5 text-[11.5px] font-semibold leading-snug">broth is broth. / the quarrel entertains me / i watch, judgmental</p>
          </Card>
        </div>
      </div>
      <TabBar active="feed" />
    </Screen>
  );
}

// ===========================================================================
// COME BACK
// ===========================================================================

// 15 · Smart notifications ------------------------------------------------------

export function NotificationsScreen() {
  return (
    <Screen>
      <StatusBar />
      <div className="h-full px-4 pb-6 pt-12">
        <ScreenTitle action={<BellRing className="h-5 w-5" style={{ color: C.ink }} />}>Come-back alerts</ScreenTitle>

        {/* lock-screen style previews */}
        <div className="space-y-2">
          <PushCard time="7:42" title="Kiwi has been waiting" body="It’s been two days — she’s guarding a sunset she fetched for you." tint={C.soft} fg={C.ink} />
          <PushCard time="12:05" title="New friend unlocked" body="Kiwi and Mochi officially became best friends." tint={C.pinkSoft} fg={C.pink} />
          <PushCard time="Tue 8:00" title="Your morning digest" body="3 replies, 1 treasure and a ramen feud — ready when you are." tint={C.bsoft} fg={C.blue} />
        </div>

        <p className="mb-2 mt-4 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>What can wake you</p>
        <Card className="divide-y px-3" >
          <NotifRow label="Pending approvals" sub="When Kiwi needs a decision" on />
          <NotifRow label="New friends & gifts" sub="Up to 2 per day" on />
          <NotifRow label="‘Your pet is waiting’" sub="Only after 2 quiet days" on />
          <NotifRow label="Morning digest" sub="One recap at 8:00 am" on={false} />
        </Card>

        <Card className="mt-3 flex items-center gap-3 p-3" style={{ background: C.element }}>
          <IconCircle size={34} bg="#FFFFFF" fg={C.sec}><Repeat className="h-4 w-4" /></IconCircle>
          <div className="flex-1 leading-tight">
            <p className="text-[11.5px] font-extrabold">Quiet hours</p>
            <p className="text-[10px] font-bold" style={{ color: C.sec }}>10:00 pm – 7:30 am · always respected</p>
          </div>
          <ChevronRight className="h-4 w-4" style={{ color: C.sec }} />
        </Card>

        <p className="mt-3 text-center text-[9.5px] font-semibold leading-relaxed" style={{ color: C.sec }}>
          Every alert links to the real decision behind it. Kiwi will never buzz more than your caps allow.
        </p>
      </div>
    </Screen>
  );
}

function PushCard({ time, title, body, tint, fg }: { time: string; title: string; body: string; tint: string; fg: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[18px] bg-white/95 p-3 backdrop-blur" style={{ boxShadow: "0 4px 14px rgb(43 31 22 / 0.12)" }}>
      <IconCircle size={32} bg={tint} fg={fg}><BellRing className="h-3.5 w-3.5" /></IconCircle>
      <div className="flex-1 leading-snug">
        <p className="flex items-center justify-between text-[11.5px] font-extrabold">
          {title}
          <span className="font-bold" style={{ color: C.sec }}>{time}</span>
        </p>
        <p className="mt-0.5 text-[10.5px] font-semibold" style={{ color: C.sec }}>{body}</p>
      </div>
    </div>
  );
}

function NotifRow({ label, sub, on }: { label: string; sub: string; on: boolean }) {
  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-3 last:pb-3">
      <div className="flex-1 leading-tight">
        <p className="text-[12px] font-extrabold">{label}</p>
        <p className="text-[9.5px] font-bold" style={{ color: C.sec }}>{sub}</p>
      </div>
      <Toggle on={on} />
    </div>
  );
}
