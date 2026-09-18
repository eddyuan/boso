"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Check, CheckCircle2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EmptyState,
  Loading,
  Muted,
  Notice,
  PageHeader,
  Pagination,
  Panel,
  SearchField,
  TimeAgo,
} from "../_components/ui";
import { useAdminData } from "../_components/use-admin-data";
import { useDebounced } from "../_components/use-debounced";

const PAGE_SIZE = 30;
const MAX_LENGTH = 500;

type Agent = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  petName: string | null;
  petSpecies: string | null;
  postCount: number;
};

export default function AgentsPage() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const query = useDebounced(search);
  const [composing, setComposing] = useState<Agent | null>(null);

  const params = new URLSearchParams({ page: String(page), mock: "only" });
  if (query) params.set("search", query);
  const { data, loading, reload } = useAdminData<{ users: Agent[]; total: number }>(`/api/admin/users?${params}`);
  const agents = data?.users ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agents"
        description={`${total.toLocaleString()} stray ${total === 1 ? "pet" : "pets"} — seeded accounts that post about nearby places.`}
      />

      <Panel
        bleed
        actions={
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search strays"
          />
        }
      >
        {loading && !data ? (
          <Loading label="Loading agents…" />
        ) : agents.length === 0 ? (
          <EmptyState
            icon={Bot}
            title={query ? "No strays match" : "No strays yet"}
            hint={query ? undefined : "Create some on the Seeds page."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pet</TableHead>
                <TableHead>Handle</TableHead>
                <TableHead className="text-right">Posts</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={a.image ?? undefined} alt="" />
                        <AvatarFallback className="text-sm">{(a.petName ?? a.name)[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="truncate font-extrabold">{a.petName ?? a.name}</div>
                        <div className="text-xs capitalize text-muted-foreground">{a.petSpecies ?? "no pet"}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.username ? `@${a.username}` : <Muted />}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {a.postCount > 0 ? a.postCount : <Muted>0</Muted>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <TimeAgo date={a.createdAt} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <TimeAgo date={a.lastActiveAt} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="secondary" size="sm" onClick={() => setComposing(a)}>
                      <Sparkles />
                      Write post
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      </Panel>

      {composing && (
        <ComposeDialog
          key={composing.id}
          agent={composing}
          onClose={(published) => {
            setComposing(null);
            if (published) reload();
          }}
        />
      )}
    </div>
  );
}

type GeneratedImage = { url: string; thumbUrl: string };
type Draft = { content: string; images: GeneratedImage[] } | { error: string };

async function requestDraft(agentId: string): Promise<Draft> {
  try {
    const res = await fetch(`/api/admin/mock-users/${agentId}/generate-post`, { method: "POST" });
    const data = await res.json();
    return res.ok ? { content: data.content, images: data.images ?? [] } : { error: data.error ?? "Couldn't write a post." };
  } catch {
    return { error: "Network error." };
  }
}

/** Generates a post in the stray's voice, lets you edit it and pick a photo, then publishes. */
function ComposeDialog({ agent, onClose }: { agent: Agent; onClose: (published: boolean) => void }) {
  const [content, setContent] = useState("");
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Mounted fresh for each agent, and starts writing straight away.
  const [generating, setGenerating] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  const apply = useCallback((draft: Draft) => {
    if ("error" in draft) setError(draft.error);
    else {
      setContent(draft.content);
      setImages(draft.images);
      // All the candidates are shown; start with the first one picked.
      setSelected(draft.images.length > 0 ? new Set([0]) : new Set());
    }
    setGenerating(false);
  }, []);

  // Generating costs money (the photos especially), so it must run once per
  // open — not twice under StrictMode's double effect.
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    requestDraft(agent.id).then(apply);
  }, [agent.id, apply]);

  const retry = () => {
    setContent("");
    setImages([]);
    setSelected(new Set());
    setError(null);
    setGenerating(true);
    requestDraft(agent.id).then(apply);
  };

  const publish = async () => {
    if (!content.trim()) return;
    setPublishing(true);
    setError(null);
    try {
      const media = [...selected]
        .sort((a, b) => a - b)
        .map((i) => ({ url: images[i]!.url, thumbUrl: images[i]!.thumbUrl }));
      const res = await fetch(`/api/admin/mock-users/${agent.id}/publish-post`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, media }),
      });
      if (res.ok) setPublished(true);
      else {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Couldn't publish.");
      }
    } catch {
      setError("Network error.");
    }
    setPublishing(false);
  };

  const name = agent.petName ?? agent.name;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose(published)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Post as {name}</DialogTitle>
          <DialogDescription>Written in {name}&apos;s voice. Edit it and pick a photo before it goes on the map.</DialogDescription>
        </DialogHeader>

        {published ? (
          <>
            <Notice tone="green">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Published.
              </span>
            </Notice>
            <DialogFooter>
              <Button onClick={() => onClose(true)}>Done</Button>
            </DialogFooter>
          </>
        ) : generating ? (
          <div className="flex flex-col items-center gap-3 py-10 text-sm font-semibold text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin text-primary-ink" />
            Writing the post and taking photos…
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                maxLength={MAX_LENGTH}
                className="resize-none"
                placeholder="Post text"
              />
              <p className="text-right text-xs font-semibold tabular-nums text-muted-foreground">
                {content.length}/{MAX_LENGTH}
              </p>
            </div>

            {images.length > 0 && (
              <div className="space-y-2">
                <p className="text-[13px] font-bold text-muted-foreground">
                  Photos — tap to include, in the order picked (up to {images.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {images.map((img, i) => {
                    const order = [...selected].sort((a, b) => a - b).indexOf(i);
                    const on = order !== -1;
                    return (
                      <button
                        key={img.url}
                        type="button"
                        onClick={() =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i);
                            else next.add(i);
                            return next;
                          })
                        }
                        aria-pressed={on}
                        className={cn(
                          "relative aspect-4/3 cursor-pointer overflow-hidden rounded-xl transition-shadow focus-visible:outline-none",
                          on ? "ring-[3px] ring-primary" : "opacity-80 hover:opacity-100",
                        )}
                      >
                        <img src={img.thumbUrl} alt={`Option ${i + 1}`} className="h-full w-full object-cover" />
                        {on && (
                          <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                            {selected.size > 1 ? (
                              <span className="text-[11px] font-extrabold">{order + 1}</span>
                            ) : (
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {error && <Notice tone="red">{error}</Notice>}

            <DialogFooter className="sm:justify-between">
              <Button variant="ghost" onClick={retry} disabled={publishing}>
                <RefreshCw />
                Try again
              </Button>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <Button variant="secondary" onClick={() => onClose(false)} disabled={publishing}>
                  Cancel
                </Button>
                <Button onClick={publish} disabled={publishing || !content.trim()}>
                  {publishing && <Loader2 className="animate-spin" />}
                  {publishing ? "Publishing…" : "Publish"}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
