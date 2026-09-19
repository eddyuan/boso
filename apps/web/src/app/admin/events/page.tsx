"use client";

import { useState } from "react";
import { CalendarClock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Loading, Muted, Notice, PageHeader, Panel, TimeAgo } from "../_components/ui";
import { useAdminData } from "../_components/use-admin-data";

const GOALS = [
  { value: "treasures_found", label: "Treasures found" },
  { value: "posts_written", label: "Posts written" },
  { value: "replies_written", label: "Replies written" },
  { value: "playdates_met", label: "Playdates met" },
  { value: "places_visited", label: "Places visited" },
] as const;

type Event = {
  id: string;
  title: string;
  blurb: string | null;
  goal: string;
  goalLabel: string;
  target: number;
  startsAt: string;
  endsAt: string;
  radiusKm: number | null;
};

type Response = {
  events: Event[];
  running: { id: string; total: number; target: number; fraction: number } | null;
};

/** Local datetime-local value -> ISO, so what an admin types is what they meant. */
const toIso = (local: string) => (local ? new Date(local).toISOString() : "");

export default function EventsPage() {
  const { data, loading, reload } = useAdminData<Response>("/api/admin/events");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    blurb: "",
    goal: "treasures_found",
    target: "100",
    startsAt: "",
    endsAt: "",
  });

  const events = data?.events ?? [];
  const running = data?.running ?? null;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          blurb: form.blurb.trim() || undefined,
          goal: form.goal,
          target: Number(form.target),
          startsAt: toIso(form.startsAt),
          endsAt: toIso(form.endsAt),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.issues?.[0]?.message ?? body.error ?? "Failed");
      }
      setForm({ ...form, title: "", blurb: "" });
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create that event.");
    }
    setBusy(false);
  }

  async function remove(id: string) {
    await fetch(`/api/admin/events?id=${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Events"
        description="Time-boxed goals a neighbourhood works on together. One shared bar, never a ranking."
      />

      <Notice>
        Progress is counted from activity that already happened, so it can&apos;t be edited — only the target
        can. Seeded accounts never count toward a goal: a collective total they filled in would be a
        visibly false number.
      </Notice>

      {running && (
        <Panel>
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 text-sm font-extrabold">
                Running now: {running.total.toLocaleString()} of {running.target.toLocaleString()}
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(running.fraction * 100)}%` }} />
              </div>
            </div>
            <span className="text-2xl font-extrabold tabular-nums">{Math.round(running.fraction * 100)}%</span>
          </div>
        </Panel>
      )}

      <Panel>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Treasure weekend"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal">Goal</Label>
            <select
              id="goal"
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {GOALS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="blurb">Blurb</Label>
            <Input
              id="blurb"
              value={form.blurb}
              onChange={(e) => setForm({ ...form, blurb: e.target.value })}
              placeholder="Let's find 200 things together."
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="target">Target</Label>
            <Input
              id="target"
              type="number"
              min={1}
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startsAt">Starts</Label>
            <Input
              id="startsAt"
              type="datetime-local"
              value={form.startsAt}
              onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endsAt">Ends</Label>
            <Input
              id="endsAt"
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={create}
              disabled={busy || !form.title.trim() || !form.startsAt || !form.endsAt}
              className="w-full"
            >
              Schedule
            </Button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm font-bold text-destructive">{error}</p>}
      </Panel>

      <Panel bleed>
        {loading && !data ? (
          <Loading label="Loading events…" />
        ) : events.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No events yet" hint="Schedule one above." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead>Window</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="font-extrabold">{e.title}</div>
                    <div className="text-xs text-muted-foreground">{e.blurb ?? <Muted />}</div>
                  </TableCell>
                  <TableCell className="text-sm capitalize text-muted-foreground">{e.goalLabel}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{e.target.toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <TimeAgo date={e.startsAt} /> → <TimeAgo date={e.endsAt} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => remove(e.id)} aria-label="Delete event">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}
