import type {Env} from "./types";
import {vector,boundedBody,metadata} from "./security";
export const OPENROUTER_BASE="https://openrouter.ai/api/v1";
export const EMBEDDING_PROVIDER="openrouter";
export const EMBEDDING_MODEL="openai/text-embedding-3-small";
export async function getEmbedding(env: Env, text: string): Promise<number[]> {
  const r = await fetch(`${OPENROUTER_BASE}/embeddings`, {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text,
    }),
  });
  if (!r.ok) {
    throw new Error('Embedding provider unavailable');
  }
  const d = JSON.parse(await boundedBody(r,256000));
  return vector(d.data?.[0]?.embedding);
}

export async function extractMetadata(env: Env, text: string): Promise<Record<string, unknown>> {
  const r = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Extract metadata from the user's captured thought. Return JSON with:
- "people": array of people mentioned (empty if none)
- "action_items": array of implied to-dos (empty if none)
- "dates_mentioned": array of dates YYYY-MM-DD (empty if none)
- "topics": array of 1-3 short topic tags (always at least one)
- "type": one of "observation", "task", "idea", "reference", "person_note"
Only extract what's explicitly there.`,
        },
        { role: "user", content: text },
      ],
    }),
  });
  try {
    const d = JSON.parse(await boundedBody(r,256000));
    return metadata(JSON.parse(d.choices[0].message.content));
  } catch {
    return { topics: ["uncategorized"], type: "observation" };
  }
}
