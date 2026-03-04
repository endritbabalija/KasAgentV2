import type { SwapQuoteResult } from "@/lib/ai/tool-types";

function TokenBadge({ symbol }: { symbol: string }) {
  const colors: Record<string, string> = {
    KAS: "bg-emerald-900/50 text-emerald-400",
    WKAS: "bg-emerald-900/50 text-emerald-400",
    ZEAL: "bg-blue-900/50 text-blue-400",
    NACHO: "bg-orange-900/50 text-orange-400",
    KASPER: "bg-purple-900/50 text-purple-400",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
        colors[symbol.toUpperCase()] ?? "bg-zinc-700/50 text-zinc-300"
      }`}
    >
      {symbol.toUpperCase()}
    </span>
  );
}

function formatAmount(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

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
