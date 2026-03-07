"use client";

import { useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
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
}

export function ChatContainer({ portfolio, pools }: ChatContainerProps) {
  const { getTokenSymbol } = useTokenRegistry();

  // Store latest serialized data in refs so the transport's body function
  // always reads fresh values without needing to recreate the transport.
  const portfolioRef = useRef<SerializedPortfolio | null>(null);
  const poolsRef = useRef<SerializedInfinityPool[]>([]);

  portfolioRef.current =
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
      : null;

  poolsRef.current = serializeInfinityPools(pools);

  // Create transport once — body is a function that reads refs on each request
  const transportRef = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        walletAddress: portfolioRef.current?.address,
        portfolio: portfolioRef.current,
        infinityPools: poolsRef.current,
      }),
    })
  );

  const { messages, status, error, stop, sendMessage } = useChat({
    transport: transportRef.current,
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

  return (
    <div className="flex flex-col h-full">
      {hasMessages ? (
        <>
          <MessageList
            messages={messages}
            isWaiting={isWaiting}
            error={error}
            onSendMessage={handleSuggestionClick}
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
