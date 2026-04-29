"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 250;

type Mode = "ask" | "search";

export function SearchBar({
  initialQuery,
  initialMode,
}: {
  initialQuery: string;
  initialMode: Mode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [mode, setMode] = useState<Mode>(initialMode);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSyncedRef = useRef(initialQuery);

  // Cmd/Ctrl+K focuses the input
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced URL sync for query changes
  useEffect(() => {
    const trimmed = value.trim();
    if (trimmed === lastSyncedRef.current.trim()) return;
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (trimmed) {
        next.set("q", trimmed);
        next.delete("source");
        next.delete("project");
        next.delete("cursor");
      } else {
        next.delete("q");
      }
      lastSyncedRef.current = trimmed;
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value, pathname, params, router]);

  // Immediate URL sync for mode changes
  function changeMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    const qs = new URLSearchParams(params.toString());
    qs.set("mode", next);
    router.replace(`${pathname}?${qs.toString()}`);
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={
            mode === "ask"
              ? "Ask your brain a question…"
              : "Search your brain — semantic, not keyword"
          }
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 pr-44 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-700"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <ModeToggle mode={mode} onChange={changeMode} />
          <kbd className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            ⌘K
          </kbd>
        </div>
      </div>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const baseBtn =
    "px-2 py-0.5 text-xs font-medium rounded transition-colors focus:outline-none";
  const activeCls = "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900";
  const inactiveCls = "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

  return (
    <div
      role="tablist"
      aria-label="Search mode"
      className="flex items-center gap-0.5 rounded-md border border-zinc-200 bg-zinc-100 p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "search"}
        onClick={() => onChange("search")}
        className={`${baseBtn} ${mode === "search" ? activeCls : inactiveCls}`}
      >
        Search
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "ask"}
        onClick={() => onChange("ask")}
        className={`${baseBtn} ${mode === "ask" ? activeCls : inactiveCls}`}
      >
        Ask
      </button>
    </div>
  );
}
