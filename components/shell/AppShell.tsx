"use client";

import { Fragment, useEffect } from "react";
import { useAccount } from "wagmi";
import { useReconnectOnFocus } from "@/hooks/useReconnectOnFocus";
import { useAuth } from "@/lib/auth-provider";
import { AppHeader } from "@/components/header/AppHeader";
import { LeftRail } from "./LeftRail";
import { PortfolioSlideOut } from "./PortfolioSlideOut";
import { useAnyPanelOpen, usePortfolioPanel, useLeftRail } from "@/stores/ui";

export function AppShell({ children }: { children: React.ReactNode }) {
  useReconnectOnFocus();
  const { isConnected } = useAccount();
  const auth = useAuth();
  const anyPanelOpen = useAnyPanelOpen();
  const portfolioPanel = usePortfolioPanel();
  const leftRail = useLeftRail();

  // Centralized body overflow lock for mobile panels
  useEffect(() => {
    if (!anyPanelOpen) return;
    const isMobile = window.innerWidth < 768;
    if (!isMobile) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [anyPanelOpen]);

  // Escape key closes whichever panel is open (higher z-index first)
  useEffect(() => {
    if (!anyPanelOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (portfolioPanel.isOpen) portfolioPanel.close();
        else if (leftRail.isOpen) leftRail.close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [anyPanelOpen, portfolioPanel, leftRail]);

  return (
    <div className="h-dvh flex flex-col bg-[#0a0a0a] text-zinc-100 overflow-hidden">
      <AppHeader />
      <div className="flex-1 flex overflow-hidden">
        <LeftRail />
        <main className="flex-1 overflow-hidden">
          {/* Brief spinner while session check is in progress (~50ms) */}
          {isConnected && auth.status === "loading" && (
            <div className="flex items-center justify-center h-full">
              <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
            </div>
          )}
          {(!isConnected || auth.status !== "loading") && (
            <Fragment key={isConnected ? "connected" : "guest"}>
              {children}
            </Fragment>
          )}
        </main>
      </div>
      <PortfolioSlideOut />
    </div>
  );
}
