"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { getAllV2Factories, type ProtocolId } from "@/config/protocols";
import { factoryAbi, pairAbi } from "@/config/abis";

export interface PairInfo {
  address: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
  protocolId: string;
}

// Stable reference so the factories array doesn't cause re-renders
const V2_FACTORIES = getAllV2Factories();

export function useAllPairs(enabled: boolean = true) {
  // ── Step 1: Get pair counts from ALL V2 factories in a single multicall ──
  const pairCountContracts = useMemo(
    () =>
      V2_FACTORIES.map((f) => ({
        address: f.address,
        abi: factoryAbi,
        functionName: "allPairsLength" as const,
      })),
    [],
  );

  const {
    data: pairCountsRaw,
    isLoading: countsLoading,
    isError: countsError,
    refetch: countsRefetch,
  } = useReadContracts({
    contracts: pairCountContracts,
    query: { enabled },
  });

  // Parse counts and build a mapping: for each factory, how many pairs it has
  const factoryCounts = useMemo(() => {
    if (!pairCountsRaw) return [];
    return V2_FACTORIES.map((f, i) => ({
      ...f,
      count:
        pairCountsRaw[i]?.status === "success"
          ? Number(pairCountsRaw[i].result as bigint)
          : 0,
    }));
  }, [pairCountsRaw]);

  const totalPairCount = useMemo(
    () => factoryCounts.reduce((sum, f) => sum + f.count, 0),
    [factoryCounts],
  );

  // ── Step 2: Get pair addresses from ALL factories in a single multicall ──
  // We flatten calls for all factories and track which factory each call belongs to
  const { pairAddressContracts, addressOwnership } = useMemo(() => {
    const contracts: {
      address: `0x${string}`;
      abi: typeof factoryAbi;
      functionName: "allPairs";
      args: readonly [bigint];
    }[] = [];
    // Track which factory (by index in V2_FACTORIES) owns each call
    const ownership: { factoryIdx: number; protocolId: ProtocolId }[] = [];

    factoryCounts.forEach((f, factoryIdx) => {
      for (let i = 0; i < f.count; i++) {
        contracts.push({
          address: f.address,
          abi: factoryAbi,
          functionName: "allPairs" as const,
          args: [BigInt(i)] as const,
        });
        ownership.push({ factoryIdx, protocolId: f.protocolId });
      }
    });

    return { pairAddressContracts: contracts, addressOwnership: ownership };
  }, [factoryCounts]);

  const {
    data: pairAddressesRaw,
    isLoading: addressesLoading,
    isError: addressesError,
    refetch: addressesRefetch,
  } = useReadContracts({
    contracts: pairAddressContracts,
    query: { enabled: enabled && pairAddressContracts.length > 0 },
  });

  // Parse addresses, keeping the protocolId tag for each
  const pairAddresses = useMemo(() => {
    if (!pairAddressesRaw) return [];
    return pairAddressesRaw
      .map((r, i) => ({
        address:
          r.status === "success" ? (r.result as `0x${string}`) : undefined,
        protocolId: addressOwnership[i].protocolId,
      }))
      .filter(
        (p): p is { address: `0x${string}`; protocolId: ProtocolId } =>
          p.address !== undefined,
      );
  }, [pairAddressesRaw, addressOwnership]);

  // ── Step 3: Get pair details for ALL pairs in a single multicall ──
  const pairDetailContracts = useMemo(
    () =>
      pairAddresses.flatMap((p) => [
        {
          address: p.address,
          abi: pairAbi,
          functionName: "token0" as const,
        },
        {
          address: p.address,
          abi: pairAbi,
          functionName: "token1" as const,
        },
        {
          address: p.address,
          abi: pairAbi,
          functionName: "getReserves" as const,
        },
        {
          address: p.address,
          abi: pairAbi,
          functionName: "totalSupply" as const,
        },
      ]),
    [pairAddresses],
  );

  const {
    data: pairDetailsRaw,
    isLoading: detailsLoading,
    isError: detailsError,
    refetch: detailsRefetch,
  } = useReadContracts({
    contracts: pairDetailContracts,
    query: { enabled: enabled && pairAddresses.length > 0 },
  });

  const pairs = useMemo<PairInfo[]>(() => {
    if (!pairDetailsRaw || !pairAddresses.length) return [];
    return pairAddresses.map((p, i) => {
      const base = i * 4;
      const reserves = pairDetailsRaw[base + 2]?.result as
        | readonly [bigint, bigint, bigint]
        | undefined;
      return {
        address: p.address,
        token0: (pairDetailsRaw[base]?.result as `0x${string}`) ?? "0x",
        token1: (pairDetailsRaw[base + 1]?.result as `0x${string}`) ?? "0x",
        reserve0: reserves?.[0] ?? 0n,
        reserve1: reserves?.[1] ?? 0n,
        totalSupply: (pairDetailsRaw[base + 3]?.result as bigint) ?? 0n,
        protocolId: p.protocolId,
      };
    });
  }, [pairDetailsRaw, pairAddresses]);

  return {
    pairs,
    pairCount: totalPairCount,
    isLoading: countsLoading || addressesLoading || detailsLoading,
    isError: countsError || addressesError || detailsError,
    refetch: () => {
      countsRefetch();
      addressesRefetch();
      detailsRefetch();
    },
  };
}
