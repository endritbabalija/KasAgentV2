"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { UIMessage } from "ai";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useInfinityPoolData } from "@/hooks/useInfinityPoolData";
import { useReconnectOnFocus } from "@/hooks/useReconnectOnFocus";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { AppContext } from "./AppContext";
import { AppHeader } from "@/components/header/AppHeader";
import { LeftRail } from "./LeftRail";
import { PortfolioSlideOut } from "./PortfolioSlideOut";
import type { ConversationSummary } from "@/hooks/useConversations";

export function AppShell({ children }: { children: React.ReactNode }) {
  useReconnectOnFocus();
  const portfolio = usePortfolio();
  const { pools } = useInfinityPoolData();
  const walletAuth = useWalletAuth();

  // --- Conversation list management ---
  // Only fetch conversations when authenticated (JWT cookie set)
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isConversationsLoading, setIsConversationsLoading] = useState(false);
  const prevAuthRef = useRef(walletAuth.isAuthenticated);

  const refreshConversations = useCallback(async () => {
    if (!walletAuth.isAuthenticated) {
      setConversations([]);
      return;
    }
    setIsConversationsLoading(true);
    try {
      // No wallet param needed — server reads from JWT cookie
      const res = await fetch("/api/conversations");
      if (res.ok) {
        setConversations(await res.json());
      } else if (res.status === 401) {
        setConversations([]);
        walletAuth.signIn();
      }
    } catch (err) {
      console.error("[AppShell] Failed to refresh conversations:", err);
    } finally {
      setIsConversationsLoading(false);
    }
  }, [walletAuth.isAuthenticated, walletAuth.signIn]);

  // Fetch conversations when auth state changes
  useEffect(() => {
    const authChanged = prevAuthRef.current !== walletAuth.isAuthenticated;
    prevAuthRef.current = walletAuth.isAuthenticated;

    if (walletAuth.isAuthenticated) {
      refreshConversations();
    } else if (authChanged) {
      setConversations([]);
    }
  }, [walletAuth.isAuthenticated, refreshConversations]);

  const saveConversation = useCallback(
    async (messages: UIMessage[]): Promise<string | null> => {
      if (!walletAuth.isAuthenticated || messages.length === 0) return null;
      try {
        const res = await fetch("/api/conversations/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages }),
        });
        if (res.ok) {
          const data = await res.json();
          refreshConversations();
          return data.conversationId;
        }
      } catch (err) {
        console.error("[AppShell] Failed to save conversation:", err);
      }
      return null;
    },
    [walletAuth.isAuthenticated, refreshConversations]
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      if (!walletAuth.isAuthenticated) return;
      try {
        // No wallet param — server reads from cookie
        const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
        if (res.ok) {
          setConversations((prev) => prev.filter((c) => c.id !== id));
        }
      } catch (err) {
        console.error("[AppShell] Failed to delete conversation:", err);
      }
    },
    [walletAuth.isAuthenticated]
  );

  // --- Panel states ---
  const [portfolioPanelOpen, setPortfolioPanelOpen] = useState(false);
  const [leftRailOpen, setLeftRailOpen] = useState(false);

  const togglePortfolio = useCallback(() => setPortfolioPanelOpen((p) => !p), []);
  const closePortfolio = useCallback(() => setPortfolioPanelOpen(false), []);
  const toggleLeftRail = useCallback(() => setLeftRailOpen((p) => !p), []);
  const closeLeftRail = useCallback(() => setLeftRailOpen(false), []);

  const portfolioPanel = useMemo(
    () => ({ isOpen: portfolioPanelOpen, toggle: togglePortfolio, close: closePortfolio }),
    [portfolioPanelOpen, togglePortfolio, closePortfolio]
  );

  const leftRail = useMemo(
    () => ({ isOpen: leftRailOpen, toggle: toggleLeftRail, close: closeLeftRail }),
    [leftRailOpen, toggleLeftRail, closeLeftRail]
  );

  const auth = useMemo(
    () => ({
      status: walletAuth.status,
      isAuthenticated: walletAuth.isAuthenticated,
      isSigning: walletAuth.isSigning,
      error: walletAuth.error,
      signIn: walletAuth.signIn,
    }),
    [walletAuth.status, walletAuth.isAuthenticated, walletAuth.isSigning, walletAuth.error, walletAuth.signIn]
  );

  const ctx = useMemo(
    () => ({
      portfolio,
      pools,
      conversations,
      isConversationsLoading,
      refreshConversations,
      saveConversation,
      deleteConversation,
      portfolioPanel,
      leftRail,
      auth,
    }),
    [
      portfolio,
      pools,
      conversations,
      isConversationsLoading,
      refreshConversations,
      saveConversation,
      deleteConversation,
      portfolioPanel,
      leftRail,
      auth,
    ]
  );

  return (
    <AppContext.Provider value={ctx}>
      <div className="h-dvh flex flex-col bg-[#0a0a0a] text-zinc-100 overflow-hidden">
        <AppHeader />
        <div className="flex-1 flex overflow-hidden">
          <LeftRail />
          <main className="flex-1 overflow-hidden">
            {/* Show signing overlay when wallet is connected but not yet authenticated */}
            {portfolio.isConnected && walletAuth.isSigning && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                  <div className="w-6 h-6 border-2 border-zinc-600 border-t-teal-400 rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-zinc-400">Sign the message in your wallet to continue...</p>
                </div>
              </div>
            )}
            {portfolio.isConnected && walletAuth.status === "error" && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-3">
                  <p className="text-sm text-red-400">{walletAuth.error}</p>
                  <button
                    onClick={walletAuth.signIn}
                    className="text-sm text-teal-400 hover:text-teal-300 underline underline-offset-2"
                  >
                    Try again
                  </button>
                </div>
              </div>
            )}
            {(!portfolio.isConnected || walletAuth.isAuthenticated) && children}
          </main>
        </div>
        <PortfolioSlideOut />
      </div>
    </AppContext.Provider>
  );
}
