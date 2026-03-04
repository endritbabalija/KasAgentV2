"use client";

import type { UIMessage } from "ai";
import { MarkdownRenderer } from "./MarkdownRenderer";

function getTextContent(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function ChatMessage({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = getTextContent(message);

  if (!text) return null;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-zinc-700 text-zinc-100"
            : "bg-zinc-800/50 border border-zinc-700/50 text-zinc-200"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">{text}</p>
        ) : (
          <MarkdownRenderer content={text} />
        )}
      </div>
    </div>
  );
}
