import type { InfinityPoolRatesResult } from "@/lib/ai/tool-types";

const poolColors: Record<string, string> = {
  ZEAL: "border-blue-800/50 bg-blue-950/20",
  NACHO: "border-orange-800/50 bg-orange-950/20",
  KASPER: "border-purple-800/50 bg-purple-950/20",
};

const nameColors: Record<string, string> = {
  ZEAL: "text-blue-400",
  NACHO: "text-orange-400",
  KASPER: "text-purple-400",
};

function formatAmount(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

export function InfinityPoolRatesCard({ data }: { data: InfinityPoolRatesResult }) {
  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Infinity Pool Rates</div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {data.pools.map((pool) => (
          <div
            key={pool.name}
            className={`rounded-lg border p-3 ${
              poolColors[pool.name] ?? "border-zinc-700/50 bg-zinc-900/30"
            }`}
          >
            <div className={`text-sm font-semibold mb-2 ${nameColors[pool.name] ?? "text-zinc-300"}`}>
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
    </div>
  );
}
