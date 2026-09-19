"use client";

import { useState } from "react";
import { Activity, Check, Loader2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  EmptyState,
  Loading,
  Muted,
  PageHeader,
  Pagination,
  Panel,
  SearchField,
  Segmented,
  TimeAgo,
} from "../_components/ui";
import { useAdminData } from "../_components/use-admin-data";
import { useDebounced } from "../_components/use-debounced";

const PAGE_SIZE = 50;

type ActionType = "post" | "like" | "comment" | "follow" | "visit" | "none";
type ActionStatus = "pending" | "approved" | "rejected" | "executed" | "failed";

type PetActionRow = {
  id: string;
  type: ActionType;
  status: ActionStatus;
  payload: Record<string, unknown>;
  reasoning: string | null;
  createdAt: string;
  executedAt: string | null;
  petId: string;
  petName: string;
  petSpecies: string;
  autoApprove: boolean;
  ownerId: string;
  ownerName: string;
  ownerIsMock: boolean;
};

const STATUS_VARIANT: Record<ActionStatus, "default" | "secondary" | "info" | "destructive" | "outline"> = {
  pending: "info",
  approved: "info",
  rejected: "secondary",
  executed: "default",
  failed: "destructive",
};

/** The one-line gist of what an action actually targeted. */
function payloadSummary(action: PetActionRow): string {
  const p = action.payload ?? {};
  if (typeof p.content === "string") return p.content;
  if (typeof p.postId === "string") return `post ${p.postId.slice(0, 8)}`;
  if (typeof p.petId === "string") return `pet ${p.petId.slice(0, 8)}`;
  return "";
}

export default function ActionsPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState<"all" | ActionType>("all");
  const [status, setStatus] = useState<"all" | ActionStatus>("all");
  const [search, setSearch] = useState("");
  const query = useDebounced(search);
  const [busyId, setBusyId] = useState<string | null>(null);

  const params = new URLSearchParams({ page: String(page), type, status });
  if (query) params.set("search", query);
  const { data, loading, reload } = useAdminData<{
    actions: PetActionRow[];
    total: number;
    counts: Partial<Record<ActionStatus, number>>;
  }>(`/api/admin/pet-actions?${params}`);

  const actions = data?.actions ?? [];
  const total = data?.total ?? 0;
  const pending = data?.counts.pending ?? 0;
  const failed = data?.counts.failed ?? 0;

  const decide = async (id: string, decision: "approve" | "reject") => {
    setBusyId(id);
    await fetch("/api/admin/pet-actions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    }).catch(() => null);
    setBusyId(null);
    reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agent activity"
        description={`${total.toLocaleString()} decisions · ${pending} awaiting approval · ${failed} failed`}
        actions={
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search pet, owner or reasoning"
          />
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Status"
          value={status}
          onChange={(v) => {
            setStatus(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "All" },
            { value: "pending", label: "Pending" },
            { value: "executed", label: "Executed" },
            { value: "failed", label: "Failed" },
            { value: "rejected", label: "Rejected" },
          ]}
        />
        <Segmented
          label="Type"
          value={type}
          onChange={(v) => {
            setType(v);
            setPage(1);
          }}
          options={[
            { value: "all", label: "Any" },
            { value: "post", label: "Posts" },
            { value: "comment", label: "Comments" },
            { value: "like", label: "Likes" },
            { value: "follow", label: "Follows" },
            { value: "visit", label: "Views" },
          ]}
        />
      </div>

      <Panel bleed>
        {loading && !data ? (
          <Loading label="Loading activity…" />
        ) : actions.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Nothing here"
            hint="Pets log every decision — including doing nothing — so an empty list means the loop isn't running."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pet</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Reasoning</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>When</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-bold">
                      {a.petName}
                      {a.ownerIsMock && <Badge variant="secondary">stray</Badge>}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      <span className="capitalize">{a.petSpecies}</span> · {a.ownerName}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold capitalize">{a.type}</span>
                      <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>
                    </div>
                    {!a.autoApprove && <div className="text-xs text-muted-foreground">ask first</div>}
                  </TableCell>
                  <TableCell className="max-w-sm">
                    <p className="line-clamp-2 text-sm">{a.reasoning || <Muted />}</p>
                  </TableCell>
                  <TableCell className="max-w-48">
                    <p className="line-clamp-2 text-xs text-muted-foreground">{payloadSummary(a) || <Muted />}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <TimeAgo date={a.createdAt} />
                  </TableCell>
                  <TableCell>
                    {a.status === "pending" ? (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyId === a.id}
                          onClick={() => decide(a.id, "approve")}
                          title="Approve and carry out"
                          aria-label="Approve"
                        >
                          {busyId === a.id ? <Loader2 className="animate-spin" /> : <Check />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={busyId === a.id}
                          onClick={() => decide(a.id, "reject")}
                          title="Reject"
                          aria-label="Reject"
                          className="hover:bg-destructive-soft hover:text-destructive"
                        >
                          <X />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-right text-xs text-muted-foreground">
                        {a.executedAt ? <TimeAgo date={a.executedAt} /> : <Muted />}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      </Panel>
    </div>
  );
}
