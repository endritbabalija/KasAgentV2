"use client";

import { useState } from "react";
import type { SwapComparisonResult, SwapComparisonQuote } from "@/lib/ai/tool-types";
import { TokenBadge, formatAmount } from "./shared/ExecutionCardParts";
import { ProtocolBadge } from "./shared/ProtocolBadge";
import { CardWrapper } from "./shared/CardWrapper";

function computeSavings(best: SwapComparisonQuote, quotes: SwapComparisonQuote[]): string | null {
  const validOthers = quotes.filter((q) => !q.isBest && !q.error && q.amountOut);
  if (validOthers.length === 0) return null;
  const bestAmt = parseFloat(best.amountOut);
  const nextBestAmt = Math.max(...validOthers.map((q) => parseFloat(q.amountOut)));
  if (nextBestAmt <= 0 || bestAmt <= nextBestAmt) return null;
  const pct = ((bestAmt - nextBestAmt) / nextBestAmt) * 100;
  if (pct < 0.01) return null;
  return `${pct.toFixed(2)}% more than next best`;
}

export function SwapComparisonCard({ data }: { data: SwapComparisonResult }) {
  const [showOthers, setShowOthers] = useState(false);

  const bestQuote = data.quotes.find((q) => q.isBest);
  const otherQuotes = data.quotes.filter((q) => !q.isBest);
  const savings = bestQuote ? computeSavings(bestQuote, data.quotes) : null;

  return (
    <CardWrapper>
      {/* Header */}
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Best Rate</div>

      {/* Best quote hero */}
      {bestQuote && !bestQuote.error && (
        <div className="bg-zinc-900/60 border border-zinc-700/40 rounded-lg p-4 mb-1">
          <div className="flex items-center gap-2 mb-3">
            <TokenBadge symbol={data.tokenIn} />
            <span className="font-mono text-zinc-300">{formatAmount(data.amountIn)}</span>
            <span className="text-zinc-600">&rarr;</span>
            <TokenBadge symbol={data.tokenOut} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-semibold font-mono text-teal-400">
              {formatAmount(bestQuote.amountOut)}
            </span>
            <span className="text-sm text-zinc-500">{data.tokenOut.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <ProtocolBadge protocol={bestQuote.protocol} />
            {savings && (
              <span className="text-[11px] text-emerald-400">{savings}</span>
            )}
          </div>
        </div>
      )}

      {/* Other quotes */}
      {otherQuotes.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowOthers(!showOthers)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showOthers ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {otherQuotes.length} other {otherQuotes.length === 1 ? "DEX" : "DEXes"}
          </button>
          {showOthers && (
            <div className="mt-2 border-t border-zinc-700/30 pt-1">
              {otherQuotes.map((q) => (
                <div key={q.protocol} className="flex items-center justify-between py-2 border-b border-zinc-700/20 last:border-0">
                  <ProtocolBadge protocol={q.protocol} />
                  {q.error ? (
                    <span className="text-xs text-zinc-600">{q.error}</span>
                  ) : (
                    <span className="font-mono text-sm text-zinc-400">
                      {formatAmount(q.amountOut)} {data.tokenOut.toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </CardWrapper>
  );
}
