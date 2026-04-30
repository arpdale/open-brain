// Strip common markdown syntax so a content fragment reads cleanly inside a
// small line-clamped card. Not a full Markdown parser — just enough to remove
// the visual noise (#, **, *, `, >, |, -, [text](url)) without changing the
// underlying words.

export function extractTitle(content: string): string | null {
  // Pull the first ATX heading (any level) from the body.
  const m = content.match(/^\s{0,3}#{1,6}\s+(.+)$/m);
  if (!m) return null;
  const t = m[1].trim();
  return t || null;
}

export function stripMarkdown(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, " ")              // fenced code blocks
    .replace(/`([^`]+)`/g, "$1")                  // inline code
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")     // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")      // links
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")           // ATX headings
    .replace(/^\s*>\s?/gm, "")                    // blockquote markers
    .replace(/^\s*[-*+]\s+/gm, "")                // bullet markers
    .replace(/^\s*\d+\.\s+/gm, "")                // numbered list markers
    .replace(/^\s*-{3,}\s*$/gm, "")               // hr
    .replace(/\*\*([^*]+)\*\*/g, "$1")            // bold
    .replace(/(?<![*\w])\*([^*\n]+)\*(?!\*)/g, "$1") // italic *...*
    .replace(/(?<![_\w])_([^_\n]+)_(?!_)/g, "$1")    // italic _..._
    .replace(/~~([^~]+)~~/g, "$1")                // strikethrough
    .replace(/\|/g, " ")                          // table pipes
    .replace(/\n{3,}/g, "\n\n")                   // collapse blank runs
    .trim();
}
