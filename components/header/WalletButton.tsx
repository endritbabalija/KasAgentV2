"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import { usePortfolioPanel } from "@/stores/ui";

export function WalletButton() {
  const portfolioPanel = usePortfolioPanel();

  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;

        if (!connected) {
          return (
            <button
              onClick={openConnectModal}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition-colors"
            >
              Connect Wallet
            </button>
          );
        }

        return (
          <button
            onClick={portfolioPanel.toggle}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-zinc-700/50 hover:bg-zinc-700/60 transition-colors"
          >
            <Wallet className="w-4 h-4 text-zinc-400" />
            <span className="hidden sm:inline text-sm text-zinc-200 font-mono">
              {account.displayBalance ?? account.displayName}
            </span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
