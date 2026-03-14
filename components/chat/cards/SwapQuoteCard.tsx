import type { SwapQuoteResult } from "@/lib/ai/tool-types";
import { TokenBadge, formatAmount } from "./shared/ExecutionCardParts";

const protocolLabels: Record<string, { label: string; className: string }> = {
  kroko: { label: "KrokoSwap", className: "bg-indigo-900/50 text-indigo-400" },
  zealous: { label: "ZealousSwap", className: "bg-blue-900/50 text-blue-400" },
  kaspacom: { label: "KaspaCom", className: "bg-orange-900/50 text-orange-400" },
};

export function SwapQuoteCard({ data }: { data: SwapQuoteResult }) {
  const rate =
    parseFloat(data.amountIn) > 0
      ? parseFloat(data.amountOut) / parseFloat(data.amountIn)
      : 0;

  const proto = data.protocol ? protocolLabels[data.protocol] : undefined;

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">Swap Quote</div>
        {proto && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${proto.className}`}>
            {proto.label}
          </span>
        )}
      </div>
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
