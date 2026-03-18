"use client";

import { X, LogOut } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";
import { usePortfolioPanel } from "@/stores/ui";
import { PortfolioPanel } from "@/components/sidebar/PortfolioPanel";

export function PortfolioSlideOut() {
  const portfolioPanel = usePortfolioPanel();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <>
      {/* Backdrop (mobile + desktop) */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          portfolioPanel.isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={portfolioPanel.close}
        aria-label="Close portfolio"
      />

      {/* Slide-out panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-80 z-50 bg-zinc-950 border-l border-zinc-800 transition-transform duration-300 flex flex-col ${
          portfolioPanel.isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-200">Portfolio</h2>
          <button
            onClick={portfolioPanel.close}
            className="p-1 rounded hover:bg-zinc-800 transition-colors"
            aria-label="Close portfolio"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">
          <PortfolioPanel />
        </div>
        {isConnected && (
          <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
            <span className="text-xs text-zinc-500 font-mono">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </span>
            <button
              onClick={() => {
                fetch("/api/auth/signout", { method: "POST" }).catch(() => {});
                disconnect();
                portfolioPanel.close();
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-red-400 hover:bg-red-400/10 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
