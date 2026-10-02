import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { neon } from '@neondatabase/serverless';

// This script intentionally logs only check names and aggregate counts.
const privateDir = resolve(process.env.PRIVATE_DIR || '.local/migration-2026-10-02');
const base = (process.env.BASE_URL || 'https://open-brain-neon.arpdale.workers.dev').replace(/\/$/, '');
const source = JSON.parse(await readFile(join(privateDir, 'source/function-secrets.json'), 'utf8'));
const secret = { ...source, ...process.env };
const databaseUrl = process.env.ADMIN_DATABASE_URL || (await readFile(join(privateDir, 'neon-owner-url'), 'utf8')).trim();
const sql = neon(databaseUrl);
const runId = randomUUID();
const marker = `migration-verification-${runId}`;
const content = `${marker}: A temporary verification note about a purple telescope observing Saturn rings.`;
const edited = `${marker}: An edited verification note about a purple telescope observing Jupiter moons.`;
const ids = new Set();
const clients = [];
const checks = [];
const manifest = join(privateDir, `verification-records-${runId}.json`);
await mkdir(privateDir, { recursive: true, mode: 0o700 });
async function saveManifest(state = 'running') {
  await writeFile(manifest, JSON.stringify({ runId, marker, ids: [...ids], state, updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
}
await saveManifest();
function pass(name) { checks.push(name); console.log(`PASS ${name}`); }
function text(result) { return (result.content || []).filter(x => x.type === 'text').map(x => x.text).join('\n'); }
async function connect(url, headers) {
  const client = new Client({ name: 'open-brain-migration-verification', version: '1.0.0' });
  clients.push(client);
  const transport = new StreamableHTTPClientTransport(new URL(url), { requestInit: { headers }, fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(120000) }) });
  await client.connect(transport);
  return client;
}
async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 120000 });
  assert.ok(!result.isError, `tool ${name} returned an error`);
  return result;
}
async function findTestRows() {
  const rows = await sql`SELECT id FROM public.thoughts WHERE content = ${content} OR content = ${edited}`;
  for (const row of rows) ids.add(row.id);
  await saveManifest();
  return rows;
}
async function row(id) {
  const rows = await sql`SELECT id, content, deleted_at, embedding IS NOT NULL AS embedded, extensions.vector_dims(embedding) AS dimensions FROM public.thoughts WHERE id = ${id}`;
  assert.equal(rows.length, 1, 'temporary thought missing');
  return rows[0];
}
async function update(action, id, extra = {}, key = secret.UPDATE_THOUGHT_SECRET) {
  return fetch(`${base}/update-thought`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { 'x-dashboard-secret': key } : {}) },
    body: JSON.stringify({ action, id, ...extra }), signal: AbortSignal.timeout(120000),
  });
}
const expectedNames = ['capture_thought', 'list_thoughts', 'search_thoughts', 'thought_stats'];
function compatibleSchema(old, next, path = 'input') {
  assert.ok(next && typeof next === 'object', `missing schema ${path}`);
  if (old.type) assert.ok(next.type === old.type || (old.type === 'number' && next.type === 'integer'), `schema type changed ${path}`);
  for (const key of ['description', 'default', 'enum']) if (key in old) assert.deepEqual(next[key], old[key], `schema ${key} changed ${path}`);
  if (old.required) assert.deepEqual(next.required, old.required, `required fields changed ${path}`);
  if (old.properties) {
    assert.deepEqual(Object.keys(next.properties).sort(), Object.keys(old.properties).sort(), `fields changed ${path}`);
    for (const [key, value] of Object.entries(old.properties)) compatibleSchema(value, next.properties[key], `${path}.${key}`);
  }
}
let failure;
try {
  const unauthorized = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-brain-key': 'invalid-verification-key' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'unauthorized-test', version: '1' } } }), signal: AbortSignal.timeout(30000) });
  assert.ok([401,403].includes(unauthorized.status)); pass('MCP invalid authentication rejected');
  const missing = await fetch(`${base}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30000) });
  assert.ok([401,403].includes(missing.status)); pass('MCP missing authentication rejected');
  const oldUrl = new URL(process.env.OLD_MCP_URL || 'https://eykyhucukwfepphxvajc.supabase.co/functions/v1/open-brain-mcp');
  oldUrl.searchParams.set('key', secret.MCP_ACCESS_KEY);
  const oldClient = await connect(oldUrl.toString(), {});
  const oldTools = (await oldClient.listTools()).tools;
  const client = await connect(`${base}/mcp`, { 'x-brain-key': secret.MCP_ACCESS_KEY });
  const newTools = (await client.listTools()).tools;
  assert.deepEqual(newTools.map(x => x.name).sort(), expectedNames);
  assert.deepEqual(oldTools.map(x => x.name).sort(), expectedNames);
  for (const old of oldTools) {
    const next = newTools.find(x => x.name === old.name);
    compatibleSchema(old.inputSchema, next.inputSchema, old.name);
    assert.equal(next.description, old.description, `description differs: ${old.name}`);
    assert.equal(next.title, old.title, `title differs: ${old.name}`);
  }
  pass('old and candidate actual SDK tools/list compatibility (bounded validation permitted)');
  await call(client, 'thought_stats'); pass('statistics through MCP client');
  // Always inspect/save precise IDs even if the response is lost after capture commits.
  let captureError;
  try { await call(client, 'capture_thought', { content }); } catch (error) { captureError = error; }
  const captured = await findTestRows();
  if (captureError) throw captureError;
  assert.equal(captured.length, 1, 'capture did not persist exactly one temporary row');
  const id = captured[0].id;
  const persisted = await row(id);
  assert.equal(persisted.content, content);
  assert.equal(persisted.embedded, true);
  assert.equal(persisted.dimensions, Number(process.env.EMBEDDING_DIMENSIONS || 1536));
  pass('capture persisted with expected vector dimensions');
  const listed = await call(client, 'list_thoughts', { limit: 50, days: 1 });
  assert.ok(text(listed).includes(marker)); pass('captured thought retrieved through MCP list');
  const searched = await call(client, 'search_thoughts', { query: content, limit: 30, threshold: 0.1 });
  assert.ok(text(searched).includes(marker)); pass('semantic search retrieves captured thought');
  const second = await connect(`${base}/mcp`, { 'x-brain-key': secret.MCP_ACCESS_KEY });
  assert.ok(text(await call(second, 'list_thoughts', { limit: 50, days: 1 })).includes(marker));
  pass('persistence across independent MCP client sessions');
  for (const key of ['', 'invalid-verification-key']) {
    const bad = await update('delete', id, {}, key);
    assert.ok([401,403].includes(bad.status));
    assert.equal((await row(id)).deleted_at, null);
  }
  pass('update missing and invalid authentication rejected without mutation');
  const edit = await update('edit', id, { content: edited }); assert.equal(edit.status, 200);
  const afterEdit = await row(id); assert.equal(afterEdit.content, edited); assert.equal(afterEdit.embedded, true);
  pass('edit persists and preserves embedding availability');
  assert.ok(text(await call(client, 'search_thoughts', { query: edited, limit: 30, threshold: 0.1 })).includes(marker));
  pass('edited thought searchable');
  const deletion = await update('delete', id); assert.equal(deletion.status, 200); assert.ok((await row(id)).deleted_at);
  assert.ok(!text(await call(client, 'list_thoughts', { limit: 50, days: 1 })).includes(marker));
  assert.ok(!text(await call(client, 'search_thoughts', { query: edited, limit: 30, threshold: 0.1 })).includes(marker));
  pass('soft deletion persists and removes thought from list and search');
  const restore = await update('undelete', id); assert.equal(restore.status, 200); assert.equal((await row(id)).deleted_at, null);
  assert.ok(text(await call(client, 'list_thoughts', { limit: 50, days: 1 })).includes(marker));
  pass('undelete restores thought visibility');
} catch (error) {
  failure = error;
  // Do not emit upstream error bodies: these can contain private content or URLs.
  console.error(`FAIL deployed verification after ${checks.length} passed checks; ${error?.name || 'Error'}`);
} finally {
  try {
    await findTestRows();
    for (const id of ids) await sql`DELETE FROM public.thoughts WHERE id = ${id} AND (content = ${content} OR content = ${edited})`;
    assert.equal((await sql`SELECT count(*)::int AS count FROM public.thoughts WHERE content = ${content} OR content = ${edited}`)[0].count, 0);
    await saveManifest('cleaned'); pass('precise temporary record cleanup');
  } catch (cleanupError) {
    await saveManifest('cleanup-required');
    failure ||= cleanupError;
    console.error('FAIL cleanup; exact record IDs retained in private manifest');
  }
  await Promise.allSettled(clients.map(x => x.close()));
  await writeFile(join(privateDir, `verification-results-${runId}.json`), JSON.stringify({ runId, baseUrl: base, passed: checks, failed: Boolean(failure), manifest }, null, 2), { mode: 0o600 });
}
if (failure) process.exitCode = 1;
else console.log(`Verified ${checks.length} checks; no temporary records remain.`);
