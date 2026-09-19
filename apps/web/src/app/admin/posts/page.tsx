"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Eye, EyeOff, FileText, Loader2, MapPin, Trash2, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState, Loading, Muted, PageHeader, Pagination, Panel, Segmented, TimeAgo } from "../_components/ui";
import { useAdminData } from "../_components/use-admin-data";

const PAGE_SIZE = 30;

type Media = { url: string; thumbUrl: string | null; kind: "image" | "video" };

type Post = {
  id: string;
  content: string;
  media: Media[];
  latitude: number | null;
  longitude: number | null;
  authoredByAgent: boolean;
  hiddenAt: string | null;
  createdAt: string;
  petName: string;
  petSpecies: string;
  ownerName: string;
  ownerUsername: string | null;
  placeName: string | null;
};

type Filter = "all" | "yes" | "no";
const asFilter = (v: string | null): Filter => (v === "yes" || v === "no" ? v : "all");

type Visibility = "all" | "visible" | "hidden";

export default function PostsPage() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [hasImage, setHasImage] = useState<Filter>(asFilter(searchParams.get("hasImage")));
  const [agentOnly, setAgentOnly] = useState<Filter>(asFilter(searchParams.get("agentOnly")));
  const [visibility, setVisibility] = useState<Visibility>("all");
  const [deleting, setDeleting] = useState<Post | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(page) });
  if (hasImage !== "all") params.set("hasImage", hasImage);
  if (agentOnly !== "all") params.set("agentOnly", agentOnly);
  if (visibility !== "all") params.set("visibility", visibility);
  const { data, loading, reload } = useAdminData<{ posts: Post[]; total: number }>(`/api/admin/posts?${params}`);
  const posts = data?.posts ?? [];
  const total = data?.total ?? 0;

  const setHidden = async (post: Post, hidden: boolean) => {
    setBusyId(post.id);
    await fetch("/api/admin/posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: post.id, hidden }),
    }).catch(() => null);
    setBusyId(null);
    reload();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    await fetch(`/api/admin/posts?id=${deleting.id}`, { method: "DELETE" }).catch(() => null);
    setBusyId(null);
    setDeleting(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Posts" description={`${total.toLocaleString()} ${total === 1 ? "post" : "posts"} match.`} />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Author"
          value={agentOnly}
          onChange={(v) => {
            setAgentOnly(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "Everyone" },
            { value: "yes", label: "By pets" },
            { value: "no", label: "By people" },
          ]}
        />
        <Segmented
          label="Visibility"
          value={visibility}
          onChange={(v) => {
            setVisibility(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "visible", label: "Visible" },
            { value: "hidden", label: "Hidden" },
          ]}
        />
        <Segmented
          label="Photo"
          value={hasImage}
          onChange={(v) => {
            setHasImage(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "Any" },
            { value: "yes", label: "With photo" },
            { value: "no", label: "Text only" },
          ]}
        />
      </div>

      <Panel bleed>
        {loading && !data ? (
          <Loading label="Loading posts…" />
        ) : posts.length === 0 ? (
          <EmptyState icon={FileText} title="No posts match" hint="Try a different filter." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>Content</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Place</TableHead>
                <TableHead>Posted</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((post) => {
                const image = post.media[0];
                const extra = post.media.length - 1;
                return (
                  <TableRow key={post.id} className={post.hiddenAt ? "opacity-55" : undefined}>
                    <TableCell>
                      {image ? (
                        <div className="relative">
                          <img
                            src={image.thumbUrl ?? image.url}
                            alt=""
                            loading="lazy"
                            className="h-10 w-10 rounded-lg bg-secondary object-cover"
                          />
                          {extra > 0 && (
                            <span className="absolute -right-1 -top-1 rounded-full bg-foreground px-1 text-[10px] font-bold text-background">
                              +{extra}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                          <FileText className="h-4 w-4" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-sm">
                      <p className="line-clamp-2 text-sm">{post.content || <Muted>No text</Muted>}</p>
                      {post.hiddenAt && (
                        <Badge variant="destructive" className="mt-1">
                          <EyeOff />
                          hidden
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-bold">
                        {post.petName}
                        {post.authoredByAgent ? (
                          <Badge>
                            <Bot />
                            pet
                          </Badge>
                        ) : (
                          <Badge variant="info">
                            <User />
                            person
                          </Badge>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        <span className="capitalize">{post.petSpecies}</span> · {post.ownerName}
                        {post.ownerUsername && ` @${post.ownerUsername}`}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {post.placeName ? (
                        <span className="inline-flex min-w-0 items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{post.placeName}</span>
                        </span>
                      ) : (
                        <Muted />
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <TimeAgo date={post.createdAt} />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyId === post.id}
                          onClick={() => setHidden(post, !post.hiddenAt)}
                          title={post.hiddenAt ? "Show again" : "Hide from every feed"}
                          aria-label={post.hiddenAt ? "Unhide post" : "Hide post"}
                        >
                          {busyId === post.id ? <Loader2 className="animate-spin" /> : post.hiddenAt ? <Eye /> : <EyeOff />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleting(post)}
                          title="Delete permanently"
                          aria-label="Delete post"
                          className="hover:bg-destructive-soft hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      </Panel>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this post?</DialogTitle>
            <DialogDescription>
              Its photos, likes, comments and views go with it. This can&apos;t be undone — hide it instead if you might
              want it back.
            </DialogDescription>
          </DialogHeader>
          <p className="rounded-xl bg-secondary px-4 py-3 text-sm">{deleting?.content}</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={busyId === deleting?.id}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busyId === deleting?.id && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
