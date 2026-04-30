import "server-only";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { synthesize } from "@/lib/synthesize";
import type { SearchResult } from "@/lib/search";
import { SynthesisError } from "@/components/synthesis-error";

type Props = {
  q: string;
  sources: SearchResult[];
};

// Renders citation tokens like [1], [1, 2], [1][2] as Next links to the
// detail page of the cited thought. Out-of-range numbers (LLM hallucinated
// citation) fall back to plaintext.
function renderTextWithCitations(
  value: string,
  sources: SearchResult[],
): (string | React.ReactNode)[] {
  const pattern = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const linkFor = (n: number) => {
    const src = sources[n - 1];
    if (!src) return null;
    return (
      <Link
        key={`cite-${key++}`}
        href={`/t/${src.id}`}
        prefetch={false}
        className="inline-block px-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
      >
        [{n}]
      </Link>
    );
  };

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push(value.slice(lastIndex, match.index));
    }
    const numbers = match[1]
      .split(/\s*,\s*/)
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isFinite(n));

    const rendered: React.ReactNode[] = [];
    for (const n of numbers) {
      const node = linkFor(n);
      if (node) rendered.push(node);
    }
    if (rendered.length === 0) {
      parts.push(match[0]); // out-of-range — keep literal text
    } else {
      parts.push(...rendered);
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < value.length) {
    parts.push(value.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [value];
}

export async function SynthesisAnswer({ q, sources }: Props) {
  let answer: string;
  try {
    answer = await synthesize(q, sources);
  } catch (err) {
    return <SynthesisError reason={(err as Error).name} />;
  }

  return (
    <article className="prose prose-sm max-w-none rounded-lg border border-zinc-200 bg-white p-5 dark:prose-invert dark:border-zinc-800 dark:bg-zinc-900">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Replace [N] / [N, M] tokens in plain text with anchor links. Code
          // blocks render via the separate `code` renderer below, which leaves
          // their contents untouched.
          p({ children, ...rest }) {
            return (
              <p {...rest}>
                {Array.isArray(children)
                  ? children.flatMap((c, i) =>
                      typeof c === "string" ? renderTextWithCitations(c, sources).map((part, j) => (
                        typeof part === "string" ? <span key={`p-${i}-${j}`}>{part}</span> : part
                      )) : [c],
                    )
                  : typeof children === "string"
                    ? renderTextWithCitations(children, sources)
                    : children}
              </p>
            );
          },
          li({ children, ...rest }) {
            return (
              <li {...rest}>
                {Array.isArray(children)
                  ? children.flatMap((c, i) =>
                      typeof c === "string" ? renderTextWithCitations(c, sources).map((part, j) => (
                        typeof part === "string" ? <span key={`li-${i}-${j}`}>{part}</span> : part
                      )) : [c],
                    )
                  : typeof children === "string"
                    ? renderTextWithCitations(children, sources)
                    : children}
              </li>
            );
          },
        }}
      >
        {answer}
      </ReactMarkdown>
    </article>
  );
}
