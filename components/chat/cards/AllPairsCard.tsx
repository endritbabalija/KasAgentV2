"use client";

import { useState } from "react";
import type { AllPairsResult, PairListItem } from "@/lib/ai/tool-types";

const PAGE_SIZE = 10;

const PROTOCOL_BADGES: Record<string, { label: string; className: string }> = {
  zealous: { label: "Zealous", className: "bg-blue-900/50 text-blue-400" },
  kroko: { label: "Kroko", className: "bg-indigo-900/50 text-indigo-400" },
  kaspacom: { label: "KaspaCom", className: "bg-orange-900/50 text-orange-400" },
};

function formatLiquidity(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(0);
  return n.toFixed(2);
}

function PairRow({ pair, maxLiquidity, showProtocol }: { pair: PairListItem; maxLiquidity: number; showProtocol: boolean }) {
  const barWidth = maxLiquidity > 0 ? (pair.totalLiquidityKas / maxLiquidity) * 100 : 0;
  const badge = pair.protocolId ? PROTOCOL_BADGES[pair.protocolId] : undefined;

  return (
    <tr className="border-b border-zinc-700/30 last:border-0">
      <td className="py-2 pr-4">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-zinc-200 font-medium">{pair.pair}</span>
          {showProtocol && badge && (
            <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>
      </td>
      <td className="py-2 w-full">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-zinc-700/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-teal-500/60 rounded-full"
              style={{ width: `${Math.max(barWidth, 1)}%` }}
            />
          </div>
          <span className="font-mono text-xs text-zinc-400 whitespace-nowrap w-20 text-right">
            {formatLiquidity(pair.totalLiquidityKas)} KAS
          </span>
        </div>
      </td>
    </tr>
  );
}

export function AllPairsCard({ data }: { data: AllPairsResult }) {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(data.pairs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * PAGE_SIZE;
  const pageItems = data.pairs.slice(start, start + PAGE_SIZE);
  const maxLiquidity = data.pairs.length > 0 ? data.pairs[0].totalLiquidityKas : 0;
  const filtered = data.totalPairsOnChain - data.pairs.length;

  // Detect if showing multiple protocols (show badges when mixed)
  const protocols = new Set(data.pairs.map((p) => p.protocolId).filter(Boolean));
  const showProtocol = protocols.size > 1;
  const singleProtocol = protocols.size === 1 ? PROTOCOL_BADGES[Array.from(protocols)[0]] : undefined;

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="text-xs text-zinc-500 uppercase tracking-wide">
            Trading Pairs
          </div>
          {singleProtocol && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${singleProtocol.className}`}>
              {singleProtocol.label}
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-600">
          {data.pairs.length} active{filtered > 0 ? ` (${filtered} dust filtered)` : ""}
        </div>
      </div>

      {pageItems.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-zinc-700/50">
                <th className="pb-2 pr-4">Pair</th>
                <th className="pb-2">Liquidity</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((pair) => (
                <PairRow key={pair.pairAddress} pair={pair} maxLiquidity={maxLiquidity} showProtocol={showProtocol} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-zinc-500 text-center py-4">
          No trading pairs found.
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-700/30">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={safePage === 0}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-zinc-700/40 text-zinc-300 hover:bg-zinc-700/70"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Prev
          </button>
          <span className="text-xs text-zinc-500">
            Page {safePage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={safePage >= totalPages - 1}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed bg-zinc-700/40 text-zinc-300 hover:bg-zinc-700/70"
          >
            Next
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
