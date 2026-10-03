type Session = {
  user?: { email?: string; emailVerified?: boolean };
  session?: { expiresAt?: string | Date };
} | null | undefined;

export function isOwnerEmail(email: string, owner: string | undefined): boolean {
  return !!owner?.trim() && email.trim().toLowerCase() === owner.trim().toLowerCase();
}

export function isOwnerSession(value: Session, owner: string | undefined): boolean {
  const expires = value?.session?.expiresAt;
  return !!value?.user && value.user.emailVerified === true &&
    isOwnerEmail(value.user.email ?? "", owner) && !!expires &&
    new Date(expires).getTime() > Date.now();
}

export function safeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\x00-\x20]/.test(value)) return "/";
  try {
    const url = new URL(value, "https://dashboard.invalid");
    return url.origin === "https://dashboard.invalid" && !url.pathname.startsWith("/login")
      ? url.pathname + url.search : "/";
  } catch { return "/"; }
}
