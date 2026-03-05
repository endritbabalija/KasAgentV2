"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import type { Portfolio } from "@/hooks/usePortfolio";
import { formatTokenAmount } from "@/lib/format";
import { NetworkStatus } from "./NetworkStatus";

interface AppHeaderProps {
  portfolio: Portfolio;
  onSidebarToggle: () => void;
  isSidebarOpen: boolean;
}

export function AppHeader({
  portfolio,
  onSidebarToggle,
  isSidebarOpen,
}: AppHeaderProps) {
  // Find KAS balance from portfolio
  const kasBalance = portfolio.balances.find((b) => b.symbol === "KAS");

  return (
    <header className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 shrink-0">
      {/* Sidebar toggle */}
      <button
        onClick={onSidebarToggle}
        className="hidden md:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-zinc-800 transition-colors"
        aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {isSidebarOpen ? (
          <PanelLeftClose className="w-5 h-5 text-zinc-400" />
        ) : (
          <PanelLeft className="w-5 h-5 text-zinc-400" />
        )}
      </button>

      {/* Logo */}
      <h1 className="text-xl font-bold tracking-tight">KasAgent</h1>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Network status */}
      <NetworkStatus />

      {/* KAS balance pill */}
      {portfolio.isConnected && kasBalance && kasBalance.balance > 0n && (
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-zinc-800/60 border border-zinc-700/50 rounded-full text-sm">
          <span className="text-zinc-400">KAS</span>
          <span className="text-zinc-200 font-mono text-xs">
            {formatTokenAmount(kasBalance.balance, kasBalance.decimals)}
          </span>
        </div>
      )}

      {/* Wallet connect */}
      <ConnectButton />
    </header>
  );
}
