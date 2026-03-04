import type { PoolReservesResult } from "@/lib/ai/tool-types";

function formatAmount(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

export function PoolReservesCard({ data }: { data: PoolReservesResult }) {
  const [tokenA, tokenB] = data.pair.split("/");

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
        Pool Reserves &mdash; {data.pair}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-zinc-500 mb-1">{tokenA} Reserve</div>
          <div className="font-mono text-teal-400">{formatAmount(data.reserveA)}</div>
        </div>
        <div>
          <div className="text-xs text-zinc-500 mb-1">{tokenB} Reserve</div>
          <div className="font-mono text-teal-400">{formatAmount(data.reserveB)}</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-zinc-700/50">
        <div className="text-xs text-zinc-500 mb-1">Total LP Supply</div>
        <div className="font-mono text-teal-400 text-sm">{formatAmount(data.totalLpSupply)}</div>
      </div>
    </div>
  );
}
