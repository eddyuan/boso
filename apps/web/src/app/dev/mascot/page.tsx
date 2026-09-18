import { notFound } from "next/navigation";
import { Suspense } from "react";
import { MascotDemo } from "./mascot-demo";

export const metadata = { title: "Mascot 3D demo" };

// Dev-only playground for the 3D mascot: model viewer + walking on a Mapbox map.
export default function MascotDemoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <MascotDemo mapboxToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""} />
    </Suspense>
  );
}
