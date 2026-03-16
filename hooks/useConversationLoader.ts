"use client";

import { useState, useEffect } from "react";
import type { UIMessage } from "ai";
import type { ExecutionRecord } from "@/components/chat/ExecutionStateContext";

interface ConversationLoaderResult {
  messages: UIMessage[];
  executionStates: Record<string, ExecutionRecord>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Given a conversation ID, loads its messages and execution states.
 * Auth comes from httpOnly cookie — no wallet param needed.
 * Uses AbortController to cancel stale fetches on rapid navigation.
 */
export function useConversationLoader(
  conversationId: string | null
): ConversationLoaderResult {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [executionStates, setExecutionStates] = useState<Record<string, ExecutionRecord>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setExecutionStates({});
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(`/api/conversations/${conversationId}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            setError("Session expired. Please reconnect your wallet.");
          } else {
            setError("Failed to load conversation");
          }
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setMessages(
          data.messages.map((m: { id: string; role: string; parts: unknown[] }) => ({
            id: m.id,
            role: m.role,
            parts: m.parts,
          }))
        );
        setExecutionStates(data.executionStates ?? {});
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("[useConversationLoader] Failed:", err);
        setError("Failed to load conversation");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [conversationId]);

  return { messages, executionStates, isLoading, error };
}
