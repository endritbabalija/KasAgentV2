"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { masterchefAbi } from "@/config/abis";

export interface ActiveFarm {
  pid: number;
  lpToken: `0x${string}`;
  allocPoint: bigint;
  totalDeposited: bigint;
  isActive: boolean;
  poolShare: bigint;
}

export interface FarmGlobals {
  rewardPerBlock: bigint;
  totalAllocPoint: bigint;
  rewardToken: `0x${string}`;
}

export function useActiveFarms(enabled: boolean = true) {
  // Step 1: Get globals
  const {
    data: globalsRaw,
    isLoading: globalsLoading,
    isError: globalsError,
    refetch: globalsRefetch,
  } = useReadContracts({
    contracts: [
      {
        address: CONTRACTS.MASTER_CHEF,
        abi: masterchefAbi,
        functionName: "getActivePools" as const,
      },
      {
        address: CONTRACTS.MASTER_CHEF,
        abi: masterchefAbi,
        functionName: "rewardPerBlock" as const,
      },
      {
        address: CONTRACTS.MASTER_CHEF,
        abi: masterchefAbi,
        functionName: "totalAllocPoint" as const,
      },
      {
        address: CONTRACTS.MASTER_CHEF,
        abi: masterchefAbi,
        functionName: "rewardToken" as const,
      },
    ],
    query: { enabled },
  });

  const activePools = useMemo<number[]>(() => {
    if (!globalsRaw?.[0]?.result) return [];
    return (globalsRaw[0].result as bigint[]).map(Number);
  }, [globalsRaw]);

  const globals = useMemo<FarmGlobals>(() => {
    return {
      rewardPerBlock: (globalsRaw?.[1]?.result as bigint) ?? 0n,
      totalAllocPoint: (globalsRaw?.[2]?.result as bigint) ?? 0n,
      rewardToken:
        (globalsRaw?.[3]?.result as `0x${string}`) ??
        ("0x" as `0x${string}`),
    };
  }, [globalsRaw]);

  // Step 2: Get pool info for each active pool
  const {
    data: poolInfosRaw,
    isLoading: poolsLoading,
    isError: poolsError,
    refetch: poolsRefetch,
  } = useReadContracts({
    contracts: activePools.map((pid) => ({
      address: CONTRACTS.MASTER_CHEF,
      abi: masterchefAbi,
      functionName: "getPoolInfo" as const,
      args: [BigInt(pid)] as const,
    })),
    query: { enabled: enabled && activePools.length > 0 },
  });

  const farms = useMemo<ActiveFarm[]>(() => {
    if (!poolInfosRaw) return [];
    return activePools.map((pid, i) => {
      const info = poolInfosRaw[i]?.result as
        | readonly [
            string,
            bigint,
            bigint,
            bigint,
            bigint,
            boolean,
            boolean,
            bigint
          ]
        | undefined;
      return {
        pid,
        lpToken: (info?.[0] as `0x${string}`) ?? ("0x" as `0x${string}`),
        allocPoint: info?.[1] ?? 0n,
        totalDeposited: info?.[4] ?? 0n,
        isActive: info?.[5] ?? false,
        poolShare: info?.[7] ?? 0n,
      };
    });
  }, [poolInfosRaw, activePools]);

  return {
    activePools,
    farms,
    globals,
    isLoading: globalsLoading || poolsLoading,
    isError: globalsError || poolsError,
    refetch: () => {
      globalsRefetch();
      poolsRefetch();
    },
  };
}
