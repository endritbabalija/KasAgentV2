import { CardWrapper } from "./shared/CardWrapper";

export function ToolCardSkeleton({ toolName }: { toolName: string }) {
  const labels: Record<string, string> = {
    getSwapQuote: "Fetching swap quote...",
    prepareSwap: "Preparing swap transaction...",
    getPoolReserves: "Fetching pool reserves...",
    getActiveFarms: "Fetching active farms...",
    getInfinityPoolRates: "Fetching staking rates...",
    discoverYieldOpportunities: "Scanning DeFi opportunities...",
    prepareAddLiquidity: "Preparing add liquidity...",
    prepareRemoveLiquidity: "Preparing remove liquidity...",
    prepareFarmStake: "Preparing farm stake...",
    prepareFarmUnstake: "Preparing farm unstake...",
    prepareInfinityStake: "Preparing InfinityPool stake...",
    prepareInfinityUnstake: "Preparing InfinityPool unstake...",
    getTransactionHistory: "Fetching transaction history...",
    getMembershipStatus: "Checking membership & discount status...",
    spyOnWallet: "Scanning wallet portfolio...",
    getTokenPrice: "Fetching token price...",
    listAllPairs: "Fetching all trading pairs...",
  };

  return (
    <CardWrapper className="animate-pulse">
      <div className="flex items-center gap-2 text-zinc-400 text-sm">
        <div className="h-4 w-4 rounded-full border-2 border-zinc-500 border-t-teal-400 animate-spin" />
        <span>{labels[toolName] ?? "Processing..."}</span>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-4 bg-zinc-700/50 rounded w-3/4" />
        <div className="h-4 bg-zinc-700/50 rounded w-1/2" />
      </div>
    </CardWrapper>
  );
}
