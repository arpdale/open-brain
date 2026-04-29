import "server-only";
import { buildAskPrompt } from "@/lib/ask-prompt";
import type { SearchResult } from "@/lib/search";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";
const TIMEOUT_MS = 20_000;

export class SynthesisTimeoutError extends Error {
  constructor() {
    super(`Synthesis timed out after ${TIMEOUT_MS}ms`);
    this.name = "SynthesisTimeoutError";
  }
}

export class OpenRouterRateLimitError extends Error {
  constructor() {
    super("OpenRouter rate limit (429)");
    this.name = "OpenRouterRateLimitError";
  }
}

export class SynthesisMalformedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SynthesisMalformedError";
  }
}

export async function synthesize(query: string, sources: SearchResult[]): Promise<string> {
  if (sources.length === 0) {
    return "No thoughts in your brain match this question.";
  }

  const orKey = process.env.OPENROUTER_API_KEY;
  if (!orKey) {
    throw new SynthesisMalformedError("OPENROUTER_API_KEY missing");
  }

  const { system, user } = buildAskPrompt(query, sources);

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${orKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new SynthesisTimeoutError();
    }
    throw err;
  }

  if (response.status === 429) {
    throw new OpenRouterRateLimitError();
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new SynthesisMalformedError(`OpenRouter ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new SynthesisMalformedError("OpenRouter response missing content");
  }
  return content.trim();
}
