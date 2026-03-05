"use client";

import { ChevronRight, ChevronLeft } from "lucide-react";
import type { Portfolio } from "@/hooks/usePortfolio";
import type { InfinityPoolInfo } from "@/hooks/useInfinityPoolData";
import { formatTokenAmount } from "@/lib/format";
import { getTokenSymbol } from "@/lib/token-utils";

interface PortfolioSidebarProps {
  portfolio: Portfolio;
  pools: InfinityPoolInfo[];
  isOpen: boolean;
  onToggle: () => void;
}

export function PortfolioSidebar({
  portfolio,
  pools,
  isOpen,
  onToggle,
}: PortfolioSidebarProps) {
  return (
    <>
      {/* Collapsed toggle */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="hidden md:flex items-center justify-center w-6 shrink-0 border-r border-zinc-800 hover:bg-zinc-800/50 transition-colors group"
          aria-label="Open sidebar"
        >
          <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300" />
        </button>
      )}

      {/* Sidebar panel */}
      <aside
        className={`shrink-0 border-r border-zinc-800 bg-zinc-950/50 transition-all duration-300 overflow-hidden hidden md:block ${
          isOpen ? "w-72" : "w-0"
        }`}
      >
        <div className="w-72 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-sm font-semibold text-zinc-300">
              Portfolio
            </span>
            <button
              onClick={onToggle}
              className="p-1 rounded hover:bg-zinc-800 transition-colors"
              aria-label="Close sidebar"
            >
              <ChevronLeft className="w-4 h-4 text-zinc-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
            {!portfolio.isConnected ? (
              <div className="text-center py-10">
                <p className="text-zinc-500 text-sm">
                  Connect wallet to view portfolio
                </p>
              </div>
            ) : (
              <>
                {/* Token Balances */}
                <Section title="Balances">
                  {portfolio.balances.length === 0 ? (
                    <p className="text-xs text-zinc-600">No tokens found</p>
                  ) : (
                    <div className="space-y-1">
                      {portfolio.balances.map((tb) => (
                        <div
                          key={tb.symbol}
                          className="flex items-center justify-between text-sm"
                        >
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
                        <div
                          key={lp.pairAddress}
                          className="bg-zinc-900/50 rounded-lg p-2 space-y-1"
                        >
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-300">
                              {getTokenSymbol(lp.token0)}/
                              {getTokenSymbol(lp.token1)}
                            </span>
                            <span className="text-zinc-500 font-mono text-xs">
                              {formatTokenAmount(lp.lpBalance, 18)}
                            </span>
                          </div>
                          <div className="flex gap-3 text-xs text-zinc-500">
                            <span>
                              {getTokenSymbol(lp.token0)}:{" "}
                              {formatTokenAmount(lp.token0Amount, 18)}
                            </span>
                            <span>
                              {getTokenSymbol(lp.token1)}:{" "}
                              {formatTokenAmount(lp.token1Amount, 18)}
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
                        <div
                          key={fp.pid}
                          className="bg-zinc-900/50 rounded-lg p-2 space-y-1"
                        >
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-300">
                              Pool #{fp.pid}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {fp.canWithdraw ? "Unlocked" : "Locked"}
                            </span>
                          </div>
                          <div className="flex gap-3 text-xs text-zinc-500">
                            <span>
                              Staked: {formatTokenAmount(fp.stakedAmount, 18)}
                            </span>
                            <span>
                              Rewards:{" "}
                              {formatTokenAmount(fp.pendingReward, 18)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Staking Positions */}
                {portfolio.stakingPositions.some(
                  (s) => s.xTokenBalance > 0n
                ) && (
                  <Section title="Staking">
                    <div className="space-y-2">
                      {portfolio.stakingPositions
                        .filter((sp) => sp.xTokenBalance > 0n)
                        .map((sp) => (
                          <div
                            key={sp.poolName}
                            className="bg-zinc-900/50 rounded-lg p-2 space-y-1"
                          >
                            <div className="flex justify-between text-sm">
                              <span className="text-zinc-300">
                                x{sp.poolName}
                              </span>
                              <span className="text-zinc-500 font-mono text-xs">
                                {formatTokenAmount(sp.xTokenBalance, 18)}
                              </span>
                            </div>
                            <div className="text-xs text-zinc-500">
                              ={" "}
                              {formatTokenAmount(sp.underlyingAmount, 18)}{" "}
                              {sp.poolName} (
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
                        <div
                          key={pool.name}
                          className="flex justify-between text-sm"
                        >
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
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}
