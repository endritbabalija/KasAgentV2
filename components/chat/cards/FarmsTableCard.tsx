import type { ActiveFarmsResult } from "@/lib/ai/tool-types";

function formatAmount(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return val;
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
}

export function FarmsTableCard({ data }: { data: ActiveFarmsResult }) {
  const totalAlloc = parseInt(data.totalAllocPoint) || 1;

  return (
    <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-zinc-500 uppercase tracking-wide">Active Farms</div>
        <div className="text-xs text-zinc-500">
          Reward: <span className="font-mono text-teal-400">{data.rewardToken}</span>{" "}
          ({formatAmount(data.rewardPerBlock)}/block)
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-zinc-500 border-b border-zinc-700/50">
              <th className="pb-2 pr-4">Pool ID</th>
              <th className="pb-2 pr-4">Alloc %</th>
              <th className="pb-2 pr-4">Total Deposited</th>
              <th className="pb-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.farms.map((farm) => {
              const allocPct = ((parseInt(farm.allocPoint) / totalAlloc) * 100).toFixed(1);
              return (
                <tr key={farm.pid} className="border-b border-zinc-700/30 last:border-0">
                  <td className="py-2 pr-4 font-mono text-zinc-300">#{farm.pid}</td>
                  <td className="py-2 pr-4 font-mono text-teal-400">{allocPct}%</td>
                  <td className="py-2 pr-4 font-mono text-teal-400">{formatAmount(farm.totalDeposited)}</td>
                  <td className="py-2">
                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs ${
                        farm.isActive
                          ? "bg-emerald-900/40 text-emerald-400"
                          : "bg-zinc-700/50 text-zinc-500"
                      }`}
                    >
                      {farm.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
