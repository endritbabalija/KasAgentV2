"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import type { UIMessage } from "ai";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useInfinityPoolData } from "@/hooks/useInfinityPoolData";
import { useConversations } from "@/hooks/useConversations";
import { useAuth } from "@/lib/auth-provider";
import { useConversationLoader } from "@/hooks/useConversationLoader";
import { useFeedInsights } from "@/hooks/useFeedInsights";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { FeedContainer } from "@/components/feed/FeedContainer";

export default function ChatPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ path?: string[] }>();
  const portfolio = usePortfolio();
  const { pools } = useInfinityPoolData();
  const { saveConversation } = useConversations();
  const auth = useAuth();

  // ── Extract conversation ID from catch-all params ──
  // "/" → params.path = undefined → null
  // "/c/abc123" → params.path = ['c', 'abc123'] → 'abc123'
  const conversationId =
    params.path?.[0] === "c" && params.path?.[1] ? params.path[1] : null;

  // ── Chat session key: controls ChatContainer remounting ──
  // Changes = ChatContainer remounts (useChat resets).
  // Must NOT change during the save transition (/ → /c/[id]).
  const [chatSessionKey, setChatSessionKey] = useState<string>(
    () => conversationId ?? `new-${Date.now()}`
  );

  // Distinguishes "I just saved this" from "user navigated externally"
  const justSavedIdRef = useRef<string | null>(null);
  // Prevents the conversationId effect from firing on initial mount
  // (useState initializer already set the correct key)
  const isInitialMountRef = useRef(true);

  // ── savedId: set after first save of a new conversation ──
  const [savedId, setSavedId] = useState<string | null>(null);
  // activeConvoId: the conversation ID passed to ChatContainer
  // For new chats: null until saved, then the saved ID
  // For existing chats: the conversationId from URL
  const activeConvoId = conversationId ?? savedId;

  // ── Determine whether to load conversation from DB ──
  // Load when chatSessionKey === conversationId (external nav or cold load).
  // Skip when they differ (new chat or just-saved redirect).
  const shouldLoadFromDb =
    conversationId !== null && chatSessionKey === conversationId;

  const {
    messages: loadedMessages,
    executionStates: loadedExecutionStates,
    isLoading,
    error,
  } = useConversationLoader(shouldLoadFromDb ? conversationId : null);

  // ── React to URL-driven conversationId changes ──
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return; // useState initializer already set the correct key
    }

    if (conversationId === null) {
      // Navigated to "/" (New Chat or browser back)
      setChatSessionKey(`new-${Date.now()}`);
      justSavedIdRef.current = null;
      setSavedId(null);
      setFeedPrompt(null);
      return;
    }

    if (justSavedIdRef.current === conversationId) {
      // Save-redirect: URL changed but messages are already in memory.
      // Do NOT change chatSessionKey — ChatContainer stays mounted.
      justSavedIdRef.current = null;
      return;
    }

    // External navigation (sidebar click, browser back/forward to a convo)
    setChatSessionKey(conversationId);
    setSavedId(null);
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Redirect from conversation URLs when not authenticated ──
  useEffect(() => {
    if (conversationId && !auth.isAuthenticated && auth.status !== "loading") {
      router.replace("/");
    }
  }, [conversationId, auth.isAuthenticated, auth.status, router]);

  // ── Save error state ──
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Feed state ──
  const [hasMessages, setHasMessages] = useState(false);
  const [feedPrompt, setFeedPrompt] = useState<string | null>(null);
  const showFeed = conversationId === null && !hasMessages && !feedPrompt;

  const { insights, isLoading: feedLoading } = useFeedInsights(portfolio, pools);

  // ── Conversation save handler ──
  // Tracks whether we've saved in this chat session (prevents duplicate creates)
  const savedIdRef = useRef<string | null>(null);

  const handleConversationSaved = useCallback(
    async (messages: UIMessage[]) => {
      if (messages.length === 0) return;

      // Already saved in this session — fire-and-forget update
      if (savedIdRef.current) {
        fetch("/api/conversations/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: savedIdRef.current,
            messages,
          }),
        }).catch(() => {});
        return;
      }

      // Existing conversation loaded from DB — update with error handling
      if (conversationId) {
        try {
          const res = await fetch("/api/conversations/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId, messages }),
          });
          if (!res.ok)
            setSaveError(
              "Failed to save conversation. Your messages may not persist."
            );
          else setSaveError(null);
        } catch {
          setSaveError(
            "Failed to save conversation. Your messages may not persist."
          );
        }
        savedIdRef.current = conversationId;
        return;
      }

      // New conversation — create, then update URL without remounting
      const id = await saveConversation(messages);
      if (id) {
        savedIdRef.current = id;
        justSavedIdRef.current = id; // Flag BEFORE navigation
        setSavedId(id); // Triggers re-render → child flush → parent navigate
      }
    },
    [saveConversation, conversationId]
  );

  // ── Navigate after save (parent effect — fires AFTER child effects) ──
  // React's depth-first effect ordering ensures useExecutionPersistence's
  // flush effect (inside ChatContainer) fires before this navigation effect.
  useEffect(() => {
    if (savedId && justSavedIdRef.current === savedId && pathname === "/") {
      router.replace(`/c/${savedId}`);
    }
  }, [savedId, pathname, router]);

  // ── Callbacks ──
  const handleMessagesChange = useCallback((msgs: UIMessage[]) => {
    setHasMessages(msgs.length > 0);
  }, []);

  const handleFeedAction = useCallback((prompt: string) => {
    setFeedPrompt(prompt);
    setChatSessionKey(`feed-${Date.now()}`);
  }, []);

  // ── Reset per-session state when chat session changes ──
  useEffect(() => {
    savedIdRef.current = null;
    setSaveError(null);
  }, [chatSessionKey]);

  // ── Render: loading/error for DB-loaded conversations ──
  if (shouldLoadFromDb && isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (shouldLoadFromDb && error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-sm text-red-400 mb-2">{error}</p>
          <a
            href="/"
            className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2"
          >
            Go back
          </a>
        </div>
      </div>
    );
  }

  // ── ChatContainer props based on mode ──
  const initialMessages = shouldLoadFromDb ? loadedMessages : [];
  const initialExecutionStates = shouldLoadFromDb ? loadedExecutionStates : {};

  return (
    <div className="flex flex-col h-full">
      {/* Feed insights — only on "/" with no active chat */}
      {showFeed && (
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="flex-1" />
          {portfolio.isConnected && auth.isAuthenticated && (
            <FeedContainer
              insights={insights}
              isLoading={feedLoading}
              onAction={handleFeedAction}
            />
          )}
        </div>
      )}

      {/* ChatContainer — keyed by chatSessionKey, NOT by conversationId */}
      <div className={showFeed ? "" : "flex-1 overflow-hidden"}>
        <ChatContainer
          key={chatSessionKey}
          portfolio={portfolio}
          pools={pools}
          initialMessages={initialMessages}
          initialExecutionStates={initialExecutionStates}
          activeConversationId={activeConvoId}
          onConversationSaved={handleConversationSaved}
          onMessagesChange={handleMessagesChange}
          saveError={saveError}
          initialInput={feedPrompt ?? undefined}
        />
      </div>
    </div>
  );
}
