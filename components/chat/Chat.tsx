"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useInfinityPoolData } from "@/hooks/useInfinityPoolData";
import { useAuth } from "@/lib/auth-provider";
import { useFeedInsights } from "@/hooks/useFeedInsights";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { FeedContainer } from "@/components/feed/FeedContainer";
import type { ExecutionRecord } from "@/components/chat/ExecutionStateContext";

interface ChatProps {
  id: string;
  initialMessages: UIMessage[];
  initialExecutionStates?: Record<string, ExecutionRecord>;
}

export function Chat({
  id,
  initialMessages,
  initialExecutionStates = {},
}: ChatProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const portfolio = usePortfolio();
  const { pools } = useInfinityPoolData();
  const auth = useAuth();

  // Feed state — show feed when no messages and user hasn't submitted yet
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [feedPrompt, setFeedPrompt] = useState<string | null>(null);
  const showFeed =
    initialMessages.length === 0 && !hasSubmitted && !feedPrompt;

  const { insights, isLoading: feedLoading } = useFeedInsights(
    portfolio,
    pools
  );

  // URL management — pushState on first submit
  const urlUpdatedRef = useRef(initialMessages.length > 0); // already on /c/[id] if has messages

  const handleFirstSubmit = useCallback(() => {
    if (!urlUpdatedRef.current) {
      window.history.pushState(null, "", `/c/${id}`);
      window.dispatchEvent(new Event("pushstate"));
      urlUpdatedRef.current = true;
    }
    setHasSubmitted(true);
  }, [id]);

  // popstate handler for back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      router.refresh();
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [router]);

  // Sidebar refresh after AI response
  const handleFinish = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }, [queryClient]);

  // Feed card action
  const handleFeedAction = useCallback((prompt: string) => {
    setFeedPrompt(prompt);
    setHasSubmitted(true);
  }, []);

  // Track messages for feed visibility
  const handleMessagesChange = useCallback((msgs: UIMessage[]) => {
    if (msgs.length > 0) setHasSubmitted(true);
  }, []);

  return (
    <div className="flex flex-col h-full">
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

      <div className={showFeed ? "" : "flex-1 overflow-hidden"}>
        <ChatContainer
          key={id}
          conversationId={id}
          portfolio={portfolio}
          pools={pools}
          initialMessages={initialMessages}
          initialExecutionStates={initialExecutionStates}
          onFirstSubmit={handleFirstSubmit}
          onFinish={handleFinish}
          onMessagesChange={handleMessagesChange}
          initialInput={feedPrompt ?? undefined}
        />
      </div>
    </div>
  );
}
