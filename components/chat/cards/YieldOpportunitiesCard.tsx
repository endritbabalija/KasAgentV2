"use client";

import { useState } from "react";
import type { YieldOpportunitiesResult, YieldOpportunity } from "@/lib/ai/tool-types";
import { formatKasAmount as formatKas } from "@/lib/format";
import { YIELD_TYPE_BADGES, RISK_DOT_COLORS } from "./shared/card-colors";
import { CardWrapper } from "./shared/CardWrapper";

function formatApy(apy: number | null): string {
  if (apy === null) return "Fee-based";
  if (apy >= 10000) return `${(apy / 1000).toFixed(1)}k%`;
  return `${apy.toFixed(2)}%`;
}

function HeroOpportunity({ opp }: { opp: YieldOpportunity }) {
  const badge = YIELD_TYPE_BADGES[opp.type] ?? YIELD_TYPE_BADGES.farm;

  return (
    <div className="bg-zinc-900/60 border border-zinc-700/40 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.className}`}>
            {badge.label}
          </span>
          <span className="text-sm font-medium text-zinc-200">{opp.name}</span>
        </div>
        <div className="flex items-center gap-1.5" title={opp.risks.map((r) => r.label).join(", ")}>
          <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT_COLORS[opp.overallRisk]}`} />
          <span className="text-[10px] text-zinc-500 capitalize">{opp.overallRisk} risk</span>
        </div>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-2xl font-semibold font-mono text-teal-400">
          {formatApy(opp.apyPercent)}
        </span>
        {opp.apyPercent !== null && (
          <span className="text-xs text-zinc-500">APY</span>
        )}
        <span className="ml-auto text-xs text-zinc-500">
          {formatKas(opp.tvlKas)} KAS TVL
        </span>
      </div>
      <div className="mt-1.5 text-[11px] text-zinc-500">{opp.yieldSource}</div>
    </div>
  );
}

function CompactRow({ opp }: { opp: YieldOpportunity }) {
  const badge = YIELD_TYPE_BADGES[opp.type] ?? YIELD_TYPE_BADGES.farm;

  return (
    <div className="flex items-center justify-between py-2 border-b border-zinc-700/20 last:border-0">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.className}`}>
          {badge.label}
        </span>
        <span className="text-sm text-zinc-300">{opp.name}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${RISK_DOT_COLORS[opp.overallRisk]}`} title={opp.risks.map((r) => r.label).join(", ")} />
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-zinc-500">{formatKas(opp.tvlKas)} KAS</span>
        <span className="font-mono text-sm text-teal-400 w-20 text-right">
          {formatApy(opp.apyPercent)}
        </span>
      </div>
    </div>
  );
}

export function YieldOpportunitiesCard({ data }: { data: YieldOpportunitiesResult }) {
  const [showAll, setShowAll] = useState(false);

  if (data.opportunities.length === 0) {
    return (
      <CardWrapper>
        <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Yield Opportunities</div>
        <div className="text-sm text-zinc-500 text-center py-4">
          No yield opportunities found.
        </div>
      </CardWrapper>
    );
  }

  // Top 2 get hero treatment, rest go into the collapsible section
  const heroes = data.opportunities.slice(0, 2);
  const rest = data.opportunities.slice(2);

  return (
    <CardWrapper>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">Top Yield</div>
        <div className="text-xs text-zinc-600">
          {data.opportunities.length} opportunities
        </div>
      </div>

      {/* Hero cards */}
      <div className="flex flex-col gap-2 mb-1">
        {heroes.map((opp) => (
          <HeroOpportunity key={opp.id} opp={opp} />
        ))}
      </div>

      {/* Collapsible rest */}
      {rest.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowAll(!showAll)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
          >
            <svg
              className={`w-3 h-3 transition-transform ${showAll ? "rotate-90" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            {rest.length} more {rest.length === 1 ? "opportunity" : "opportunities"}
          </button>
          {showAll && (
            <div className="mt-2 border-t border-zinc-700/30 pt-1">
              {rest.map((opp) => (
                <CompactRow key={opp.id} opp={opp} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-3 text-[10px] text-zinc-600 leading-relaxed">
        APY estimates assume {data.blockTimeSeconds}s block time. Fee-based pools earn via exchange rate appreciation. Not financial advice.
      </div>
    </CardWrapper>
  );
}
