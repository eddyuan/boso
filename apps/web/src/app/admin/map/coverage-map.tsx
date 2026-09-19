"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type MapPost = {
  id: string;
  latitude: number;
  longitude: number;
  content: string;
  authoredByAgent: boolean;
  hiddenAt: string | null;
  createdAt: string;
  petName: string;
  ownerIsMock: boolean;
};
type MapPlace = { id: string; name: string; latitude: number; longitude: number; category: string | null };
type Stray = { userId: string; name: string; location: string | null; latitude: number | null; longitude: number | null; petName: string | null };
type Coverage = {
  posts: MapPost[];
  places: MapPlace[];
  strays: Stray[];
  totals: { posts: number; hidden: number; byAgents: number };
};

const START: [number, number] = [-123.1207, 49.2827]; // Vancouver — where the seeded strays live
const LAYERS = ["places-dots", "posts-dots", "strays-dots"] as const;

const COLORS = {
  person: "#2F7BEA",
  agent: "#FFC53D",
  hidden: "#D9453F",
  place: "#7D6B5B",
  stray: "#2F9E5E",
};

// Minimal GeoJSON shapes — the global GeoJSON namespace needs @types/geojson,
// which this app doesn't depend on.
type PointFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: Record<string, unknown>;
};
type PointCollection = { type: "FeatureCollection"; features: PointFeature[] };

const point = (lng: number, lat: number, props: Record<string, unknown>): PointFeature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: props,
});

const collection = (features: PointFeature[]): PointCollection => ({
  type: "FeatureCollection",
  features,
});

export function CoverageMap({ token }: { token: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [data, setData] = useState<Coverage | null>(null);
  const [visible, setVisible] = useState({ posts: true, places: false, strays: true });
  const [loading, setLoading] = useState(false);
  // Flipped on map load. The data and visibility effects depend on it, so they
  // re-run once the style is ready instead of silently bailing forever.
  const [styleReady, setStyleReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bounds-driven load, debounced by moveend rather than a timer.
  const load = useCallback(async (map: mapboxgl.Map) => {
    const b = map.getBounds();
    if (!b) return;
    setLoading(true);
    const params = new URLSearchParams({
      west: String(b.getWest()),
      east: String(b.getEast()),
      south: String(b.getSouth()),
      north: String(b.getNorth()),
    });
    const res = await fetch(`/api/admin/map?${params}`).catch(() => null);
    setLoading(false);
    if (!res?.ok) return;
    setData((await res.json()) as Coverage);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!token || !host) return;
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: host,
      style: "mapbox://styles/mapbox/light-v11",
      center: START,
      zoom: 10.5,
    });
    mapRef.current = map;
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    map.on("error", (e) => setError(e.error?.message ?? "Mapbox failed to load"));

    map.on("load", () => {
      setStyleReady(true);
      for (const id of LAYERS) {
        map.addSource(id, { type: "geojson", data: collection([]) });
      }
      map.addLayer({
        id: "places-dots",
        type: "circle",
        source: "places-dots",
        paint: { "circle-radius": 3, "circle-color": COLORS.place, "circle-opacity": 0.5 },
      });
      map.addLayer({
        id: "posts-dots",
        type: "circle",
        source: "posts-dots",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 8, 3, 16, 7],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.85,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#FFFFFF",
        },
      });
      map.addLayer({
        id: "strays-dots",
        type: "circle",
        source: "strays-dots",
        paint: {
          "circle-radius": 8,
          "circle-color": COLORS.stray,
          "circle-opacity": 0.35,
          "circle-stroke-width": 2,
          "circle-stroke-color": COLORS.stray,
        },
      });

      const popup = new mapboxgl.Popup({ closeButton: false, offset: 10 });
      map.on("mouseenter", "posts-dots", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const f = e.features?.[0] as unknown as PointFeature | undefined;
        if (!f) return;
        const p = f.properties as { petName: string; content: string; hidden: string };
        popup
          .setLngLat(f.geometry.coordinates)
          .setHTML(
            `<strong>${p.petName}</strong>${p.hidden === "true" ? " · hidden" : ""}<br/>${String(p.content).slice(0, 120)}`,
          )
          .addTo(map);
      });
      map.on("mouseleave", "posts-dots", () => {
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      load(map);
    });

    map.on("moveend", () => load(map));

    // Mapbox measures the container once, at construction — which in a flex
    // layout can still be 0px tall — and then keeps a 300px fallback canvas
    // forever. Watching the host covers both that first tick and later layout
    // changes (sidebar, window resize).
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(host);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      setStyleReady(false);
    };
  }, [token, load]);

  // Push fetched rows into the sources.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady || !data) return;
    (map.getSource("posts-dots") as mapboxgl.GeoJSONSource | undefined)?.setData(
      collection(
        data.posts.map((p) =>
          point(p.longitude, p.latitude, {
            color: p.hiddenAt ? COLORS.hidden : p.authoredByAgent ? COLORS.agent : COLORS.person,
            petName: p.petName,
            content: p.content,
            hidden: String(Boolean(p.hiddenAt)),
          }),
        ),
      ),
    );
    (map.getSource("places-dots") as mapboxgl.GeoJSONSource | undefined)?.setData(
      collection(data.places.map((p) => point(p.longitude, p.latitude, { name: p.name }))),
    );
    (map.getSource("strays-dots") as mapboxgl.GeoJSONSource | undefined)?.setData(
      collection(
        data.strays
          .filter((s) => s.latitude !== null && s.longitude !== null)
          .map((s) => point(s.longitude!, s.latitude!, { name: s.petName ?? s.name })),
      ),
    );
  }, [data, styleReady]);

  // Layer toggles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !styleReady) return;
    const set = (id: string, on: boolean) => map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    set("posts-dots", visible.posts);
    set("places-dots", visible.places);
    set("strays-dots", visible.strays);
  }, [visible, styleReady]);

  if (!token) {
    return (
      <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Set NEXT_PUBLIC_MAPBOX_TOKEN to use the coverage map.
      </div>
    );
  }

  const inView = data?.posts.length ?? 0;

  return (
    <div className="absolute inset-0 overflow-hidden rounded-xl border border-border">
      {/* Sized, not positioned: mapbox-gl.css sets `.mapboxgl-map { position: relative }`
          on its own container, which beats Tailwind's `.absolute` (same specificity,
          later in the cascade) and would collapse this div to height:auto = 0. */}
      <div ref={hostRef} className="h-full w-full" />

      <div className="absolute left-3 top-3 space-y-2 rounded-xl border border-border bg-card/95 p-3 text-[13px] shadow-sm backdrop-blur">
        {error && <p className="font-bold text-destructive">{error}</p>}
        <p className="font-bold">
          {inView.toLocaleString()} posts in view{loading && " · loading…"}
        </p>
        {data && (
          <p className="text-muted-foreground">
            {data.totals.posts.toLocaleString()} placed overall · {data.totals.byAgents.toLocaleString()} by pets ·{" "}
            {data.totals.hidden.toLocaleString()} hidden
          </p>
        )}
        <div className="flex flex-col gap-1 pt-1">
          {(
            [
              ["posts", "Posts", COLORS.person],
              ["strays", "Stray homes", COLORS.stray],
              ["places", "Places", COLORS.place],
            ] as const
          ).map(([key, label, color]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 font-semibold">
              <input
                type="checkbox"
                checked={visible[key]}
                onChange={(e) => setVisible((v) => ({ ...v, [key]: e.target.checked }))}
              />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              {label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: COLORS.person }} /> person
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: COLORS.agent }} /> pet
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: COLORS.hidden }} /> hidden
          </span>
        </div>
      </div>
    </div>
  );
}
