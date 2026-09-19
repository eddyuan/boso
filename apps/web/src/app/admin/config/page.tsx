"use client";

import { useState } from "react";
import { AlertTriangle, History, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loading, Muted, Notice, PageHeader, Panel, TimeAgo } from "../_components/ui";
import { useAdminData } from "../_components/use-admin-data";

type Field = {
  key: string;
  label: string;
  group: string;
  type: "int" | "rate" | "hour";
  default: number;
  min: number;
  max: number;
  help: string;
  unit?: string;
};
type Group = { id: string; label: string; blurb: string };
type Audit = { id: string; key: string; fromValue: number | null; toValue: number; actor: string | null; createdAt: string };
type Config = {
  fields: Field[];
  groups: Group[];
  values: Record<string, number>;
  issues: { key: string; reason: string }[];
  history: Audit[];
};

function Row({
  field,
  value,
  onSave,
  busy,
}: {
  field: Field;
  value: number;
  onSave: (value: number | null) => void;
  busy: boolean;
}) {
  // Initialised once. The caller keys this component on the saved value, so a
  // successful save remounts it with the new one — no effect syncing state to a
  // prop, which would cascade a render on every refresh.
  const [draft, setDraft] = useState(String(value));

  const parsed = Number(draft);
  const valid =
    draft.trim() !== "" &&
    Number.isFinite(parsed) &&
    parsed >= field.min &&
    parsed <= field.max &&
    (field.type === "rate" || Number.isInteger(parsed));
  const dirty = parsed !== value;
  const overridden = value !== field.default;

  return (
    <div className="flex flex-wrap items-start gap-4 border-b border-border px-5 py-4 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-extrabold">{field.label}</span>
          {overridden && (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-bold text-primary-ink">
              changed from {field.default}
            </span>
          )}
        </div>
        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{field.key}</p>
        <p className="mt-1 max-w-[70ch] text-[13px] leading-5 text-muted-foreground">{field.help}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="text-right">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            inputMode="decimal"
            className={`h-9 w-28 text-right tabular-nums ${valid ? "" : "border-destructive"}`}
            aria-label={field.label}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {field.min}–{field.max}
            {field.unit ? ` ${field.unit}` : ""}
          </p>
        </div>
        <Button size="sm" disabled={!valid || !dirty || busy} onClick={() => onSave(parsed)}>
          Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={!overridden || busy}
          onClick={() => onSave(null)}
          aria-label={`Reset ${field.label}`}
          title="Back to the shipped default"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function ConfigPage() {
  const { data, loading, reload } = useAdminData<Config>("/api/admin/config");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(key: string, value: number | null) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.reason ?? body.error ?? "Rejected");
      }
      reload();
    } catch (e) {
      setError(e instanceof Error ? `${key}: ${e.message}` : "Couldn't save that.");
    }
    setBusy(null);
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Tuning" description="Game values, changeable without a deploy." />
        <Panel><Loading label="Reading config…" /></Panel>
      </div>
    );
  }
  if (!data) return null;

  const changed = data.fields.filter((f) => data.values[f.key] !== f.default);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tuning"
        description="Game values, changeable without a deploy. Every one takes effect within a few seconds, on every instance and in the background workers."
      />

      <Notice>
        Legal and structural values stay in code on purpose — the age gate, username lengths, coordinate
        precision, the earth&apos;s radius. Those aren&apos;t tuning, and a change to them should be reviewed.
      </Notice>

      {data.issues.length > 0 && (
        <Panel>
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <h2 className="font-display text-base font-semibold">Stored values being ignored</h2>
              <p className="mb-2 text-[13px] text-muted-foreground">
                These failed their bounds on read and are running on their defaults instead. Usually a value
                edited directly in the database, or one stored before a bound was tightened.
              </p>
              <ul className="space-y-1">
                {data.issues.map((i) => (
                  <li key={i.key} className="text-[13px]">
                    <span className="font-mono text-xs">{i.key}</span> — {i.reason}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Panel>
      )}

      {error && (
        <Panel>
          <p className="text-sm font-bold text-destructive">{error}</p>
        </Panel>
      )}

      {changed.length > 0 && (
        <Panel>
          <h2 className="mb-2 font-display text-base font-semibold">
            {changed.length} value{changed.length === 1 ? "" : "s"} away from the defaults
          </h2>
          <div className="flex flex-wrap gap-2">
            {changed.map((f) => (
              <span key={f.key} className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary-ink">
                {f.label}: {data.values[f.key]}
                <span className="ml-1 opacity-60">was {f.default}</span>
              </span>
            ))}
          </div>
        </Panel>
      )}

      {data.groups.map((group) => {
        const fields = data.fields.filter((f) => f.group === group.id);
        if (fields.length === 0) return null;
        return (
          <Panel key={group.id} bleed>
            <div className="px-5 pb-1 pt-5">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                {group.label}
              </h2>
              <p className="mb-2 text-[13px] text-muted-foreground">{group.blurb}</p>
            </div>
            {fields.map((f) => (
              <Row
                key={`${f.key}:${data.values[f.key]}`}
                field={f}
                value={data.values[f.key]}
                busy={busy === f.key}
                onSave={(v) => save(f.key, v)}
              />
            ))}
          </Panel>
        );
      })}

      <Panel bleed>
        <div className="px-5 pb-3 pt-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <History className="h-4 w-4 text-muted-foreground" />
            What changed
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Written before the value takes effect, so a change can never apply without being recorded.
          </p>
        </div>
        {data.history.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">Nothing has been changed yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.history.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-2.5 text-[13px]">
                <span className="font-mono text-xs">{h.key}</span>
                <span className="tabular-nums text-muted-foreground">
                  {h.fromValue === null ? <Muted>default</Muted> : h.fromValue}
                </span>
                <span className="text-muted-foreground">→</span>
                <span className="font-bold tabular-nums">{h.toValue}</span>
                <span className="ml-auto text-muted-foreground">
                  {h.actor ?? <Muted>unknown</Muted>} · <TimeAgo date={h.createdAt} />
                </span>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
