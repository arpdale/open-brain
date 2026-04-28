import Link from "next/link";
import type { Thought } from "@/lib/db";

type Props = { thought: Thought };

function snippet(content: string, max = 280): string {
  const trimmed = content.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function relTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(1, Math.floor((now - then) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function ThoughtCard({ thought }: Props) {
  const md = thought.metadata ?? {};
  const source = typeof md.source === "string" ? md.source : null;
  const projectKey = source ? `${source}_project` : null;
  const project =
    projectKey && typeof md[projectKey] === "string" ? (md[projectKey] as string) : null;
  const titleKey = source ? `${source}_conversation_title` : null;
  const title =
    titleKey && typeof md[titleKey] === "string" ? (md[titleKey] as string) : null;

  return (
    <Link
      href={`/t/${thought.id}`}
      className="block rounded-lg border border-zinc-200 bg-white p-4 hover:border-zinc-400 transition-colors dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
    >
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
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
        <span className="ml-auto">{relTime(thought.created_at)}</span>
      </div>
      {title ? (
        <h3 className="text-sm font-medium text-zinc-900 mb-1 line-clamp-1 dark:text-zinc-100">
          {title}
        </h3>
      ) : null}
      <p className="text-sm text-zinc-600 line-clamp-3 dark:text-zinc-400">
        {snippet(thought.content)}
      </p>
    </Link>
  );
}
