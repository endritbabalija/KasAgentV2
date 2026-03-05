"use client";

import { usePortfolio } from "@/hooks/usePortfolio";
import { useInfinityPoolData } from "@/hooks/useInfinityPoolData";
import { useSidebarState } from "@/hooks/useSidebarState";
import { AppHeader } from "@/components/header/AppHeader";
import { PortfolioSidebar } from "@/components/sidebar/PortfolioSidebar";
import { ChatContainer } from "@/components/chat/ChatContainer";

export default function Home() {
  const portfolio = usePortfolio();
  const { pools } = useInfinityPoolData();
  const { isOpen, toggle } = useSidebarState(true);

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
        />

        <main className="flex-1 overflow-hidden">
          <ChatContainer portfolio={portfolio} pools={pools} />
        </main>
      </div>
    </div>
  );
}
