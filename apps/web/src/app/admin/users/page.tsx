"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, KeyRound, Loader2, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

type User = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  image: string | null;
  isAdmin: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  petName: string | null;
  petSpecies: string | null;
  postCount: number;
  hasCredential: boolean;
};

export default function UsersPage() {
  const searchParams = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const query = useDebounced(search);
  const [resetting, setResetting] = useState<User | null>(null);

  const params = new URLSearchParams({ page: String(page), mock: "exclude" });
  if (query) params.set("search", query);
  const { data, loading } = useAdminData<{ users: User[]; total: number }>(`/api/admin/users?${params}`);
  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description={`${total.toLocaleString()} real ${total === 1 ? "person" : "people"} — stray pets are under Agents.`}
        actions={
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search name, email, username"
          />
        }
      />

      <Panel bleed>
        {loading && !data ? (
          <Loading label="Loading users…" />
        ) : users.length === 0 ? (
          <EmptyState icon={Users} title={query ? "No one matches that" : "No users yet"} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Pet</TableHead>
                <TableHead className="text-right">Posts</TableHead>
                <TableHead>Sign-in</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last active</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 hover:underline">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={u.image ?? undefined} alt="" />
                        <AvatarFallback className="text-sm">{u.name[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-extrabold">
                          <span className="truncate">{u.name}</span>
                          {u.isAdmin && <Badge>admin</Badge>}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {u.username ? `@${u.username} · ` : ""}
                          {u.email}
                        </div>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {u.petName ? (
                      <div>
                        <div className="font-bold">{u.petName}</div>
                        <div className="text-xs capitalize text-muted-foreground">{u.petSpecies}</div>
                      </div>
                    ) : (
                      <Muted />
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold tabular-nums">
                    {u.postCount > 0 ? u.postCount : <Muted>0</Muted>}
                  </TableCell>
                  <TableCell>
                    {u.hasCredential ? <Badge variant="info">password</Badge> : <Badge variant="secondary">social only</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <TimeAgo date={u.createdAt} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <TimeAgo date={u.lastActiveAt} />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setResetting(u)}
                      title="Set a new password"
                      aria-label={`Set a new password for ${u.name}`}
                    >
                      <KeyRound />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      </Panel>

      <ResetPasswordDialog key={resetting?.id ?? "closed"} user={resetting} onClose={() => setResetting(null)} />
    </div>
  );
}

function ResetPasswordDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!user || password.length < 8) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, newPassword: password }),
    });
    setBusy(false);
    if (res.ok) {
      setDone(true);
      setPassword("");
    } else {
      setError("Couldn't set the password. Try again.");
    }
  };

  return (
    <Dialog open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set a new password</DialogTitle>
          <DialogDescription>
            For <strong className="text-foreground">{user?.name}</strong>. It works straight away, and adds email sign-in if they
            only had Google or Apple.
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <>
            <Notice tone="green">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Password updated.
              </span>
            </Notice>
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                autoFocus
              />
              {error && <p className="text-sm font-semibold text-destructive">{error}</p>}
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy || password.length < 8}>
                {busy && <Loader2 className="animate-spin" />}
                {busy ? "Saving…" : "Set password"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
