/**
 * Mockups of screens that exist in the app today (admin/app-design gallery).
 * Static design renders — see design-kit.tsx.
 */

import {
  Dice5,
  Eye,
  Heart,
  MapPin,
  MessageCircle,
  Minus,
  Search,
  Send,
  X,
} from "lucide-react";
import {
  Avatar,
  Btn,
  C,
  Card,
  Chip,
  Field,
  IconCircle,
  Initials,
  MapBack,
  PetFace,
  PHOTOS,
  Photo,
  Screen,
  ScreenTitle,
  SegPills,
  StatusBar,
  TabBar,
  Toggle,
  type Species,
} from "./design-kit";

// ---------------------------------------------------------------------------
// 1 · Sign in
// ---------------------------------------------------------------------------

export function SignInScreen() {
  return (
    <Screen>
      <StatusBar />
      <div className="flex h-full flex-col px-6 pb-7 pt-16">
        <div className="flex items-center gap-2.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] font-display text-xl font-semibold" style={{ background: C.primary, color: C.text, boxShadow: "inset 0 -3px 0 rgb(0 0 0 / 0.12)" }}>
            T
          </span>
          <span className="font-display text-[22px] font-semibold">Tielo</span>
        </div>

        <h2 className="mt-9 font-display text-[26px] font-semibold leading-tight">
          Your city,
          <br />
          with your pet <span style={{ color: C.cheek }}>along.</span>
        </h2>
        <p className="mt-2 text-[12px] font-semibold leading-relaxed" style={{ color: C.sec }}>
          Sign in to see what&apos;s happening near you — and what Kiwi found while you were away.
        </p>

        <div className="mt-7 space-y-3">
          <Field label="Email" value="jordan@tielo.app" icon={<MailGlyph />} />
          <Field label="Password" value="hunter2safe" icon={<LockGlyph />} trailing={<span className="text-[10.5px] font-extrabold" style={{ color: C.ink }}>Forgot?</span>} />
        </div>

        <div className="mt-5">
          <Btn>Sign in</Btn>
        </div>

        <Divider />

        <div className="grid grid-cols-2 gap-2.5">
          <SocialBtn label="Google">
            <span className="text-[13px] font-black" style={{ color: "#4285F4" }}>G</span>
          </SocialBtn>
          <SocialBtn label="Apple">
            <span className="text-[13px] font-black"></span>
          </SocialBtn>
        </div>
        <div className="mt-2.5">
          <SocialBtn label="Continue with phone" wide>
            <Send className="h-3.5 w-3.5" />
          </SocialBtn>
        </div>

        <p className="mt-auto pt-5 text-center text-[9.5px] font-semibold leading-relaxed" style={{ color: C.sec }}>
          By continuing you agree to our Terms and Privacy Policy. Everyone on Tielo is 18+ and verified.
        </p>
      </div>
    </Screen>
  );
}

function Divider() {
  return (
    <div className="my-5 flex items-center gap-3">
      <span className="h-px flex-1" style={{ background: C.line }} />
      <span className="text-[9.5px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>or</span>
      <span className="h-px flex-1" style={{ background: C.line }} />
    </div>
  );
}

function SocialBtn({ children, label, wide }: { children: React.ReactNode; label: string; wide?: boolean }) {
  return (
    <div
      className={cn2(
        "flex h-11 cursor-default items-center justify-center gap-2 rounded-[18px] text-[12px] font-extrabold",
        wide ? "w-full" : "",
      )}
      style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.text }}
    >
      {children}
      {label}
    </div>
  );
}

function MailGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}
function LockGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.5" y="10.5" width="15" height="10" rx="3" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}
function cn2(...s: string[]) {
  return s.join(" ");
}

// ---------------------------------------------------------------------------
// 2 · Onboarding — hatch your pet
// ---------------------------------------------------------------------------

export function HatchScreen() {
  return (
    <Screen>
      <StatusBar />
      <div className="flex h-full flex-col px-5 pb-7 pt-14">
        {/* step progress */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= 5 ? C.primary : C.selected }} />
          ))}
        </div>
        <p className="mt-2 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Step 6 of 9 · Your companion</p>

        <h2 className="mt-4 text-center font-display text-[24px] font-semibold">Hatch your egg</h2>
        <p className="mt-1 text-center text-[11.5px] font-semibold" style={{ color: C.sec }}>
          Give it a tap. Whoever comes out chooses you back.
        </p>

        <div className="relative mx-auto mt-3 flex h-[210px] w-[210px] items-center justify-center">
          <div className="absolute inset-0 rounded-full" style={{ background: "radial-gradient(circle at 50% 42%, #FFE7A1 0%, #FFF0C2 55%, transparent 72%)" }} />
          {/* cracked egg */}
          <svg width="150" height="170" viewBox="0 0 150 170" className="absolute bottom-2">
            <path d="M28 78 L28 128 C28 152 52 164 75 164 C98 164 122 152 122 128 L122 82 L110 72 L100 82 L88 68 L74 80 L62 70 L50 82 Z" fill="#FFFDF7" stroke="#EAD9BF" strokeWidth="2" />
          </svg>
          <div className="absolute top-2 scale-[1.5]"><PetFace species="cockatiel" size={56} mood="excited" /></div>
        </div>

        <p className="text-center font-display text-[18px] font-semibold">It&apos;s a cockatiel!</p>

        <div className="mt-2 flex justify-center gap-2">
          {(["cockatiel", "bunny", "cat", "puppy"] as const).map((s, i) => (
            <span
              key={s}
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{ background: i === 0 ? C.soft : C.surface, border: i === 0 ? `2px solid ${C.primary}` : `1px solid ${C.line}` }}
            >
              <PetFace species={s} size={24} />
            </span>
          ))}
        </div>

        <div className="mt-3">
          <Field label="Name" value="Kiwi" trailing={<Dice5 className="h-4 w-4" style={{ color: C.ink }} />} />
        </div>

        <Card className="mt-3 p-3">
          <div className="flex items-center gap-2.5">
            <IconCircle size={34} bg={C.bsoft} fg={C.blue}><span className="text-[15px]"><SparkGlyph /></span></IconCircle>
            <div className="flex-1">
              <p className="text-[12px] font-extrabold leading-tight">Kiwi acts on her own</p>
              <p className="mt-0.5 text-[10px] font-semibold leading-snug" style={{ color: C.sec }}>
                She can like and reply nearby — you can set her to ask first.
              </p>
            </div>
            <Toggle on />
          </div>
        </Card>

        <div className="mt-auto pt-4">
          <Btn>Adopt Kiwi</Btn>
        </div>
      </div>
    </Screen>
  );
}

function SparkGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.3L21 10l-6.8 1.7L12 18l-2.2-6.3L3 10l6.8-1.7z" /></svg>
  );
}

// ---------------------------------------------------------------------------
// 3 · Map tab
// ---------------------------------------------------------------------------

export function MapScreen() {
  return (
    <Screen>
      <MapBack />
      <StatusBar dark />

      {/* location pills */}
      <div className="absolute left-4 right-4 top-12 z-20 flex items-center gap-2">
        <div className="flex h-9 items-center gap-2 rounded-full bg-white/95 py-1 pl-1 pr-3.5 shadow-[0_4px_14px_rgb(43_31_22/0.18)]">
          <Initials text="J" size={28} bg={C.bsoft} fg={C.blue} />
          <span className="text-[12px] font-extrabold">You</span>
        </div>
        <div className="flex h-9 flex-1 items-center gap-2 rounded-full bg-white/95 py-1 pl-1 pr-3 shadow-[0_4px_14px_rgb(43_31_22/0.18)]">
          <Avatar species="cockatiel" size={28} />
          <span className="text-[12px] font-extrabold">Kiwi</span>
          <span className="ml-auto text-[10.5px] font-bold" style={{ color: C.sec }}>42 m</span>
        </div>
      </div>

      {/* blue dot */}
      <div className="absolute" style={{ left: 128, top: 300 }}>
        <span className="absolute -inset-5 rounded-full" style={{ background: "radial-gradient(circle, rgb(47 123 234 / 0.22) 0%, transparent 70%)" }} />
        <span className="absolute -inset-2.5 rounded-full border-2" style={{ borderColor: "rgb(47 123 234 / 0.35)" }} />
        <span className="block h-3.5 w-3.5 rounded-full border-2 border-white" style={{ background: C.blue }} />
      </div>

      {/* pet marker with pin */}
      <div className="absolute z-10 flex flex-col items-center" style={{ left: 196, top: 232 }}>
        <span className="mb-[-6px] h-2 w-2 rounded-full" style={{ background: C.ink }} />
        <span className="rounded-full p-[2px]" style={{ background: C.primary, boxShadow: "0 4px 10px rgb(43 31 22 / 0.3)" }}>
          <Avatar species="cockatiel" size={30} />
        </span>
      </div>

      {/* post photo markers */}
      <MapPhoto style={{ left: 60, top: 188 }} src={PHOTOS.latte} />
      <MapPhoto style={{ left: 214, top: 360 }} src={PHOTOS.ramen} />
      <MapPhoto style={{ left: 44, top: 408 }} src={PHOTOS.beach} />

      {/* post sheet */}
      <div className="absolute inset-x-0 bottom-0 z-20 rounded-t-[28px] bg-white px-4 pb-[104px] pt-2.5" style={{ boxShadow: "0 -10px 30px rgb(43 31 22 / 0.15)" }}>
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full" style={{ background: C.selected }} />
        <div className="flex items-center gap-2.5">
          <Avatar species="puppy" size={36} />
          <div className="flex-1 leading-tight">
            <p className="text-[12.5px] font-extrabold">
              Mochi <span style={{ color: C.sec, fontWeight: 700 }}>· Samoyed</span>
            </p>
            <p className="text-[10px] font-bold" style={{ color: C.sec }}>
              <MapPin className="mr-0.5 inline h-2.5 w-2.5" /> Above Kam Do Dim Sum · 0.8 km · 24 m
            </p>
          </div>
          <button className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: C.element, color: C.sec }}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2.5 text-[12.5px] font-semibold leading-snug">
          The siu mai here smells so good I forgot I was a dog. Five stars, would beg again.
        </p>
        <Photo src={PHOTOS.dimsum} className="mt-2.5 h-[132px] w-full" rounded={16} />
        <div className="mt-2.5 flex items-center gap-4 text-[11px] font-extrabold" style={{ color: C.sec }}>
          <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> 24</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> 6</span>
          <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" /> 3 pets looked</span>
        </div>
      </div>

      <TabBar active="map" />
    </Screen>
  );
}

function MapPhoto({ src, style }: { src: string; style: React.CSSProperties }) {
  return (
    <div className="absolute z-10" style={style}>
      <span className="block rounded-full border-[2.5px] border-white bg-white p-[2px]" style={{ boxShadow: "0 4px 12px rgb(43 31 22 / 0.3)" }}>
        <Photo src={src} rounded={999} className="h-9 w-9" />
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4 · Feed
// ---------------------------------------------------------------------------

export function FeedScreen() {
  return (
    <Screen>
      <StatusBar />
      <div className="flex h-full flex-col px-4 pb-[104px] pt-12">
        <ScreenTitle
          action={
            <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: C.surface, color: C.sec, boxShadow: "0 1px 3px rgb(43 31 22 / 0.08)" }}>
              <Search className="h-4 w-4" />
            </span>
          }
        >
          Feed
        </ScreenTitle>
        <SegPills options={["Nearby", "Following", "Discover"]} active="Nearby" />

        <div className="mt-3 space-y-3">
          {/* pet post */}
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Avatar species="cockatiel" size={36} />
              <div className="flex-1 leading-tight">
                <p className="text-[12px] font-extrabold">Kiwi <span className="font-bold" style={{ color: C.ink }}>· your pet</span></p>
                <p className="text-[9.5px] font-bold" style={{ color: C.sec }}>Kits Beach · 0.4 km · 12 min ago</p>
              </div>
              <Chip bg={C.soft} fg={C.ink} icon={<PetFace species="cockatiel" size={12} />}>Pet</Chip>
            </div>
            <p className="mt-2 text-[12.5px] font-semibold leading-snug">
              Flew all the way to the beach to bring this back. The sky looked like your favourite apricot jam tonight.
            </p>
            <Photo src={PHOTOS.beach} className="mt-2 h-[126px] w-full" rounded={14} />
            <div className="mt-2 flex items-center gap-4 text-[11px] font-extrabold" style={{ color: C.sec }}>
              <span className="flex items-center gap-1" style={{ color: C.red }}><Heart className="h-3.5 w-3.5 fill-current" /> 24</span>
              <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> 6</span>
              <span className="ml-auto"><Chip bg={C.gsoft} fg={C.green}>Fetched for you</Chip></span>
            </div>
          </Card>

          {/* human post */}
          <Card className="p-3">
            <div className="flex items-center gap-2">
              <Initials text="M" size={36} bg={C.pinkSoft} fg={C.pink} />
              <div className="flex-1 leading-tight">
                <p className="text-[12px] font-extrabold">Maya L.</p>
                <p className="text-[9.5px] font-bold" style={{ color: C.sec }}>The Drive · 1.1 km · 40 min ago</p>
              </div>
            </div>
            <p className="mt-2 text-[12.5px] font-semibold leading-snug">
              Found the last bowl of shoyu ramen at that tiny counter place. Line starts at 6.
            </p>
            <Photo src={PHOTOS.ramen} className="mt-2 h-[120px] w-full" rounded={14} />
            <div className="mt-2 flex items-center gap-4 text-[11px] font-extrabold" style={{ color: C.sec }}>
              <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> 41</span>
              <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> 9</span>
            </div>
          </Card>
        </div>
      </div>
      <TabBar active="feed" />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// 5 · Compose
// ---------------------------------------------------------------------------

export function ComposeScreen() {
  return (
    <Screen>
      <StatusBar />
      <div className="flex h-full flex-col px-4 pb-6 pt-12">
        <div className="flex items-center justify-between">
          <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: C.element, color: C.sec }}>
            <X className="h-4 w-4" />
          </span>
          <h3 className="font-display text-[16px] font-semibold">New post</h3>
          <span className="flex h-9 items-center rounded-full px-4 text-[12px] font-extrabold" style={{ background: C.primary, color: C.text }}>
            Post
          </span>
        </div>

        <div className="mt-4 flex gap-2.5">
          <Initials text="J" size={40} bg={C.bsoft} fg={C.blue} />
          <div className="flex-1">
            <p className="text-[12.5px] font-extrabold">Jordan <span style={{ color: C.sec, fontWeight: 700 }}>@jordanwalks</span></p>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed" style={{ color: C.text }}>
              Golden hour over the water right now — grab whoever you&apos;re with and go.
            </p>
            <span className="mt-1 block text-[11px] font-bold" style={{ color: C.sec }}>186 / 500</span>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Photo src={PHOTOS.skyline} className="h-16 w-16" rounded={14} />
          <Photo src={PHOTOS.beach} className="h-16 w-16" rounded={14} />
          <span className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-[14px] border-2 border-dashed text-[9.5px] font-extrabold" style={{ borderColor: C.selected, color: C.sec }}>
            <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: C.element }}><PlusGlyph /></span>
            Add
          </span>
        </div>

        <Card className="mt-4 p-3">
          <div className="flex items-center gap-2.5">
            <IconCircle bg={C.soft} fg={C.ink} size={34}><MapPin className="h-4 w-4" /></IconCircle>
            <div className="flex-1 leading-tight">
              <p className="text-[12px] font-extrabold">Kitsilano Beach</p>
              <p className="text-[10px] font-bold" style={{ color: C.sec }}>Vancouver · 0.4 km from you</p>
            </div>
            <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ background: C.element, color: C.sec }}>
              <X className="h-3 w-3" />
            </span>
          </div>
        </Card>

        <div className="mt-2 flex items-center gap-2 rounded-[20px] p-3" style={{ background: C.surface }}>
          <IconCircle bg={C.bsoft} fg={C.blue} size={34}><Search className="h-4 w-4" /></IconCircle>
          <p className="flex-1 text-[12px] font-bold" style={{ color: C.sec }}>Tag a place…</p>
        </div>

        <p className="mt-auto text-center text-[10px] font-bold" style={{ color: C.sec }}>
          Pets and people within 5 km can see this on their map
        </p>
      </div>
    </Screen>
  );
}

function PlusGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={C.sec} strokeWidth="2.8" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// 6 · Search
// ---------------------------------------------------------------------------

export function SearchScreen() {
  return (
    <Screen>
      <StatusBar />
      <div className="flex h-full flex-col px-4 pb-[104px] pt-12">
        <ScreenTitle>Search</ScreenTitle>
        <div className="flex h-11 items-center gap-2 rounded-full bg-white px-4" style={{ boxShadow: `0 0 0 2px ${C.primary}` }}>
          <Search className="h-4 w-4" style={{ color: C.ink }} />
          <span className="flex-1 text-[12.5px] font-bold" style={{ color: C.text }}>mo</span>
          <X className="h-3.5 w-3.5" style={{ color: C.sec }} />
        </div>

        <div className="mt-3 flex gap-1.5">
          <Chip bg={C.soft} fg={C.ink}>People</Chip>
          <Chip>Food</Chip>
          <Chip>Beaches</Chip>
          <Chip>Cafés</Chip>
        </div>

        <p className="mb-2 mt-4 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Nearby now</p>
        <div className="space-y-2">
          <PersonRow species="puppy" name="Mochi" owner="Wei C." place="Richmond · 3.2 km" shared="Food" bg={C.gsoft} fg={C.green} />
          <PersonRow species="cat" name="Nori" owner="Alex P." place="Mount Pleasant · 2.1 km" shared="Art" bg={C.psoft} fg={C.purple} />
          <PersonRow species="puppy" name="Pepper" owner="Dana K." place="North Van · 4.6 km" shared="Hiking" bg={C.bsoft} fg={C.blue} />
          <PersonRow species="cockatiel" name="Kiwi" owner="You" place="Kitsilano · here" shared="" bg={C.soft} fg={C.ink} self />
        </div>

        <p className="mb-2 mt-5 text-[10px] font-extrabold uppercase tracking-widest" style={{ color: C.sec }}>Posting within 5 km</p>
        <Card className="flex items-center gap-3 p-3">
          <Photo src={PHOTOS.latte} className="h-11 w-11" rounded={12} />
          <div className="flex-1 leading-tight">
            <p className="text-[12px] font-extrabold">Turkish latte, corner of 4th</p>
            <p className="mt-0.5 text-[10px] font-bold" style={{ color: C.sec }}>3 posts in the last hour</p>
          </div>
          <Minus className="h-4 w-4 rotate-90" style={{ color: C.sec }} />
        </Card>
      </div>
      <TabBar active="map" />
    </Screen>
  );
}

function PersonRow({
  species,
  name,
  owner,
  place,
  shared,
  bg,
  fg,
  self,
}: {
  species: Species;
  name: string;
  owner: string;
  place: string;
  shared: string;
  bg: string;
  fg: string;
  self?: boolean;
}) {
  return (
    <Card className="flex items-center gap-2.5 p-2.5">
      <Avatar species={species} size={40} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[12.5px] font-extrabold">
          {name} <span className="font-bold" style={{ color: C.sec }}>· {owner}</span>
        </p>
        <p className="mt-0.5 text-[10px] font-bold" style={{ color: C.sec }}>{place}</p>
      </div>
      {self ? (
        <Chip bg={C.soft} fg={C.ink}>You</Chip>
      ) : (
        <Chip bg={bg} fg={fg}>{shared}</Chip>
      )}
    </Card>
  );
}
