"use client";

import { Fragment } from "react";
import { useAccount } from "wagmi";
import { useReconnectOnFocus } from "@/hooks/useReconnectOnFocus";
import { useAuth } from "@/lib/auth-provider";
import { AppHeader } from "@/components/header/AppHeader";
import { LeftRail } from "./LeftRail";
import { PortfolioSlideOut } from "./PortfolioSlideOut";

export function AppShell({ children }: { children: React.ReactNode }) {
  useReconnectOnFocus();
  const { isConnected } = useAccount();
  const auth = useAuth();

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
            <Fragment key={auth.isAuthenticated ? "authed" : "guest"}>
              {children}
            </Fragment>
          )}
        </main>
      </div>
      <PortfolioSlideOut />
    </div>
  );
}
