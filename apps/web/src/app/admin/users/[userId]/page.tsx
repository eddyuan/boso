"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, EyeOff, FileText, KeyRound, Monitor, PawPrint, ShieldCheck, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, Loading, Muted, PageHeader, Panel, TimeAgo } from "../../_components/ui";
import { useAdminData } from "../../_components/use-admin-data";

type Detail = {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    phoneNumber: string | null;
    phoneNumberVerified: boolean | null;
    username: string | null;
    image: string | null;
    isAdmin: boolean;
    isMock: boolean;
    gender: string | null;
    birthday: string | null;
    interests: string[];
    ageGateFailedAt: string | null;
    onboardingCompletedAt: string | null;
    createdAt: string;
    lastActiveAt: string | null;
    lastLatitude: number | null;
    lastLongitude: number | null;
    lastLocationAt: string | null;
    showSensitiveContent: boolean | null;
  };
  pet: {
    id: string;
    name: string;
    species: string;
    traits: string[];
    personality: string;
    autoApprove: boolean;
    maxActionsPerDay: number;
    bondXp: number | null;
    createdAt: string;
  } | null;
  game: {
    bond: { level: number; xp: number; intoLevel: number; levelSpan: number; xpToNext: number; next: { unlock: string } | null };
    ledgerAgrees: boolean;
    ledgerSum: number;
    mood: { name: string; score: number; reasons: string[] } | null;
    careToday: string[];
    ledger: { event: string; amount: number; createdAt: string }[];
    xpBySource: { event: string; awards: number; xp: number }[];
    treasures: { kind: string; label: string; rarity: string; foundAt: string }[];
    friends: { petName: string; tier: { label: string }; affinity: number; interactions: number }[];
    notifications: { type: string; title: string; createdAt: string }[];
    pushBudget: { total: number; usedTotal: number; byType: { type: string; count: number }[] };
    location: { latitude: number | null; longitude: number | null; at: string | null };
  } | null;
  providers: { providerId: string; createdAt: string }[];
  sessions: {
    id: string;
    deviceName: string | null;
    userAgent: string | null;
    ipAddress: string | null;
    lastActiveAt: string | null;
    expiresAt: string;
    createdAt: string;
  }[];
  authEvents: { id: string; type: string; ipAddress: string | null; deviceName: string | null; createdAt: string }[];
  pushTokens: { id: string; platform: string }[];
  posts: {
    id: string;
    content: string;
    authoredByAgent: boolean;
    hiddenAt: string | null;
    createdAt: string;
    media: { url: string; thumbUrl: string | null }[];
  }[];
  petActions: { id: string; type: string; status: string; reasoning: string | null; createdAt: string }[];
  stats: { posts: number; hidden: number };
};

export default function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params);
  const { data, loading } = useAdminData<Detail>(`/api/admin/users/${userId}`);

  if (loading && !data) return <Loading label="Loading account…" />;
  if (!data) return <EmptyState icon={User} title="Account not found" />;

  const { user, pet, providers, sessions, authEvents, pushTokens, posts, petActions, stats } = data;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        All users
      </Link>

      <PageHeader
        title={user.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {user.username && <span>@{user.username}</span>}
            <span>{user.email}</span>
            {user.phoneNumber && <span>{user.phoneNumber}</span>}
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            {user.isAdmin && (
              <Badge>
                <ShieldCheck />
                admin
              </Badge>
            )}
            {user.isMock && (
              <Badge variant="secondary">
                <Bot />
                stray
              </Badge>
            )}
            {user.ageGateFailedAt && <Badge variant="destructive">age restricted</Badge>}
            {!user.onboardingCompletedAt && <Badge variant="outline">onboarding incomplete</Badge>}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Panel title="Account">
          <dl className="space-y-1.5 text-sm">
            <Row label="Joined">
              <TimeAgo date={user.createdAt} />
            </Row>
            <Row label="Last active">{user.lastActiveAt ? <TimeAgo date={user.lastActiveAt} /> : <Muted />}</Row>
            <Row label="Email verified">{user.emailVerified ? "yes" : "no"}</Row>
            <Row label="Phone verified">{user.phoneNumberVerified ? "yes" : user.phoneNumber ? "no" : <Muted />}</Row>
            <Row label="Birthday">{user.birthday ?? <Muted />}</Row>
            <Row label="Gender">{user.gender?.replaceAll("_", " ") ?? <Muted />}</Row>
          </dl>
        </Panel>

        <Panel title="Sign-in methods" icon={KeyRound}>
          {providers.length === 0 ? (
            <Muted>none</Muted>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {providers.map((p) => (
                <li key={p.providerId} className="flex items-center justify-between gap-2">
                  <span className="font-bold capitalize">{p.providerId}</span>
                  <span className="text-xs text-muted-foreground">
                    <TimeAgo date={p.createdAt} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          {pushTokens.length > 0 && (
            <p className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
              {pushTokens.length} push {pushTokens.length === 1 ? "token" : "tokens"} (
              {[...new Set(pushTokens.map((t) => t.platform))].join(", ")})
            </p>
          )}
        </Panel>

        <Panel title="Pet" icon={PawPrint}>
          {pet ? (
            <dl className="space-y-1.5 text-sm">
              <Row label="Name">{pet.name}</Row>
              <Row label="Species">
                <span className="capitalize">{pet.species}</span>
              </Row>
              <Row label="Acts on its own">{pet.autoApprove ? "yes" : "asks first"}</Row>
              <Row label="Daily actions">{pet.maxActionsPerDay}</Row>
              <Row label="Traits">{pet.traits.length ? pet.traits.join(", ") : <Muted />}</Row>
            </dl>
          ) : (
            <Muted>No pet yet</Muted>
          )}
        </Panel>

        <Panel title="Content" icon={FileText}>
          <dl className="space-y-1.5 text-sm">
            <Row label="Posts">{stats.posts}</Row>
            <Row label="Hidden">{stats.hidden > 0 ? <span className="text-destructive">{stats.hidden}</span> : 0}</Row>
            <Row label="Interests">{user.interests.length ? user.interests.join(", ") : <Muted />}</Row>
          </dl>
        </Panel>
      </div>

      <Panel title="Recent posts" icon={FileText} bleed>
        {posts.length === 0 ? (
          <EmptyState icon={FileText} title="No posts" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>Content</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Posted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {posts.map((p) => (
                <TableRow key={p.id} className={p.hiddenAt ? "opacity-55" : undefined}>
                  <TableCell>
                    {p.media[0] ? (
                      <img
                        src={p.media[0].thumbUrl ?? p.media[0].url}
                        alt=""
                        loading="lazy"
                        className="h-10 w-10 rounded-lg bg-secondary object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                        <FileText className="h-4 w-4" />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="line-clamp-2 text-sm">{p.content}</p>
                    {p.hiddenAt && (
                      <Badge variant="destructive" className="mt-1">
                        <EyeOff />
                        hidden
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.authoredByAgent ? <Badge>by pet</Badge> : <Badge variant="info">person</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <TimeAgo date={p.createdAt} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Devices" icon={Monitor} bleed>
          {sessions.length === 0 ? (
            <EmptyState icon={Monitor} title="No active sessions" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Last active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-bold">{s.deviceName ?? <Muted>Unknown device</Muted>}</div>
                      <div className="truncate text-xs text-muted-foreground">{s.userAgent?.slice(0, 60)}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.ipAddress ?? <Muted />}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.lastActiveAt ? <TimeAgo date={s.lastActiveAt} /> : <Muted />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>

        <Panel title="Login history" bleed>
          {authEvents.length === 0 ? (
            <EmptyState icon={ShieldCheck} title="No events" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Device</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authEvents.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-bold">{e.type.replaceAll("_", " ")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.deviceName ?? e.ipAddress ?? <Muted />}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <TimeAgo date={e.createdAt} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>

      {data.game && (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="Bond">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl font-semibold tabular-nums">{data.game.bond.level}</span>
                <span className="text-[13px] text-muted-foreground">
                  {data.game.bond.xp.toLocaleString()} XP
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{
                    width: `${
                      data.game.bond.levelSpan > 0
                        ? Math.round((data.game.bond.intoLevel / data.game.bond.levelSpan) * 100)
                        : 100
                    }%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[13px] text-muted-foreground">
                {data.game.bond.next
                  ? `${data.game.bond.xpToNext} to ${data.game.bond.next.unlock.toLowerCase()}`
                  : "Elder bond — nothing left to unlock"}
              </p>
              {data.game.ledgerAgrees ? (
                <p className="mt-2 text-[11px] text-success">Ledger reconciles with the stored total.</p>
              ) : (
                <p className="mt-2 text-[11px] font-bold text-destructive">
                  Ledger sums to {data.game.ledgerSum.toLocaleString()} but the stored total is{" "}
                  {data.game.bond.xp.toLocaleString()} — this level can&apos;t be fully explained.
                </p>
              )}
            </Panel>

            <Panel title="Mood">
              {data.game.mood ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-2xl font-semibold capitalize">{data.game.mood.name}</span>
                    <span className="text-[13px] tabular-nums text-muted-foreground">{data.game.mood.score}/100</span>
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {data.game.mood.reasons.map((r) => (
                      <li key={r} className="text-[13px] text-muted-foreground">{r}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Derived on read, the same way the owner sees it — this can&apos;t show a mood they aren&apos;t.
                  </p>
                </>
              ) : (
                <Muted>Couldn&apos;t derive a mood</Muted>
              )}
              <p className="mt-3 text-[13px]">
                <span className="text-muted-foreground">Care today: </span>
                {data.game.careToday.length > 0 ? data.game.careToday.join(", ") : <Muted>none</Muted>}
              </p>
            </Panel>

            <Panel title="Reach">
              <p className="text-[13px]">
                <span className="text-muted-foreground">Pushes today: </span>
                <b className="tabular-nums">
                  {data.game.pushBudget.usedTotal} / {data.game.pushBudget.total}
                </b>
              </p>
              <div className="mt-1.5 space-y-0.5">
                {data.game.pushBudget.byType.length === 0 ? (
                  <p className="text-[13px]"><Muted>None sent in 24h</Muted></p>
                ) : (
                  data.game.pushBudget.byType.map((t) => (
                    <p key={t.type} className="font-mono text-[11px] text-muted-foreground">
                      {t.type} × {t.count}
                    </p>
                  ))
                )}
              </div>
              <p className="mt-3 text-[13px]">
                <span className="text-muted-foreground">Location: </span>
                {data.game.location.at ? (
                  <>
                    <span className="font-mono text-xs">
                      {data.game.location.latitude?.toFixed(3)}, {data.game.location.longitude?.toFixed(3)}
                    </span>{" "}
                    <TimeAgo date={data.game.location.at} />
                  </>
                ) : (
                  <Muted>never shared</Muted>
                )}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Stale beyond 14 days, at which point nearby features stop offering them anyone.
              </p>
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Where their XP came from" bleed>
              {data.game.xpBySource.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted-foreground">Nothing earned yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event</TableHead>
                      <TableHead className="text-right">Times</TableHead>
                      <TableHead className="text-right">XP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.game.xpBySource.map((x) => (
                      <TableRow key={x.event}>
                        <TableCell className="font-mono text-xs">{x.event}</TableCell>
                        <TableCell className="text-right tabular-nums">{x.awards}</TableCell>
                        <TableCell className="text-right font-bold tabular-nums">{x.xp}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Panel>

            <Panel title="Their pet's circle" bleed>
              {data.game.friends.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted-foreground">No relationships yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pet</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">Warmth</TableHead>
                      <TableHead className="text-right">Together</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.game.friends.map((f) => (
                      <TableRow key={f.petName}>
                        <TableCell className="font-semibold">{f.petName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{f.tier.label}</TableCell>
                        <TableCell className="text-right tabular-nums">{f.affinity.toFixed(1)}</TableCell>
                        <TableCell className="text-right tabular-nums">{f.interactions}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Recent XP" bleed>
              {data.game.ledger.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-muted-foreground">Nothing yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {data.game.ledger.map((l, i) => (
                    <div key={`${l.createdAt}-${i}`} className="flex items-center gap-3 px-5 py-2 text-[13px]">
                      <span className="font-mono text-xs">{l.event}</span>
                      <span className="font-bold tabular-nums text-primary-ink">+{l.amount}</span>
                      <span className="ml-auto text-muted-foreground"><TimeAgo date={l.createdAt} /></span>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Shelf and messages" bleed>
              <div className="divide-y divide-border">
                {data.game.treasures.length === 0 && data.game.notifications.length === 0 && (
                  <p className="px-5 py-4 text-sm text-muted-foreground">Nothing found and nothing sent.</p>
                )}
                {data.game.treasures.map((t, i) => (
                  <div key={`${t.kind}-${i}`} className="flex items-center gap-3 px-5 py-2 text-[13px]">
                    <span className="font-semibold">{t.label}</span>
                    <span className="text-xs capitalize text-muted-foreground">{t.rarity}</span>
                    <span className="ml-auto text-muted-foreground"><TimeAgo date={t.foundAt} /></span>
                  </div>
                ))}
                {data.game.notifications.map((n, i) => (
                  <div key={`${n.createdAt}-${i}`} className="flex items-center gap-3 px-5 py-2 text-[13px]">
                    <span className="font-mono text-[11px] text-muted-foreground">{n.type}</span>
                    <span className="min-w-0 truncate">{n.title}</span>
                    <span className="ml-auto shrink-0 text-muted-foreground"><TimeAgo date={n.createdAt} /></span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}

      <Panel title="Pet activity" bleed actions={<Link href="/admin/actions" className="text-[13px] font-bold text-primary-ink">View all</Link>}>
        {petActions.length === 0 ? (
          <EmptyState icon={Bot} title="No decisions logged" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Reasoning</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {petActions.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <span className="font-bold capitalize">{a.type}</span>
                    <div className="text-xs text-muted-foreground">{a.status}</div>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="line-clamp-2 text-sm">{a.reasoning || <Muted />}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <TimeAgo date={a.createdAt} />
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold">{children}</dd>
    </div>
  );
}
