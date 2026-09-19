"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, Clock, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Loading, Muted, Notice, PageHeader, Panel, StatCard, TimeAgo } from "../_components/ui";
import { useAdminData } from "../_components/use-admin-data";

type Health = {
  id: string;
  label: string;
  trigger: string;
  blurb: string;
  event?: string;
  staleAfterHours: number | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: "running" | "succeeded" | "failed" | null;
  lastDurationMs: number | null;
  lastError: string | null;
  runs24h: number;
  failures24h: number;
  stale: boolean;
  neverRun: boolean;
};
type Run = {
  id: string; job: string; status: string; startedAt: string;
  durationMs: number | null; error: string | null; manual: boolean;
};

function duration(ms: number | null) {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

function StatusIcon({ job }: { job: Health }) {
  if (job.neverRun) return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
  if (job.lastStatus === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  if (job.stale) return <AlertTriangle className="h-4 w-4 text-destructive" />;
  if (job.lastStatus === "running") return <Clock className="h-4 w-4 text-muted-foreground" />;
  return <CheckCircle2 className="h-4 w-4 text-success" />;
}

export default function JobsPage() {
  const { data, loading, reload } = useAdminData<{ health: Health[]; runs: Run[] }>("/api/admin/jobs");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  async function run(job: string) {
    setBusy(job);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.reason ?? body.error ?? "Failed");
      setMessage({ tone: "ok", text: `Queued ${job}. It appears below once a worker picks it up.` });
      reload();
    } catch (e) {
      setMessage({ tone: "bad", text: e instanceof Error ? e.message : "Couldn't queue that." });
    }
    setBusy(null);
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Jobs" description="Whether the background work is actually running." />
        <Panel><Loading label="Checking jobs…" /></Panel>
      </div>
    );
  }
  if (!data) return null;

  const { health, runs } = data;
  const neverRun = health.filter((j) => j.neverRun);
  const stale = health.filter((j) => j.stale && !j.neverRun);
  const failing = health.filter((j) => j.failures24h > 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs"
        description="Whether the background work is actually running. A run is recorded when it starts, not when it finishes, so a job killed halfway still leaves a trace."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Jobs" value={health.length} icon={Clock} />
        <StatCard label="Never run" value={neverRun.length} icon={CircleDashed} />
        <StatCard label="Overdue" value={stale.length} icon={AlertTriangle} />
        <StatCard label="Failed in 24h" value={failing.reduce((n, j) => n + j.failures24h, 0)} icon={XCircle} />
      </div>

      {neverRun.length === health.length && (
        <Notice>
          <b>No job has ever recorded a run.</b> Either no Inngest scheduler is connected, or nothing has
          been deployed with this tracking in place yet. Everything scheduled — nightly diaries, the morning
          digest, comeback nudges, persona posts, the pet loop — is therefore unproven end to end.
        </Notice>
      )}

      {message && (
        <Panel>
          <p className={`text-sm font-bold ${message.tone === "ok" ? "text-success" : "text-destructive"}`}>
            {message.text}
          </p>
        </Panel>
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        {health.map((j) => (
          <div
            key={j.id}
            className={`rounded-xl border bg-card p-4 ${
              j.lastStatus === "failed" || j.stale ? "border-destructive/50" : "border-border"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5"><StatusIcon job={j} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold">{j.label}</span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                    {j.trigger}
                  </span>
                  {j.neverRun && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                      never run
                    </span>
                  )}
                  {j.stale && !j.neverRun && (
                    <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-[11px] font-bold text-destructive">
                      overdue
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{j.blurb}</p>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-4">
                  <div>
                    <dt className="text-muted-foreground">Last run</dt>
                    <dd className="font-semibold">{j.lastRunAt ? <TimeAgo date={j.lastRunAt} /> : <Muted />}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last success</dt>
                    <dd className="font-semibold">
                      {j.lastSuccessAt ? <TimeAgo date={j.lastSuccessAt} /> : <Muted />}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Took</dt>
                    <dd className="font-semibold tabular-nums">{duration(j.lastDurationMs)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">24h</dt>
                    <dd className="font-semibold tabular-nums">
                      {j.runs24h}
                      {j.failures24h > 0 && <span className="text-destructive"> · {j.failures24h} failed</span>}
                    </dd>
                  </div>
                </dl>

                {j.lastError && (
                  <p className="mt-2 break-words rounded-lg bg-destructive-soft px-3 py-2 font-mono text-[11px] text-destructive">
                    {j.lastError}
                  </p>
                )}

                {j.staleAfterHours !== null && (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Counts as overdue after {j.staleAfterHours}h without a success.
                  </p>
                )}
              </div>
              {j.event && (
                <Button size="sm" variant="secondary" disabled={busy === j.id} onClick={() => run(j.id)}>
                  <Play className="mr-1 h-3.5 w-3.5" />
                  Run
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Panel bleed>
        <div className="px-5 pb-3 pt-5">
          <h2 className="font-display text-lg font-semibold">Recent runs</h2>
          <p className="text-[13px] text-muted-foreground">
            Newest first. A row stuck on &ldquo;running&rdquo; with no end is a job that died mid-flight.
          </p>
        </div>
        {runs.length === 0 ? (
          <EmptyState icon={Clock} title="Nothing recorded yet" hint="Runs appear here once a job executes." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead className="text-right">Took</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    {r.job}
                    {r.manual && <span className="ml-2 text-[11px] font-bold text-muted-foreground">manual</span>}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        r.status === "succeeded"
                          ? "bg-success-soft text-success"
                          : r.status === "failed"
                            ? "bg-destructive-soft text-destructive"
                            : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground"><TimeAgo date={r.startedAt} /></TableCell>
                  <TableCell className="text-right tabular-nums">{duration(r.durationMs)}</TableCell>
                  <TableCell className="max-w-xs truncate font-mono text-[11px] text-destructive">
                    {r.error ?? ""}
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
