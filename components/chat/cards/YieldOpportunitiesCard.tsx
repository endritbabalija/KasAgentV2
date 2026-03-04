import type { YieldOpportunitiesResult, YieldOpportunity, RiskLevel } from "@/lib/ai/tool-types";

function formatKas(n: number): string {
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

function formatApy(apy: number | null): string {
  if (apy === null) return "Fee-based";
  if (apy >= 10000) return `${(apy / 1000).toFixed(1)}k%`;
  return `${apy.toFixed(2)}%`;
}

const typeBadge: Record<string, { label: string; className: string }> = {
  farm: { label: "Farm", className: "bg-teal-900/40 text-teal-400" },
  infinity_pool: { label: "Stake", className: "bg-blue-900/40 text-blue-400" },
};

const riskColors: Record<RiskLevel, string> = {
  low: "bg-emerald-900/40 text-emerald-400",
  medium: "bg-yellow-900/40 text-yellow-400",
  high: "bg-red-900/40 text-red-400",
};

function RiskBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${riskColors[level]}`}>
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function OpportunityRow({ opp }: { opp: YieldOpportunity }) {
  const badge = typeBadge[opp.type] ?? typeBadge.farm;

  return (
    <tr className="border-b border-zinc-700/30 last:border-0">
      {/* Name + type badge */}
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${badge.className}`}>
            {badge.label}
          </span>
          <span className="text-sm text-zinc-200">{opp.name}</span>
        </div>
      </td>
      {/* APY */}
      <td className="py-2.5 pr-3 font-mono text-sm text-right">
        {opp.apyPercent !== null ? (
          <span className="text-teal-400">{formatApy(opp.apyPercent)}</span>
        ) : (
          <span className="text-zinc-500 text-xs">{formatApy(null)}</span>
        )}
      </td>
      {/* TVL */}
      <td className="py-2.5 pr-3 font-mono text-sm text-right text-zinc-300">
        {formatKas(opp.tvlKas)} KAS
      </td>
      {/* Source */}
      <td className="py-2.5 pr-3 text-xs text-zinc-400">{opp.yieldSource}</td>
      {/* Risk */}
      <td className="py-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <RiskBadge level={opp.overallRisk} />
          {opp.risks.length > 0 && (
            <span className="text-[10px] text-zinc-600" title={opp.risks.map((r) => r.label).join(", ")}>
              ({opp.risks.length} flag{opp.risks.length !== 1 ? "s" : ""})
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

export function YieldOpportunitiesCard({ data }: { data: YieldOpportunitiesResult }) {
  const prices = data.tokenPricesInKas;
  const priceEntries = Object.entries(prices).filter(([sym]) => sym !== "KAS" && sym !== "WKAS");

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">Yield Opportunities</div>
        <div className="text-xs text-zinc-600">
          {data.opportunities.length} found
        </div>
      </div>

      {/* Token prices bar */}
      {priceEntries.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-3 px-2 py-1.5 bg-zinc-900/50 rounded-lg">
          {priceEntries.map(([sym, price]) => (
            <div key={sym} className="text-xs">
              <span className="text-zinc-500">1 {sym} = </span>
              <span className="font-mono text-teal-400">{formatKas(price)}</span>
              <span className="text-zinc-600"> KAS</span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {data.opportunities.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-zinc-500 border-b border-zinc-700/50">
                <th className="pb-2 pr-3">Opportunity</th>
                <th className="pb-2 pr-3 text-right">APY</th>
                <th className="pb-2 pr-3 text-right">TVL</th>
                <th className="pb-2 pr-3">Source</th>
                <th className="pb-2">Risk</th>
              </tr>
            </thead>
            <tbody>
              {data.opportunities.map((opp) => (
                <OpportunityRow key={opp.id} opp={opp} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-sm text-zinc-500 text-center py-4">
          No yield opportunities found.
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-3 text-[10px] text-zinc-600 leading-relaxed">
        APY estimates assume {data.blockTimeSeconds}s block time. Actual returns may vary. Fee-based pools earn yield
        through exchange rate appreciation — APY depends on historical trading volume. This is not financial advice.
      </div>
    </div>
  );
}
