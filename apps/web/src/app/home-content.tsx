"use client";

import { useRouter } from "next/navigation";
import type { Session } from "@/lib/auth";

type Props = {
  user: Session["user"];
  isAdmin: boolean;
};

export function HomeContent({ user, isAdmin }: Props) {
  const router = useRouter();

  const signOut = async () => {
    await fetch("/api/auth/sign-out", { method: "POST" });
    router.push("/sign-in");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-5">
        <h1 className="text-2xl font-semibold text-center">Tielo</h1>

        <div className="rounded border border-[var(--foreground)]/20 p-4 space-y-3">
          <div className="space-y-1">
            <p className="text-xs opacity-50">Signed in as</p>
            <p className="font-medium">{user.name || user.email}</p>
            {user.email && <p className="text-sm opacity-60">{user.email}</p>}
            {user.username && <p className="text-sm opacity-60">@{user.username}</p>}
          </div>

          {isAdmin && (
            <a
              href="/admin"
              className="block w-full text-center rounded bg-[var(--foreground)] text-[var(--background)] py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Admin Panel
            </a>
          )}

          <button
            onClick={signOut}
            className="w-full rounded border border-[var(--foreground)]/20 py-2 text-sm font-medium hover:bg-[var(--foreground)]/5 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
