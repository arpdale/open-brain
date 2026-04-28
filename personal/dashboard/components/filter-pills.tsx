import Link from "next/link";
import type { FilterFacets } from "@/lib/db";

type Props = {
  facets: FilterFacets;
  active: { source?: string; project?: string };
};

function pillClass(active: boolean): string {
  return active
    ? "inline-block rounded-full px-3 py-1 text-xs font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
    : "inline-block rounded-full px-3 py-1 text-xs font-medium bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700";
}

export function FilterPills({ facets, active }: Props) {
  const projects = active.source ? facets.projectsBySource[active.source] ?? [] : [];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-zinc-500 mr-1">Source</span>
        <Link href="/" className={pillClass(!active.source)}>
          all
        </Link>
        {facets.sources.map((s) => (
          <Link
            key={s}
            href={`/?source=${encodeURIComponent(s)}`}
            className={pillClass(active.source === s)}
          >
            {s}
          </Link>
        ))}
      </div>
      {active.source && projects.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs uppercase tracking-wide text-zinc-500 mr-1">Project</span>
          <Link
            href={`/?source=${encodeURIComponent(active.source)}`}
            className={pillClass(!active.project)}
          >
            all
          </Link>
          {projects.map((p) => (
            <Link
              key={p}
              href={`/?source=${encodeURIComponent(active.source!)}&project=${encodeURIComponent(p)}`}
              className={pillClass(active.project === p)}
            >
              {p}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
