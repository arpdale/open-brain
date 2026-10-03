import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createNeonAuth } from "@neondatabase/auth/next/server";
import { isOwnerSession } from "./auth-policy";

export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    sameSite: "lax",
    sessionDataTtl: 60,
  },
});

// Only deduplicate within a render request. Ask Neon for the current session so
// revoked sessions do not retain data access through a cached browser cookie.
export const hasOwnerSession = cache(async (): Promise<boolean> => {
  try {
    const { data, error } = await auth.getSession({ query: { disableCookieCache: "true" } });
    return !error && isOwnerSession(data, process.env.BRAIN_OWNER_EMAIL);
  } catch {
    return false;
  }
});

export async function requireOwner(): Promise<void> {
  if (!await hasOwnerSession()) redirect("/login");
}
