import type { FeedInsight } from "./types";
import type { SerializedPortfolio, SerializedInfinityPool } from "@/lib/ai/serializers";

/**
 * Compute feed insights from a user's portfolio and pool data.
 * Runs server-side. Returns insights sorted by priority (highest first).
 */
export function computeInsights(
  portfolio: SerializedPortfolio,
  pools: SerializedInfinityPool[]
): FeedInsight[] {
  const insights: FeedInsight[] = [];

  // --- 1. Idle Capital ---
  // Tokens with meaningful balance that aren't staked/farmed/LP'd
  const lpTokenSymbols = new Set(
    portfolio.lpPositions.flatMap((lp) => {
      const parts = lp.pair.split("/");
      return parts;
    })
  );
  const stakedPools = new Set(
    portfolio.stakingPositions
      .filter((sp) => parseFloat(sp.xTokenBalance) > 0)
      .map((sp) => sp.pool)
  );

  for (const bal of portfolio.balances) {
    const amount = parseFloat(bal.balance);
    if (amount <= 0) continue;

    // Skip if this token is actively used somewhere
    const isInLP = lpTokenSymbols.has(bal.symbol);
    const isStaked = stakedPools.has(bal.symbol);

    // For KAS/WKAS, higher threshold since it's the native token
    const threshold = bal.symbol === "KAS" || bal.symbol === "WKAS" ? 100 : 10;

    if (amount > threshold && !isInLP && !isStaked) {
      const priority = Math.min(90, Math.floor(30 + amount / 100));
      insights.push({
        id: `idle-${bal.symbol}`,
        type: "idle-capital",
        priority,
        title: `${formatCompact(amount)} ${bal.symbol} sitting idle`,
        description: `Explore yield opportunities for your ${bal.symbol}`,
        actionPrompt: `Find the best yield opportunities for my ${bal.symbol}`,
        tokens: [bal.symbol],
        metrics: { balance: bal.balance },
      });
    }
  }

  // --- 2. Harvest Reminder ---
  // Pending farm rewards above a small threshold
  for (const fp of portfolio.farmPositions) {
    const pending = parseFloat(fp.pendingReward);
    if (pending > 0.01) {
      const priority = Math.min(85, Math.floor(50 + pending * 10));
      insights.push({
        id: `harvest-${fp.pid}`,
        type: "harvest-reminder",
        priority,
        title: `${formatCompact(pending)} ${portfolio.farmGlobals.rewardToken} to harvest`,
        description: `Farm #${fp.pid} has unclaimed rewards`,
        actionPrompt: `Unstake from farm ${fp.pid} to claim my pending rewards`,
        tokens: [portfolio.farmGlobals.rewardToken],
        metrics: { pending: fp.pendingReward, pid: String(fp.pid) },
      });
    }
  }

  // --- 3. Better Yield ---
  // If user has InfinityPool staking but ZEAL emissions are paused
  for (const pool of pools) {
    if (pool.emissionsPaused && pool.name === "ZEAL") {
      const userStake = portfolio.stakingPositions.find(
        (sp) => sp.pool === "ZEAL" && parseFloat(sp.xTokenBalance) > 0
      );
      if (userStake) {
        insights.push({
          id: "better-yield-zeal-paused",
          type: "better-yield",
          priority: 70,
          title: "ZEAL emissions paused",
          description: "Your xZEAL staking is not earning emission rewards right now. Consider other options.",
          actionPrompt: "What are the best yield opportunities for my ZEAL?",
          tokens: ["ZEAL"],
        });
      }
    }
  }

  // Sort by priority (highest first)
  insights.sort((a, b) => b.priority - a.priority);

  return insights;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}
