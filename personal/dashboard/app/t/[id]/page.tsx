import Link from "next/link";
import { notFound } from "next/navigation";
import { getNeighbors, getThought } from "@/lib/db";
import { ConnectedPanel } from "@/components/connected-panel";

type Params = Promise<{ id: string }>;

export default async function ThoughtDetailPage({ params }: { params: Params }) {
  const { id } = await params;

  const [thought, neighbors] = await Promise.all([
    getThought(id),
    getNeighbors(id, 5).catch(() => []),
  ]);

  if (!thought) notFound();

  const md = thought.metadata ?? {};
  const source = typeof md.source === "string" ? md.source : null;
  const projectKey = source ? `${source}_project` : null;
  const project =
    projectKey && typeof md[projectKey] === "string" ? (md[projectKey] as string) : null;
  const titleKey = source ? `${source}_conversation_title` : null;
  const title =
    titleKey && typeof md[titleKey] === "string" ? (md[titleKey] as string) : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl p-6 space-y-6">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
            ← Browse
          </Link>
          <div className="text-xs text-zinc-600">{new Date(thought.created_at).toLocaleString()}</div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          <article className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {source ? (
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                  {source}
                </span>
              ) : null}
              {project ? (
                <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                  {project}
                </span>
              ) : null}
            </div>
            {title ? <h1 className="text-xl font-medium">{title}</h1> : null}
            <pre className="whitespace-pre-wrap break-words text-sm text-zinc-200 font-sans leading-relaxed">
              {thought.content}
            </pre>

            <details className="rounded border border-zinc-800 bg-zinc-900">
              <summary className="cursor-pointer px-3 py-2 text-xs text-zinc-400 hover:text-zinc-200">
                Metadata
              </summary>
              <pre className="px-3 py-2 text-xs text-zinc-500 overflow-x-auto">
                {JSON.stringify(thought.metadata, null, 2)}
              </pre>
            </details>
          </article>

          <ConnectedPanel neighbors={neighbors} />
        </div>
      </div>
    </main>
  );
}
