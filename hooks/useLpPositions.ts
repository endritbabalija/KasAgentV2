"use client";

import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { useAllPairs } from "./useAllPairs";
import { pairAbi } from "@/config/abis";

export interface LpPosition {
  pairAddress: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  lpBalance: bigint;
  token0Amount: bigint;
  token1Amount: bigint;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
}

export function useLpPositions() {
  const { address } = useAccount();
  const { pairs, isLoading: pairsLoading } = useAllPairs(!!address);

  const {
    data: lpBalancesRaw,
    isLoading: balancesLoading,
    isError: balancesError,
    isFetching: balancesFetching,
    refetch,
  } = useReadContracts({
    contracts: pairs.map((pair) => ({
      address: pair.address,
      abi: pairAbi,
      functionName: "balanceOf" as const,
      args: [address!] as const,
    })),
    query: { enabled: !!address && pairs.length > 0 },
  });

  const positions = useMemo<LpPosition[]>(() => {
    if (!lpBalancesRaw) return [];
    return pairs
      .map((pair, i) => {
        const balance = (lpBalancesRaw[i]?.result as bigint) ?? 0n;
        if (balance === 0n) return null;
        const token0Amount =
          pair.totalSupply > 0n
            ? (balance * pair.reserve0) / pair.totalSupply
            : 0n;
        const token1Amount =
          pair.totalSupply > 0n
            ? (balance * pair.reserve1) / pair.totalSupply
            : 0n;
        return {
          pairAddress: pair.address,
          token0: pair.token0,
          token1: pair.token1,
          lpBalance: balance,
          token0Amount,
          token1Amount,
          reserve0: pair.reserve0,
          reserve1: pair.reserve1,
          totalSupply: pair.totalSupply,
        };
      })
      .filter((p): p is LpPosition => p !== null);
  }, [lpBalancesRaw, pairs]);

  return {
    positions,
    isLoading: pairsLoading || balancesLoading,
    isFetching: balancesFetching,
    isError: balancesError,
    refetch,
  };
}
