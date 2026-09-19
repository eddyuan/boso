"use client";

import { useState } from "react";
import { AlertTriangle, HardDrive, Image as ImageIcon, Link2Off, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Loading, Muted, Notice, PageHeader, Panel, StatCard, TimeAgo } from "../_components/ui";
import { useAdminData } from "../_components/use-admin-data";

type Obj = { key: string; bytes: number; modified: string | null };
type Inventory = {
  objects: number;
  bytes: number;
  referenced: number;
  orphans: Obj[];
  orphanBytes: number;
  dangling: { kind: string; url: string }[];
  byUse: { kind: string; label: string; rows: number; keys: number }[];
  truncated: boolean;
  foreign: { objects: number; bytes: number; prefixes: string[] };
  error?: string;
  reason?: string;
};

function size(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function AssetsPage() {
  const { data, loading, reload } = useAdminData<Inventory>("/api/admin/assets");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function purge(keys: string[]) {
    if (keys.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.reason ?? body.error ?? "Failed");
      setMessage(
        `Deleted ${body.deleted}.` +
          (body.refused?.length ? ` Refused ${body.refused.length} — they became referenced since the page loaded.` : ""),
      );
      setPicked(new Set());
      reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't delete those.");
    }
    setBusy(false);
  }

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <PageHeader title="Assets" description="What storage holds, against what the database references." />
        <Panel><Loading label="Listing storage…" /></Panel>
      </div>
    );
  }
  if (!data) return null;

  if (data.error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Assets" description="What storage holds, against what the database references." />
        <Notice tone="red">
          <b>Couldn&apos;t list storage.</b> {data.reason} — usually object storage not being configured, or
          credentials without <span className="font-mono text-xs">ListBucket</span>. Nothing is offered for
          deletion while the listing is unreadable, since an empty bucket and an unreadable one look the same.
        </Notice>
      </div>
    );
  }

  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description="What storage holds, against what the database references. Both directions matter, and neither is visible from one side alone."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Our objects" value={data.objects} icon={HardDrive} hint={size(data.bytes)} />
        <StatCard label="Referenced" value={data.referenced} icon={ImageIcon} />
        <StatCard label="Unreferenced" value={data.orphans.length} icon={Trash2} hint={size(data.orphanBytes)} />
        <StatCard label="Broken references" value={data.dangling.length} icon={Link2Off} />
      </div>

      {data.foreign.objects > 0 && (
        <Notice>
          <b>This bucket is shared.</b> {data.foreign.objects.toLocaleString()} objects
          ({size(data.foreign.bytes)}) sit under prefixes this app doesn&apos;t write —{" "}
          <span className="font-mono text-xs">{data.foreign.prefixes.join(", ")}</span> — and belong to
          something else. They are counted here only so the totals make sense; they are never listed as
          unreferenced and cannot be deleted from this page. Only{" "}
          <span className="font-mono text-xs">posts/</span>, <span className="font-mono text-xs">places/</span>{" "}
          and <span className="font-mono text-xs">avatars/</span> are ours to judge.
        </Notice>
      )}

      {data.truncated && (
        <Notice tone="red">
          The listing hit its ceiling, so &ldquo;unreferenced&rdquo; can&apos;t be trusted and deletion is
          disabled. A truncated list reports real files as absent, which is the one direction this tool must
          never get wrong.
        </Notice>
      )}

      {message && (
        <Panel>
          <p className="text-sm font-bold">{message}</p>
        </Panel>
      )}

      <Panel>
        <h2 className="mb-3 font-display text-lg font-semibold">What references what</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Kind</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead className="text-right">Objects expected</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.byUse.map((u) => (
              <TableRow key={u.kind}>
                <TableCell>
                  <div className="font-semibold">{u.label}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">{u.kind}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">{u.rows.toLocaleString()}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{u.keys.toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-3 text-[13px] text-muted-foreground">
          Post photos and venue photos each store a card and a thumbnail, so two objects per row.
        </p>
      </Panel>

      {data.dangling.length > 0 && (
        <Panel>
          <div className="mb-3 flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <h2 className="font-display text-lg font-semibold">Broken references</h2>
              <p className="text-[13px] text-muted-foreground">
                Rows pointing at objects that aren&apos;t there. These render as broken images for real users,
                which makes them the more urgent of the two problems — and they can&apos;t be fixed by deleting
                anything.
              </p>
            </div>
          </div>
          <div className="space-y-1">
            {data.dangling.slice(0, 50).map((d) => (
              <div key={d.url} className="flex items-center gap-3 text-[13px]">
                <span className="rounded-full bg-destructive-soft px-2 py-0.5 text-[11px] font-bold text-destructive">
                  {d.kind}
                </span>
                <span className="truncate font-mono text-[11px]">{d.url}</span>
              </div>
            ))}
            {data.dangling.length > 50 && (
              <p className="pt-1 text-[13px] text-muted-foreground">…and {data.dangling.length - 50} more.</p>
            )}
          </div>
        </Panel>
      )}

      <Panel bleed>
        <div className="flex flex-wrap items-center gap-3 px-5 pb-3 pt-5">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold">Unreferenced objects</h2>
            <p className="text-[13px] text-muted-foreground">
              Nothing in the database points at these. They cost storage every month and nothing notices —
              a failed post after its photos uploaded, a replaced avatar, a deleted post whose rows cascaded
              away while the objects stayed.
            </p>
          </div>
          {data.orphans.length > 0 && !data.truncated && (
            <div className="flex shrink-0 gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => setPicked(new Set(data.orphans.map((o) => o.key)))}
              >
                Select all
              </Button>
              <Button size="sm" variant="destructive" disabled={busy || picked.size === 0} onClick={() => purge([...picked])}>
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Delete {picked.size || ""}
              </Button>
            </div>
          )}
        </div>
        {data.orphans.length === 0 ? (
          <EmptyState icon={Trash2} title="Nothing unreferenced" hint="Every stored object is pointed at by a row." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Key</TableHead>
                <TableHead className="text-right">Size</TableHead>
                <TableHead>Stored</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.orphans.slice(0, 300).map((o) => (
                <TableRow key={o.key}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={picked.has(o.key)}
                      onChange={() => toggle(o.key)}
                      disabled={data.truncated}
                      aria-label={`Select ${o.key}`}
                      className="h-4 w-4 accent-[var(--primary-press)]"
                    />
                  </TableCell>
                  <TableCell className="max-w-md truncate font-mono text-[11px]">{o.key}</TableCell>
                  <TableCell className="text-right tabular-nums">{size(o.bytes)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {o.modified ? <TimeAgo date={o.modified} /> : <Muted />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {data.orphans.length > 300 && (
          <p className="px-5 py-3 text-[13px] text-muted-foreground">
            Showing the first 300 of {data.orphans.length}.
          </p>
        )}
      </Panel>
    </div>
  );
}
