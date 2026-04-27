import "server-only";

const COOKIE_NAME = "dashboard-session";
const SESSION_TTL_DAYS = 30;

function getSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET missing or too short (need >=32 chars)");
  }
  return s;
}

type Payload = { exp: number; nonce: string };

const enc = new TextEncoder();

function b64url(bytes: Uint8Array | string): string {
  const bin =
    typeof bytes === "string"
      ? bytes
      : Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(bin).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

async function importKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(payload: Payload): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const key = await importKey();
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(body))
  );
  return `${body}.${b64url(sig)}`;
}

async function verify(token: string): Promise<Payload | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, mac] = parts;
  const key = await importKey();
  const expected = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(body))
  );
  const provided = fromB64url(mac);
  if (!timingSafeEqual(expected, provided)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Payload;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
};

function cookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

export async function issueSessionCookie(): Promise<{
  name: string;
  value: string;
  options: CookieOptions;
}> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_DAYS * 24 * 60 * 60;
  const nonceBytes = new Uint8Array(12);
  crypto.getRandomValues(nonceBytes);
  const nonce = b64url(nonceBytes);
  const value = await sign({ exp, nonce });
  return { name: COOKIE_NAME, value, options: cookieOptions(SESSION_TTL_DAYS * 24 * 60 * 60) };
}

export function clearSessionCookie(): { name: string; value: string; options: CookieOptions } {
  return { name: COOKIE_NAME, value: "", options: cookieOptions(0) };
}

export async function isSessionValid(cookieValue: string | undefined): Promise<boolean> {
  if (!cookieValue) return false;
  return (await verify(cookieValue)) !== null;
}

export function checkPassword(supplied: string): boolean {
  const expected = process.env.BRAIN_PASSWORD;
  if (!expected) return false;
  const a = enc.encode(supplied);
  const b = enc.encode(expected);
  return timingSafeEqual(a, b);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
