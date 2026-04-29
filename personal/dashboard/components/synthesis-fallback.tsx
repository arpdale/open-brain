// Skeleton placeholder shown while synthesis is in flight (~5-9s typical).
// Approximates the height of a 4-paragraph answer to minimize layout shift
// when the real synthesis lands.

export function SynthesisFallback() {
  return (
    <div
      className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      aria-busy="true"
      aria-label="Synthesizing answer"
    >
      <div className="space-y-3 animate-pulse">
        <div className="h-3 w-11/12 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-10/12 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-3 w-3/5 rounded bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
        Synthesizing answer from your thoughts…
      </p>
    </div>
  );
}
