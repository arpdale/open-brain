import "server-only";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { synthesize } from "@/lib/synthesize";
import type { SearchResult } from "@/lib/search";
import { SynthesisError } from "@/components/synthesis-error";

type Props = {
  q: string;
  sources: SearchResult[];
};

// Renders citation tokens like [1], [1, 2], [1][2] as anchor links to #card-{N}.
// Walks each rendered text node from react-markdown, splits on the citation
// pattern, and replaces matches with <a> elements. Skips text inside <code>
// blocks because react-markdown calls a separate `code` component for those —
// our `text` renderer never sees code-block contents.
function renderTextWithCitations(value: string): (string | React.ReactNode)[] {
  // Match either [1] or [1, 2] / [1,2] — single token can hold multiple refs
  const pattern = /\[(\d+(?:\s*,\s*\d+)*)\]/g;
  const parts: (string | React.ReactNode)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push(value.slice(lastIndex, match.index));
    }
    const numbers = match[1].split(/\s*,\s*/).map((s) => parseInt(s, 10)).filter((n) => Number.isFinite(n));
    if (numbers.length === 0) {
      parts.push(match[0]);
    } else if (numbers.length === 1) {
      const n = numbers[0];
      parts.push(
        <a
          key={`cite-${key++}`}
          href={`#card-${n}`}
          className="inline-block px-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          [{n}]
        </a>,
      );
    } else {
      // [1, 2] → render each as its own anchor
      for (const n of numbers) {
        parts.push(
          <a
            key={`cite-${key++}`}
            href={`#card-${n}`}
            className="inline-block px-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            [{n}]
          </a>,
        );
      }
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
                      typeof c === "string" ? renderTextWithCitations(c).map((part, j) => (
                        typeof part === "string" ? <span key={`p-${i}-${j}`}>{part}</span> : part
                      )) : [c],
                    )
                  : typeof children === "string"
                    ? renderTextWithCitations(children)
                    : children}
              </p>
            );
          },
          li({ children, ...rest }) {
            return (
              <li {...rest}>
                {Array.isArray(children)
                  ? children.flatMap((c, i) =>
                      typeof c === "string" ? renderTextWithCitations(c).map((part, j) => (
                        typeof part === "string" ? <span key={`li-${i}-${j}`}>{part}</span> : part
                      )) : [c],
                    )
                  : typeof children === "string"
                    ? renderTextWithCitations(children)
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
