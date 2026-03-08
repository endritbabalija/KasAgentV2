"use client";

import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

const components: Components = {
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-3">
      <table
        className="w-full text-sm border-collapse border border-zinc-700"
        {...props}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }) => (
    <thead className="bg-zinc-800" {...props}>
      {children}
    </thead>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border border-zinc-700 px-3 py-1.5 text-left text-zinc-300 font-medium"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-zinc-700 px-3 py-1.5 text-zinc-300" {...props}>
      {children}
    </td>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-2 last:mb-0" {...props}>
      {children}
    </p>
  ),
  ul: ({ children, ...props }) => (
    <ul className="list-disc list-inside mb-2 space-y-1" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="list-decimal list-inside mb-2 space-y-1" {...props}>
      {children}
    </ol>
  ),
  code: ({ children, className, node, ...props }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isBlock = className || (node as any)?.parent?.tagName === "pre";
    if (!isBlock) {
      return (
        <code
          className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm text-sky-400 font-mono"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="block bg-zinc-900 border border-zinc-700 rounded-lg p-3 my-2 text-sm overflow-x-auto font-mono"
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ children, ...props }) => (
    <pre className="bg-transparent p-0 m-0" {...props}>
      {children}
    </pre>
  ),
  strong: ({ children, ...props }) => (
    <strong className="font-semibold text-zinc-100" {...props}>
      {children}
    </strong>
  ),
  a: ({ children, href, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-400 hover:text-blue-300 underline"
      {...props}
    >
      {children}
    </a>
  ),
  blockquote: ({ children, ...props }) => (
    <blockquote
      className="border-l-2 border-zinc-600 pl-3 my-2 text-zinc-400 italic"
      {...props}
    >
      {children}
    </blockquote>
  ),
  hr: (props) => <hr className="border-zinc-700 my-4" {...props} />,
};

const remarkPlugins = [remarkGfm];

export const MarkdownRenderer = memo(function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="text-zinc-200 leading-relaxed">
      <ReactMarkdown remarkPlugins={remarkPlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
