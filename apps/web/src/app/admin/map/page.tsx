import { PageHeader } from "../_components/ui";
import { CoverageMap } from "./coverage-map";

export const metadata = { title: "Coverage — Tielo admin" };

export default function CoveragePage() {
  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <PageHeader
        title="Coverage"
        description="Where the map has content, and where it doesn't — pan to load an area, then seed the gaps."
      />
      <div className="relative min-h-0 flex-1">
        <CoverageMap token={process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""} />
      </div>
    </div>
  );
}
