"use client";

import { useEffect, useRef, useCallback, useMemo } from "react";
import type { UIMessage } from "ai";
import { ChatMessage } from "./ChatMessage";
import { QuickActions } from "./QuickActions";
import { getQuickActions, type QuickAction } from "@/lib/ai/quick-actions";

interface MessageListProps {
  messages: UIMessage[];
  isWaiting: boolean;
  isStreaming: boolean;
  error: Error | undefined;
  onSendMessage: (text: string) => void;
  onRetry: () => void;
}

export function MessageList({
  messages,
  isWaiting,
  isStreaming,
  error,
  onSendMessage,
  onRetry,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  // Detect if user has scrolled away from the bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    userScrolledUp.current = distanceFromBottom > 80;
  }, []);

  useEffect(() => {
    if (!userScrolledUp.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isWaiting, error]);

  // Extract quick actions from the last assistant message's tool parts
  const quickActions = useMemo<QuickAction[]>(() => {
    if (isWaiting || messages.length === 0) return [];

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== "assistant") return [];

    const actions: QuickAction[] = [];
    for (const part of lastMsg.parts) {
      if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
        const raw = part as unknown as Record<string, unknown>;
        const toolName =
          part.type === "dynamic-tool"
            ? (raw.toolName as string)
            : part.type.split("-").slice(1).join("-");
        const output = raw.output as Record<string, unknown> | undefined;
        if (raw.state === "output-available" && output && !output.error) {
          actions.push(...getQuickActions(toolName, output));
        }
      }
    }
    return actions;
  }, [messages, isWaiting]);

  return (
    <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overflow-x-hidden pt-6 pb-2">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 space-y-4">
      {messages.map((message, i) => {
        const isLastAssistant =
          message.role === "assistant" &&
          i === messages.length - 1;
        return (
          <ChatMessage
            key={message.id}
            message={message}
            isLastAssistant={isLastAssistant}
            isStreaming={isStreaming}
          />
        );
      })}
      {isWaiting && (
        <div className="flex justify-start">
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 text-zinc-400">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
              <span className="text-sm">Thinking...</span>
            </div>
          </div>
        </div>
      )}
      {error && (
        <div className="flex justify-start">
          <div className="bg-red-950/50 border border-red-800/50 rounded-2xl px-4 py-3 max-w-[95%] sm:max-w-[85%]">
            <p className="text-sm text-red-400">
              {error.message || "Something went wrong. Please try again."}
            </p>
            <button
              onClick={onRetry}
              className="mt-1.5 text-sm text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      )}
      {quickActions.length > 0 && !isWaiting && (
        <QuickActions actions={quickActions} onSend={onSendMessage} />
      )}
      <div ref={bottomRef} />
      </div>
    </div>
  );
}
