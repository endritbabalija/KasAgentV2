"use client";

import { useState, useEffect, useCallback } from "react";
import type { FeedInsight } from "@/lib/feed/types";
import type { Portfolio } from "@/hooks/usePortfolio";
import type { InfinityPoolInfo } from "@/hooks/useInfinityPoolData";
import {
  serializePortfolio,
  serializeInfinityPools,
} from "@/lib/ai/serializers";
import { useTokenRegistry } from "@/hooks/useTokenRegistry";

export function useFeedInsights(portfolio: Portfolio, pools: InfinityPoolInfo[]) {
  const [insights, setInsights] = useState<FeedInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getTokenSymbol, tokenMap } = useTokenRegistry();

  const getTokenDecimals = useCallback(
    (address: string): number =>
      tokenMap.get(address.toLowerCase())?.decimals ?? 18,
    [tokenMap]
  );

  useEffect(() => {
    if (!portfolio.isConnected || !portfolio.address || portfolio.isLoading) {
      setInsights([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const serialized = serializePortfolio(
      portfolio.address,
      portfolio.balances,
      portfolio.lpPositions,
      portfolio.farmPositions,
      portfolio.farmGlobals,
      portfolio.stakingPositions,
      getTokenSymbol,
      getTokenDecimals
    );

    fetch("/api/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        portfolio: serialized,
        infinityPools: serializeInfinityPools(pools),
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Feed API error");
        return res.json();
      })
      .then((data: FeedInsight[]) => {
        if (!cancelled) setInsights(data);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[useFeedInsights]", err);
          setError("Failed to load insights");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [
    portfolio.isConnected,
    portfolio.address,
    portfolio.isLoading,
    portfolio.balances,
    portfolio.lpPositions,
    portfolio.farmPositions,
    portfolio.farmGlobals,
    portfolio.stakingPositions,
    pools,
    getTokenSymbol,
    getTokenDecimals,
  ]);

  return { insights, isLoading, error };
}
