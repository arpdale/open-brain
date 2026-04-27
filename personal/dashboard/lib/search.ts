"use server";

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

export async function searchAction(
  query: string,
  k = 10,
  threshold = 0.7
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
