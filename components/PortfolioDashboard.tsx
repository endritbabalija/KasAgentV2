"use client";

import { useReadContract } from "wagmi";
import { usePortfolio } from "@/hooks/usePortfolio";
import { useInfinityPoolData } from "@/hooks/useInfinityPoolData";
import { useTokenRegistry } from "@/hooks/useTokenRegistry";
import { formatTokenAmount } from "@/lib/format";
import { CONTRACTS } from "@/config/contracts";
import { factoryAbi, masterchefAbi } from "@/config/abis";

export function PortfolioDashboard() {
  const portfolio = usePortfolio();
  const { pools: infinityPools } = useInfinityPoolData();
  const { getTokenSymbol } = useTokenRegistry();

  const { data: pairCountRaw } = useReadContract({
    address: CONTRACTS.FACTORY,
    abi: factoryAbi,
    functionName: "allPairsLength",
  });
  const pairCount = pairCountRaw !== undefined ? Number(pairCountRaw) : 0;

  const { data: activePoolsRaw } = useReadContract({
    address: CONTRACTS.MASTER_CHEF,
    abi: masterchefAbi,
    functionName: "getActivePools",
  });
  const farmPoolIds = (activePoolsRaw as bigint[]) ?? [];

  if (!portfolio.isConnected) {
    return (
      <div className="text-center py-20">
        <h2 className="text-3xl font-bold mb-3">Welcome to KasAgent</h2>
        <p className="text-zinc-400 mb-6">
          AI-powered DeFi copilot for Kasplex L2
        </p>
        <p className="text-zinc-500 text-sm">
          Connect your wallet to view your portfolio
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Token Balances */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Token Balances</h2>
        <div className="bg-zinc-900 rounded-xl border border-zinc-800 divide-y divide-zinc-800">
          {portfolio.balances.map((tb) => (
            <div
              key={tb.symbol}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="font-medium">{tb.symbol}</span>
              <span className="text-zinc-300 font-mono text-sm">
                {formatTokenAmount(tb.balance, tb.decimals)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* LP Positions */}
      {portfolio.lpPositions.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">LP Positions</h2>
          <div className="space-y-3">
            {portfolio.lpPositions.map((lp) => (
              <div
                key={lp.pairAddress}
                className="bg-zinc-900 rounded-xl border border-zinc-800 p-4"
              >
                <div className="flex justify-between mb-2">
                  <span className="font-medium">
                    {getTokenSymbol(lp.token0)} / {getTokenSymbol(lp.token1)}
                  </span>
                  <span className="text-zinc-400 text-sm font-mono">
                    LP: {formatTokenAmount(lp.lpBalance, 18)}
                  </span>
                </div>
                <div className="text-sm text-zinc-400 flex gap-4">
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
        </section>
      )}

      {/* Farm Positions */}
      {portfolio.farmPositions.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Farm Positions</h2>
          <div className="space-y-3">
            {portfolio.farmPositions.map((fp) => (
              <div
                key={fp.pid}
                className="bg-zinc-900 rounded-xl border border-zinc-800 p-4"
              >
                <div className="flex justify-between mb-1">
                  <span className="font-medium">Pool #{fp.pid}</span>
                  <span className="text-sm text-zinc-400">
                    {fp.canWithdraw ? "Unlocked" : "Locked"}
                  </span>
                </div>
                <div className="text-sm text-zinc-400 flex gap-4">
                  <span>
                    Staked: {formatTokenAmount(fp.stakedAmount, 18)}
                  </span>
                  <span>
                    Pending: {formatTokenAmount(fp.pendingReward, 18)}{" "}
                    {getTokenSymbol(portfolio.farmGlobals.rewardToken)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Staking Positions */}
      {portfolio.stakingPositions.some((s) => s.xTokenBalance > 0n) && (
        <section>
          <h2 className="text-lg font-semibold mb-3">Staking Positions</h2>
          <div className="space-y-3">
            {portfolio.stakingPositions
              .filter((sp) => sp.xTokenBalance > 0n)
              .map((sp) => (
                <div
                  key={sp.poolName}
                  className="bg-zinc-900 rounded-xl border border-zinc-800 p-4"
                >
                  <div className="flex justify-between mb-1">
                    <span className="font-medium">x{sp.poolName} Pool</span>
                    <span className="text-sm text-zinc-400 font-mono">
                      x{sp.poolName}:{" "}
                      {formatTokenAmount(sp.xTokenBalance, 18)}
                    </span>
                  </div>
                  <div className="text-sm text-zinc-400">
                    Underlying:{" "}
                    {formatTokenAmount(sp.underlyingAmount, 18)}{" "}
                    {sp.poolName} (rate:{" "}
                    {formatTokenAmount(sp.exchangeRate, 18, 6)})
                  </div>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Discovery */}
      <section>
        <h2 className="text-lg font-semibold mb-3">Discovery</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <p className="text-zinc-400 text-sm mb-1">DEX Pairs</p>
            <p className="text-2xl font-bold">{pairCount}</p>
          </div>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <p className="text-zinc-400 text-sm mb-1">Active Farms</p>
            <p className="text-2xl font-bold">{farmPoolIds.length}</p>
          </div>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-4">
            <p className="text-zinc-400 text-sm mb-1">InfinityPool Rates</p>
            {infinityPools.length > 0 ? (
              <div className="space-y-1 mt-1">
                {infinityPools.map((pool) => (
                  <div
                    key={pool.name}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-zinc-300">{pool.name}</span>
                    <span className="font-mono text-zinc-400">
                      {formatTokenAmount(pool.exchangeRate, 18, 6)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">Loading...</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
