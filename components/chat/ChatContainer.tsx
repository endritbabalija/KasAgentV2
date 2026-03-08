"use client";

import { useEffect, useRef, useState } from "react";
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
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { WelcomeScreen } from "./WelcomeScreen";

interface ChatContainerProps {
  portfolio: Portfolio;
  pools: InfinityPoolInfo[];
  initialMessages: UIMessage[];
  activeConversationId: string | null;
  onConversationSaved: (messages: UIMessage[]) => void;
  onMessagesChange?: (messages: UIMessage[]) => void;
  saveError: string | null;
}

/**
 * Closure-based mutable store for the transport body.
 * Mutations happen to closure-scoped variables, which avoids both
 * react-hooks/refs (no useRef in render closures) and
 * react-hooks/immutability (no property writes on useState values).
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
        walletAddress: portfolio?.address,
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
  activeConversationId,
  onConversationSaved,
  onMessagesChange,
  saveError,
}: ChatContainerProps) {
  const { getTokenSymbol } = useTokenRegistry();

  const [bodyStore] = useState(createBodyStore);

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: bodyStore.getBody,
      })
  );

  // Refs to avoid stale closures in onError and beforeunload
  const messagesRef = useRef<UIMessage[]>(initialMessages);
  const onSavedRef = useRef(onConversationSaved);
  const conversationIdRef = useRef(activeConversationId);
  useEffect(() => {
    onSavedRef.current = onConversationSaved;
    conversationIdRef.current = activeConversationId;
  });

  const { messages, status, error, stop, sendMessage } = useChat({
    transport,
    messages: initialMessages,
    onFinish: ({ messages: allMessages }) => {
      onConversationSaved(allMessages);
    },
    onError: () => {
      // Save whatever messages we have when the stream errors
      if (messagesRef.current.length > 0) {
        onSavedRef.current(messagesRef.current);
      }
    },
  });

  // Keep refs and parent in sync with latest messages
  useEffect(() => {
    messagesRef.current = messages;
    onMessagesChange?.(messages);
  }, [messages, onMessagesChange]);

  // Save on tab close / navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (messagesRef.current.length > 0 && portfolio.address) {
        const payload = JSON.stringify({
          walletAddress: portfolio.address,
          conversationId: conversationIdRef.current,
          messages: messagesRef.current,
        });
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/conversations/save", blob);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [portfolio.address]);

  // Sync latest data after each render for the transport body closure
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
            getTokenSymbol
          )
        : null,
      serializeInfinityPools(pools)
    );
  });

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
    <div className="flex flex-col h-full">
      {hasMessages ? (
        <>
          <MessageList
            messages={messages}
            isWaiting={isWaiting}
            isStreaming={status === "streaming"}
            error={error}
            onSendMessage={handleSuggestionClick}
          />
          {saveError && (
            <div className="text-center py-1.5 px-4 flex items-center justify-center gap-2">
              <p className="text-xs text-amber-400/80">
                {saveError}
              </p>
              <button
                onClick={handleRetrySave}
                className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2"
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
          <div className="flex flex-col items-center px-3 sm:px-4 pb-6">
            <WelcomeScreen
              isConnected={portfolio.isConnected}
              onSuggestionClick={handleSuggestionClick}
            />
            <div className="w-full max-w-2xl mt-6">
              <ChatInput
                onSubmit={handleSubmit}
                onStop={stop}
                isLoading={isLoading}
                isConnected={portfolio.isConnected}
              />
            </div>
          </div>
          <div className="flex-[0.6]" />
        </div>
      )}
    </div>
  );
}
