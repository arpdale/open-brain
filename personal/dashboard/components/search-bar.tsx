"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const DEBOUNCE_MS = 250;

export function SearchBar({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(initialQuery);
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

  // Debounced URL sync
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

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search your brain — semantic, not keyword"
        className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2.5 pr-16 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-700"
      />
      <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-xs text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
        ⌘K
      </kbd>
    </div>
  );
}
