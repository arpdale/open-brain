// ingest-thought Edge Function
//
// Slack capture for personal Open Brain. Listens to messages in a designated
// Slack channel from the maintainer's user ID; embeds + LLM-extracts metadata;
// inserts into public.thoughts with claim-first idempotency.
//
// Auth: Slack signature verification (HMAC-SHA256, x-slack-signature).
// Idempotency: idempotency_key = "slack:<channel>:<ts>" with UNIQUE partial index.
// Background work: EdgeRuntime.waitUntil keeps the runtime alive while embedding
// + LLM extraction run in parallel after the synchronous claim insert.
//
// Required Supabase secrets: OPENROUTER_API_KEY, SLACK_BOT_TOKEN,
// SLACK_SIGNING_SECRET, SLACK_CAPTURE_CHANNEL, SLACK_CAPTURE_USER_ID.
// (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected.)

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY")!;
const SLACK_BOT_TOKEN = Deno.env.get("SLACK_BOT_TOKEN")!;
const SLACK_SIGNING_SECRET = Deno.env.get("SLACK_SIGNING_SECRET")!;
const SLACK_CAPTURE_CHANNEL = Deno.env.get("SLACK_CAPTURE_CHANNEL")!;
const SLACK_CAPTURE_USER_ID = Deno.env.get("SLACK_CAPTURE_USER_ID")!;

const EMBEDDING_PROVIDER = "openrouter";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const LLM_MODEL = "openai/gpt-4o-mini";
const REPLAY_WINDOW_SEC = 60 * 5;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// EdgeRuntime is provided by the Supabase Edge runtime.
// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: { waitUntil: (p: Promise<unknown>) => void };

// ----------------------------------------------------------------------------
// Slack signature verification
// ----------------------------------------------------------------------------

async function verifySlackSignature(req: Request, rawBody: string): Promise<boolean> {
  const ts = req.headers.get("x-slack-request-timestamp");
  const sig = req.headers.get("x-slack-signature");
  if (!ts || !sig) return false;

  const tsNum = parseInt(ts, 10);
  if (Number.isNaN(tsNum)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - tsNum) > REPLAY_WINDOW_SEC) return false;

  const baseString = `v0:${ts}:${rawBody}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(SLACK_SIGNING_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(baseString)),
  );
  const hex = Array.from(sigBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expected = `v0=${hex}`;

  // Constant-time compare
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

// ----------------------------------------------------------------------------
// OpenRouter calls
// ----------------------------------------------------------------------------

async function getEmbedding(text: string): Promise<number[]> {
  const r = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text }),
  });
  if (!r.ok) {
    const msg = await r.text().catch(() => "");
    throw new Error(`OpenRouter embeddings ${r.status}: ${msg.slice(0, 200)}`);
  }
  const d = await r.json();
  return d.data[0].embedding;
}

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

async function extractMetadata(text: string): Promise<ExtractedMeta> {
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
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        response_format: { type: "json_object" },
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      }),
    });
    if (!r.ok) return fallback;
    const d = await r.json();
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

// ----------------------------------------------------------------------------
// Slack reply
// ----------------------------------------------------------------------------

async function slackReply(channel: string, threadTs: string, text: string): Promise<void> {
  await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, thread_ts: threadTs, text }),
  });
}

function buildConfirmationText(meta: ExtractedMeta): string {
  const header = meta.category
    ? `✓ Captured as *${meta.type}* — ${meta.category}`
    : `✓ Captured as *${meta.type}*`;
  const lines = [header];
  if (meta.people.length) lines.push(`People: ${meta.people.join(", ")}`);
  if (meta.action_items.length) lines.push(`Action items: ${meta.action_items.join("; ")}`);
  if (meta.dates_mentioned.length) lines.push(`Dates: ${meta.dates_mentioned.join(", ")}`);
  return lines.join("\n");
}

// ----------------------------------------------------------------------------
// Background processing
// ----------------------------------------------------------------------------

async function processThought(
  rowId: string,
  text: string,
  channel: string,
  ts: string,
  initialMetadata: Record<string, unknown>,
): Promise<void> {
  try {
    const [embedding, meta] = await Promise.all([
      getEmbedding(text),
      extractMetadata(text),
    ]);

    const finalMetadata = {
      ...initialMetadata,
      type: meta.type,
      category: meta.category,
      people: meta.people,
      action_items: meta.action_items,
      dates_mentioned: meta.dates_mentioned,
    };

    const { error } = await supabase
      .from("thoughts")
      .update({ embedding, metadata: finalMetadata })
      .eq("id", rowId);
    if (error) throw new Error(`update failed: ${error.message}`);

    await slackReply(channel, ts, buildConfirmationText(meta));
  } catch (err) {
    console.error("processThought error:", err);
    await slackReply(
      channel,
      ts,
      "⚠️ Captured (raw text saved) but processing failed — check Edge Function logs.",
    );
  }
}

// ----------------------------------------------------------------------------
// Request handler
// ----------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  const rawBody = await req.text();

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response("invalid json", { status: 400 });
  }

  // Verify Slack signature for ALL requests, including url_verification.
  if (!(await verifySlackSignature(req, rawBody))) {
    return new Response("invalid signature", { status: 401 });
  }

  // Slack URL verification challenge (one-time, on Event Subscription setup)
  if (body.type === "url_verification") {
    return new Response(JSON.stringify({ challenge: body.challenge }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const event = body.event as Record<string, unknown> | undefined;
  if (
    !event ||
    event.type !== "message" ||
    event.subtype ||
    event.bot_id
  ) {
    return new Response("ok");
  }

  if (event.channel !== SLACK_CAPTURE_CHANNEL) return new Response("ok");
  if (event.user !== SLACK_CAPTURE_USER_ID) return new Response("ok");

  const text = typeof event.text === "string" ? event.text.trim() : "";
  if (!text) return new Response("ok");

  const channel = event.channel as string;
  const ts = event.ts as string;
  const threadTs = (event.thread_ts as string | undefined) ?? null;

  const idempotencyKey = `slack:${channel}:${ts}`;

  const initialMetadata = {
    source: "slack",
    slack_channel: channel,
    slack_user: SLACK_CAPTURE_USER_ID,
    slack_ts: ts,
    slack_thread_ts: threadTs,
    embedding_provider: EMBEDDING_PROVIDER,
    embedding_model: EMBEDDING_MODEL,
  };

  // Claim first: insert placeholder row. Unique constraint blocks duplicates.
  const { data: claimed, error: claimErr } = await supabase
    .from("thoughts")
    .insert({
      content: text,
      idempotency_key: idempotencyKey,
      metadata: initialMetadata,
    })
    .select("id")
    .single();

  if (claimErr) {
    // Unique violation = another invocation already claimed this message.
    return new Response("ok");
  }

  // Background: embedding + LLM extraction + threaded reply.
  EdgeRuntime.waitUntil(
    processThought(claimed.id, text, channel, ts, initialMetadata),
  );

  return new Response("ok");
});
