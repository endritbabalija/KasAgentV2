"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import type { FeedInsight } from "@/lib/feed/types";
import type { Portfolio } from "@/hooks/usePortfolio";
import type { InfinityPoolInfo } from "@/hooks/useInfinityPoolData";
import {
  serializePortfolio,
  serializeInfinityPools,
} from "@/lib/ai/serializers";
import { useTokenRegistry } from "@/hooks/useTokenRegistry";
import { useAuth } from "@/lib/auth-provider";

export function useFeedInsights(portfolio: Portfolio, pools: InfinityPoolInfo[]) {
  const { getTokenSymbol, tokenMap } = useTokenRegistry();
  const auth = useAuth();

  const getTokenDecimals = useCallback(
    (address: string): number =>
      tokenMap.get(address.toLowerCase())?.decimals ?? 18,
    [tokenMap]
  );

  const enabled =
    auth.isAuthenticated &&
    portfolio.isConnected &&
    !!portfolio.address &&
    !portfolio.isLoading;

  const {
    data: insights = [],
    isLoading,
    error,
  } = useQuery<FeedInsight[]>({
    queryKey: ["feed", portfolio.address],
    queryFn: async ({ signal }) => {
      const serialized = serializePortfolio(
        portfolio.address!,
        portfolio.balances,
        portfolio.lpPositions,
        portfolio.farmPositions,
        portfolio.farmGlobals,
        portfolio.stakingPositions,
        getTokenSymbol,
        getTokenDecimals
      );

      const res = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          portfolio: serialized,
          infinityPools: serializeInfinityPools(pools),
        }),
        signal,
      });
      if (!res.ok) throw new Error("Feed API error");
      return res.json() as Promise<FeedInsight[]>;
    },
    enabled,
    staleTime: 120_000, // match 2-minute server cache TTL
    retry: false,
  });

  return {
    insights,
    isLoading: enabled && isLoading,
    error: error ? "Failed to load insights" : null,
  };
}
