// Ask-mode prompt template + per-source truncation.
//
// Truncation is character-based (1500 chars/source). For long thoughts with
// frontmatter (e.g., ChatGPT exports starting with "Source: ... Extracted: ..."),
// the first 1500 chars may be mostly metadata. v1.5: detect a `---` separator
// and skip past it before truncating.

import type { SearchResult } from "@/lib/search";

const TRUNCATE_CHARS = 1500;

export function truncate(content: string, max = TRUNCATE_CHARS): string {
  const trimmed = content.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  // Back up to the previous space if cut falls mid-word
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > max * 0.8 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

export function buildAskPrompt(query: string, sources: SearchResult[]): { system: string; user: string } {
  const numbered = sources
    .map((s, i) => `[${i + 1}] ${truncate(s.content)}`)
    .join("\n\n");

  const system = `You are answering a question using the user's personal Open Brain — a corpus of their captured thoughts. Use ONLY the source snippets below. Cite each factual claim with [N] referring to the snippet number. If the snippets do not contain enough information to answer, say so plainly.

Sources:
${numbered}

Answer in 1–4 short paragraphs. Use Markdown. Inline-cite with [N]. If multiple sources support a single claim, cite all relevant ones, e.g. [1][3]. If you can't answer from the sources, say so directly without speculation.`;

  return { system, user: query };
}
