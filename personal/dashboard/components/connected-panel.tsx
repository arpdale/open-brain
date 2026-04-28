import Link from "next/link";
import type { Thought } from "@/lib/db";

type Props = { neighbors: Thought[] };

export function ConnectedPanel({ neighbors }: Props) {
  if (neighbors.length === 0) {
    return (
      <aside className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="text-xs uppercase tracking-wide text-zinc-500 mb-2">Connected</h2>
        <p className="text-sm text-zinc-500">
          No semantically similar thoughts above threshold.
        </p>
      </aside>
    );
  }

  return (
    <aside className="rounded-lg border border-zinc-200 bg-white p-4 space-y-3 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-xs uppercase tracking-wide text-zinc-500">
        Semantic neighbors
      </h2>
      <ul className="space-y-2">
        {neighbors.map((n) => {
          const md = n.metadata ?? {};
          const source = typeof md.source === "string" ? md.source : null;
          const title =
            source && typeof md[`${source}_conversation_title`] === "string"
              ? (md[`${source}_conversation_title`] as string)
              : null;
          return (
            <li key={n.id}>
              <Link
                href={`/t/${n.id}`}
                className="block rounded-md border border-zinc-200 p-2 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
              >
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                  {source ? (
                    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {source}
                    </span>
                  ) : null}
                </div>
                {title ? (
                  <div className="text-sm text-zinc-900 line-clamp-1 dark:text-zinc-100">{title}</div>
                ) : null}
                <div className="text-xs text-zinc-600 line-clamp-2 mt-0.5 dark:text-zinc-400">
                  {n.content.trim().slice(0, 160)}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
