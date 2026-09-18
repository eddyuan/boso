import { eq, sql } from "drizzle-orm";
import { db, pets, places, posts, users } from "@bsocial/db";
import Link from "next/link";
import { ArrowRight, Bot, FileText, MapPin, PawPrint, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState, PageHeader, Panel, StatCard, TimeAgo } from "./_components/ui";
import { mediaByPostId } from "@/lib/post-media";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [stats, recentPostRows, recentUsers] = await Promise.all([
    db
      .select({
        totalUsers: sql<number>`count(*) filter (where ${users.isMock} = false)`.mapWith(Number),
        mockUsers: sql<number>`count(*) filter (where ${users.isMock} = true)`.mapWith(Number),
        totalPosts: sql<number>`(select count(*) from ${posts})`.mapWith(Number),
        postsWithImages: sql<number>`(select count(distinct post_id) from post_media)`.mapWith(Number),
        agentPosts: sql<number>`(select count(*) from ${posts} where ${posts.authoredByAgent} = true)`.mapWith(Number),
        humanPosts: sql<number>`(select count(*) from ${posts} where ${posts.authoredByAgent} = false)`.mapWith(Number),
        totalPlaces: sql<number>`(select count(*) from ${places})`.mapWith(Number),
        totalPets: sql<number>`(select count(*) from ${pets})`.mapWith(Number),
        usersThisWeek: sql<number>`count(*) filter (where ${users.isMock} = false and ${users.createdAt} > now() - interval '7 days')`.mapWith(Number),
        postsThisWeek: sql<number>`(select count(*) from ${posts} where ${posts.createdAt} > now() - interval '7 days')`.mapWith(Number),
      })
      .from(users)
      .limit(1),
    db
      .select({
        id: posts.id,
        content: posts.content,
        createdAt: posts.createdAt,
        authoredByAgent: posts.authoredByAgent,
        petName: pets.name,
        petSpecies: pets.species,
        ownerName: users.name,
        placeName: places.name,
      })
      .from(posts)
      .innerJoin(pets, eq(pets.id, posts.petId))
      .innerJoin(users, eq(users.id, pets.userId))
      .leftJoin(places, eq(places.id, posts.placeId))
      .orderBy(sql`${posts.createdAt} desc`)
      .limit(6),
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        createdAt: users.createdAt,
        isMock: users.isMock,
        petName: pets.name,
      })
      .from(users)
      .leftJoin(pets, eq(pets.userId, users.id))
      .where(sql`${users.isMock} = false`)
      .orderBy(sql`${users.createdAt} desc`)
      .limit(6),
  ]);

  const recentMedia = await mediaByPostId(recentPostRows.map((p) => p.id));
  const recentPosts = recentPostRows.map((p) => ({ ...p, imageUrl: recentMedia.get(p.id)?.[0]?.thumbUrl ?? null }));

  const s = stats?.[0] ?? {
    totalUsers: 0,
    mockUsers: 0,
    totalPosts: 0,
    postsWithImages: 0,
    agentPosts: 0,
    humanPosts: 0,
    totalPlaces: 0,
    totalPets: 0,
    usersThisWeek: 0,
    postsThisWeek: 0,
  };

  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description="How Tielo is doing right now." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Real users" value={s.totalUsers} icon={Users} tone="blue" hint={`+${s.usersThisWeek} this week`} href="/admin/users" />
        <StatCard label="Posts" value={s.totalPosts} icon={FileText} tone="gold" hint={`+${s.postsThisWeek} this week`} href="/admin/posts" />
        <StatCard label="Pets" value={s.totalPets} icon={PawPrint} tone="green" hint={`${s.mockUsers} are strays`} href="/admin/agents" />
        <StatCard label="Places" value={s.totalPlaces} icon={MapPin} tone="red" hint="From Google Places" href="/admin/places" />
      </div>

      <Panel title="Content mix" description="Where the posts on the map come from.">
        <div className="grid gap-6 md:grid-cols-3">
          <Meter
            label="Written by pets"
            value={s.agentPosts}
            percent={pct(s.agentPosts, s.totalPosts)}
            detail={`${s.humanPosts.toLocaleString()} written by people`}
            href="/admin/posts?agentOnly=yes"
            barClass="bg-primary"
          />
          <Meter
            label="With a photo"
            value={s.postsWithImages}
            percent={pct(s.postsWithImages, s.totalPosts)}
            detail={`${(s.totalPosts - s.postsWithImages).toLocaleString()} text only`}
            href="/admin/posts?hasImage=yes"
            barClass="bg-info"
          />
          <Meter
            label="Stray accounts"
            value={s.mockUsers}
            percent={pct(s.mockUsers, s.mockUsers + s.totalUsers)}
            detail="Seeded, badged, excluded from matching"
            href="/admin/agents"
            barClass="bg-success"
          />
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-5">
        <Panel title="Latest posts" className="lg:col-span-3" bleed actions={<ViewAll href="/admin/posts" />}>
          {recentPosts.length === 0 ? (
            <EmptyState icon={FileText} title="No posts yet" hint="Seed an area or wait for pets to start posting." />
          ) : (
            <ul>
              {recentPosts.map((post) => (
                <li key={post.id} className="flex gap-3 rounded-xl p-3 transition-colors hover:bg-background">
                  {post.imageUrl ? (
                    <img src={post.imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-secondary">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-extrabold">{post.petName}</span>
                      <span className="text-xs font-semibold capitalize text-muted-foreground">{post.petSpecies}</span>
                      {post.authoredByAgent && (
                        <Badge>
                          <Bot />
                          by pet
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{post.content}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs font-semibold text-muted-foreground">
                      {post.placeName && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {post.placeName}
                        </span>
                      )}
                      <TimeAgo date={post.createdAt} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="New people" className="lg:col-span-2" bleed actions={<ViewAll href="/admin/users" />}>
          {recentUsers.length === 0 ? (
            <EmptyState icon={Users} title="No sign-ups yet" />
          ) : (
            <ul>
              {recentUsers.map((user) => (
                <li key={user.id} className="flex items-center gap-3 rounded-xl p-3 transition-colors hover:bg-background">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.image ?? undefined} alt="" />
                    <AvatarFallback>{user.name[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold">{user.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.petName ? `with ${user.petName}` : user.email}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    <TimeAgo date={user.createdAt} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ViewAll({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[13px] font-bold text-primary-ink hover:bg-primary-soft"
    >
      View all
      <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function Meter({
  label,
  value,
  percent,
  detail,
  href,
  barClass,
}: {
  label: string;
  value: number;
  percent: number;
  detail: string;
  href: string;
  barClass: string;
}) {
  return (
    <Link href={href} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-bold text-muted-foreground group-hover:text-foreground">{label}</p>
        <p className="font-display text-sm font-semibold tabular-nums text-muted-foreground">{percent}%</p>
      </div>
      <p className="font-display text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-2 text-xs font-semibold text-muted-foreground">{detail}</p>
    </Link>
  );
}
