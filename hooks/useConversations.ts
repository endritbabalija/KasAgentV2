"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { UIMessage } from "ai";
import { useAuth } from "@/lib/auth-provider";

export interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
}

export function useConversations() {
  const queryClient = useQueryClient();
  const auth = useAuth();

  // --- Query: conversations list ---
  const { data: conversations = [], isLoading: isConversationsLoading } =
    useQuery({
      queryKey: ["conversations"],
      queryFn: async ({ signal }) => {
        const res = await fetch("/api/conversations", { signal });
        if (res.status === 401) {
          auth.handleSessionExpired();
          return [];
        }
        if (!res.ok) throw new Error("Failed to fetch conversations");
        return res.json() as Promise<ConversationSummary[]>;
      },
      enabled: auth.isAuthenticated,
    });

  // --- Mutation: save (create) conversation ---
  const saveMutation = useMutation({
    mutationFn: async (messages: UIMessage[]) => {
      const res = await fetch("/api/conversations/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      return data.conversationId as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const saveConversation = useCallback(
    async (messages: UIMessage[]): Promise<string | null> => {
      if (!auth.isAuthenticated || messages.length === 0) return null;
      try {
        return await saveMutation.mutateAsync(messages);
      } catch {
        return null;
      }
    },
    [auth.isAuthenticated, saveMutation]
  );

  // --- Mutation: delete conversation (optimistic) ---
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["conversations"] });
      const prev = queryClient.getQueryData<ConversationSummary[]>([
        "conversations",
      ]);
      queryClient.setQueryData<ConversationSummary[]>(
        ["conversations"],
        (old) => old?.filter((c) => c.id !== id) ?? []
      );
      return { prev };
    },
    onError: (_err, _id, context) => {
      if (context?.prev) {
        queryClient.setQueryData(["conversations"], context.prev);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  const deleteConversation = useCallback(
    (id: string) => {
      if (!auth.isAuthenticated) return;
      deleteMutation.mutate(id);
    },
    [auth.isAuthenticated, deleteMutation]
  );

  // --- Refresh (for external callers) ---
  const refreshConversations = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }, [queryClient]);

  return {
    conversations: auth.isAuthenticated ? conversations : [],
    isConversationsLoading,
    refreshConversations,
    saveConversation,
    deleteConversation,
  };
}
