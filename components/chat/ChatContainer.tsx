"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import type { Portfolio } from "@/hooks/usePortfolio";
import type { InfinityPoolInfo } from "@/hooks/useInfinityPoolData";
import {
  serializePortfolio,
  serializeInfinityPools,
  type SerializedPortfolio,
  type SerializedInfinityPool,
} from "@/lib/ai/serializers";
import { useTokenRegistry } from "@/hooks/useTokenRegistry";
import { useExecutionPersistence } from "@/hooks/useExecutionPersistence";
import { useStrategyAutoContinue } from "@/hooks/useStrategyAutoContinue";
import { AlertTriangle } from "lucide-react";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { WelcomeScreen } from "./WelcomeScreen";
import {
  ExecutionStateContext,
  type ExecutionRecord,
} from "./ExecutionStateContext";

interface ChatContainerProps {
  portfolio: Portfolio;
  pools: InfinityPoolInfo[];
  initialMessages: UIMessage[];
  initialExecutionStates: Record<string, ExecutionRecord>;
  activeConversationId: string | null;
  onConversationSaved: (messages: UIMessage[]) => void;
  onMessagesChange?: (messages: UIMessage[]) => void;
  saveError: string | null;
  /** If provided, automatically sends this text on mount. Used by feed card actions. */
  initialInput?: string;
}

/**
 * Closure-based mutable store for the transport body.
 */
function createBodyStore() {
  let portfolio: SerializedPortfolio | null = null;
  let pools: SerializedInfinityPool[] = [];

  return {
    update(p: SerializedPortfolio | null, pl: SerializedInfinityPool[]) {
      portfolio = p;
      pools = pl;
    },
    getBody() {
      return {
        portfolio,
        infinityPools: pools,
      };
    },
  };
}

// This component is keyed by chatLoadKey in page.tsx.
// Changing the key remounts it, which resets useChat with fresh initialMessages.
// No manual reset effects needed.

export function ChatContainer({
  portfolio,
  pools,
  initialMessages,
  initialExecutionStates,
  activeConversationId,
  onConversationSaved,
  onMessagesChange,
  saveError,
  initialInput,
}: ChatContainerProps) {
  const { getTokenSymbol, tokenMap } = useTokenRegistry();
  const getTokenDecimals = useCallback(
    (address: string): number =>
      tokenMap.get(address.toLowerCase())?.decimals ?? 18,
    [tokenMap]
  );

  const [bodyStore] = useState(createBodyStore);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: bodyStore.getBody,
      })
  );

  // Refs to avoid stale closures
  const messagesRef = useRef<UIMessage[]>(initialMessages);
  const onSavedRef = useRef(onConversationSaved);
  const sendMessageRef = useRef<(opts: { text: string }) => void>(null!);
  const statusRef = useRef<string>("ready");
  const executionStatesRef = useRef<Record<string, ExecutionRecord>>(initialExecutionStates);
  // Guard: set to true once onFinish/onError saves, so beforeunload beacon is skipped
  const savedByFinishRef = useRef(false);

  useEffect(() => {
    onSavedRef.current = onConversationSaved;
  }, [onConversationSaved]);

  // Strategy auto-continue
  const { onExecutionSuccess } = useStrategyAutoContinue({
    messagesRef,
    sendMessageRef,
    statusRef,
    executionStatesRef,
    portfolioRefetch: portfolio.refetch,
    portfolioIsFetching: portfolio.isFetching,
  });

  // Execution state persistence
  const { executionStates, executionCtx } = useExecutionPersistence({
    initialStates: initialExecutionStates,
    activeConversationId,
    onSuccess: onExecutionSuccess,
  });

  const { messages, status, error, stop, sendMessage, regenerate } = useChat({
    transport,
    messages: initialMessages,
    onFinish: ({ messages: allMessages }) => {
      savedByFinishRef.current = true;
      onConversationSaved(allMessages);
    },
    onError: () => {
      if (messagesRef.current.length > 0) {
        savedByFinishRef.current = true;
        onSavedRef.current(messagesRef.current);
      }
    },
  });

  // Keep refs and parent in sync
  useEffect(() => {
    messagesRef.current = messages;
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
    statusRef.current = status;
    executionStatesRef.current = executionStates;
    // Reset save guard when a new request starts, so beforeunload works for new messages
    if (status === "submitted") {
      savedByFinishRef.current = false;
    }
  }, [sendMessage, status, executionStates]);

  // Auto-send initialInput on mount (used by feed card actions)
  const initialInputSentRef = useRef(false);
  useEffect(() => {
    if (initialInput && !initialInputSentRef.current) {
      initialInputSentRef.current = true;
      sendMessage({ text: initialInput });
    }
  }, [initialInput, sendMessage]);

  // Save on tab close / navigation (skip if onFinish/onError already saved)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (savedByFinishRef.current) return;
      if (messagesRef.current.length > 0 && portfolio.address) {
        // Auth comes from httpOnly cookie (auto-sent with sendBeacon)
        const payload = JSON.stringify({
          conversationId: activeConversationId,
          messages: messagesRef.current,
        });
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/conversations/save", blob);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [portfolio.address, activeConversationId]);

  // Sync latest data for the transport body closure
  useEffect(() => {
    bodyStore.update(
      portfolio.isConnected && portfolio.address
        ? serializePortfolio(
            portfolio.address,
            portfolio.balances,
            portfolio.lpPositions,
            portfolio.farmPositions,
            portfolio.farmGlobals,
            portfolio.stakingPositions,
            getTokenSymbol,
            getTokenDecimals
          )
        : null,
      serializeInfinityPools(pools)
    );
  }, [portfolio.isConnected, portfolio.address, portfolio.balances, portfolio.lpPositions, portfolio.farmPositions, portfolio.farmGlobals, portfolio.stakingPositions, pools, bodyStore, getTokenSymbol, getTokenDecimals]);

  const isLoading = status === "submitted" || status === "streaming";
  const isWaiting = status === "submitted";
  const hasMessages = messages.length > 0;

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({ text: suggestion });
  };

  const handleSubmit = (text: string) => {
    if (text.trim()) {
      sendMessage({ text: text.trim() });
    }
  };

  const handleRetrySave = () => {
    if (messages.length > 0) {
      onConversationSaved(messages);
    }
  };

  return (
    <ExecutionStateContext.Provider value={executionCtx}>
      <div className="flex flex-col h-full">
        {hasMessages ? (
          <>
            <MessageList
              messages={messages}
              isWaiting={isWaiting}
              isStreaming={status === "streaming"}
              error={error}
              onSendMessage={handleSuggestionClick}
              onRetry={regenerate}
            />
            {saveError && (
              <div className="mx-3 sm:mx-4 mb-1 max-w-3xl self-center w-full py-2 px-3 bg-amber-950/50 border border-amber-700/50 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <p className="text-sm text-amber-400 flex-1">
                  {saveError}
                </p>
                <button
                  onClick={handleRetrySave}
                  className="text-sm text-amber-400 hover:text-amber-300 underline underline-offset-2 font-medium shrink-0"
                >
                  Retry
                </button>
              </div>
            )}
            <ChatInput
              onSubmit={handleSubmit}
              onStop={stop}
              isLoading={isLoading}
              isConnected={portfolio.isConnected}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col">
            <div className="flex-1" />
            <WelcomeScreen
              isConnected={portfolio.isConnected}
              onSuggestionClick={handleSuggestionClick}
              hasBalances={portfolio.balances.length > 0}
              hasPositions={
                portfolio.lpPositions.length > 0 ||
                portfolio.farmPositions.length > 0 ||
                portfolio.stakingPositions.some((s) => s.xTokenBalance > 0n)
              }
            />
            <ChatInput
              onSubmit={handleSubmit}
              onStop={stop}
              isLoading={isLoading}
              isConnected={portfolio.isConnected}
            />
          </div>
        )}
      </div>
    </ExecutionStateContext.Provider>
  );
}
