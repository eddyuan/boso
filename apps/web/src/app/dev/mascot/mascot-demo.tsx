"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ModelViewer } from "./model-viewer";
import { MapWalker } from "./map-walker";

export function MascotDemo({ mapboxToken }: { mapboxToken: string }) {
  // ?tab=map opens the map directly.
  const initialTab = useSearchParams().get("tab") === "map" ? "map" : "model";
  const [tab, setTab] = useState<"model" | "map">(initialTab);

  return (
    <div className="fixed inset-0 flex flex-col bg-[#FFF6EC] text-[#2B1F16]">
      <header className="flex flex-wrap items-center gap-3 px-4 py-3">
        <h1 className="text-lg font-bold">Mascot 3D</h1>
        <div className="flex gap-1 rounded-full bg-[#F7EADA] p-1">
          {(["model", "map"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                tab === t ? "bg-[#FFC53D] text-[#2B1F16]" : "text-[#7D6B5B]"
              }`}>
              {t === "model" ? "Model" : "Map"}
            </button>
          ))}
        </div>
        <span className="text-sm text-[#7D6B5B]">
          {tab === "model" ? "Drag to orbit · scroll to zoom" : "Click the map to send the pet there"}
        </span>
      </header>
      <main className="relative min-h-0 flex-1">
        {tab === "model" ? <ModelViewer /> : <MapWalker token={mapboxToken} />}
      </main>
    </div>
  );
}
