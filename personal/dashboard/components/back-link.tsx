"use client";

import { useRouter } from "next/navigation";

type Props = {
  children: React.ReactNode;
  fallback?: string;
  className?: string;
};

export function BackLink({ children, fallback = "/", className }: Props) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
      className={
        className ?? "text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      }
    >
      {children}
    </button>
  );
}
