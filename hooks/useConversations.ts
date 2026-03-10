"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { UIMessage } from "ai";
import type { ExecutionRecord } from "@/components/chat/ExecutionStateContext";

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
  const [loadedExecutionStates, setLoadedExecutionStates] = useState<Record<string, ExecutionRecord>>({});
  const [activeTab, setActiveTab] = useState<SidebarTab>("portfolio");
  const [isLoading, setIsLoading] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Incremented only on user-initiated resets (new chat, load, delete active, wallet switch).
  // Used as React key on ChatContainer — changing it remounts the component.
  // saveConversation does NOT increment this, so saving won't reset the chat.
  const [chatLoadKey, setChatLoadKey] = useState(0);

  const errorTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showError = useCallback((msg: string) => {
    setError(msg);
    clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 5000);
  }, []);
  const clearError = useCallback(() => {
    setError(null);
    clearTimeout(errorTimerRef.current);
  }, []);

  const refreshConversations = useCallback(async () => {
    if (!walletAddress) {
      setConversations([]);
      return;
    }
    setIsListLoading(true);
    try {
      const res = await fetch(`/api/conversations?wallet=${walletAddress}`);
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      } else {
        showError("Failed to load conversations");
      }
    } catch (err) {
      console.error("[useConversations] Failed to refresh conversations:", err);
      showError("Failed to load conversations");
    } finally {
      setIsListLoading(false);
    }
  }, [walletAddress, showError]);

  // Fetch conversations when wallet connects/changes
  const hasAutoSwitchedRef = useRef(false);
  const prevWalletRef = useRef(walletAddress);
  useEffect(() => {
    const walletChanged = prevWalletRef.current !== walletAddress;
    prevWalletRef.current = walletAddress;

    if (walletAddress) {
      hasAutoSwitchedRef.current = false;
      refreshConversations();
      if (walletChanged) {
        // Wallet switched to a different address — reset chat
        setActiveConversationId(null);
        setLoadedMessages([]);
        setLoadedExecutionStates({});
        setChatLoadKey((k) => k + 1);
      }
    } else {
      setConversations([]);
      setActiveConversationId(null);
      setLoadedMessages([]);
      setLoadedExecutionStates({});
      setActiveTab("portfolio");
      hasAutoSwitchedRef.current = false;
      if (walletChanged) {
        setChatLoadKey((k) => k + 1);
      }
    }
  }, [walletAddress, refreshConversations]);

  // Auto-select chats tab only once on initial load when conversations exist
  useEffect(() => {
    if (walletAddress && conversations.length > 0 && !hasAutoSwitchedRef.current) {
      setActiveTab("chats");
      hasAutoSwitchedRef.current = true;
    }
  }, [walletAddress, conversations.length]);

  const createNewChat = useCallback(async (currentMessages?: UIMessage[]) => {
    // Persist in-progress conversation before resetting
    if (currentMessages && currentMessages.length > 0 && walletAddress) {
      try {
        await fetch("/api/conversations/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            conversationId: activeConversationId,
            messages: currentMessages,
          }),
        });
      } catch {}
    }
    setActiveConversationId(null);
    setLoadedMessages([]);
    setLoadedExecutionStates({});
    setSaveError(null);
    setChatLoadKey((k) => k + 1);
  }, [walletAddress, activeConversationId]);

  const loadConversation = useCallback(
    async (id: string) => {
      if (!walletAddress) return;
      setIsLoading(true);
      setSaveError(null);
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
          setLoadedExecutionStates(data.executionStates ?? {});
          setChatLoadKey((k) => k + 1);
        } else {
          showError("Failed to load conversation");
        }
      } catch (err) {
        console.error("[useConversations] Failed to load conversation:", err);
        showError("Failed to load conversation");
      } finally {
        setIsLoading(false);
      }
    },
    [walletAddress, showError]
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
            setLoadedExecutionStates({});
            setChatLoadKey((k) => k + 1);
          }
        } else {
          showError("Failed to delete conversation");
        }
      } catch (err) {
        console.error("[useConversations] Failed to delete conversation:", err);
        showError("Failed to delete conversation");
      }
    },
    [walletAddress, activeConversationId, showError]
  );

  const saveConversation = useCallback(
    async (messages: UIMessage[]) => {
      if (!walletAddress || messages.length === 0) return null;
      setSaveError(null);
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
          refreshConversations();
          return newId;
        }
        // Server returned an error status
        console.error("[useConversations] Save failed with status:", res.status);
        setSaveError("Failed to save conversation. Your messages may not persist.");
      } catch (err) {
        console.error("[useConversations] Failed to save conversation:", err);
        setSaveError("Failed to save conversation. Your messages may not persist.");
      }
      return null;
    },
    [walletAddress, activeConversationId, refreshConversations]
  );

  return {
    conversations,
    activeConversationId,
    loadedMessages,
    loadedExecutionStates,
    activeTab,
    isLoading,
    isListLoading,
    chatLoadKey,
    saveError,
    error,
    setActiveTab,
    clearError,
    createNewChat,
    loadConversation,
    deleteConversation,
    saveConversation,
    refreshConversations,
  };
}
