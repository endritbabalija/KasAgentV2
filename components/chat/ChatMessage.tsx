"use client";

import { memo } from "react";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { parseToolPart } from "@/lib/ui/parse-tool-part";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { AnimatedMarkdown } from "./AnimatedMarkdown";
import { ToolPartRenderer } from "./ToolPartRenderer";

interface ChatMessageProps {
  message: ChatMessageType;
  isLastAssistant: boolean;
  isStreaming: boolean;
}

export const ChatMessage = memo(
  function ChatMessage({
    message,
    isLastAssistant,
    isStreaming,
  }: ChatMessageProps) {
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
          <div className="max-w-[95%] sm:max-w-[85%] rounded-2xl px-4 py-3 bg-teal-900/60 border border-teal-700/40 text-zinc-100 min-w-0">
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</p>
          </div>
        </div>
      );
    }

    // Assistant messages: render parts in order (text bubbles + tool cards)
    const elements: React.ReactNode[] = [];
    let textBuffer = "";

    const flushText = (isLast: boolean) => {
      const trimmed = textBuffer.trim();
      if (trimmed) {
        // Only animate the last text block of the last assistant message while streaming
        const shouldAnimate = isLastAssistant && isStreaming && isLast;
        elements.push(
          <div key={`text-${elements.length}`} className="flex justify-start">
            <div className="max-w-[95%] sm:max-w-[85%] rounded-2xl px-4 py-3 bg-zinc-800/50 border border-zinc-700/50 text-zinc-200 min-w-0">
              {shouldAnimate ? (
                <AnimatedMarkdown content={trimmed} />
              ) : (
                <MarkdownRenderer content={trimmed} />
              )}
            </div>
          </div>
        );
      }
      textBuffer = "";
    };

    for (const part of message.parts) {
      if (part.type === "text") {
        textBuffer += part.text;
      } else {
        const tp = parseToolPart(part);
        if (tp) {
          flushText(false);
          elements.push(
            <div key={tp.toolCallId} className="flex justify-start">
              <div className="max-w-[95%] sm:max-w-[85%] w-full">
                <ToolPartRenderer part={tp} />
              </div>
            </div>
          );
        }
      }
    }

    // Flush any remaining text — this is the last text block
    flushText(true);

    if (elements.length === 0) return null;

    return (
      <div className={elements.length > 1 ? "space-y-3 border-l-2 border-zinc-700/50 pl-3" : "space-y-3"}>
        {elements}
      </div>
    );
  },
  // Custom comparator: skip re-render for non-last messages when only isStreaming changes
  (prev, next) => {
    if (prev.message !== next.message) return false;
    if (prev.isLastAssistant !== next.isLastAssistant) return false;
    // Only care about isStreaming changes for the last assistant message
    if (next.isLastAssistant && prev.isStreaming !== next.isStreaming) return false;
    return true;
  }
);
