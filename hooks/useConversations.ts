"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { UIMessage } from "ai";

export interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
}

export type SidebarTab = "chats" | "portfolio";

export function useConversations(walletAddress: string | undefined) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadedMessages, setLoadedMessages] = useState<UIMessage[]>([]);
  const [activeTab, setActiveTab] = useState<SidebarTab>("portfolio");
  const [isLoading, setIsLoading] = useState(false);
  // Counter to force chat reset even when activeConversationId stays null
  const [chatResetKey, setChatResetKey] = useState(0);

  const refreshConversations = useCallback(async () => {
    if (!walletAddress) {
      setConversations([]);
      return;
    }
    try {
      const res = await fetch(`/api/conversations?wallet=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch {
      // silently fail
    }
  }, [walletAddress]);

  // Fetch conversations when wallet connects/changes
  const hasAutoSwitchedRef = useRef(false);
  useEffect(() => {
    if (walletAddress) {
      hasAutoSwitchedRef.current = false;
      refreshConversations();
    } else {
      setConversations([]);
      setActiveConversationId(null);
      setLoadedMessages([]);
      setActiveTab("portfolio");
      hasAutoSwitchedRef.current = false;
    }
  }, [walletAddress, refreshConversations]);

  // Auto-select chats tab only once on initial load when conversations exist
  useEffect(() => {
    if (walletAddress && conversations.length > 0 && !hasAutoSwitchedRef.current) {
      setActiveTab("chats");
      hasAutoSwitchedRef.current = true;
    }
  }, [walletAddress, conversations.length]);

  const createNewChat = useCallback(() => {
    setActiveConversationId(null);
    setLoadedMessages([]);
    setChatResetKey((k) => k + 1);
  }, []);

  const loadConversation = useCallback(
    async (id: string) => {
      if (!walletAddress) return;
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/conversations/${id}?wallet=${walletAddress}`
        );
        if (res.ok) {
          const data = await res.json();
          setActiveConversationId(id);
          setLoadedMessages(
            data.messages.map((m: { id: string; role: string; parts: unknown[] }) => ({
              id: m.id,
              role: m.role,
              parts: m.parts,
            }))
          );
        }
      } catch {
        // silently fail
      } finally {
        setIsLoading(false);
      }
    },
    [walletAddress]
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!walletAddress) return;
      try {
        const res = await fetch(
          `/api/conversations/${id}?wallet=${walletAddress}`,
          { method: "DELETE" }
        );
        if (res.ok) {
          setConversations((prev) => prev.filter((c) => c.id !== id));
          if (activeConversationId === id) {
            setActiveConversationId(null);
            setLoadedMessages([]);
          }
        }
      } catch {
        // silently fail
      }
    },
    [walletAddress, activeConversationId]
  );

  const saveConversation = useCallback(
    async (messages: UIMessage[]) => {
      if (!walletAddress || messages.length === 0) return null;
      try {
        const res = await fetch("/api/conversations/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            conversationId: activeConversationId,
            messages,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const newId = data.conversationId;
          if (!activeConversationId) {
            setActiveConversationId(newId);
          }
          // Refresh the list to get updated titles/timestamps
          refreshConversations();
          return newId;
        }
      } catch {
        // silently fail
      }
      return null;
    },
    [walletAddress, activeConversationId, refreshConversations]
  );

  return {
    conversations,
    activeConversationId,
    loadedMessages,
    activeTab,
    isLoading,
    chatResetKey,
    setActiveTab,
    createNewChat,
    loadConversation,
    deleteConversation,
    saveConversation,
    refreshConversations,
  };
}
