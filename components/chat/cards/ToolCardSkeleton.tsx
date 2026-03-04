export function ToolCardSkeleton({ toolName }: { toolName: string }) {
  const labels: Record<string, string> = {
    getSwapQuote: "Fetching swap quote...",
    getPoolReserves: "Fetching pool reserves...",
    getActiveFarms: "Fetching active farms...",
    getInfinityPoolRates: "Fetching staking rates...",
  };

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-2 text-zinc-400 text-sm">
        <div className="h-4 w-4 rounded-full border-2 border-zinc-500 border-t-teal-400 animate-spin" />
        <span>{labels[toolName] ?? "Processing..."}</span>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-4 bg-zinc-700/50 rounded w-3/4" />
        <div className="h-4 bg-zinc-700/50 rounded w-1/2" />
      </div>
    </div>
  );
}
