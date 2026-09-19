"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, Circle, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ALL_ITEMS,
  ITEM_BY_ID,
  PHASES,
  PHASE_OF,
  PRINCIPLES,
  START_HERE,
  type Effort,
  type Item,
  type Status,
} from "./plan-data";

const EFFORT: Record<Effort, { label: string; hint: string }> = {
  S: { label: "S", hint: "days" },
  M: { label: "M", hint: "a week or two" },
  L: { label: "L", hint: "multi-week" },
};

const STATUS: Record<Status, { label: string; className: string }> = {
  shipped: { label: "Shipped", className: "bg-success-soft text-success" },
  ready: { label: "Ready", className: "bg-info-soft text-info" },
  blocked: { label: "Waiting", className: "bg-secondary text-muted-foreground" },
};

function Impact({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Impact ${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className={cn("h-1.5 w-1.5 rounded-full", n <= value ? "bg-foreground" : "bg-border")}
        />
      ))}
    </span>
  );
}

function ItemCard({ item, accent }: { item: Item; accent: string }) {
  const [open, setOpen] = useState(false);
  const blockers = (item.needs ?? []).map((id) => ITEM_BY_ID.get(id)).filter(Boolean) as Item[];

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-start gap-3 p-4 text-left"
      >
        <span
          aria-hidden
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-display text-base font-semibold leading-tight">{item.title}</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", STATUS[item.status].className)}>
              {STATUS[item.status].label}
            </span>
          </span>
          <span className="mt-1 block text-sm text-muted-foreground">{item.summary}</span>
        </span>
        <span className="flex shrink-0 items-center gap-3 pt-0.5">
          <Impact value={item.impact} />
          <span
            className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] font-extrabold text-muted-foreground"
            title={`${EFFORT[item.effort].hint} of work`}
          >
            {EFFORT[item.effort].label}
          </span>
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4 pl-[2.1rem] text-sm">
          <p className="max-w-[70ch] leading-relaxed">{item.why}</p>

          {blockers.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span className="font-bold">Needs first:</span>
              {blockers.map((b) => (
                <span key={b.id} className="rounded-md bg-secondary px-1.5 py-0.5 font-semibold text-foreground">
                  {b.title}
                </span>
              ))}
            </p>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {item.existing && item.existing.length > 0 && (
              <div>
                <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                  Already built
                </p>
                <ul className="space-y-1">
                  {item.existing.map((line) => (
                    <li key={line} className="flex gap-2 text-[13px] text-muted-foreground">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                What&apos;s left
              </p>
              <ul className="space-y-1">
                {item.todo.map((line) => (
                  <li key={line} className="flex gap-2 text-[13px]">
                    <Circle className="mt-1 h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function PlanBoard() {
  const [readyOnly, setReadyOnly] = useState(false);

  const counts = useMemo(() => {
    const ready = ALL_ITEMS.filter((i) => i.status === "ready").length;
    const blocked = ALL_ITEMS.filter((i) => i.status === "blocked").length;
    return { total: ALL_ITEMS.length, ready, blocked };
  }, []);

  return (
    <div className="space-y-8 pb-16">
      <header className="space-y-3">
        <h1 className="font-display text-xl font-semibold leading-tight tracking-tight">Build plan</h1>
        <p className="max-w-[75ch] text-sm leading-relaxed text-muted-foreground">
          Ordered by the loop each phase closes, not by feature theme. Tielo doesn&apos;t lack features — it has loops
          that dead-end. A pet acts and logs a decision, and you can&apos;t approve it, can&apos;t like the reply,
          can&apos;t see who looked. Points and levels on top of that are a scoreboard for a game with no ball. So:
          fill the world, close the loop, earn the return, then give long-term players something to chase.
        </p>
        <p className="text-[13px] font-semibold text-muted-foreground">
          {counts.total} items · {counts.ready} ready to pick up · {counts.blocked} waiting on something earlier
        </p>
      </header>

      <section className="rounded-xl border border-border bg-card p-4">
        <p className="mb-3 flex items-center gap-2 font-display text-base font-semibold">
          <Sparkles className="h-4 w-4 text-primary-ink" />
          Start here
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {START_HERE.map((id, i) => {
            const item = ITEM_BY_ID.get(id);
            if (!item) return null;
            return (
              <span key={id} className="flex items-center gap-2">
                {i > 0 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                <a
                  href={`#${id}`}
                  className="rounded-lg border border-border px-2.5 py-1 text-[13px] font-bold hover:bg-accent"
                >
                  {item.title}
                </a>
              </span>
            );
          })}
        </div>
        <p className="mt-3 max-w-[70ch] text-[13px] text-muted-foreground">
          All three are unblocked, all three are mostly-built already, and none of them needs the level system to
          exist. Hold the whole XP economy until these are live and there&apos;s real engagement data to tune it
          against.
        </p>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setReadyOnly((v) => !v)}
          className={cn(
            "h-8 cursor-pointer rounded-lg px-3 text-[13px] font-bold transition-colors",
            readyOnly ? "bg-primary-soft text-primary-ink" : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
        >
          {readyOnly ? "Showing what's unblocked" : "Show only what's unblocked"}
        </button>
        <span className="text-[13px] text-muted-foreground">Click any item for the argument and the work.</span>
      </div>

      {PHASES.map((phase) => {
        const items = readyOnly ? phase.items.filter((i) => i.status === "ready") : phase.items;
        if (items.length === 0) return null;
        return (
          <section key={phase.id} id={phase.id} className="space-y-3">
            <div className="border-l-2 pl-4" style={{ borderColor: phase.accent }}>
              <p className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: phase.accent }}>
                {phase.label} · {phase.question}
              </p>
              <h2 className="font-display text-lg font-semibold leading-tight">{phase.title}</h2>
              <p className="mt-1 max-w-[75ch] text-sm text-muted-foreground">{phase.goal}</p>
              <p className="mt-2 max-w-[75ch] text-[13px] leading-relaxed text-muted-foreground">{phase.rationale}</p>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} id={item.id} className="scroll-mt-6">
                  <ItemCard item={item} accent={phase.accent} />
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="space-y-3">
        <div className="border-l-2 border-border pl-4">
          <h2 className="font-display text-lg font-semibold leading-tight">Rules we hold to</h2>
          <p className="mt-1 max-w-[75ch] text-sm text-muted-foreground">
            The decisions that shape everything above, written down so they don&apos;t get relitigated per feature.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {PRINCIPLES.map((p) => (
            <div key={p.title} className="rounded-xl border border-border bg-card p-4">
              <p className="font-display text-base font-semibold">{p.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Unused today, kept so a phase index can be added without re-deriving it. */
export const phaseForItem = (id: string) => PHASE_OF.get(id);
