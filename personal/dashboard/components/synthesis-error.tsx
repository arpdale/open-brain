// Shown when synthesize() throws (timeout, rate limit, malformed response).
// Cards are still rendered below so the user has something useful.

export function SynthesisError({ reason }: { reason?: string }) {
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
      <p className="font-medium">Couldn&apos;t synthesize an answer.</p>
      <p className="mt-1 text-xs opacity-80">
        Showing the closest matches below.
        {reason ? ` (${reason})` : ""}
      </p>
    </div>
  );
}
