import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AdminNav, AdminNavStrip, SignOutButton } from "./admin-nav";

export const metadata: Metadata = {
  title: "Admin — Tielo",
};

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2.5 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="brand-mark flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-lg text-primary-foreground shadow-[inset_0_-3px_0_rgb(0_0_0/0.12)]">
        T
      </span>
      <span className="leading-tight">
        <span className="block font-display text-lg font-semibold">Tielo</span>
        <span className="block text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">Admin</span>
      </span>
    </Link>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (!session.user.isAdmin) redirect("/");

  const { name, email, image } = session.user;
  const initial = (name || email || "A")[0]!.toUpperCase();

  return (
    <div className="admin-ui flex min-h-screen w-full bg-background">
      {/* Sidebar — large screens */}
      <aside className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col bg-sidebar lg:flex">
        <div className="px-4 pb-3 pt-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto">
          <AdminNav />
        </div>
        <div className="m-2 flex items-center gap-2 rounded-lg border border-border bg-card p-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={image ?? undefined} alt="" />
            <AvatarFallback className="text-xs">{initial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold leading-tight">{name || "Admin"}</p>
            <p className="truncate text-[11px] leading-tight text-muted-foreground">{email}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — small screens */}
        <header className="sticky top-0 z-30 bg-sidebar/95 px-4 pt-3 backdrop-blur lg:hidden">
          <div className="mb-3 flex items-center justify-between">
            <Brand />
            <SignOutButton compact />
          </div>
          <AdminNavStrip />
        </header>

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
