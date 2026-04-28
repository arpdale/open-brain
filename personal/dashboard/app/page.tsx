import Link from "next/link";
import { decodeCursor, distinctMetadataValues, listThoughts } from "@/lib/db";
import { searchThoughts } from "@/lib/search";
import { readTheme } from "@/lib/theme";
import { FilterPills } from "@/components/filter-pills";
import { SearchBar } from "@/components/search-bar";
import { SearchResults } from "@/components/search-results";
import { ThemeToggle } from "@/components/theme-toggle";
import { ThoughtCard } from "@/components/thought-card";

type SearchParams = Promise<{
  q?: string;
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
  const query = sp.q?.trim() ?? "";
  const theme = await readTheme();

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <div className="mx-auto max-w-3xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-lg font-medium">Open Brain</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle initial={theme} />
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Sign out
              </button>
            </form>
          </div>
        </header>

        <SearchBar initialQuery={query} />

        {query ? <SearchView query={query} /> : <BrowseView sp={sp} />}
      </div>
    </main>
  );
}

async function SearchView({ query }: { query: string }) {
  const { results, elapsed_ms, error } = await searchThoughts(query);
  return (
    <SearchResults
      results={results}
      query={query}
      elapsedMs={elapsed_ms}
      error={error}
    />
  );
}

async function BrowseView({
  sp,
}: {
  sp: { source?: string; project?: string; cursor?: string };
}) {
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
    <div className="space-y-6">
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
            className="inline-block rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
          >
            Older →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
