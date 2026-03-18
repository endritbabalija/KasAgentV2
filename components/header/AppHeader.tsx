"use client";

import { Menu } from "lucide-react";
import { useLeftRail } from "@/stores/ui";
import { NetworkStatus } from "./NetworkStatus";
import { WalletButton } from "./WalletButton";

export function AppHeader() {
  const leftRail = useLeftRail();

  return (
    <header className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 border-b border-zinc-800 shrink-0">
      <button
        onClick={leftRail.toggle}
        className="md:hidden flex items-center justify-center w-10 h-10 min-w-[44px] min-h-[44px] rounded-lg hover:bg-zinc-800 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-zinc-400" />
      </button>
      <h1 className="text-xl font-bold tracking-tight">KasAgent</h1>
      <div className="flex-1" />
      <NetworkStatus />
      <WalletButton />
    </header>
  );
}
