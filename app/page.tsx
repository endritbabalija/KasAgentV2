"use client";

import { useCallback } from "react";
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
    chatResetKey,
    setActiveTab,
    createNewChat,
    loadConversation,
    deleteConversation,
    saveConversation,
  } = useConversations(portfolio.address);

  const handleConversationSaved = useCallback(
    (messages: UIMessage[]) => {
      saveConversation(messages);
    },
    [saveConversation]
  );

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a] text-zinc-100">
      <AppHeader
        portfolio={portfolio}
        onSidebarToggle={toggle}
        isSidebarOpen={isOpen}
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
          onNewChat={createNewChat}
        />

        <main className="flex-1 overflow-hidden">
          <ChatContainer
            portfolio={portfolio}
            pools={pools}
            activeConversationId={activeConversationId}
            loadedMessages={loadedMessages}
            chatResetKey={chatResetKey}
            onConversationSaved={handleConversationSaved}
          />
        </main>
      </div>
    </div>
  );
}
