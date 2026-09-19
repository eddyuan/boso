"use client";

import { useState } from "react";
import { Activity, Coins, Gem, ListChecks, Sparkles, TrendingUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Loading, Muted, Notice, PageHeader, Panel, Segmented, StatCard } from "../_components/ui";
import { useAdminData } from "../_components/use-admin-data";

/** Micro-dollars as money — mirrors formatMicros on the server. */
function money(micros: number): string {
  const d = micros / 1_000_000;
  if (d === 0) return "$0";
  if (d < 0.01) return `$${d.toFixed(4)}`;
  if (d < 10) return `$${d.toFixed(2)}`;
  return `$${Math.round(d).toLocaleString()}`;
}
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

type Telemetry = {
  days: number;
  economy: {
    xp: { event: string; awards: number; xp: number; configured: number }[];
    levels: { level: number; unlock: string; pets: number }[];
    drops: {
      finds: number; wanders: number; actualRate: number | null; configuredRate: number;
      byRarity: { rarity: string; label: string; finds: number; actualShare: number | null; configuredShare: number }[];
    };
    missions: { id: string; label: string; xp: number; completions: number; conditional: boolean }[];
    events: { id: string; title: string; goal: string; target: number; startsAt: string; endsAt: string; running: boolean }[];
    activity: { day: string; posts: number; petPosts: number; replies: number }[];
  };
  spend: {
    byKind: { provider: string; kind: string; calls: number; units: number; failed: number; costMicros: number }[];
    byDay: { day: string; calls: number; costMicros: number }[];
    today: { calls: number; costMicros: number };
    cells: { cells: number; found: number; requests: number };
  };
};

const RANGES = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
];

/** A bar that compares an actual share against the configured one. */
function Compare({ actual, configured }: { actual: number | null; configured: number }) {
  const a = actual ?? 0;
  const off = actual !== null && Math.abs(a - configured) > Math.max(0.05, configured * 0.5);
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-28 overflow-hidden rounded-full bg-muted">
        <div
          className={off ? "h-full rounded-full bg-destructive" : "h-full rounded-full bg-primary"}
          style={{ width: `${Math.min(100, a * 100)}%` }}
        />
        {/* Where it should sit, so a drift is visible rather than calculated. */}
        <div
          className="absolute top-[-2px] h-3 w-0.5 bg-foreground/60"
          style={{ left: `${Math.min(100, configured * 100)}%` }}
          title={`configured ${pct(configured)}`}
        />
      </div>
      <span className="w-28 text-xs tabular-nums text-muted-foreground">
        {actual === null ? <Muted>no data</Muted> : <>{pct(a)} <span className="opacity-60">vs {pct(configured)}</span></>}
      </span>
    </div>
  );
}

export default function TelemetryPage() {
  const [days, setDays] = useState("30");
  const { data, loading } = useAdminData<Telemetry>(`/api/admin/telemetry?days=${days}`);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Telemetry" description="What the economy is actually doing, and what it costs." />
        <Panel><Loading label="Reading the ledgers…" /></Panel>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Telemetry" description="What the economy is actually doing, and what it costs." />
        <Panel><EmptyState icon={Activity} title="Couldn't load telemetry" /></Panel>
      </div>
    );
  }

  const { economy, spend } = data;
  const totalXp = economy.xp.reduce((n, r) => n + r.xp, 0);
  const windowCost = spend.byDay.reduce((n, d) => n + d.costMicros, 0);
  const maxDayCost = Math.max(1, ...spend.byDay.map((d) => d.costMicros));
  const maxLevel = Math.max(1, ...economy.levels.map((l) => l.pets));
  const maxActivity = Math.max(1, ...economy.activity.map((a) => a.posts + a.petPosts + a.replies));
  const drops = economy.drops;
  const rateOff =
    drops.actualRate !== null && Math.abs(drops.actualRate - drops.configuredRate) > drops.configuredRate * 0.5;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telemetry"
        description="What the economy is actually doing, and what it costs. Every figure is derived from rows that already exist — nothing here is separately counted."
        actions={<Segmented label="Range" options={RANGES} value={days} onChange={setDays} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Spent today" value={money(spend.today.costMicros)} icon={Coins} hint={`${spend.today.calls} calls`} />
        <StatCard label={`Spent in ${data.days} days`} value={money(windowCost)} icon={TrendingUp} />
        <StatCard label="XP awarded" value={totalXp} icon={Sparkles} />
        <StatCard label="Treasures found" value={drops.finds} icon={Gem} />
      </div>

      {spend.today.costMicros === 0 && spend.byKind.length === 0 && (
        <Notice>
          No billed calls recorded yet. Spend is logged from the moment a place import, a venue photo or an
          AI call runs — historical spend before this page existed is not recoverable.
        </Notice>
      )}

      {/* ---------------------------------------------------------- spend */}
      <Panel>
        <h2 className="mb-1 font-display text-lg font-semibold">Where the money goes</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">
          Prices are indicative list rates stamped onto each call when it happens, not a billing feed —
          enough to say &ldquo;about {money(windowCost)}&rdquo; rather than a call count.
        </p>
        {spend.byKind.length === 0 ? (
          <EmptyState icon={Coins} title="Nothing billed yet" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Call</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {spend.byKind.map((r) => (
                <TableRow key={`${r.provider}:${r.kind}`}>
                  <TableCell className="text-sm text-muted-foreground">{r.provider.replace("_", " ")}</TableCell>
                  <TableCell className="font-mono text-xs">{r.kind}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.calls.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.units.toLocaleString()}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.failed > 0 ? <span className="font-bold text-destructive">{r.failed}</span> : <Muted>0</Muted>}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{money(r.costMicros)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {spend.byDay.length > 0 && (
          <div className="mt-5 space-y-1.5">
            {spend.byDay.slice(0, 14).map((d) => (
              <div key={d.day} className="flex items-center gap-3">
                <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{d.day}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(d.costMicros / maxDayCost) * 100}%` }} />
                </div>
                <span className="w-20 shrink-0 text-right text-xs font-bold tabular-nums">{money(d.costMicros)}</span>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{d.calls}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-[13px] text-muted-foreground">
          <b>{spend.cells.cells}</b> map cells imported in this window
          {spend.cells.cells > 0 && <> · {spend.cells.requests} billed requests · {spend.cells.found} venues kept</>}.
          The autofill ceiling is 30 cells per rolling day.
        </p>
      </Panel>

      {/* -------------------------------------------------- drop rates */}
      <Panel>
        <h2 className="mb-1 font-display text-lg font-semibold">Treasure drops — actual against configured</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">
          The marker on each bar is the configured share. A bar that turns red has drifted more than half
          its intended value away — the case a constant can never tell you about.
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Find rate </span>
            <b className={rateOff ? "text-destructive" : ""}>
              {drops.actualRate === null ? "—" : pct(drops.actualRate)}
            </b>
            <span className="text-muted-foreground"> vs {pct(drops.configuredRate)} configured</span>
          </div>
          <div className="text-muted-foreground">
            {drops.finds} finds over {drops.wanders} errand returns
          </div>
        </div>
        {drops.wanders === 0 ? (
          <Notice>
            No errands have returned in this window, so there is no denominator and the find rate is
            unknowable. It is shown as &ldquo;—&rdquo; rather than 0%.
          </Notice>
        ) : (
          <div className="space-y-2">
            {drops.byRarity.map((r) => (
              <div key={r.rarity} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm font-semibold">{r.label}</span>
                <Compare actual={r.actualShare} configured={r.configuredShare} />
                <span className="text-xs tabular-nums text-muted-foreground">{r.finds} found</span>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* --------------------------------------------------------- xp */}
      <Panel>
        <h2 className="mb-4 font-display text-lg font-semibold">Where XP comes from</h2>
        {economy.xp.length === 0 ? (
          <EmptyState icon={Sparkles} title="No XP awarded in this window" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead className="text-right">Awards</TableHead>
                <TableHead className="text-right">Per award</TableHead>
                <TableHead className="text-right">Total XP</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {economy.xp.map((r) => {
                // A mismatch means rows were written under a different rate —
                // the value was retuned, or something writes its own amount.
                const drift = r.awards > 0 && Math.round(r.xp / r.awards) !== r.configured;
                return (
                  <TableRow key={r.event}>
                    <TableCell className="font-mono text-xs">{r.event}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.awards.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {drift ? (
                        <span className="font-bold text-destructive" title="Ledger disagrees with the configured value">
                          {(r.xp / r.awards).toFixed(1)} ≠ {r.configured}
                        </span>
                      ) : (
                        r.configured
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{r.xp.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {totalXp > 0 ? pct(r.xp / totalXp) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      {/* --------------------------------------------------- missions */}
      <Panel>
        <h2 className="mb-1 font-display text-lg font-semibold">Missions</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">
          Completions come from the bond ledger. A mission at zero is either unreachable or not worth
          reaching — both matter, and the code can&apos;t tell them apart.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mission</TableHead>
              <TableHead className="text-right">Worth</TableHead>
              <TableHead className="text-right">Completions</TableHead>
              <TableHead>Offered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {economy.missions.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="font-semibold">{m.label}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{m.id}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">+{m.xp}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.completions === 0 ? <span className="font-bold text-destructive">0</span> : m.completions.toLocaleString()}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {m.conditional ? "Only when possible" : "Always eligible"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      {/* ----------------------------------------------------- levels */}
      <Panel>
        <h2 className="mb-1 font-display text-lg font-semibold">Bond levels</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">Real accounts only — seeded pets are excluded.</p>
        <div className="space-y-1">
          {economy.levels.map((l) => (
            <div key={l.level} className="flex items-center gap-3">
              <span className="w-7 shrink-0 text-right font-display text-sm font-semibold tabular-nums">{l.level}</span>
              <div className="h-2.5 w-40 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(l.pets / maxLevel) * 100}%` }} />
              </div>
              <span className="w-8 shrink-0 text-xs tabular-nums text-muted-foreground">{l.pets || ""}</span>
              <span className="truncate text-xs text-muted-foreground">{l.unlock}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* --------------------------------------------------- activity */}
      <Panel>
        <h2 className="mb-1 font-display text-lg font-semibold">People against pets</h2>
        <p className="mb-4 text-[13px] text-muted-foreground">
          Bots filling the room is the intent; bots being the <i>only</i> thing in it is the failure mode.
        </p>
        {economy.activity.length === 0 ? (
          <EmptyState icon={ListChecks} title="Nothing posted in this window" />
        ) : (
          <div className="space-y-1.5">
            {economy.activity.slice(0, 14).map((a) => (
              <div key={a.day} className="flex items-center gap-3">
                <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">{a.day}</span>
                <div className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-primary" style={{ width: `${(a.posts / maxActivity) * 100}%` }} title={`${a.posts} by people`} />
                  <div className="h-full bg-foreground/30" style={{ width: `${(a.petPosts / maxActivity) * 100}%` }} title={`${a.petPosts} by pets`} />
                  <div className="h-full bg-foreground/15" style={{ width: `${(a.replies / maxActivity) * 100}%` }} title={`${a.replies} replies`} />
                </div>
                <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {a.posts} · {a.petPosts} · {a.replies}
                </span>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">People · pets · replies</p>
          </div>
        )}
      </Panel>

      {/* ----------------------------------------------------- events */}
      {economy.events.length > 0 && (
        <Panel bleed>
          <div className="px-5 pt-5">
            <h2 className="font-display text-lg font-semibold">Events</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Goal</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead>Window</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {economy.events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <span className="font-semibold">{e.title}</span>
                    {e.running && <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">Running</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{e.goal}</TableCell>
                  <TableCell className="text-right tabular-nums">{e.target.toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(e.startsAt).toLocaleDateString()} → {new Date(e.endsAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </div>
  );
}
