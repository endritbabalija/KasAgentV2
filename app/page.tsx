"use client";

import { useCallback, useRef } from "react";
import type { UIMessage } from "ai";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useInfinityPoolData } from "@/hooks/useInfinityPoolData";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useReconnectOnFocus } from "@/hooks/useReconnectOnFocus";
import { useConversations } from "@/hooks/useConversations";
import { AppHeader } from "@/components/header/AppHeader";
import { PortfolioSidebar } from "@/components/sidebar/PortfolioSidebar";
import { ChatContainer } from "@/components/chat/ChatContainer";

export default function Home() {
  useReconnectOnFocus();
  const portfolio = usePortfolio();
  const { pools } = useInfinityPoolData();
  const { isOpen, toggle, close } = useSidebarState();

  const {
    conversations,
    activeConversationId,
    loadedMessages,
    activeTab,
    isLoading,
    isListLoading,
    chatLoadKey,
    setActiveTab,
    createNewChat,
    loadConversation,
    deleteConversation,
    saveConversation,
    saveError,
    error,
    clearError,
  } = useConversations(portfolio.address);

  // Track ChatContainer's live messages so we can save before New Chat
  const currentMessagesRef = useRef<UIMessage[]>([]);
  const handleMessagesChange = useCallback((msgs: UIMessage[]) => {
    currentMessagesRef.current = msgs;
  }, []);

  const handleConversationSaved = useCallback(
    (messages: UIMessage[]) => {
      saveConversation(messages);
    },
    [saveConversation]
  );

  const handleNewChat = useCallback(() => {
    createNewChat(currentMessagesRef.current);
  }, [createNewChat]);

  return (
    <div className="h-dvh flex flex-col bg-[#0a0a0a] text-zinc-100 overflow-hidden">
      <AppHeader
        portfolio={portfolio}
        onSidebarToggle={toggle}
        onNewChat={handleNewChat}
      />

      <div className="flex-1 flex overflow-hidden">
        <PortfolioSidebar
          portfolio={portfolio}
          pools={pools}
          isOpen={isOpen}
          onToggle={toggle}
          onClose={close}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={loadConversation}
          onDeleteConversation={deleteConversation}
          isLoading={isLoading}
          isListLoading={isListLoading}
          conversationError={error}
          onClearError={clearError}
        />

        <main className="flex-1 overflow-hidden">
          <ChatContainer
            key={chatLoadKey}
            portfolio={portfolio}
            pools={pools}
            initialMessages={loadedMessages}
            activeConversationId={activeConversationId}
            onConversationSaved={handleConversationSaved}
            onMessagesChange={handleMessagesChange}
            saveError={saveError}
          />
        </main>
      </div>
    </div>
  );
}
