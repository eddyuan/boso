"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Bot,
  FileText,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  Sparkles,
  Sprout,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/posts", label: "Posts", icon: FileText },
  { href: "/admin/places", label: "Places", icon: MapPin },
  { href: "/admin/agents", label: "Agents", icon: Bot },
  { href: "/admin/mock-profiles", label: "Personas", icon: Sparkles },
  { href: "/admin/seeds", label: "Seeds", icon: Sprout },
];

function useActive() {
  const pathname = usePathname();
  return (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
}

/** Vertical list for the sidebar (large screens). */
export function AdminNav() {
  const isActive = useActive();
  return (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-full px-3.5 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary-soft text-primary-ink"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <item.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.5 : 2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Horizontal, scrollable strip for the top bar (small screens). */
export function AdminNavStrip() {
  const isActive = useActive();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
      {NAV.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-[13px] font-bold transition-colors",
              active ? "bg-primary-soft text-primary-ink" : "text-muted-foreground hover:bg-accent",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
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
