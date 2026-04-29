import { createClient } from "@supabase/supabase-js";

const EMBEDDING_PROVIDER_URL = "https://openrouter.ai/api/v1/embeddings";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";

export type SearchResult = {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  created_at: string;
};

export type SearchResponse = {
  results: SearchResult[];
  elapsed_ms: number;
  error?: string;
};

// Default threshold tuned for text-embedding-3-small at our corpus scale
// (130–10k thoughts). Short single-word queries top out at ~0.30–0.35 cosine
// similarity, so a 0.4 default returns zero results for most one-word inputs.
// 0.2 keeps the long tail of weakly-related results visible — they sort to the
// bottom by similarity DESC anyway, and the user can ignore them.
//
// Sweep here only if MCP and dashboard search disagree on the same query.
export async function searchThoughts(
  query: string,
  k = 30,
  threshold = 0.2
): Promise<SearchResponse> {
  const trimmed = query.trim();
  if (!trimmed) return { results: [], elapsed_ms: 0 };
  if (trimmed.length > 2000) return { results: [], elapsed_ms: 0, error: "Query too long" };
  const safeK = Math.min(50, Math.max(1, Math.floor(k)));
  const safeThreshold = Math.min(1, Math.max(0, threshold));

  const start = Date.now();
  const orKey = process.env.OPENROUTER_API_KEY;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!orKey || !url || !key) {
    return { results: [], elapsed_ms: 0, error: "Missing env config" };
  }

  let embedding: number[];
  try {
    const r = await fetch(EMBEDDING_PROVIDER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${orKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: trimmed }),
    });
    if (!r.ok) {
      return { results: [], elapsed_ms: Date.now() - start, error: `Embedding API ${r.status}` };
    }
    const json = (await r.json()) as { data?: Array<{ embedding: number[] }> };
    const e = json.data?.[0]?.embedding;
    if (!e || !Array.isArray(e)) {
      return { results: [], elapsed_ms: Date.now() - start, error: "Embedding response malformed" };
    }
    embedding = e;
  } catch (err) {
    return {
      results: [],
      elapsed_ms: Date.now() - start,
      error: `Embedding fetch failed: ${(err as Error).message}`,
    };
  }

  const supa = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supa.rpc("match_thoughts", {
    query_embedding: embedding as unknown as number[],
    match_threshold: safeThreshold,
    match_count: safeK,
    filter: {},
  });
  if (error) {
    return { results: [], elapsed_ms: Date.now() - start, error: `match_thoughts: ${error.message}` };
  }

  return {
    results: (data ?? []) as SearchResult[],
    elapsed_ms: Date.now() - start,
  };
}
