// Run explicitly against a candidate preview, never as part of npm test.
// Required: DASHBOARD_URL, DASHBOARD_SHARE_URL_FILE, DASHBOARD_FIXTURE_FILE,
// BRAIN_PASSWORD. Optional PLAYWRIGHT_MODULE points to installed playwright/core.
// Fixture JSON: {id,content,updatedContent,query,source,project,neighborId?}.
// Root creates/cleans the temporary fixture; no private output/screenshots saved.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.DASHBOARD_URL;
const password = process.env.BRAIN_PASSWORD;
assert(base && password && process.env.DASHBOARD_SHARE_URL_FILE && process.env.DASHBOARD_FIXTURE_FILE,
  "Missing deployed verification configuration");
const fixture = JSON.parse(await readFile(process.env.DASHBOARD_FIXTURE_FILE, "utf8"));
assert(/^[0-9a-f-]{36}$/i.test(fixture.id) && fixture.content && fixture.updatedContent && fixture.query && fixture.source && fixture.project,
  "Missing temporary fixture fields");
const share = (await readFile(process.env.DASHBOARD_SHARE_URL_FILE, "utf8")).trim();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(30000);
let stage = "platform access";
let deletionPending = false;
let substage;
const actionStatuses = [];
page.on("response", response => {
  if (response.request().method() === "POST" && new URL(response.url()).origin === new URL(base).origin) {
    actionStatuses.push(response.status());
  }
});
const reports = [];
const passed = (name) => reports.push({ name, status: "passed" });
const navigate = async (path) => {
  const response = await page.goto(new URL(path, base).href, { waitUntil: "domcontentloaded", timeout: 60000 });
  assert(response && response.status() < 400, "Candidate route returned an error");
};
const noDegradation = async () => {
  assert.equal(await page.getByText(/Search degraded:/).count(), 0, "Search degraded");
};
try {
  await page.goto(share, { waitUntil: "domcontentloaded", timeout: 60000 });
  stage = "route protection";
  await navigate("/");
  assert(new URL(page.url()).pathname === "/login", "Unauthenticated browse was not protected");
  await navigate(`/t/${fixture.id}`);
  assert(new URL(page.url()).pathname === "/login", "Unauthenticated detail was not protected");
  passed(stage);

  stage = "invalid login";
  await page.locator('input[name="password"]').fill(`incorrect-${crypto.randomUUID()}`);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByText("Incorrect password.", { exact: true }).waitFor();
  assert.equal((await context.cookies()).some(c => c.name === "dashboard-session"), false);
  passed(stage);

  stage = "valid login";
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(u => u.pathname !== "/login");
  const session = (await context.cookies()).find(c => c.name === "dashboard-session");
  assert(session && session.httpOnly && session.secure && session.sameSite === "Lax", "Session cookie security failed");
  passed(stage);

  stage = "browse and pagination";
  await navigate("/");
  const firstIds = await page.locator('a[href^="/t/"]').evaluateAll(nodes => nodes.map(n => n.getAttribute("href")));
  assert(firstIds.length > 0, "Browse returned no thoughts");
  const next = page.locator('a[href*="cursor="]').first();
  assert(await next.count(), "Expected pagination at migrated corpus size");
  await next.click();
  await page.waitForURL(u => u.searchParams.has("cursor"));
  const secondIds = await page.locator('a[href^="/t/"]').evaluateAll(nodes => nodes.map(n => n.getAttribute("href")));
  assert(secondIds.length > 0 && secondIds.every(id => !firstIds.includes(id)), "Pagination repeated or omitted rows");
  passed(stage);

  stage = "source/project filtering";
  await navigate(`/?source=${encodeURIComponent(fixture.source)}&project=${encodeURIComponent(fixture.project)}`);
  const fixtureCard = page.locator(`a[href="/t/${fixture.id}"]`).first();
  await fixtureCard.waitFor();
  assert.equal(await page.locator('a[href^="/t/"]').count(), 1, "Fixture project filter was not exclusive");
  passed(stage);

  stage = "detail and neighbors";
  await navigate(`/t/${fixture.id}`);
  await page.getByRole("button", { name: "Edit", exact: true }).waitFor();
  await page.getByText(fixture.content, { exact: true }).waitFor();
  if (fixture.neighborId) {
    await page.locator(`aside a[href="/t/${fixture.neighborId}"]`).waitFor();
  } else {
    assert(await page.locator("aside").count(), "Neighbor panel absent");
  }
  passed(stage);

  stage = "semantic search";
  await navigate(`/?q=${encodeURIComponent(fixture.query)}&mode=search`);
  await page.locator(`a[href="/t/${fixture.id}"]`).first().waitFor();
  await noDegradation();
  passed(stage);

  stage = "Ask synthesis";
  await navigate(`/?q=${encodeURIComponent(fixture.query)}&mode=ask`);
  await page.locator("article.prose").waitFor({ timeout: 60000 });
  await noDegradation();
  assert.equal(await page.getByText("No thoughts in your brain match this question.", { exact: true }).count(), 0);
  passed(stage);

  stage = "edit and persisted reload";
  await navigate(`/t/${fixture.id}`);
  substage = "click Edit";
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  substage = "fill draft";
  await page.locator("textarea").fill(fixture.updatedContent);
  substage = "click Save";
  await page.getByRole("button", { name: "Save", exact: true }).click();
  substage = "await completed save";
  // The draft textarea already contains updatedContent before the request
  // completes. Wait for editing mode to close before reloading the page.
  await page.locator("textarea").waitFor({ state: "hidden", timeout: 60000 });
  await page.getByRole("button", { name: "Edit", exact: true }).waitFor();
  substage = "await saved markdown";
  await page.locator("article").getByText(fixture.updatedContent, { exact: true }).waitFor();
  substage = "reload persisted detail";
  await page.reload({ waitUntil: "domcontentloaded" });
  substage = "await persisted content";
  await page.locator("article").getByText(fixture.updatedContent, { exact: true }).waitFor();
  passed(stage);

  stage = "soft delete and restore";
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Yes, delete", exact: true }).click();
  await page.getByText("Thought deleted.", { exact: true }).waitFor();
  deletionPending = true;
  // Verify deletion with authenticated HTTP without leaving the Undo toast.
  const deleted = await context.request.get(new URL(`/t/${fixture.id}`, base).href);
  assert.equal(deleted.status(), 404, "Deleted fixture remained visible");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.waitForURL(u => !u.searchParams.has("deleted"));
  deletionPending = false;
  await navigate(`/t/${fixture.id}`);
  await page.getByText(fixture.updatedContent, { exact: true }).waitFor();
  passed(stage);

  stage = "logout and malformed session rejection";
  await navigate("/");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page.waitForURL(u => u.pathname === "/login");
  await context.addCookies([{ name: "dashboard-session", value: "invalid.%%%", url: base, httpOnly: true, secure: true }]);
  await navigate("/");
  assert.equal(new URL(page.url()).pathname, "/login");
  passed(stage);
  console.log(JSON.stringify({ status: "passed", checks: reports }, null, 2));
} catch (error) {
  const errors = await page.locator("p.text-red-600, p.text-red-500, .text-red-600").allTextContents().catch(() => []);
  const diagnostics = errors.map(text => {
    const status = text.match(/\b([45]\d{2})\b/)?.[1];
    if (status) return `HTTP ${status}`;
    if (/unauthorized/i.test(text)) return "Unauthorized";
    if (/missing/i.test(text)) return "Missing environment configuration";
    if (/network/i.test(text)) return "Network failure";
    if (/invalid thought id/i.test(text)) return "Invalid thought ID";
    return "Unclassified action error";
  });
  // Don't print Playwright error text: locator diagnostics may include private UI.
  console.error(JSON.stringify({ status: "failed", stage, substage, errorName: error?.name || "Error", actionStatuses, actionErrors: diagnostics, deletionPending, checks: reports }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
