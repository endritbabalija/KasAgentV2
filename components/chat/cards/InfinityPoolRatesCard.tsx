import type { InfinityPoolRatesResult } from "@/lib/ai/tool-types";
import { formatAmount } from "./shared/ExecutionCardParts";
import { POOL_BORDER_COLORS, POOL_NAME_COLORS } from "./shared/card-colors";
import { CardWrapper } from "./shared/CardWrapper";

export function InfinityPoolRatesCard({ data }: { data: InfinityPoolRatesResult }) {
  return (
    <CardWrapper>
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Infinity Pool Rates</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {data.pools.map((pool) => (
          <div
            key={pool.name}
            className={`rounded-lg border p-3 ${
              POOL_BORDER_COLORS[pool.name] ?? "border-zinc-700/50 bg-zinc-900/30"
            }`}
          >
            <div className={`text-sm font-semibold mb-2 ${POOL_NAME_COLORS[pool.name] ?? "text-zinc-300"}`}>
              {pool.name}
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Rate</span>
                <span className="font-mono text-teal-400">{formatAmount(pool.exchangeRate)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500">Staked</span>
                <span className="font-mono text-teal-400">{formatAmount(pool.totalStaked)}</span>
              </div>
              {pool.zealPerBlock && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">ZEAL/block</span>
                  <span className="font-mono text-teal-400">{formatAmount(pool.zealPerBlock)}</span>
                </div>
              )}
              {pool.emissionsPaused !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-500">Emissions</span>
                  <span className={pool.emissionsPaused ? "text-red-400" : "text-emerald-400"}>
                    {pool.emissionsPaused ? "Paused" : "Active"}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </CardWrapper>
  );
}
