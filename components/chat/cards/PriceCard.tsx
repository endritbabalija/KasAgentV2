import type { TokenPriceResult } from "@/lib/ai/tool-types";
import { formatPrice } from "@/lib/format";
import { CardWrapper } from "./shared/CardWrapper";
import { EXPLORER_URL } from "@/config/chains";

function formatLiquidity(kasAmount: string): string {
  const num = parseFloat(kasAmount);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  if (num >= 1) return num.toFixed(0);
  if (num > 0) return `<1`;
  return "0";
}

export function PriceCard({ data }: { data: TokenPriceResult }) {
  return (
    <CardWrapper compact>
      <div className="flex items-baseline gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-900/40 text-blue-400">
          {data.token}
        </span>
        <span className="text-2xl font-semibold text-zinc-100 font-mono">
          {formatPrice(data.priceInKAS)}
        </span>
        <span className="text-sm text-zinc-500">KAS</span>
      </div>
      {data.tokenAddress && (
        <div className="mb-2">
          <a
            href={`${EXPLORER_URL}/address/${data.tokenAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-zinc-600 hover:text-zinc-400 font-mono"
          >
            {data.tokenAddress.slice(0, 6)}...{data.tokenAddress.slice(-4)}
          </a>
        </div>
      )}

      {data.dexLiquidity && data.dexLiquidity.length > 0 && (
        <div className="space-y-1">
          {data.dexLiquidity.map((dex) => {
            const kasNum = parseFloat(dex.liquidityKAS);
            const isDeep = kasNum >= 10_000;
            const isThin = kasNum > 0 && kasNum < 1_000;
            const isEmpty = kasNum === 0;

            return (
              <div key={dex.pairAddress} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400">{dex.dex}</span>
                  <a
                    href={`${EXPLORER_URL}/address/${dex.pairAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-600 hover:text-zinc-400 font-mono"
                  >
                    {dex.pairAddress.slice(0, 6)}...{dex.pairAddress.slice(-4)}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-zinc-300">{formatLiquidity(dex.liquidityKAS)} KAS</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isDeep ? "bg-emerald-900/30 text-emerald-400" :
                    isThin ? "bg-yellow-900/30 text-yellow-400" :
                    isEmpty ? "bg-red-900/30 text-red-400" :
                    "bg-zinc-800 text-zinc-400"
                  }`}>
                    {isDeep ? "Deep" : isThin ? "Thin" : isEmpty ? "Empty" : "OK"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.note && (
        <div className="mt-2 text-xs text-zinc-500 italic">{data.note}</div>
      )}
    </CardWrapper>
  );
}
