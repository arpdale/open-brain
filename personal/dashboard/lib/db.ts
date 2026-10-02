import "server-only";
import { neon } from "@neondatabase/serverless";

export type Thought = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};
export type Filters = { source?: string; project?: string };
export type Cursor = { created_at: string; id: string } | null;
export type MatchRow = Thought & { similarity: number };
const PAGE_SIZE = 50;

// The dashboard uses a dedicated SELECT-only role; this URL never reaches clients.
export async function queryRows<T>(query: string, params: unknown[] = []): Promise<T[]> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  return await neon(url).query(query, params) as T[];
}

export function encodeCursor(c: { created_at: string; id: string }): string {
  return Buffer.from(`${c.created_at}|${c.id}`).toString("base64url");
}
export function decodeCursor(s: string | undefined): Cursor {
  if (!s) return null;
  try {
    const [created_at, id] = Buffer.from(s, "base64url").toString().split("|");
    if (!created_at || !Number.isFinite(Date.parse(created_at)) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id ?? "")) return null;
    return { created_at, id };
  } catch { return null; }
}

export async function listThoughts(filters: Filters, cursor: Cursor): Promise<{ rows: Thought[]; nextCursor: string | null }> {
  const rows = await queryRows<Thought>(`
    select id, content, metadata, created_at::text as created_at from public.thoughts
    where deleted_at is null
      and ($1::text is null or metadata->>'source' = $1)
      and ($2::text is null or metadata->>$3::text = $2)
      and ($4::timestamptz is null or (created_at, id) < ($4::timestamptz, $5::uuid))
    order by created_at desc, id desc limit $6`,
    [filters.source ?? null, filters.source ? filters.project ?? null : null,
      filters.source ? `${filters.source}_project` : null,
      cursor?.created_at ?? null, cursor?.id ?? null, PAGE_SIZE + 1]);
  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const last = page[page.length - 1];
  return { rows: page, nextCursor: hasMore && last ? encodeCursor(last) : null };
}

export type FilterFacets = { sources: string[]; projectsBySource: Record<string, string[]> };
export async function distinctMetadataValues(): Promise<FilterFacets> {
  const rows = await queryRows<{metadata: Record<string, unknown>}>(
    "select metadata from public.thoughts where deleted_at is null limit 10000");
  const sources = new Set<string>();
  const projectsBySource = new Map<string, Set<string>>();
  for (const r of rows) {
    const md = r.metadata ?? {};
    const source = typeof md.source === "string" ? md.source : null;
    if (!source) continue;
    sources.add(source);
    const project = md[`${source}_project`];
    if (typeof project === "string" && project) {
      if (!projectsBySource.has(source)) projectsBySource.set(source, new Set());
      projectsBySource.get(source)!.add(project);
    }
  }
  return { sources: Array.from(sources).sort(), projectsBySource: Object.fromEntries(
    Array.from(projectsBySource, ([k,v]) => [k, Array.from(v).sort()])) };
}

export async function getThought(id: string): Promise<Thought | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const rows = await queryRows<Thought>(
    "select id, content, metadata, created_at::text as created_at from public.thoughts where id = $1::uuid and deleted_at is null", [id]);
  return rows[0] ?? null;
}

// Preserve the core RPC's ordering, threshold and over-fetch semantics, then
// hide deleted rows as the previous dashboard did.
export async function matchVisibleThoughts(embedding: number[] | string, threshold: number, count: number): Promise<MatchRow[]> {
  const vector = typeof embedding === "string" ? embedding : JSON.stringify(embedding);
  return queryRows<MatchRow>(`
    select matches.id, matches.content, matches.metadata, matches.created_at::text as created_at, matches.similarity
    from public.match_thoughts($1::vector, $2::float, $3::int, '{}'::jsonb) matches
    join public.thoughts visible on visible.id = matches.id
    where visible.deleted_at is null
    order by matches.similarity desc`, [vector, threshold, count]);
}

export async function getNeighbors(id: string, k = 5): Promise<Thought[]> {
  const rows = await queryRows<{embedding: string | null}>(
    "select embedding::text from public.thoughts where id=$1::uuid and deleted_at is null", [id]);
  const embedding = rows[0]?.embedding;
  if (!embedding) return [];
  const matches = await matchVisibleThoughts(embedding, 0.7, k * 4 + 1);
  return matches.filter(r => r.id !== id).slice(0,k)
    .map(({id,content,metadata,created_at}) => ({id,content,metadata,created_at}));
}
