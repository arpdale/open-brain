import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  children: string;
  className?: string;
};

export function Markdown({ children, className }: Props) {
  return (
    <div
      className={
        className ??
        "text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      }
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children, ...rest }) => (
            <h1 {...rest} className="text-xl font-semibold mt-6 mb-3 text-zinc-900 dark:text-zinc-100">
              {children}
            </h1>
          ),
          h2: ({ children, ...rest }) => (
            <h2 {...rest} className="text-lg font-semibold mt-5 mb-2 text-zinc-900 dark:text-zinc-100">
              {children}
            </h2>
          ),
          h3: ({ children, ...rest }) => (
            <h3 {...rest} className="text-base font-semibold mt-4 mb-2 text-zinc-900 dark:text-zinc-100">
              {children}
            </h3>
          ),
          h4: ({ children, ...rest }) => (
            <h4 {...rest} className="text-sm font-semibold mt-3 mb-1 text-zinc-900 dark:text-zinc-100">
              {children}
            </h4>
          ),
          p: ({ children, ...rest }) => (
            <p {...rest} className="my-3">
              {children}
            </p>
          ),
          ul: ({ children, ...rest }) => (
            <ul {...rest} className="list-disc pl-6 my-3 space-y-1">
              {children}
            </ul>
          ),
          ol: ({ children, ...rest }) => (
            <ol {...rest} className="list-decimal pl-6 my-3 space-y-1">
              {children}
            </ol>
          ),
          li: ({ children, ...rest }) => (
            <li {...rest} className="leading-relaxed">
              {children}
            </li>
          ),
          a: ({ children, href, ...rest }) => (
            <a
              {...rest}
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {children}
            </a>
          ),
          code: ({ children, className, ...rest }) => {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              return (
                <code {...rest} className={className}>
                  {children}
                </code>
              );
            }
            return (
              <code
                {...rest}
                className="rounded bg-zinc-100 px-1 py-0.5 text-xs font-mono text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {children}
              </code>
            );
          },
          pre: ({ children, ...rest }) => (
            <pre
              {...rest}
              className="rounded bg-zinc-900 text-zinc-100 p-3 overflow-x-auto text-xs my-3 dark:bg-zinc-950 dark:border dark:border-zinc-800"
            >
              {children}
            </pre>
          ),
          blockquote: ({ children, ...rest }) => (
            <blockquote
              {...rest}
              className="border-l-4 border-zinc-300 pl-3 my-3 italic text-zinc-600 dark:border-zinc-600 dark:text-zinc-400"
            >
              {children}
            </blockquote>
          ),
          hr: ({ ...rest }) => (
            <hr {...rest} className="border-zinc-200 my-4 dark:border-zinc-700" />
          ),
          table: ({ children, ...rest }) => (
            <div className="my-3 overflow-x-auto">
              <table {...rest} className="w-full text-sm border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children, ...rest }) => (
            <thead {...rest} className="bg-zinc-50 dark:bg-zinc-800">
              {children}
            </thead>
          ),
          th: ({ children, ...rest }) => (
            <th
              {...rest}
              className="border border-zinc-200 px-2 py-1 text-left font-medium dark:border-zinc-700"
            >
              {children}
            </th>
          ),
          td: ({ children, ...rest }) => (
            <td {...rest} className="border border-zinc-200 px-2 py-1 align-top dark:border-zinc-700">
              {children}
            </td>
          ),
          strong: ({ children, ...rest }) => (
            <strong {...rest} className="font-semibold">
              {children}
            </strong>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
