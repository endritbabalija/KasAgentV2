"use client";

import { useState, useEffect, useCallback } from "react";
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
 */
export function useConversationLoader(
  conversationId: string | null
): ConversationLoaderResult {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [executionStates, setExecutionStates] = useState<Record<string, ExecutionRecord>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setExecutionStates({});
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      // No wallet param — server reads from JWT cookie
      const res = await fetch(`/api/conversations/${conversationId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(
          data.messages.map((m: { id: string; role: string; parts: unknown[] }) => ({
            id: m.id,
            role: m.role,
            parts: m.parts,
          }))
        );
        setExecutionStates(data.executionStates ?? {});
      } else if (res.status === 401) {
        setError("Session expired. Please reconnect your wallet.");
      } else {
        setError("Failed to load conversation");
      }
    } catch (err) {
      console.error("[useConversationLoader] Failed:", err);
      setError("Failed to load conversation");
    } finally {
      setIsLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  return { messages, executionStates, isLoading, error };
}
