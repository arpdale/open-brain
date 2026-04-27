import Link from "next/link";
import { decodeCursor, distinctMetadataValues, listThoughts } from "@/lib/db";
import { FilterPills } from "@/components/filter-pills";
import { ThoughtCard } from "@/components/thought-card";

type SearchParams = Promise<{
  source?: string;
  project?: string;
  cursor?: string;
}>;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = { source: sp.source, project: sp.project };
  const cursor = decodeCursor(sp.cursor);

  const [{ rows, nextCursor }, facets] = await Promise.all([
    listThoughts(filters, cursor),
    distinctMetadataValues(),
  ]);

  const nextHref = nextCursor
    ? `/?${new URLSearchParams({
        ...(filters.source ? { source: filters.source } : {}),
        ...(filters.project ? { project: filters.project } : {}),
        cursor: nextCursor,
      }).toString()}`
    : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-3xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-medium">Open Brain</h1>
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Sign out
            </button>
          </form>
        </header>

        <FilterPills facets={facets} active={filters} />

        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-zinc-500">No thoughts match these filters.</p>
          ) : (
            rows.map((t) => <ThoughtCard key={t.id} thought={t} />)
          )}
        </div>

        {nextHref ? (
          <div className="pt-2">
            <Link
              href={nextHref}
              className="inline-block rounded-md bg-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
            >
              Older →
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
