"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchAction, type SearchResult } from "@/lib/search";

const DEBOUNCE_MS = 250;

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cmd/Ctrl+K toggle, Esc close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
    else {
      setQuery("");
      setResults([]);
      setError(null);
      setHighlight(0);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setPending(true);
    const t = setTimeout(async () => {
      const r = await searchAction(trimmed);
      if (cancelled) return;
      setPending(false);
      if (r.error) {
        setError(r.error);
        setResults([]);
      } else {
        setError(null);
        setResults(r.results);
        setHighlight(0);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, open]);

  function onResultKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results[highlight]) {
      e.preventDefault();
      setOpen(false);
      router.push(`/t/${results[highlight].id}`);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onResultKey}
          placeholder="Search your brain…"
          className="w-full bg-transparent border-b border-zinc-800 px-4 py-3 text-sm text-zinc-100 focus:outline-none"
        />
        <div className="max-h-96 overflow-y-auto">
          {error ? (
            <div className="px-4 py-3 text-sm text-amber-400">Search degraded: {error}</div>
          ) : pending && results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-zinc-500">Searching…</div>
          ) : query.trim() && results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-zinc-500">No matches above threshold.</div>
          ) : (
            results.map((r, i) => {
              const md = r.metadata ?? {};
              const source = typeof md.source === "string" ? md.source : null;
              const title =
                source && typeof md[`${source}_conversation_title`] === "string"
                  ? (md[`${source}_conversation_title`] as string)
                  : null;
              return (
                <button
                  key={r.id}
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => {
                    setOpen(false);
                    router.push(`/t/${r.id}`);
                  }}
                  className={`block w-full text-left px-4 py-3 border-b border-zinc-800 last:border-b-0 ${
                    i === highlight ? "bg-zinc-800" : "hover:bg-zinc-800/60"
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
                    {source ? (
                      <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-300">
                        {source}
                      </span>
                    ) : null}
                    <span className="ml-auto">{(r.similarity * 100).toFixed(0)}%</span>
                  </div>
                  {title ? (
                    <div className="text-sm text-zinc-100 line-clamp-1">{title}</div>
                  ) : null}
                  <div className="text-xs text-zinc-400 line-clamp-2 mt-0.5">
                    {r.content.trim().slice(0, 200)}
                  </div>
                </button>
              );
            })
          )}
        </div>
        <div className="border-t border-zinc-800 px-4 py-2 text-xs text-zinc-600 flex justify-between">
          <span>↑↓ navigate · ↵ open · esc close</span>
          <span>⌘K to toggle</span>
        </div>
      </div>
    </div>
  );
}
