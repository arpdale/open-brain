import test from "node:test";
import assert from "node:assert/strict";
import { isOwnerEmail, isOwnerSession, safeReturnPath } from "../lib/auth-policy.ts";

const owner = "owner@example.com";
const valid = { user: { email: owner, emailVerified: true }, session: { expiresAt: new Date(Date.now() + 60_000).toISOString() } };

test("only a verified owner with a live session has access", () => {
  assert.equal(isOwnerSession(valid, owner), true);
  for (const value of [null, {}, { user: valid.user },
    { ...valid, user: { email: "other@example.com", emailVerified: true } },
    { ...valid, user: { email: owner, emailVerified: false } },
    { ...valid, user: { email: owner } },
    { ...valid, session: { expiresAt: "2000-01-01" } },
    { ...valid, session: { expiresAt: "invalid" } }]) {
    assert.equal(isOwnerSession(value, owner), false);
  }
  assert.equal(isOwnerSession(valid, undefined), false);
  assert.equal(isOwnerSession(valid, ""), false);
});

test("email matching normalizes case but rejects aliases and suffixes", () => {
  assert.equal(isOwnerEmail(" Owner@Example.COM ", owner), true);
  for (const email of ["", "owner+other@example.com", "owner@example.com.evil", "other@example.com"]) {
    assert.equal(isOwnerEmail(email, owner), false);
  }
});

test("return paths remain on the dashboard and cannot loop through login", () => {
  assert.equal(safeReturnPath("/t/123?q=test"), "/t/123?q=test");
  for (const value of ["https://evil.example", "//evil.example", "/\\evil.example", "/\nevil.example", "/login", "javascript:alert(1)"]) {
    assert.equal(safeReturnPath(value), "/");
  }
});
