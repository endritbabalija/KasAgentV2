"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import {
  infinityPoolZealAbi,
  infinityPoolNachoAbi,
  infinityPoolKasperAbi,
} from "@/config/abis";

export interface InfinityPoolInfo {
  name: string;
  poolAddress: `0x${string}`;
  exchangeRate: bigint;
  totalStaked: bigint;
  xTokenAddress: `0x${string}`;
  zealPerBlock?: bigint;
  emissionsPaused?: boolean;
}

export function useInfinityPoolData(enabled: boolean = true) {
  const { data, isLoading, isError, refetch } = useReadContracts({
    contracts: [
      // ZEAL pool (indices 0-4)
      {
        address: CONTRACTS.INFINITY_POOL_ZEAL,
        abi: infinityPoolZealAbi,
        functionName: "getExchangeRate" as const,
      },
      {
        address: CONTRACTS.INFINITY_POOL_ZEAL,
        abi: infinityPoolZealAbi,
        functionName: "totalStaked" as const,
      },
      {
        address: CONTRACTS.INFINITY_POOL_ZEAL,
        abi: infinityPoolZealAbi,
        functionName: "zealPerBlock" as const,
      },
      {
        address: CONTRACTS.INFINITY_POOL_ZEAL,
        abi: infinityPoolZealAbi,
        functionName: "emissionsPaused" as const,
      },
      {
        address: CONTRACTS.INFINITY_POOL_ZEAL,
        abi: infinityPoolZealAbi,
        functionName: "xZealToken" as const,
      },
      // NACHO pool (indices 5-7)
      {
        address: CONTRACTS.INFINITY_POOL_NACHO,
        abi: infinityPoolNachoAbi,
        functionName: "getExchangeRate" as const,
      },
      {
        address: CONTRACTS.INFINITY_POOL_NACHO,
        abi: infinityPoolNachoAbi,
        functionName: "totalStaked" as const,
      },
      {
        address: CONTRACTS.INFINITY_POOL_NACHO,
        abi: infinityPoolNachoAbi,
        functionName: "xNachoToken" as const,
      },
      // KASPER pool (indices 8-10)
      {
        address: CONTRACTS.INFINITY_POOL_KASPER,
        abi: infinityPoolKasperAbi,
        functionName: "getExchangeRate" as const,
      },
      {
        address: CONTRACTS.INFINITY_POOL_KASPER,
        abi: infinityPoolKasperAbi,
        functionName: "totalStaked" as const,
      },
      {
        address: CONTRACTS.INFINITY_POOL_KASPER,
        abi: infinityPoolKasperAbi,
        functionName: "xKasperToken" as const,
      },
    ],
    query: { enabled },
  });

  const pools = useMemo<InfinityPoolInfo[]>(() => {
    if (!data) return [];
    return [
      {
        name: "ZEAL",
        poolAddress: CONTRACTS.INFINITY_POOL_ZEAL,
        exchangeRate: (data[0]?.result as bigint) ?? 0n,
        totalStaked: (data[1]?.result as bigint) ?? 0n,
        zealPerBlock: (data[2]?.result as bigint) ?? 0n,
        emissionsPaused: (data[3]?.result as boolean) ?? false,
        xTokenAddress:
          (data[4]?.result as `0x${string}`) ?? ("0x" as `0x${string}`),
      },
      {
        name: "NACHO",
        poolAddress: CONTRACTS.INFINITY_POOL_NACHO,
        exchangeRate: (data[5]?.result as bigint) ?? 0n,
        totalStaked: (data[6]?.result as bigint) ?? 0n,
        xTokenAddress:
          (data[7]?.result as `0x${string}`) ?? ("0x" as `0x${string}`),
      },
      {
        name: "KASPER",
        poolAddress: CONTRACTS.INFINITY_POOL_KASPER,
        exchangeRate: (data[8]?.result as bigint) ?? 0n,
        totalStaked: (data[9]?.result as bigint) ?? 0n,
        xTokenAddress:
          (data[10]?.result as `0x${string}`) ?? ("0x" as `0x${string}`),
      },
    ];
  }, [data]);

  return { pools, isLoading, isError, refetch };
}
