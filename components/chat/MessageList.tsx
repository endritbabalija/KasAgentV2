"use client";

import { useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import { ChatMessage } from "./ChatMessage";

interface MessageListProps {
  messages: UIMessage[];
  isWaiting: boolean;
  error: Error | undefined;
}

export function MessageList({ messages, isWaiting, error }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isWaiting, error]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
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
          <div className="bg-red-950/50 border border-red-800/50 rounded-2xl px-4 py-3 max-w-[85%]">
            <p className="text-sm text-red-400">
              Something went wrong. Please try again.
            </p>
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
