"use client";

import { useRef, useEffect, useState } from "react";
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

/* ------------------------------------------------------------------ */
/*  localStorage chat persistence (per wallet, max 50 messages)       */
/* ------------------------------------------------------------------ */

const STORAGE_PREFIX = "kasagent_chat_";
const MAX_STORED_MESSAGES = 50;

function storageKey(address: string) {
  return `${STORAGE_PREFIX}${address.toLowerCase()}`;
}

function loadMessages(address: string | undefined): UIMessage[] {
  if (!address) return [];
  try {
    const raw = localStorage.getItem(storageKey(address));
    if (!raw) return [];
    return JSON.parse(raw) as UIMessage[];
  } catch {
    return [];
  }
}

function persistMessages(address: string | undefined, msgs: UIMessage[]) {
  if (!address) return;
  if (msgs.length === 0) {
    localStorage.removeItem(storageKey(address));
    return;
  }
  try {
    localStorage.setItem(
      storageKey(address),
      JSON.stringify(msgs.slice(-MAX_STORED_MESSAGES))
    );
  } catch {
    // localStorage full — silently fail
  }
}

/* ------------------------------------------------------------------ */

interface ChatContainerProps {
  portfolio: Portfolio;
  pools: InfinityPoolInfo[];
}

export function ChatContainer({ portfolio, pools }: ChatContainerProps) {
  const { getTokenSymbol } = useTokenRegistry();

  // Refs for latest wallet address (used by onFinish closure + wallet switch)
  const addressRef = useRef(portfolio.address);
  const prevAddressRef = useRef(portfolio.address);

  // Store latest serialized data in refs so the transport's body function
  // always reads fresh values without needing to recreate the transport.
  const portfolioRef = useRef<SerializedPortfolio | null>(null);
  const poolsRef = useRef<SerializedInfinityPool[]>([]);

  // Create transport once — body closure reads refs lazily on user action, not during render.
  /* eslint-disable react-hooks/refs -- refs are captured in a callback, not read during render */
  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          walletAddress: portfolioRef.current?.address,
          portfolio: portfolioRef.current,
          infinityPools: poolsRef.current,
        }),
      })
  );
  /* eslint-enable react-hooks/refs */

  // Load initial messages from localStorage (evaluated once)
  const [initialMessages] = useState(() => loadMessages(portfolio.address));

  const { messages, status, error, stop, sendMessage, setMessages } = useChat({
    transport,
    messages: initialMessages,
    onFinish: ({ messages: allMessages }) => {
      persistMessages(addressRef.current, allMessages);
    },
  });

  // Track current messages in a ref for the wallet-switch effect
  const messagesRef = useRef(messages);

  // Sync refs after each render for closures (transport body, onFinish, wallet-switch effect)
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
            getTokenSymbol
          )
        : null;
    poolsRef.current = serializeInfinityPools(pools);
    addressRef.current = portfolio.address;
    messagesRef.current = messages;
  });

  // Handle wallet switch / disconnect
  useEffect(() => {
    const prevAddress = prevAddressRef.current;
    const newAddress = portfolio.address;
    if (prevAddress === newAddress) return;

    // Save current messages for the old wallet
    if (prevAddress && messagesRef.current.length > 0) {
      persistMessages(prevAddress, messagesRef.current);
    }

    // Load messages for the new wallet (or clear if disconnected)
    setMessages(loadMessages(newAddress));
    prevAddressRef.current = newAddress;
  }, [portfolio.address, setMessages]);

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

  const handleClearChat = () => {
    if (portfolio.address) {
      localStorage.removeItem(storageKey(portfolio.address));
    }
    setMessages([]);
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
            onClearChat={handleClearChat}
            isLoading={isLoading}
            isConnected={portfolio.isConnected}
            hasMessages
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
                onClearChat={handleClearChat}
                isLoading={isLoading}
                isConnected={portfolio.isConnected}
                hasMessages={false}
              />
            </div>
          </div>
          <div className="flex-[0.6]" />
        </div>
      )}
    </div>
  );
}
