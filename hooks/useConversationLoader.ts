"use client";

import { useQuery } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import type { ExecutionRecord } from "@/components/chat/ExecutionStateContext";

interface ConversationData {
  messages: UIMessage[];
  executionStates: Record<string, ExecutionRecord>;
}

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
  const { data, isLoading, error } = useQuery<ConversationData>({
    queryKey: ["conversation", conversationId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        signal,
      });
      if (res.status === 401) {
        throw new Error("Session expired. Please reconnect your wallet.");
      }
      if (!res.ok) {
        throw new Error("Failed to load conversation");
      }
      const raw = await res.json();
      return {
        messages: raw.messages.map(
          (m: { id: string; role: string; parts: unknown[] }) => ({
            id: m.id,
            role: m.role,
            parts: m.parts,
          })
        ),
        executionStates: raw.executionStates ?? {},
      };
    },
    enabled: !!conversationId,
    staleTime: Infinity, // conversation content doesn't go stale while viewing
    retry: false, // match current behavior: no retries on 401/error
  });

  return {
    messages: data?.messages ?? [],
    executionStates: data?.executionStates ?? {},
    isLoading,
    error: error ? (error as Error).message : null,
  };
}
