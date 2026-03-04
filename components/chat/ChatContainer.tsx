"use client";

import { useRef } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useInfinityPoolData } from "@/hooks/useInfinityPoolData";
import {
  serializePortfolio,
  serializeInfinityPools,
  type SerializedPortfolio,
  type SerializedInfinityPool,
} from "@/lib/ai/serializers";
import { MessageList } from "./MessageList";
import { ChatInput } from "./ChatInput";
import { WelcomeScreen } from "./WelcomeScreen";

export function ChatContainer() {
  const portfolio = usePortfolio();
  const { pools } = useInfinityPoolData();

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
          portfolio.stakingPositions
        )
      : null;

  poolsRef.current = serializeInfinityPools(pools);

  // Create transport once — body is a function that reads refs on each request
  const transportRef = useRef(
    new DefaultChatTransport({
      api: "/api/chat",
      body: () => ({
        portfolio: portfolioRef.current,
        infinityPools: poolsRef.current,
      }),
    })
  );

  const { messages, status, stop, sendMessage } = useChat({
    transport: transportRef.current,
  });

  const isLoading = status === "submitted" || status === "streaming";
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
        <MessageList messages={messages} isLoading={isLoading} />
      ) : (
        <WelcomeScreen
          isConnected={portfolio.isConnected}
          onSuggestionClick={handleSuggestionClick}
        />
      )}
      <ChatInput
        onSubmit={handleSubmit}
        onStop={stop}
        isLoading={isLoading}
        isConnected={portfolio.isConnected}
      />
    </div>
  );
}
