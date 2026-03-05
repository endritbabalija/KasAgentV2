"use client";

import { useAccount, useChainId } from "wagmi";

const KASPLEX_CHAIN_ID = 202555;

export function NetworkStatus() {
  const { isConnected } = useAccount();
  const chainId = useChainId();

  if (!isConnected) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <span className="w-2 h-2 rounded-full bg-zinc-600" />
        Disconnected
      </div>
    );
  }

  if (chainId !== KASPLEX_CHAIN_ID) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-orange-400">
        <span className="w-2 h-2 rounded-full bg-orange-400" />
        Wrong Network
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-emerald-400">
      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
      Kasplex L2
    </div>
  );
}
