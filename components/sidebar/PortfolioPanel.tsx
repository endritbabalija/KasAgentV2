"use client";

import type { Portfolio } from "@/hooks/usePortfolio";
import type { InfinityPoolInfo } from "@/hooks/useInfinityPoolData";
import { formatTokenAmount } from "@/lib/format";
import { useTokenRegistry } from "@/hooks/useTokenRegistry";
import { RefreshCw } from "lucide-react";

interface PortfolioPanelProps {
  portfolio: Portfolio;
  pools: InfinityPoolInfo[];
}

export function PortfolioPanel({ portfolio, pools }: PortfolioPanelProps) {
  const { getTokenSymbol, tokenMap } = useTokenRegistry();
  const getTokenDecimals = (address: string): number =>
    tokenMap.get(address.toLowerCase())?.decimals ?? 18;

  if (!portfolio.isConnected) {
    return (
      <div className="text-center py-10">
        <p className="text-zinc-500 text-sm">Connect wallet to view portfolio</p>
      </div>
    );
  }

  if (portfolio.isError) {
    return (
      <div className="text-center py-10 space-y-3">
        <p className="text-red-400 text-sm">Failed to load portfolio</p>
        <button
          onClick={() => portfolio.refetch()}
          className="text-xs text-zinc-400 hover:text-zinc-200 underline underline-offset-2 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (portfolio.isLoading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div>
          <div className="h-3 w-16 bg-zinc-800 rounded mb-3" />
          <div className="space-y-2">
            <div className="flex justify-between">
              <div className="h-3.5 w-12 bg-zinc-800 rounded" />
              <div className="h-3.5 w-20 bg-zinc-800 rounded" />
            </div>
            <div className="flex justify-between">
              <div className="h-3.5 w-14 bg-zinc-800 rounded" />
              <div className="h-3.5 w-16 bg-zinc-800 rounded" />
            </div>
            <div className="flex justify-between">
              <div className="h-3.5 w-10 bg-zinc-800 rounded" />
              <div className="h-3.5 w-24 bg-zinc-800 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    { label: "Tokens", count: portfolio.balances.length },
    { label: "LPs", count: portfolio.lpPositions.length },
    { label: "Farms", count: portfolio.farmPositions.length },
    { label: "Staked", count: portfolio.stakingPositions.filter((s) => s.xTokenBalance > 0n).length },
  ];

  return (
    <>
      {/* Refresh button */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Portfolio</h3>
        <button
          onClick={() => portfolio.refetch()}
          className="p-1.5 rounded hover:bg-zinc-800 transition-colors"
          aria-label="Refresh portfolio"
        >
          <RefreshCw
            className={`w-3 h-3 text-zinc-500 hover:text-zinc-300${
              portfolio.isFetching ? " animate-spin" : ""
            }`}
          />
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-2 bg-zinc-800/30 rounded-lg p-3 mb-5">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <div className="text-sm text-zinc-200 font-medium">{s.count}</div>
            <div className="text-xs text-zinc-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Token Balances */}
      <Section title="Balances">
        {portfolio.balances.length === 0 ? (
          <p className="text-xs text-zinc-600">No tokens found</p>
        ) : (
          <div className="space-y-1">
            {portfolio.balances.map((tb) => (
              <div key={tb.symbol} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300">{tb.symbol}</span>
                <span className="text-zinc-400 font-mono text-xs">
                  {formatTokenAmount(tb.balance, tb.decimals)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* LP Positions */}
      {portfolio.lpPositions.length > 0 && (
        <Section title="LP Positions">
          <div className="space-y-2">
            {portfolio.lpPositions.map((lp) => (
              <div key={lp.pairAddress} className="bg-zinc-900/50 rounded-lg p-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-300">
                    {getTokenSymbol(lp.token0)}/{getTokenSymbol(lp.token1)}
                  </span>
                  <span className="text-zinc-500 font-mono text-xs">
                    {formatTokenAmount(lp.lpBalance, 18)}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-zinc-500">
                  <span>
                    {getTokenSymbol(lp.token0)}: {formatTokenAmount(lp.token0Amount, getTokenDecimals(lp.token0))}
                  </span>
                  <span>
                    {getTokenSymbol(lp.token1)}: {formatTokenAmount(lp.token1Amount, getTokenDecimals(lp.token1))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Farm Positions */}
      {portfolio.farmPositions.length > 0 && (
        <Section title="Farms">
          <div className="space-y-2">
            {portfolio.farmPositions.map((fp) => (
              <div key={fp.pid} className="bg-zinc-900/50 rounded-lg p-2 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-300">Pool #{fp.pid}</span>
                  <span className="text-xs text-zinc-500">
                    {fp.canWithdraw ? "Unlocked" : "Locked"}
                  </span>
                </div>
                <div className="flex gap-3 text-xs text-zinc-500">
                  <span>Staked: {formatTokenAmount(fp.stakedAmount, 18)}</span>
                  <span>Rewards: {formatTokenAmount(fp.pendingReward, 18)}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Staking Positions */}
      {portfolio.stakingPositions.some((s) => s.xTokenBalance > 0n) && (
        <Section title="Staking">
          <div className="space-y-2">
            {portfolio.stakingPositions
              .filter((sp) => sp.xTokenBalance > 0n)
              .map((sp) => (
                <div key={sp.poolName} className="bg-zinc-900/50 rounded-lg p-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-300">x{sp.poolName}</span>
                    <span className="text-zinc-500 font-mono text-xs">
                      {formatTokenAmount(sp.xTokenBalance, 18)}
                    </span>
                  </div>
                  <div className="text-xs text-zinc-500">
                    = {formatTokenAmount(sp.underlyingAmount, 18)} {sp.poolName} (
                    {formatTokenAmount(sp.exchangeRate, 18, 6)}x)
                  </div>
                </div>
              ))}
          </div>
        </Section>
      )}

      {/* Infinity Pools */}
      {pools.length > 0 && (
        <Section title="InfinityPool Rates">
          <div className="space-y-1">
            {pools.map((pool) => (
              <div key={pool.name} className="flex justify-between text-sm">
                <span className="text-zinc-300">{pool.name}</span>
                <span className="font-mono text-xs text-zinc-500">
                  {formatTokenAmount(pool.exchangeRate, 18, 6)}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}
