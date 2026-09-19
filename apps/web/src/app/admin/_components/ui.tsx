import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2, Search, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Building blocks shared by the admin pages, so every page has the same frame:
 * a header, then cards. Kept free of hooks so server pages can use them too.
 */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-semibold leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** A card with a title row. `bleed` drops the body padding for tables and lists. */
export function Panel({
  title,
  icon: Icon,
  description,
  actions,
  children,
  className,
  bleed,
}: {
  title?: string;
  icon?: LucideIcon;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bleed?: boolean;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card", className)}>
      {(title || actions) && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-3 px-4 pt-4",
            (title || description) && "justify-between",
          )}
        >
          {(title || description) && (
            <div className="min-w-0">
              {title && (
                <h2 className="flex items-center gap-2 font-display text-base font-semibold leading-tight">
                  {Icon && <Icon className="h-4 w-4 text-primary-ink" />}
                  {title}
                </h2>
              )}
              {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
            </div>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(bleed ? "p-2" : "p-4", (title || actions) && "pt-3")}>{children}</div>
    </section>
  );
}

const TONES = {
  gold: "bg-primary-soft text-primary-ink",
  green: "bg-success-soft text-success",
  blue: "bg-info-soft text-info",
  red: "bg-destructive-soft text-destructive",
  neutral: "bg-secondary text-muted-foreground",
} as const;
export type Tone = keyof typeof TONES;

/** A tinted rounded square holding an icon — the app's "icon tile". */
export function IconTile({ icon: Icon, tone = "gold", className }: { icon: LucideIcon; tone?: Tone; className?: string }) {
  return (
    <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px]", TONES[tone], className)}>
      <Icon className="h-5 w-5" />
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
}: {
  label: string;
  /** A string when the figure is already formatted — money, a rate, a duration. */
  value: number | string;
  icon: LucideIcon;
  hint?: string;
  href?: string;
}) {
  const body = (
    <div className="flex h-full items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors group-hover:border-foreground/25">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-semibold leading-tight tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      </div>
      {hint && <p className="ml-auto shrink-0 text-xs font-semibold text-muted-foreground">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}

export function SearchField({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-72", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10"
      />
    </div>
  );
}

/** Pill-shaped segmented control, used for filters. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-full bg-secondary p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-8 cursor-pointer rounded-full px-3.5 text-[13px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-4">
      <p className="text-[13px] font-semibold text-muted-foreground tabular-nums">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-1.5">
        <Button variant="secondary" size="icon-sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <span className="min-w-14 text-center text-[13px] font-bold tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="secondary" size="icon-sm" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <IconTile icon={Icon} tone="neutral" className="mb-4 h-12 w-12 rounded-2xl" />
      <p className="font-display text-base font-semibold">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-14 text-sm font-semibold text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

/** A result/notice strip under a form. */
export function Notice({ tone = "gold", children }: { tone?: Tone; children: React.ReactNode }) {
  return <div className={cn("rounded-xl px-4 py-3 text-sm font-semibold", TONES[tone])}>{children}</div>;
}

export function Muted({ children = "—" }: { children?: React.ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

function relative(d: Date): string {
  const seconds = (d.getTime() - Date.now()) / 1000;
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

/** "3 days ago" — with the full date on hover via `title`. */
export function TimeAgo({ date }: { date: string | Date | null }) {
  if (!date) return <Muted />;
  const d = new Date(date);
  const text = relative(d);
  return (
    <time dateTime={d.toISOString()} title={d.toLocaleString()} className="whitespace-nowrap">
      {text}
    </time>
  );
}
