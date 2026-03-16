"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { UIMessage } from "ai";
import { useAppContext } from "@/components/shell/AppContext";
import { useFeedInsights } from "@/hooks/useFeedInsights";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { FeedContainer } from "@/components/feed/FeedContainer";

export default function FeedPage() {
  const router = useRouter();
  const { portfolio, pools, saveConversation } = useAppContext();
  const savedIdRef = useRef<string | null>(null);
  const [hasMessages, setHasMessages] = useState(false);
  const [feedPrompt, setFeedPrompt] = useState<string | null>(null);

  const { insights, isLoading: feedLoading } = useFeedInsights(portfolio, pools);

  const handleConversationSaved = useCallback(
    async (messages: UIMessage[]) => {
      if (savedIdRef.current) {
        // Already saved — just update
        if (messages.length > 0) {
          fetch("/api/conversations/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversationId: savedIdRef.current,
              messages,
            }),
          }).catch(() => {});
        }
        return;
      }
      const id = await saveConversation(messages);
      if (id) {
        savedIdRef.current = id;
        router.replace(`/c/${id}`);
      }
    },
    [saveConversation, router, portfolio.address]
  );

  const handleMessagesChange = useCallback((msgs: UIMessage[]) => {
    setHasMessages(msgs.length > 0);
  }, []);

  const handleFeedAction = useCallback((prompt: string) => {
    setFeedPrompt(prompt);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Show feed insights only when chat is empty and no feed action triggered */}
      {!hasMessages && !feedPrompt && (
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="flex-1" />
          {portfolio.isConnected && (
            <FeedContainer
              insights={insights}
              isLoading={feedLoading}
              onAction={handleFeedAction}
            />
          )}
        </div>
      )}

      {/* ChatContainer — remounts when feedPrompt changes via key */}
      <div className={!hasMessages && !feedPrompt ? "" : "flex-1 overflow-hidden"}>
        <ChatContainer
          key={feedPrompt ?? "new"}
          portfolio={portfolio}
          pools={pools}
          initialMessages={[]}
          initialExecutionStates={{}}
          activeConversationId={null}
          onConversationSaved={handleConversationSaved}
          onMessagesChange={handleMessagesChange}
          saveError={null}
          initialInput={feedPrompt ?? undefined}
        />
      </div>
    </div>
  );
}
