/**
 * Design-gallery kit: hand-built, dependency-light primitives used by every
 * app mockup on /admin/app-design. These are STATIC design renders (HTML/CSS
 * inside a phone frame), not working app screens — they exist to visualise
 * the current app and the roadmap ideas in Tielo's real design language
 * (cream & gold, Fredoka + Nunito, 20px rounded cards, floating pill bar).
 */

import {
  Bell,
  Check,
  Heart,
  Home,
  Map as MapIcon,
  Newspaper,
  Plus,
  User,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const C = {
  bg: "#FFF6EC",
  surface: "#FFFFFF",
  element: "#F7EADA",
  selected: "#EEDDC9",
  text: "#2B1F16",
  sec: "#7D6B5B",
  primary: "#FFC53D",
  primaryPress: "#E09E00",
  soft: "#FFF0C2",
  ink: "#8A5A00",
  cheek: "#FF8A4C",
  green: "#2F9E5E",
  gsoft: "#DDF2E4",
  red: "#D9453F",
  rsoft: "#FCE3E1",
  blue: "#2F7BEA",
  bsoft: "#E2EDFC",
  purple: "#8B5CF6",
  psoft: "#EDE7FC",
  pink: "#E05780",
  pinkSoft: "#FCE4EE",
  line: "#EEDDC9",
} as const;

export const PHOTO = (prompt: string, size: "square" | "landscape_4_3" = "landscape_4_3") =>
  `https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=${encodeURIComponent(prompt)}&image_size=${size}`;

export const PHOTOS = {
  beach: PHOTO("candid phone photo of a sunny Vancouver beach at golden hour, driftwood logs, calm ocean, warm tones, slightly nostalgic"),
  ramen: PHOTO("top-down phone snapshot of a tonkotsu ramen bowl on a worn wooden cafe table, steam, warm cozy light"),
  latte: PHOTO("close phone photo of latte art coffee in a ceramic cup on a sunlit cafe counter, pastry beside it, warm tones"),
  parkDogs: PHOTO("candid phone photo of happy dogs playing in a city park at golden hour, fallen leaves, warm nostalgic tones"),
  skyline: PHOTO("phone photo of the Vancouver skyline at dusk from a hill viewpoint, orange and pink sky, sparkling city lights"),
  dimsum: PHOTO("phone snapshot of bamboo steamer baskets of dim sum on a restaurant table, warm restaurant lighting, cozy"),
  forest: PHOTO("phone photo of a misty coastal forest trail with ferns, soft morning light, Pacific Northwest, warm muted tones"),
  sunsetPet: PHOTO("soft 3d render style photo of a tiny fluffy bird silhouette watching an orange sunset over the ocean, warm, whimsical"),
};

// ---------------------------------------------------------------------------
// Phone frame
// ---------------------------------------------------------------------------

export function Phone({
  children,
  className,
  tone = "light",
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <div className={cn("relative shrink-0", className)}>
      <div className="rounded-[46px] bg-[#1d1712] p-[9px] shadow-[0_24px_60px_-18px_rgb(43_31_22/0.45)] ring-1 ring-black/10">
        <div
          className="relative h-[600px] w-[292px] overflow-hidden rounded-[38px]"
          style={{ background: tone === "dark" ? "#1A1410" : C.bg, color: tone === "dark" ? "#FAF1E7" : C.text }}
        >
          {/* notch */}
          <div className="absolute left-1/2 top-2 z-50 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-[#1d1712]" />
          {children}
          {/* home indicator */}
          <div className={cn("absolute bottom-[7px] left-1/2 z-50 h-[4px] w-[110px] -translate-x-1/2 rounded-full", tone === "dark" ? "bg-white/40" : "bg-[#2B1F16]/25")} />
        </div>
      </div>
    </div>
  );
}

export function StatusBar({ dark = false, right }: { dark?: boolean; right?: React.ReactNode }) {
  const col = dark ? "#FFFFFF" : C.text;
  return (
    <div className="absolute inset-x-0 top-0 z-40 flex h-11 items-center justify-between px-7 pt-1.5">
      <span className="text-[12px] font-extrabold tracking-wide" style={{ color: col }}>
        9:41
      </span>
      <div className="flex items-center gap-1.5" style={{ color: col }}>
        {right ?? (
          <>
            <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
              <rect x="0" y="7" width="2.5" height="3.5" rx="0.8" fill={col} />
              <rect x="4" y="5" width="2.5" height="5.5" rx="0.8" fill={col} />
              <rect x="8" y="2.5" width="2.5" height="8" rx="0.8" fill={col} />
              <rect x="12" y="0" width="2.5" height="10.5" rx="0.8" fill={col} opacity="0.35" />
            </svg>
            <Wifi className="h-3 w-3" strokeWidth={2.6} />
            <svg width="24" height="11" viewBox="0 0 24 11" fill="none">
              <rect x="0.5" y="0.5" width="20" height="10" rx="3" stroke={col} opacity="0.45" />
              <rect x="2" y="2" width="15" height="7" rx="1.6" fill={col} />
              <rect x="21.5" y="3.5" width="1.6" height="4" rx="0.8" fill={col} opacity="0.45" />
            </svg>
          </>
        )}
      </div>
    </div>
  );
}

/** The app's floating icon-only pill: map · feed · bell · profile, plus compose. */
export function TabBar({
  active = "map",
  tone = "light",
}: {
  active?: "map" | "feed" | "bell" | "profile";
  tone?: "light" | "dark";
}) {
  const surface = tone === "dark" ? "#251D17" : C.surface;
  const sec = tone === "dark" ? "#B6A594" : C.sec;
  const items: { id: typeof active; icon: React.ReactNode }[] = [
    { id: "map", icon: <MapIcon className="h-[19px] w-[19px]" strokeWidth={active === "map" ? 2.6 : 2.1} /> },
    { id: "feed", icon: <Newspaper className="h-[19px] w-[19px]" strokeWidth={active === "feed" ? 2.6 : 2.1} /> },
    { id: "bell", icon: <Bell className="h-[19px] w-[19px]" strokeWidth={active === "bell" ? 2.6 : 2.1} /> },
    { id: "profile", icon: <User className="h-[19px] w-[19px]" strokeWidth={active === "profile" ? 2.6 : 2.1} /> },
  ];
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[26px] z-40 flex items-center justify-center gap-2">
      <div
        className="flex h-[52px] items-center gap-0.5 rounded-full px-2"
        style={{ background: surface, boxShadow: "0 8px 24px -6px rgb(43 31 22 / 0.28)" }}
      >
        {items.map((it) => (
          <div
            key={it.id}
            className="flex h-9 w-11 items-center justify-center rounded-full"
            style={{ background: active === it.id ? C.soft : "transparent", color: active === it.id ? C.ink : sec }}
          >
            {it.icon}
          </div>
        ))}
      </div>
      <div
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full"
        style={{ background: surface, boxShadow: "0 8px 24px -6px rgb(43 31 22 / 0.28)", color: sec }}
      >
        <Plus className="h-5 w-5" strokeWidth={2.6} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function Screen({
  children,
  dark = false,
  className,
}: {
  children: React.ReactNode;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("relative h-full w-full", className)}
      style={{ background: dark ? "#1A1410" : C.bg, color: dark ? "#FAF1E7" : C.text }}
    >
      {children}
    </div>
  );
}

export function Scroll({ children, className, pad = true }: { children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <div className={cn("h-full w-full overflow-hidden", pad && "px-4", className)}>
      <div className="pt-12">{children}</div>
    </div>
  );
}

export function ScreenTitle({ children, sub, action }: { children: React.ReactNode; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-2">
      <div>
        <h3 className="font-display text-[22px] font-semibold leading-none tracking-tight">{children}</h3>
        {sub && <p className="mt-1 text-[11px] font-bold" style={{ color: C.sec }}>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function SegPills({
  options,
  active,
  tone = "light",
}: {
  options: string[];
  active: string;
  tone?: "light" | "dark";
}) {
  const track = tone === "dark" ? "#30261E" : C.element;
  return (
    <div className="flex gap-1 rounded-full p-1" style={{ background: track }}>
      {options.map((o) => {
        const on = o === active;
        return (
          <div
            key={o}
            className="flex h-7 flex-1 items-center justify-center rounded-full text-[11px] font-extrabold"
            style={{
              background: on ? C.surface : "transparent",
              color: on ? C.text : C.sec,
              boxShadow: on ? "0 1px 4px rgb(43 31 22 / 0.12)" : "none",
            }}
          >
            {o}
          </div>
        );
      })}
    </div>
  );
}

export function Card({
  children,
  className,
  style,
  tone = "light",
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  tone?: "light" | "dark";
}) {
  return (
    <div
      className={cn("rounded-[20px]", className)}
      style={{ background: tone === "dark" ? "#251D17" : C.surface, boxShadow: "0 1px 3px rgb(43 31 22 / 0.06)", ...style }}
    >
      {children}
    </div>
  );
}

export function Chip({
  children,
  bg = C.element,
  fg = C.sec,
  className,
  icon,
}: {
  children: React.ReactNode;
  bg?: string;
  fg?: string;
  className?: string;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[9.5px] font-extrabold", className)}
      style={{ background: bg, color: fg }}
    >
      {icon}
      {children}
    </span>
  );
}

export function Btn({
  children,
  variant = "primary",
  className,
  icon,
  tone = "light",
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  icon?: React.ReactNode;
  tone?: "light" | "dark";
}) {
  const styles: React.CSSProperties =
    variant === "primary"
      ? { background: C.primary, color: C.text, boxShadow: "inset 0 -3px 0 rgb(0 0 0 / 0.10)" }
      : variant === "secondary"
        ? { background: tone === "dark" ? "#30261E" : C.element, color: tone === "dark" ? "#FAF1E7" : C.text }
        : { background: "transparent", color: C.sec };
  return (
    <div
      className={cn("flex h-11 items-center justify-center gap-1.5 rounded-[18px] text-[13px] font-extrabold", className)}
      style={styles}
    >
      {icon}
      {children}
    </div>
  );
}

export function Progress({
  value,
  fill = C.primary,
  track = C.element,
  h = 7,
}: {
  value: number;
  fill?: string;
  track?: string;
  h?: number;
}) {
  return (
    <div className="w-full overflow-hidden rounded-full" style={{ background: track, height: h }}>
      <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: fill }} />
    </div>
  );
}

export function IconCircle({
  children,
  bg = C.soft,
  fg = C.ink,
  size = 32,
  className,
}: {
  children: React.ReactNode;
  bg?: string;
  fg?: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-[11px]", className)}
      style={{ background: bg, color: fg, width: size, height: size }}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  value,
  placeholder,
  icon,
  trailing,
}: {
  label?: string;
  value?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-[10.5px] font-extrabold uppercase tracking-wide" style={{ color: C.sec }}>{label}</span>}
      <div
        className="flex h-[46px] items-center gap-2 rounded-[16px] px-3.5"
        style={{ background: C.surface, border: `1px solid ${C.line}` }}
      >
        {icon && <span style={{ color: C.sec }}>{icon}</span>}
        <span className="flex-1 truncate text-[12.5px] font-bold" style={{ color: value ? C.text : C.sec }}>
          {value ?? placeholder}
        </span>
        {trailing}
      </div>
    </label>
  );
}

export function Toggle({ on, onChange }: { on: boolean; onChange?: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onChange?.();
      }}
      className="relative h-[26px] w-[44px] shrink-0 rounded-full transition-colors"
      style={{ background: on ? C.primary : C.selected }}
      aria-pressed={on}
    >
      <span
        className="absolute top-[3px] h-5 w-5 rounded-full bg-white shadow transition-all"
        style={{ left: on ? 19 : 3 }}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Pet faces (flat SVG in the style of components/mascot/companions.tsx)
// ---------------------------------------------------------------------------

export type Species = "cockatiel" | "bunny" | "cat" | "puppy";

export function PetFace({
  species,
  size = 40,
  mood = "happy",
}: {
  species: Species;
  size?: number;
  mood?: "happy" | "sleepy" | "excited" | "sad";
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden>
      {species === "cockatiel" && <Cockatiel mood={mood} />}
      {species === "bunny" && <Bunny mood={mood} />}
      {species === "cat" && <CatFace mood={mood} />}
      {species === "puppy" && <Puppy mood={mood} />}
    </svg>
  );
}

const INK = "#2B1F16";

function Eyes({ mood, y = 25, x1 = 17, x2 = 31, c = INK }: { mood: string; y?: number; x1?: number; x2?: number; c?: string }) {
  if (mood === "sleepy" || mood === "sad") {
    return (
      <g stroke={c} strokeWidth="2.2" strokeLinecap="round">
        <path d={`M${x1 - 3} ${y} q3 ${mood === "sad" ? -2.6 : 2.6} 6 0`} />
        <path d={`M${x2 - 3} ${y} q3 ${mood === "sad" ? -2.6 : 2.6} 6 0`} />
      </g>
    );
  }
  if (mood === "excited") {
    return (
      <g stroke={c} strokeWidth="2.2" strokeLinecap="round">
        <path d={`M${x1 - 3} ${y + 2} l3 -3 l3 3`} />
        <path d={`M${x2 - 3} ${y + 2} l3 -3 l3 3`} />
      </g>
    );
  }
  return (
    <g fill={c}>
      <circle cx={x1} cy={y} r="2.6" />
      <circle cx={x2} cy={y} r="2.6" />
      <circle cx={x1 + 0.8} cy={y - 0.8} r="0.9" fill="#fff" />
      <circle cx={x2 + 0.8} cy={y - 0.8} r="0.9" fill="#fff" />
    </g>
  );
}

function Cockatiel({ mood }: { mood: string }) {
  return (
    <g>
      {/* crest */}
      <path d="M24 11 C22 5 24 2 27 1.5 C26 5 27 8 28 10 Z" fill="#F4B73E" />
      <path d="M21 12 C16 8 14 5 15 2 C20 4 21 8 23 11 Z" fill="#FFD261" />
      <path d="M27 11 C30 6 33 5 34 7 C31 8 30 11 29 13 Z" fill="#F4B73E" />
      {/* head */}
      <circle cx="24" cy="27" r="16" fill="#FFD261" />
      <circle cx="24" cy="35" r="9.5" fill="#E8E2D8" />
      {/* cheek */}
      <circle cx="33.5" cy="28.5" r="4.4" fill="#FF8A4C" opacity="0.85" />
      <Eyes mood={mood} x1={18.5} x2={28} />
      {/* beak */}
      <path d="M22.6 31.5 l2.8 2 l2.8 -2 Z" fill="#6B4F2A" />
    </g>
  );
}

function Bunny({ mood }: { mood: string }) {
  return (
    <g>
      <path d="M17 13 C13 2 16 -3 20 -1 C23 2 22 9 21.5 14 Z" fill="#E9C9A1" />
      <path d="M31 13 C35 2 32 -3 28 -1 C25 2 26 9 26.5 14 Z" fill="#E9C9A1" />
      <path d="M18.2 10 C16 3 18 0 20 1 C21.5 3 21 8 20.6 12 Z" fill="#FFB8C6" />
      <path d="M29.8 10 C32 3 30 0 28 1 C26.5 3 27 8 27.4 12 Z" fill="#FFB8C6" />
      <circle cx="24" cy="29" r="16" fill="#E9C9A1" />
      <ellipse cx="24" cy="35" rx="10" ry="8.5" fill="#FFF4E3" />
      <circle cx="14" cy="29" r="3" fill="#FF9AAE" opacity="0.8" />
      <circle cx="34" cy="29" r="3" fill="#FF9AAE" opacity="0.8" />
      <Eyes mood={mood} />
      <path d="M22.6 32.6 q1.4 1.2 2.8 0 q-0.4 1.6 -1.4 2 q-1 -0.4 -1.4 -2 Z" fill="#E8798F" />
    </g>
  );
}

function CatFace({ mood }: { mood: string }) {
  return (
    <g>
      <path d="M10 16 L8 3 L20 11 Z" fill="#A9B3C4" />
      <path d="M38 16 L40 3 L28 11 Z" fill="#A9B3C4" />
      <path d="M11.8 12 L11 5.5 L17.5 10.5 Z" fill="#FFB8C6" />
      <path d="M36.2 12 L37 5.5 L30.5 10.5 Z" fill="#FFB8C6" />
      <circle cx="24" cy="27" r="16" fill="#A9B3C4" />
      <path d="M20 13 q4 1.6 8 0 M21 16.5 q3 1.2 6 0" stroke="#7F8A9D" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <ellipse cx="24" cy="33" rx="8.5" ry="6" fill="#F4F1EC" />
      <ellipse cx="24" cy="39" rx="7.5" ry="4.5" fill="#F4F1EC" />
      <circle cx="14.5" cy="28" r="2.8" fill="#FF9AAE" opacity="0.75" />
      <circle cx="33.5" cy="28" r="2.8" fill="#FF9AAE" opacity="0.75" />
      <Eyes mood={mood} y={25.5} />
      <path d="M22.4 31.4 l3.2 0 l-1.6 1.9 Z" fill="#E8798F" />
    </g>
  );
}

function Puppy({ mood }: { mood: string }) {
  return (
    <g>
      <ellipse cx="10.5" cy="24" rx="6" ry="10" fill="#C9935E" transform="rotate(14 10.5 24)" />
      <ellipse cx="37.5" cy="24" rx="6" ry="10" fill="#C9935E" transform="rotate(-14 37.5 24)" />
      <circle cx="24" cy="27" r="16" fill="#E2B07E" />
      <ellipse cx="24" cy="32" rx="9" ry="7.5" fill="#F3D9B8" />
      <ellipse cx="24" cy="40" rx="7" ry="4.5" fill="#F3D9B8" />
      <circle cx="14.5" cy="28" r="2.8" fill="#FF9A7E" opacity="0.7" />
      <circle cx="33.5" cy="28" r="2.8" fill="#FF9A7E" opacity="0.7" />
      <Eyes mood={mood} y={25} c="#3A2A1A" />
      <ellipse cx="24" cy="31.4" rx="2.4" ry="1.8" fill="#3A2A1A" />
    </g>
  );
}

export function Avatar({
  species,
  size = 38,
  bg = C.soft,
  mood,
  ring,
  className,
}: {
  species?: Species;
  size?: number;
  bg?: string;
  mood?: "happy" | "sleepy" | "excited" | "sad";
  ring?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: species ? bg : C.primary,
        boxShadow: ring ? `0 0 0 2px ${ring}` : undefined,
      }}
    >
      {species ? <PetFace species={species} size={size * 0.82} mood={mood} /> : null}
    </span>
  );
}

export function Initials({ text, size = 38, bg = C.bsoft, fg = C.blue }: { text: string; size?: number; bg?: string; fg?: string }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold"
      style={{ width: size, height: size, background: bg, color: fg }}
    >
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Stylised warm map backdrop (Mapbox-standard-inspired, pure SVG)
// ---------------------------------------------------------------------------

export function MapBack({
  children,
  variant = "day",
  className,
}: {
  children?: React.ReactNode;
  variant?: "day" | "dusk" | "park";
  className?: string;
}) {
  const land = variant === "dusk" ? "#E7D3B8" : "#F3E7D3";
  const block = variant === "dusk" ? "#EAD8BE" : "#FBF3E5";
  const street = variant === "dusk" ? "#F6ECDC" : "#FFFFFF";
  const park = variant === "park" ? "#CFE4C0" : variant === "dusk" ? "#BFCFA6" : "#DEEBCF";
  const water = variant === "dusk" ? "#C9B8D9" : "#C9DFF0";
  return (
    <div className={cn("absolute inset-0 overflow-hidden", className)}>
      <svg width="100%" height="100%" viewBox="0 0 300 620" preserveAspectRatio="xMidYMid slice">
        <rect width="300" height="620" fill={land} />
        {/* water */}
        <path d="M-20 470 C60 440 110 520 200 490 C250 474 290 486 330 470 L330 640 L-20 640 Z" fill={water} />
        {/* parks */}
        <rect x="186" y="60" width="120" height="120" rx="18" fill={park} />
        <rect x="-20" y="300" width="96" height="110" rx="18" fill={park} />
        {/* blocks */}
        {[
          [16, 40, 78, 56],
          [110, 30, 60, 70],
          [20, 130, 60, 60],
          [104, 128, 70, 44],
          [16, 220, 70, 60],
          [102, 210, 76, 64],
          [196, 200, 90, 58],
          [118, 310, 64, 70],
          [196, 300, 96, 64],
          [30, 430, 70, 54],
          [126, 420, 60, 60],
          [196, 404, 96, 70],
        ].map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} rx="10" fill={block} />
        ))}
        {/* streets */}
        <g stroke={street} strokeWidth="9" strokeLinecap="round" opacity="0.95">
          <path d="M0 200 C80 190 140 250 300 232" fill="none" />
          <path d="M0 392 C100 380 180 430 300 410" fill="none" />
          <path d="M96 -10 C104 140 86 300 110 630" fill="none" />
          <path d="M186 -10 C176 160 210 320 196 630" fill="none" />
        </g>
        <g stroke={land} strokeWidth="1.4" strokeDasharray="6 8" strokeLinecap="round">
          <path d="M0 200 C80 190 140 250 300 232" fill="none" />
          <path d="M0 392 C100 380 180 430 300 410" fill="none" />
        </g>
        {variant === "dusk" && <rect width="300" height="620" fill="#3B2A4E" opacity="0.12" />}
      </svg>
      {children}
    </div>
  );
}

/** A photo used on map markers / cards, with a warm fallback while loading. */
export function Photo({
  src,
  className,
  rounded = 12,
  alt = "",
}: {
  src: string;
  className?: string;
  rounded?: number;
  alt?: string;
}) {
  return (
    <span
      className={cn("block overflow-hidden", className)}
      style={{ borderRadius: rounded, background: "linear-gradient(135deg,#F0DFC3,#E6D2B4)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
    </span>
  );
}

export function HeartDot({ filled = true, size = 13 }: { filled?: boolean; size?: number }) {
  return <Heart className={cn(filled && "fill-current")} style={{ width: size, height: size }} strokeWidth={2.4} />;
}

export function CheckMark({ size = 12 }: { size?: number }) {
  return <Check style={{ width: size, height: size }} strokeWidth={3.4} />;
}

export { Home };
