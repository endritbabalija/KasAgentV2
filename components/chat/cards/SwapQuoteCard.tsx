import type { SwapQuoteResult } from "@/lib/ai/tool-types";
import { TokenBadge, formatAmount } from "./shared/ExecutionCardParts";

export function SwapQuoteCard({ data }: { data: SwapQuoteResult }) {
  const rate =
    parseFloat(data.amountIn) > 0
      ? parseFloat(data.amountOut) / parseFloat(data.amountIn)
      : 0;

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Swap Quote</div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.tokenIn} />
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.amountIn)}</span>
        </div>
        <span className="text-zinc-500 text-lg">&rarr;</span>
        <div className="flex items-center gap-2">
          <TokenBadge symbol={data.tokenOut} />
          <span className="font-mono text-teal-400 text-lg">{formatAmount(data.amountOut)}</span>
        </div>
      </div>
      {rate > 0 && (
        <div className="mt-2 text-xs text-zinc-500">
          1 {data.tokenIn.toUpperCase()} &asymp;{" "}
          <span className="font-mono text-zinc-400">{rate.toLocaleString("en-US", { maximumFractionDigits: 6 })}</span>{" "}
          {data.tokenOut.toUpperCase()}
        </div>
      )}
    </div>
  );
}
