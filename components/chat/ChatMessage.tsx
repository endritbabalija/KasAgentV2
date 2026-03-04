"use client";

import type { UIMessage } from "ai";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { ToolPartRenderer } from "./ToolPartRenderer";

export function ChatMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";

  // User messages: simple text bubble, right-aligned
  if (isUser) {
    const text = message.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");

    if (!text) return null;

    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-zinc-700 text-zinc-100">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    );
  }

  // Assistant messages: render parts in order (text bubbles + tool cards)
  const elements: React.ReactNode[] = [];
  let textBuffer = "";

  const flushText = () => {
    const trimmed = textBuffer.trim();
    if (trimmed) {
      elements.push(
        <div key={`text-${elements.length}`} className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 text-zinc-200">
            <MarkdownRenderer content={trimmed} />
          </div>
        </div>
      );
    }
    textBuffer = "";
  };

  for (const part of message.parts) {
    if (part.type === "text") {
      textBuffer += part.text;
    } else if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
      flushText();
      const toolPart = part as unknown as {
        toolName: string;
        state: string;
        output?: unknown;
        errorText?: string;
        toolCallId: string;
      };
      elements.push(
        <div key={toolPart.toolCallId} className="flex justify-start">
          <div className="max-w-[85%] w-full">
            <ToolPartRenderer part={toolPart} />
          </div>
        </div>
      );
    }
    // Skip other part types (reasoning, source, etc.)
  }

  // Flush any remaining text
  flushText();

  if (elements.length === 0) return null;

  return <div className="space-y-3">{elements}</div>;
}
