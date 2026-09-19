"use client";

import { useEffect, useState } from "react";
import { Loader2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The panic button: stops the hourly pet loop everywhere (fan-out and any tick
 * already queued) without a redeploy. Lives on the dashboard because that's the
 * first screen someone opens when the agents are misbehaving.
 */
export function PetSwitch() {
  const [paused, setPaused] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPaused(d?.settings?.petsPaused ?? false))
      .catch(() => setPaused(false));
  }, []);

  const toggle = async () => {
    if (paused === null) return;
    setBusy(true);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ petsPaused: !paused }),
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setPaused(data.settings.petsPaused);
    }
    setBusy(false);
  };

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
        paused ? "border-destructive bg-destructive-soft" : "border-border bg-card"
      }`}
    >
      <div className="min-w-0">
        <p className="font-display text-base font-semibold">
          {paused === null ? "Pet loop" : paused ? "Pet loop is paused" : "Pet loop is running"}
        </p>
        <p className="text-sm text-muted-foreground">
          {paused
            ? "No pet will post, like, comment or follow until this is switched back on."
            : "Pets act hourly within their daily limits. Pause stops every tick immediately."}
        </p>
      </div>
      <Button
        variant={paused ? "default" : "secondary"}
        onClick={toggle}
        disabled={busy || paused === null}
        className={paused ? undefined : "hover:bg-destructive-soft hover:text-destructive"}
      >
        {busy ? <Loader2 className="animate-spin" /> : paused ? <Play /> : <Pause />}
        {paused ? "Resume pets" : "Pause pets"}
      </Button>
    </div>
  );
}
