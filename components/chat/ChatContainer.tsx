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
import { useAuth } from "@/lib/auth-provider";
import { useExecutionPersistence } from "@/hooks/useExecutionPersistence";
import { useStrategyAutoContinue } from "@/hooks/useStrategyAutoContinue";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { WelcomeScreen } from "./WelcomeScreen";
import {
  ExecutionStateContext,
  type ExecutionRecord,
} from "./ExecutionStateContext";

interface ChatContainerProps {
  conversationId: string;
  portfolio: Portfolio;
  pools: InfinityPoolInfo[];
  initialMessages: UIMessage[];
  initialExecutionStates: Record<string, ExecutionRecord>;
  onFirstSubmit?: () => void;
  onFinish?: () => void;
  onMessagesChange?: (messages: UIMessage[]) => void;
  initialInput?: string;
}

export function ChatContainer({
  conversationId,
  portfolio,
  pools,
  initialMessages,
  initialExecutionStates,
  onFirstSubmit,
  onFinish,
  onMessagesChange,
  initialInput,
}: ChatContainerProps) {
  const { getTokenSymbol, tokenMap } = useTokenRegistry();
  const { handleSessionExpired } = useAuth();
  const getTokenDecimals = useCallback(
    (address: string): number =>
      tokenMap.get(address.toLowerCase())?.decimals ?? 18,
    [tokenMap]
  );

  // Refs for portfolio/pools so prepareSendMessagesRequest always has latest
  const portfolioRef = useRef<SerializedPortfolio | null>(null);
  const poolsRef = useRef<SerializedInfinityPool[]>([]);

  useEffect(() => {
    portfolioRef.current =
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
        : null;
    poolsRef.current = serializeInfinityPools(pools);
  }, [portfolio, pools, getTokenSymbol, getTokenDecimals]);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ messages, trigger }) => {
          const lastMessage = messages[messages.length - 1];
          return {
            body: {
              conversationId,
              message: lastMessage,
              portfolio: portfolioRef.current,
              infinityPools: poolsRef.current,
              trigger,
            },
          };
        },
      })
  );

  // Refs to avoid stale closures
  const messagesRef = useRef<UIMessage[]>(initialMessages);
  const sendMessageRef = useRef<(opts: { text: string }) => void>(null!);
  const statusRef = useRef<string>("ready");
  const executionStatesRef = useRef<Record<string, ExecutionRecord>>(
    initialExecutionStates
  );

  // Strategy auto-continue
  const { onExecutionSuccess } = useStrategyAutoContinue({
    messagesRef,
    sendMessageRef,
    statusRef,
    executionStatesRef,
    portfolioRefetch: portfolio.refetch,
    portfolioIsFetching: portfolio.isFetching,
  });

  // Execution state persistence — conversationId is always known
  const { executionStates, executionCtx } = useExecutionPersistence({
    initialStates: initialExecutionStates,
    activeConversationId: conversationId,
    onSuccess: onExecutionSuccess,
  });

  const { messages, status, error, stop, sendMessage, regenerate } = useChat({
    id: conversationId,
    transport,
    messages: initialMessages,
    onFinish: () => {
      onFinish?.();
    },
    onError: () => {
      // No-op — persistence is handled server-side
    },
  });

  // Detect auth expiry from chat API 401 errors
  useEffect(() => {
    if (!error) return;
    const msg = error.message || String(error);
    if (msg.includes("401") || msg.includes("Authentication required")) {
      handleSessionExpired();
    }
  }, [error, handleSessionExpired]);

  // Keep refs and parent in sync
  useEffect(() => {
    messagesRef.current = messages;
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  useEffect(() => {
    sendMessageRef.current = sendMessage;
    statusRef.current = status;
    executionStatesRef.current = executionStates;
  }, [sendMessage, status, executionStates]);

  // Auto-send initialInput on mount (used by feed card actions)
  const initialInputSentRef = useRef(false);
  useEffect(() => {
    if (initialInput && !initialInputSentRef.current) {
      initialInputSentRef.current = true;
      onFirstSubmit?.();
      sendMessage({ text: initialInput });
    }
  }, [initialInput, sendMessage, onFirstSubmit]);

  const isLoading = status === "submitted" || status === "streaming";
  const isWaiting = status === "submitted";
  const hasMessages = messages.length > 0;

  const handleSuggestionClick = (suggestion: string) => {
    onFirstSubmit?.();
    sendMessage({ text: suggestion });
  };

  const handleSubmit = (text: string) => {
    if (text.trim()) {
      onFirstSubmit?.();
      sendMessage({ text: text.trim() });
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
