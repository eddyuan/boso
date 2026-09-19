"use client";

import { useState } from "react";
import { Coffee, ExternalLink, Landmark, MapPin, ShoppingBag, Trees, Utensils, type LucideIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  EmptyState,
  IconTile,
  Loading,
  Muted,
  PageHeader,
  Pagination,
  Panel,
  SearchField,
  type Tone,
} from "../_components/ui";
import { useAdminData } from "../_components/use-admin-data";
import { useDebounced } from "../_components/use-debounced";

const PAGE_SIZE = 30;

type Place = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  source: string;
  createdAt: string;
  postCount: number;
};

/** Mirrors PlaceCategory in src/lib/places.ts. */
const CATEGORY: Record<string, { icon: LucideIcon; tone: Tone }> = {
  food: { icon: Utensils, tone: "red" },
  drink: { icon: Coffee, tone: "gold" },
  park: { icon: Trees, tone: "green" },
  shop: { icon: ShoppingBag, tone: "blue" },
  landmark: { icon: Landmark, tone: "neutral" },
};

export default function PlacesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query = useDebounced(search);

  const params = new URLSearchParams({ page: String(page) });
  if (query) params.set("search", query);
  const { data, loading } = useAdminData<{ places: Place[]; total: number }>(`/api/admin/places?${params}`);
  const places = data?.places ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Places"
        description={`${total.toLocaleString()} venues imported from Google Places. Posts attach to these.`}
        actions={
          <SearchField
            value={search}
            onChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            placeholder="Search name, address, category"
          />
        }
      />

      <Panel bleed>
        {loading && !data ? (
          <Loading label="Loading places…" />
        ) : places.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title={query ? "No places match" : "No places yet"}
            hint={query ? undefined : "Import an area with scripts/import-places.mts."}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Place</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="text-right">Posts</TableHead>
                <TableHead>Location</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {places.map((p) => {
                const cat = CATEGORY[p.category ?? ""] ?? { icon: MapPin, tone: "neutral" as Tone };
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <IconTile icon={cat.icon} tone={cat.tone} className="h-9 w-9 rounded-xl [&_svg]:h-4 [&_svg]:w-4" />
                        <div className="min-w-0">
                          <div className="truncate font-extrabold">{p.name}</div>
                          <div className="text-xs capitalize text-muted-foreground">
                            {p.category ?? "uncategorised"} · {p.source}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {p.address ?? <Muted />}
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {p.postCount > 0 ? p.postCount : <Muted>0</Muted>}
                    </TableCell>
                    <TableCell>
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
      </Panel>
    </div>
  );
}
