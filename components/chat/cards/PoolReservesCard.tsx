import type { PoolReservesResult } from "@/lib/ai/tool-types";
import { formatAmount } from "./shared/ExecutionCardParts";
import { CardWrapper } from "./shared/CardWrapper";

export function PoolReservesCard({ data }: { data: PoolReservesResult }) {
  const [tokenA, tokenB] = data.pair.split("/");

  return (
    <CardWrapper>
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
    </CardWrapper>
  );
}
