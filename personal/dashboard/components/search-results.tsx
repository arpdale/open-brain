import Link from "next/link";
import type { SearchResult } from "@/lib/search";
import { extractTitle, stripMarkdown } from "@/lib/markdown";

type Props = {
  results: SearchResult[];
  query: string;
  elapsedMs?: number;
  error?: string;
  // When true, the result cards get id="card-{N}" anchors so synthesis citations
  // can scroll to them. Used in Ask mode.
  anchored?: boolean;
};

function snippet(content: string, max = 220): string {
  const cleaned = stripMarkdown(content);
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export function SearchResults({ results, query, elapsedMs, error, anchored = false }: Props) {
  if (error) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
        Search degraded: {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          {results.length} {results.length === 1 ? "result" : "results"} for &ldquo;{query}&rdquo;
        </span>
        {typeof elapsedMs === "number" ? <span>{elapsedMs}ms</span> : null}
      </div>

      {results.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No matches above similarity threshold. Try a broader phrasing or check spelling.
        </p>
      ) : (
        results.map((r, i) => {
          const md = r.metadata ?? {};
          const source = typeof md.source === "string" ? md.source : null;
          const projectKey = source ? `${source}_project` : null;
          const project =
            projectKey && typeof md[projectKey] === "string"
              ? (md[projectKey] as string)
              : null;
          const titleKey = source ? `${source}_conversation_title` : null;
          const title =
            (titleKey && typeof md[titleKey] === "string" ? (md[titleKey] as string) : null) ||
            extractTitle(r.content);

          return (
            <Link
              key={r.id}
              id={anchored ? `card-${i + 1}` : undefined}
              href={`/t/${r.id}`}
              className="block scroll-mt-20 rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
            >
              <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                {anchored ? (
                  <span className="font-mono text-zinc-400 dark:text-zinc-500">[{i + 1}]</span>
                ) : null}
                {source ? (
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {source}
                  </span>
                ) : null}
                {project ? (
                  <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {project}
                  </span>
                ) : null}
                <span className="ml-auto font-mono text-zinc-500 dark:text-zinc-400">
                  {(r.similarity * 100).toFixed(0)}%
                </span>
              </div>
              {title ? (
                <h3 className="text-sm font-medium text-zinc-900 mb-1 line-clamp-1 dark:text-zinc-100">
                  {title}
                </h3>
              ) : null}
              <p className="text-sm text-zinc-600 line-clamp-3 dark:text-zinc-400">
                {snippet(r.content)}
              </p>
            </Link>
          );
        })
      )}
    </div>
  );
}
