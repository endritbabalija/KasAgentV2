"use client";

import { useCallback, useState } from "react";
import { useParams } from "next/navigation";
import type { UIMessage } from "ai";
import { useAppContext } from "@/components/shell/AppContext";
import { useConversationLoader } from "@/hooks/useConversationLoader";
import { ChatContainer } from "@/components/chat/ChatContainer";

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { portfolio, pools } = useAppContext();
  const { messages, executionStates, isLoading, error } = useConversationLoader(id);

  const [saveError, setSaveError] = useState<string | null>(null);

  const handleConversationSaved = useCallback(
    async (msgs: UIMessage[]) => {
      if (msgs.length === 0) return;
      try {
        const res = await fetch("/api/conversations/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: id,
            messages: msgs,
          }),
        });
        if (!res.ok) {
          setSaveError("Failed to save conversation. Your messages may not persist.");
        } else {
          setSaveError(null);
        }
      } catch {
        setSaveError("Failed to save conversation. Your messages may not persist.");
      }
    },
    [portfolio.address, id]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
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

  return (
    <ChatContainer
      key={id}
      portfolio={portfolio}
      pools={pools}
      initialMessages={messages}
      initialExecutionStates={executionStates}
      activeConversationId={id}
      onConversationSaved={handleConversationSaved}
      saveError={saveError}
    />
  );
}
