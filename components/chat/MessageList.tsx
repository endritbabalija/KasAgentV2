"use client";

import { useEffect, useRef, useMemo } from "react";
import type { UIMessage } from "ai";
import { ChatMessage } from "./ChatMessage";
import { QuickActions } from "./QuickActions";
import { getQuickActions, type QuickAction } from "@/lib/ai/quick-actions";

interface MessageListProps {
  messages: UIMessage[];
  isWaiting: boolean;
  error: Error | undefined;
  onSendMessage: (text: string) => void;
}

export function MessageList({
  messages,
  isWaiting,
  error,
  onSendMessage,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
        if (raw.state === "result" && raw.output) {
          actions.push(...getQuickActions(toolName, raw.output));
        }
      }
    }
    return actions;
  }, [messages, isWaiting]);

  return (
    <div className="flex-1 overflow-y-auto pt-6 pb-2">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 space-y-4">
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
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
              Something went wrong. Please try again.
            </p>
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
