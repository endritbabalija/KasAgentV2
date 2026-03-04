"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { CONTRACTS } from "@/config/contracts";
import { factoryAbi } from "@/config/abis";
import { pairAbi } from "@/config/abis";

export interface PairInfo {
  address: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
}

export function useAllPairs(enabled: boolean = true) {
  // Step 1: Get pair count
  const {
    data: pairCount,
    isLoading: countLoading,
    refetch: countRefetch,
  } = useReadContract({
    address: CONTRACTS.FACTORY,
    abi: factoryAbi,
    functionName: "allPairsLength",
    query: { enabled },
  });

  // Step 2: Get pair addresses
  const pairIndices = useMemo(() => {
    if (pairCount === undefined) return [];
    return Array.from({ length: Number(pairCount) }, (_, i) => i);
  }, [pairCount]);

  const {
    data: pairAddressesRaw,
    isLoading: addressesLoading,
    refetch: addressesRefetch,
  } = useReadContracts({
    contracts: pairIndices.map((i) => ({
      address: CONTRACTS.FACTORY,
      abi: factoryAbi,
      functionName: "allPairs" as const,
      args: [BigInt(i)] as const,
    })),
    query: { enabled: enabled && pairIndices.length > 0 },
  });

  const pairAddresses = useMemo(() => {
    if (!pairAddressesRaw) return [];
    return pairAddressesRaw
      .filter((r) => r.status === "success")
      .map((r) => r.result as `0x${string}`);
  }, [pairAddressesRaw]);

  // Step 3: Get pair details (token0, token1, reserves, totalSupply per pair)
  const {
    data: pairDetailsRaw,
    isLoading: detailsLoading,
    refetch: detailsRefetch,
  } = useReadContracts({
    contracts: pairAddresses.flatMap((addr) => [
      { address: addr, abi: pairAbi, functionName: "token0" as const },
      { address: addr, abi: pairAbi, functionName: "token1" as const },
      { address: addr, abi: pairAbi, functionName: "getReserves" as const },
      { address: addr, abi: pairAbi, functionName: "totalSupply" as const },
    ]),
    query: { enabled: enabled && pairAddresses.length > 0 },
  });

  const pairs = useMemo<PairInfo[]>(() => {
    if (!pairDetailsRaw || !pairAddresses.length) return [];
    return pairAddresses.map((addr, i) => {
      const base = i * 4;
      const reserves = pairDetailsRaw[base + 2]?.result as
        | readonly [bigint, bigint, bigint]
        | undefined;
      return {
        address: addr,
        token0: (pairDetailsRaw[base]?.result as `0x${string}`) ?? "0x",
        token1: (pairDetailsRaw[base + 1]?.result as `0x${string}`) ?? "0x",
        reserve0: reserves?.[0] ?? 0n,
        reserve1: reserves?.[1] ?? 0n,
        totalSupply: (pairDetailsRaw[base + 3]?.result as bigint) ?? 0n,
      };
    });
  }, [pairDetailsRaw, pairAddresses]);

  return {
    pairs,
    pairCount: pairCount !== undefined ? Number(pairCount) : 0,
    isLoading: countLoading || addressesLoading || detailsLoading,
    refetch: () => {
      countRefetch();
      addressesRefetch();
      detailsRefetch();
    },
  };
}
