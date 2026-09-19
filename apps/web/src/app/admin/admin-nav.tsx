"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Bot,
  CalendarClock,
  FileText,
  Globe2,
  HardDrive,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  Network,
  Smartphone,
  SlidersHorizontal,
  Sparkles,
  Timer,
  TrendingUp,
  ShieldAlert,
  Sprout,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Grouped so the list stays scannable as routes keep landing — a flat list was
 * already hard to navigate at eleven items. Groups are domains, not page types,
 * so a new route has an obvious home.
 */
const NAV_GROUPS: { label: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
      { href: "/admin/map", label: "Coverage", icon: Globe2 },
      { href: "/admin/telemetry", label: "Telemetry", icon: TrendingUp },
      { href: "/admin/jobs", label: "Jobs", icon: Timer },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/posts", label: "Posts", icon: FileText },
      { href: "/admin/review", label: "Review", icon: ShieldAlert },
      { href: "/admin/places", label: "Places", icon: MapPin },
      { href: "/admin/assets", label: "Assets", icon: HardDrive },
    ],
  },
  {
    label: "People",
    items: [{ href: "/admin/users", label: "Users", icon: Users }],
  },
  {
    label: "Agents",
    items: [
      { href: "/admin/agents", label: "Strays", icon: Bot },
      { href: "/admin/mock-profiles", label: "Personas", icon: Sparkles },
      { href: "/admin/actions", label: "Activity", icon: Activity },
      { href: "/admin/seeds", label: "Seeds", icon: Sprout },
    ],
  },
  {
    label: "Product",
    items: [
      { href: "/admin/events", label: "Events", icon: CalendarClock },
      { href: "/admin/config", label: "Tuning", icon: SlidersHorizontal },
      { href: "/admin/roadmap", label: "Roadmap", icon: Network },
      { href: "/admin/app-design", label: "App design", icon: Smartphone },
    ],
  },
];


function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
}

/** Vertical list for the sidebar (large screens). */
export function AdminNav() {
  const isActive = useActive();
  return (
    <nav className="flex flex-col gap-4 px-3 pb-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-3.5 pb-1 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground/70">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2.5 rounded-lg px-3.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-primary-soft text-primary-ink"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" strokeWidth={active ? 2.5 : 2} />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Horizontal, scrollable strip for the top bar (small screens). */
export function AdminNavStrip() {
  const isActive = useActive();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
      {NAV_GROUPS.map((group, i) => (
        <div key={group.label} className="flex shrink-0 items-center gap-1">
          {i > 0 && <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />}
          {group.items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-2 rounded-lg px-3 text-[13px] font-bold transition-colors",
                  active ? "bg-primary-soft text-primary-ink" : "text-muted-foreground hover:bg-accent",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function SignOutButton({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const signOut = async () => {
    setBusy(true);
    await fetch("/api/auth/sign-out", { method: "POST" }).catch(() => null);
    router.push("/sign-in");
    router.refresh();
  };
  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      title="Sign out"
      aria-label="Sign out"
      className={cn(
        "flex shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50",
        compact ? "h-9 w-9" : "h-8 w-8",
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
    </button>
  );
}
