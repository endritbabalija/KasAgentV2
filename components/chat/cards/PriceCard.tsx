import type { TokenPriceResult } from "@/lib/ai/tool-types";
import { shortenAddress } from "./shared/ExecutionCardParts";

function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (num === 0) return "0";
  if (num >= 1) return num.toLocaleString("en-US", { maximumFractionDigits: 4 });
  // For very small prices, show enough significant digits
  if (num < 0.000001) return num.toExponential(4);
  return num.toLocaleString("en-US", { maximumSignificantDigits: 4 });
}

function formatLiquidity(value: string): string {
  if (value === "N/A") return "N/A";
  const num = parseFloat(value);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function PriceCard({ data }: { data: TokenPriceResult }) {
  const explorerUrl =
    data.pairAddress !== "N/A"
      ? `https://explorer.kasplex.org/address/${data.pairAddress}`
      : null;

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">
          Token Price
        </div>
        {data.pairAddress !== "N/A" && (
          <span className="text-xs font-mono text-zinc-600">
            Pair: {shortenAddress(data.pairAddress)}
          </span>
        )}
      </div>

      {/* Price — large and prominent */}
      <div className="flex items-baseline gap-2 mb-4">
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-900/40 text-blue-400">
          {data.token}
        </span>
        <span className="text-2xl font-semibold text-zinc-100 font-mono">
          {formatPrice(data.priceInKAS)}
        </span>
        <span className="text-sm text-zinc-500">KAS</span>
      </div>

      {/* Liquidity depth */}
      {data.pairAddress !== "N/A" && (
        <>
          <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-2">
            Pair Liquidity
          </div>
          <div className="border border-zinc-700/30 bg-zinc-900/30 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-y-1.5 text-xs">
              <div className="text-zinc-500">KAS Side</div>
              <div className="font-mono text-zinc-300 text-right">
                {formatLiquidity(data.liquidityKAS)} KAS
              </div>

              <div className="text-zinc-500">{data.token} Side</div>
              <div className="font-mono text-zinc-300 text-right">
                {formatLiquidity(data.liquidityToken)} {data.token}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Explorer link */}
      {explorerUrl && (
        <div className="mt-3 text-right">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            View pair on explorer &rarr;
          </a>
        </div>
      )}
    </div>
  );
}
