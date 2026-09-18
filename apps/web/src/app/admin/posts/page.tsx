"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, FileText, MapPin, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Loading, PageHeader, Pagination, Segmented, TimeAgo } from "../_components/ui";
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
  createdAt: string;
  petName: string;
  petSpecies: string;
  ownerName: string;
  ownerUsername: string | null;
  placeName: string | null;
};

type Filter = "all" | "yes" | "no";
const asFilter = (v: string | null): Filter => (v === "yes" || v === "no" ? v : "all");

export default function PostsPage() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [hasImage, setHasImage] = useState<Filter>(asFilter(searchParams.get("hasImage")));
  const [agentOnly, setAgentOnly] = useState<Filter>(asFilter(searchParams.get("agentOnly")));

  const params = new URLSearchParams({ page: String(page) });
  if (hasImage !== "all") params.set("hasImage", hasImage);
  if (agentOnly !== "all") params.set("agentOnly", agentOnly);
  const { data, loading } = useAdminData<{ posts: Post[]; total: number }>(`/api/admin/posts?${params}`);
  const posts = data?.posts ?? [];
  const total = data?.total ?? 0;

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

      {loading && !data ? (
        <Loading label="Loading posts…" />
      ) : posts.length === 0 ? (
        <div className="rounded-2xl bg-card shadow-card">
          <EmptyState icon={FileText} title="No posts match" hint="Try a different filter." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-card px-2 shadow-card empty:hidden">
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      </div>
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
  const image = post.media[0];
  const extra = post.media.length - 1;
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl bg-card shadow-card">
      {image && (
        <div className="relative">
          {/* The card-sized image, not the 256px thumb — these render ~380px wide. */}
          <img
            src={image.url ?? image.thumbUrl ?? ""}
            alt=""
            loading="lazy"
            className="aspect-4/3 w-full bg-secondary object-cover"
          />
          {extra > 0 && (
            <span className="absolute right-2 top-2 rounded-full bg-[#2b1f16]/60 px-2 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
              +{extra}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display font-semibold text-primary-ink">
            {post.petName[0]?.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-extrabold">{post.petName}</p>
            <p className="truncate text-xs text-muted-foreground">
              <span className="capitalize">{post.petSpecies}</span> · {post.ownerName}
              {post.ownerUsername && ` @${post.ownerUsername}`}
            </p>
          </div>
          {post.authoredByAgent ? (
            <Badge>
              <Bot />
              by pet
            </Badge>
          ) : (
            <Badge variant="info">
              <User />
              person
            </Badge>
          )}
        </div>

        <p className={`text-[15px] leading-relaxed ${image ? "line-clamp-3" : "line-clamp-6"}`}>{post.content}</p>

        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted-foreground">
          {post.placeName && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{post.placeName}</span>
            </span>
          )}
          <TimeAgo date={post.createdAt} />
        </div>
      </div>
    </article>
  );
}
