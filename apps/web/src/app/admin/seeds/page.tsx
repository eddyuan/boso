"use client";

import { useState } from "react";
import { Bot, ImageIcon, Loader2, MapPinned, Plus, Sprout, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { EmptyState, Loading, Notice, PageHeader, Panel, type Tone } from "../_components/ui";
import { useAdminData } from "../_components/use-admin-data";

type Stray = { userId: string; petId: string; petName: string; species: string };
type Bbox = { west: number; south: number; east: number; north: number };

/** Areas we've imported places for. A custom box works too, as long as it has places. */
const PRESETS: { label: string; bbox: Bbox }[] = [
  { label: "Richmond, BC", bbox: { west: -123.14, south: 49.16, east: -123.07, north: 49.21 } },
  { label: "Downtown Toronto", bbox: { west: -79.395, south: 43.645, east: -79.375, north: 43.665 } },
];

const sameBox = (a: Bbox, b: Bbox) =>
  a.west === b.west && a.south === b.south && a.east === b.east && a.north === b.north;

export default function SeedsPage() {
  const { data, loading, reload: fetchStrays } = useAdminData<{ strays: Stray[] }>("/api/admin/strays");
  const strays = data?.strays ?? [];
  const [createCount, setCreateCount] = useState(3);
  const [busy, setBusy] = useState<"creating" | "clearing" | "seeding" | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const [bbox, setBbox] = useState<Bbox>(PRESETS[0]!.bbox);
  const [seedCount, setSeedCount] = useState(20);
  const [imageCount, setImageCount] = useState(0);
  const [result, setResult] = useState<{ tone: Tone; text: string } | null>(null);

  const createStrays = async () => {
    setBusy("creating");
    await fetch("/api/admin/strays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: createCount }),
    });
    setBusy(null);
    fetchStrays();
  };

  const clearStrays = async () => {
    setConfirmClear(false);
    setBusy("clearing");
    await fetch("/api/admin/strays", { method: "DELETE" });
    setBusy(null);
    fetchStrays();
  };

  const runSeed = async () => {
    setBusy("seeding");
    setResult(null);
    try {
      const res = await fetch("/api/admin/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...bbox, count: seedCount, withImages: imageCount }),
      });
      const data = await res.json();
      setResult(
        res.ok
          ? {
              tone: "green",
              text: `Wrote ${data.written} posts (${data.images} with photos), skipped ${data.skipped}, across ${data.strays} strays.`,
            }
          : { tone: "red", text: `Seeding failed: ${data.error ?? res.statusText}` },
      );
    } catch {
      setResult({ tone: "red", text: "Network error — the run may still be going on the server." });
    }
    setBusy(null);
    fetchStrays();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Seeds" description="Stray pets and the posts they write, so a new area's map isn't empty." />

      <div className="grid items-start gap-6 xl:grid-cols-5">
        <Panel
          title="Seed posts"
          icon={Wand2}
          className="xl:col-span-3"
          description="Picks places in the area nobody has posted about and hands each to a stray."
        >
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Area</Label>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => {
                  const on = sameBox(p.bbox, bbox);
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setBbox(p.bbox)}
                      className={cn(
                        "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-bold transition-colors",
                        on ? "bg-primary-soft text-primary-ink" : "bg-secondary text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <MapPinned className="h-4 w-4" />
                      {p.label}
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(["west", "south", "east", "north"] as const).map((edge) => (
                  <div key={edge} className="space-y-1.5">
                    <Label htmlFor={edge} className="text-xs capitalize">
                      {edge}
                    </Label>
                    <Input
                      id={edge}
                      type="number"
                      step="0.001"
                      value={bbox[edge]}
                      onChange={(e) => setBbox((b) => ({ ...b, [edge]: Number(e.target.value) }))}
                      className="font-mono"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="seed-count">Posts</Label>
                <Input
                  id="seed-count"
                  type="number"
                  min={1}
                  max={100}
                  value={seedCount}
                  onChange={(e) => setSeedCount(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="image-count" className="flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5" />
                  With photos
                </Label>
                <Input
                  id="image-count"
                  type="number"
                  min={0}
                  max={50}
                  value={imageCount}
                  onChange={(e) => setImageCount(Number(e.target.value))}
                />
              </div>
            </div>
            <p className="-mt-3 text-xs font-semibold text-muted-foreground">
              Photos are generated, and cost far more than the text — keep the count low.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={runSeed} disabled={busy !== null}>
                {busy === "seeding" ? <Loader2 className="animate-spin" /> : <Wand2 />}
                {busy === "seeding" ? "Seeding — this takes a while…" : "Seed posts"}
              </Button>
            </div>

            {result && <Notice tone={result.tone}>{result.text}</Notice>}
          </div>
        </Panel>

        <Panel
          title="Strays"
          icon={Sprout}
          className="xl:col-span-2"
          description={`${strays.length} seeded ${strays.length === 1 ? "account" : "accounts"}, all marked as mock.`}
        >
          <div className="space-y-5">
            <div className="flex items-end gap-2">
              <div className="w-20 space-y-1.5">
                <Label htmlFor="create-count">Add</Label>
                <Input
                  id="create-count"
                  type="number"
                  min={1}
                  max={50}
                  value={createCount}
                  onChange={(e) => setCreateCount(Number(e.target.value))}
                />
              </div>
              <Button onClick={createStrays} disabled={busy !== null}>
                {busy === "creating" ? <Loader2 className="animate-spin" /> : <Plus />}
                Create
              </Button>
              <Button
                variant="destructive"
                className="ml-auto"
                onClick={() => setConfirmClear(true)}
                disabled={busy !== null || strays.length === 0}
              >
                {busy === "clearing" ? <Loader2 className="animate-spin" /> : <Trash2 />}
                Remove all
              </Button>
            </div>

            {loading && !data ? (
              <Loading label="Loading strays…" />
            ) : strays.length === 0 ? (
              <EmptyState icon={Bot} title="No strays yet" hint="Create a few, then seed an area." />
            ) : (
              <ul className="-mx-2 max-h-105 overflow-y-auto">
                {strays.map((s) => (
                  <li key={s.userId} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-background">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-sm font-semibold text-primary-ink">
                      {s.petName[0]?.toUpperCase()}
                    </span>
                    <span className="flex-1 truncate text-sm font-extrabold">{s.petName}</span>
                    <span className="text-xs font-semibold capitalize text-muted-foreground">{s.species}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove every stray?</DialogTitle>
            <DialogDescription>
              All {strays.length} seeded accounts go, and their pets and posts with them. Real users aren&apos;t touched. This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Keep them
            </Button>
            <Button className="bg-destructive text-destructive-foreground shadow-none hover:brightness-110" onClick={clearStrays}>
              <Trash2 />
              Remove all
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
