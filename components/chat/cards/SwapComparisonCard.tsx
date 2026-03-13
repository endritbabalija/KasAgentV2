"use client";

import { useState } from "react";
import type { SwapComparisonResult, SwapComparisonQuote } from "@/lib/ai/tool-types";
import { TokenBadge, formatAmount } from "./shared/ExecutionCardParts";

function ProtocolBadge({ protocol }: { protocol: string }) {
  const colors: Record<string, string> = {
    zealous: "bg-blue-900/50 text-blue-400",
    kroko: "bg-indigo-900/50 text-indigo-400",
  };
  const names: Record<string, string> = {
    zealous: "ZealousSwap",
    kroko: "KrokoSwap",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
        colors[protocol] ?? "bg-zinc-700/50 text-zinc-300"
      }`}
    >
      {names[protocol] ?? protocol}
    </span>
  );
}

function QuoteRow({
  quote,
  tokenOut,
  isBest,
  compact,
}: {
  quote: SwapComparisonQuote;
  tokenOut: string;
  isBest: boolean;
  compact?: boolean;
}) {
  if (quote.error) {
    return (
      <div className={`flex items-center justify-between ${compact ? "py-2" : "py-3"} opacity-50`}>
        <ProtocolBadge protocol={quote.protocol} />
        <span className="text-xs text-zinc-500">{quote.error}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between ${compact ? "py-2" : "py-3"} ${
        isBest ? "" : "opacity-70"
      }`}
    >
      <div className="flex items-center gap-2">
        <ProtocolBadge protocol={quote.protocol} />
        {isBest && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/50 text-emerald-400 font-medium">
            Best
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`font-mono ${isBest ? "text-teal-400" : "text-zinc-400"} ${compact ? "text-sm" : "text-lg"}`}>
          {formatAmount(quote.amountOut)}
        </span>
        <span className="text-xs text-zinc-500">{tokenOut.toUpperCase()}</span>
      </div>
    </div>
  );
}

export function SwapComparisonCard({ data }: { data: SwapComparisonResult }) {
  const [showCompare, setShowCompare] = useState(false);

  const bestQuote = data.quotes.find((q) => q.isBest);
  const otherQuotes = data.quotes.filter((q) => !q.isBest);
  const hasMultipleValid = data.quotes.filter((q) => !q.error).length > 1;

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      {/* Header */}
      <div className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Swap Comparison</div>

      {/* Input amount */}
      <div className="flex items-center gap-2 mb-3">
        <TokenBadge symbol={data.tokenIn} />
        <span className="font-mono text-zinc-300 text-lg">{formatAmount(data.amountIn)}</span>
        <span className="text-zinc-500 text-lg">&rarr;</span>
        <TokenBadge symbol={data.tokenOut} />
      </div>

      {/* Best quote (hero) */}
      {bestQuote && (
        <div className="bg-zinc-900/50 border border-zinc-700/30 rounded-lg px-3">
          <QuoteRow quote={bestQuote} tokenOut={data.tokenOut} isBest={true} />
        </div>
      )}

      {/* Recommendation */}
      {data.recommendation && (
        <div className="mt-2 text-xs text-zinc-400">{data.recommendation}</div>
      )}

      {/* Compare toggle */}
      {hasMultipleValid && otherQuotes.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowCompare(!showCompare)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showCompare ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            Compare with other DEXes
          </button>
          {showCompare && (
            <div className="mt-2 border-t border-zinc-700/30 pt-1">
              {otherQuotes.map((q) => (
                <QuoteRow
                  key={q.protocol}
                  quote={q}
                  tokenOut={data.tokenOut}
                  isBest={false}
                  compact
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Show failed protocols inline if only one succeeded */}
      {!hasMultipleValid && otherQuotes.length > 0 && (
        <div className="mt-2 border-t border-zinc-700/30 pt-2">
          {otherQuotes.map((q) => (
            <QuoteRow
              key={q.protocol}
              quote={q}
              tokenOut={data.tokenOut}
              isBest={false}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}
