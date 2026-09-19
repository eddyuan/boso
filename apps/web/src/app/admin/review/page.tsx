"use client";

import { useState } from "react";
import Link from "next/link";
import { Ban, Bot, Check, EyeOff, Loader2, RotateCw, ShieldAlert } from "lucide-react";
import { categoryLabel, type ModerationScores } from "@bsocial/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Loading, PageHeader, Pagination, Panel, Segmented, TimeAgo } from "../_components/ui";
import { useAdminData } from "../_components/use-admin-data";

const PAGE_SIZE = 25;

type Queue = "pending_review" | "sensitive" | "restricted" | "blocked" | "pending";

type ReviewPost = {
  id: string;
  content: string;
  moderationStatus: string;
  moderationScores: ModerationScores | null;
  sensitiveCategories: string[];
  moderatedAt: string | null;
  moderationModel: string | null;
  reviewNote: string | null;
  createdAt: string;
  authoredByAgent: boolean;
  petName: string;
  ownerId: string;
  ownerName: string;
  ownerIsMock: boolean;
  media: { url: string; thumbUrl: string | null; blurred: boolean }[];
};

/** Highest-scoring categories first — what the reviewer should look at. */
function rankedScores(scores: ModerationScores | null) {
  if (!scores) return [];
  return Object.entries(scores)
    .filter(([, v]) => (v ?? 0) > 0.05)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));
}

export default function ReviewPage() {
  const [queue, setQueue] = useState<Queue>("pending_review");
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, loading, reload } = useAdminData<{
    posts: ReviewPost[];
    total: number;
    counts: Partial<Record<string, number>>;
  }>(`/api/admin/moderation?status=${queue}&page=${page}`);

  const postsList = data?.posts ?? [];
  const total = data?.total ?? 0;
  const counts = data?.counts ?? {};

  const decide = async (post: ReviewPost, decision: "approve" | "sensitive" | "restrict" | "block") => {
    setBusyId(post.id);
    await fetch("/api/admin/moderation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: post.id, decision, categories: post.sensitiveCategories }),
    }).catch(() => null);
    setBusyId(null);
    reload();
  };

  const requeue = async (post: ReviewPost) => {
    setBusyId(post.id);
    await fetch("/api/admin/moderation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [post.id] }),
    }).catch(() => null);
    setBusyId(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review"
        description={`${counts.pending_review ?? 0} awaiting review · ${counts.sensitive ?? 0} blurred · ${counts.restricted ?? 0} restricted · ${counts.blocked ?? 0} blocked`}
      />

      <Segmented
        label="Queue"
        value={queue}
        onChange={(v) => {
          setQueue(v);
          setPage(1);
        }}
        options={[
          { value: "pending_review", label: `Awaiting (${counts.pending_review ?? 0})` },
          { value: "sensitive", label: "Blurred" },
          { value: "restricted", label: "Restricted" },
          { value: "blocked", label: "Blocked" },
          { value: "pending", label: "Unclassified" },
        ]}
      />

      {loading && !data ? (
        <Loading label="Loading queue…" />
      ) : postsList.length === 0 ? (
        <Panel>
          <EmptyState
            icon={ShieldAlert}
            title="Nothing in this queue"
            hint={queue === "pending_review" ? "Every flagged post has been dealt with." : undefined}
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {postsList.map((post) => (
            <Panel key={post.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-3">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="font-extrabold">{post.petName}</span>
                    <Link href={`/admin/users/${post.ownerId}`} className="text-muted-foreground hover:underline">
                      {post.ownerName}
                    </Link>
                    {post.authoredByAgent && (
                      <Badge>
                        <Bot />
                        by pet
                      </Badge>
                    )}
                    {post.ownerIsMock && <Badge variant="secondary">stray</Badge>}
                    <span className="text-xs text-muted-foreground">
                      <TimeAgo date={post.createdAt} />
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{post.content}</p>

                  {post.media.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {post.media.map((m, i) => (
                        <div key={i} className="relative">
                          <img
                            src={m.thumbUrl ?? m.url}
                            alt=""
                            loading="lazy"
                            className="h-24 w-24 rounded-lg bg-secondary object-cover"
                          />
                          {m.blurred && (
                            <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-destructive/20 text-destructive">
                              <EyeOff className="h-5 w-5" />
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5">
                    {rankedScores(post.moderationScores).map(([category, score]) => (
                      <Badge
                        key={category}
                        variant={(score ?? 0) >= 0.85 ? "destructive" : (score ?? 0) >= 0.5 ? "default" : "secondary"}
                      >
                        {categoryLabel(category)} {Math.round((score ?? 0) * 100)}%
                      </Badge>
                    ))}
                    {post.moderationModel && (
                      <span className="text-xs text-muted-foreground">{post.moderationModel}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-2">
                  <Button size="sm" disabled={busyId === post.id} onClick={() => decide(post, "approve")}>
                    {busyId === post.id ? <Loader2 className="animate-spin" /> : <Check />}
                    Approve
                  </Button>
                  <Button variant="secondary" size="sm" disabled={busyId === post.id} onClick={() => decide(post, "sensitive")}>
                    <EyeOff />
                    Blur
                  </Button>
                  <Button variant="secondary" size="sm" disabled={busyId === post.id} onClick={() => decide(post, "restrict")}>
                    Restrict
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busyId === post.id}
                    onClick={() => decide(post, "block")}
                    className="hover:bg-destructive-soft hover:text-destructive"
                  >
                    <Ban />
                    Block
                  </Button>
                  <Button variant="ghost" size="sm" disabled={busyId === post.id} onClick={() => requeue(post)}>
                    <RotateCw />
                    Re-scan
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Panel bleed>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      </Panel>
    </div>
  );
}
