import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { checkPassword, issueSessionCookie, isSessionValid } from "../lib/auth.ts";

process.env.SESSION_SECRET = randomBytes(32).toString("hex");
process.env.BRAIN_PASSWORD = randomBytes(16).toString("hex");

test("sessions accept a signed token and reject missing, tampered, malformed and expired tokens", async () => {
  const cookie = await issueSessionCookie();
  assert.equal(await isSessionValid(cookie.value), true);
  assert.equal(cookie.options.httpOnly, true);
  assert.equal(cookie.options.sameSite, "lax");
  assert.equal(await isSessionValid(undefined), false);
  const [body, signature] = cookie.value.split(".");
  const first = signature[0] === "A" ? "B" : "A";
  assert.equal(await isSessionValid(`${body}.${first}${signature.slice(1)}`), false);
  assert.equal(await isSessionValid("invalid.%%%"), false);
  const expired = Buffer.from(JSON.stringify({ exp: 1, nonce: "test" })).toString("base64url");
  const mac = createHmac("sha256", process.env.SESSION_SECRET).update(expired).digest("base64url");
  assert.equal(await isSessionValid(`${expired}.${mac}`), false);
});

test("password authentication accepts only the configured password", () => {
  assert.equal(checkPassword(process.env.BRAIN_PASSWORD), true);
  assert.equal(checkPassword("wrong"), false);
  assert.equal(checkPassword(""), false);
});
