import type {Env} from "./types";
import {boundedBody} from './security';
type ExtractedMeta = {
  type: string;
  category: string | null;
  people: string[];
  action_items: string[];
  dates_mentioned: string[];
};

const SYSTEM_PROMPT = `Extract structured metadata from the user's captured thought. Return ONLY a single JSON object, no markdown or backticks.

Schema:
{
  "type": one of "decision", "person_note", "insight", "meeting_note", "idea", "task", "reference", "note",
  "category": short topic area (e.g. "career", "product", "health", "consulting", "design") or null,
  "people": array of person names mentioned (empty array if none),
  "action_items": array of any action items or next steps (empty array if none),
  "dates_mentioned": array of dates in YYYY-MM-DD format (empty array if none)
}

Do not include a "topics" field. Only extract what's explicitly there. If unsure on type, use "note".`;

export async function extractSlack(env:Env,text: string): Promise<ExtractedMeta> {
  const fallback: ExtractedMeta = {
    type: "note",
    category: null,
    people: [],
    action_items: [],
    dates_mentioned: [],
  };

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
        signal:AbortSignal.timeout(45000),
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });
    if (!r.ok) return fallback;
    const d = JSON.parse(await boundedBody(r,256000));
    const raw = d.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<ExtractedMeta> & {
      topics?: unknown;
    };

    // Defensive: never let `topics` leak through (locked decision).
    delete parsed.topics;

    return {
      type: typeof parsed.type === "string" ? parsed.type : "note",
      category: typeof parsed.category === "string" ? parsed.category : null,
      people: Array.isArray(parsed.people) ? parsed.people.filter((p): p is string => typeof p === "string") : [],
      action_items: Array.isArray(parsed.action_items) ? parsed.action_items.filter((a): a is string => typeof a === "string") : [],
      dates_mentioned: Array.isArray(parsed.dates_mentioned) ? parsed.dates_mentioned.filter((d): d is string => typeof d === "string") : [],
    };
  } catch {
    return fallback;
  }
}
