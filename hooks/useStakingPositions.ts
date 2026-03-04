"use client";

import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { useInfinityPoolData } from "./useInfinityPoolData";
import { erc20Abi } from "@/config/abis";

export interface StakingPosition {
  poolName: string;
  poolAddress: `0x${string}`;
  xTokenAddress: `0x${string}`;
  xTokenBalance: bigint;
  underlyingAmount: bigint;
  exchangeRate: bigint;
}

export function useStakingPositions() {
  const { address } = useAccount();
  const { pools, isLoading: poolsLoading } = useInfinityPoolData();

  const validPools = useMemo(
    () => pools.filter((p) => p.xTokenAddress !== "0x"),
    [pools]
  );

  const {
    data: xBalancesRaw,
    isLoading: balancesLoading,
    refetch,
  } = useReadContracts({
    contracts: validPools.map((pool) => ({
      address: pool.xTokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address!] as const,
    })),
    query: { enabled: !!address && validPools.length > 0 },
  });

  const positions = useMemo<StakingPosition[]>(() => {
    if (!xBalancesRaw) return [];
    return validPools.map((pool, i) => {
      const xBalance = (xBalancesRaw[i]?.result as bigint) ?? 0n;
      const underlyingAmount =
        pool.exchangeRate > 0n
          ? (xBalance * pool.exchangeRate) / 10n ** 18n
          : 0n;
      return {
        poolName: pool.name,
        poolAddress: pool.poolAddress,
        xTokenAddress: pool.xTokenAddress,
        xTokenBalance: xBalance,
        underlyingAmount,
        exchangeRate: pool.exchangeRate,
      };
    });
  }, [xBalancesRaw, validPools]);

  return {
    positions,
    isLoading: poolsLoading || balancesLoading,
    refetch,
  };
}
