"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { useAllPairs } from "./useAllPairs";
import { erc20Abi } from "@/config/abis";
import { KAS_NATIVE, TOKEN_LOGOS, type Token } from "@/config/tokens";

export function useTokenRegistry() {
  const { pairs, isLoading: pairsLoading } = useAllPairs();

  // Extract unique token addresses from all pairs
  const uniqueAddresses = useMemo(() => {
    const set = new Set<string>();
    for (const pair of pairs) {
      set.add(pair.token0.toLowerCase());
      set.add(pair.token1.toLowerCase());
    }
    return Array.from(set) as `0x${string}`[];
  }, [pairs]);

  // Batch-read ERC20 metadata: name, symbol, decimals for each address
  const { data: metadataRaw, isLoading: metadataLoading } = useReadContracts({
    contracts: uniqueAddresses.flatMap((addr) => [
      { address: addr, abi: erc20Abi, functionName: "name" as const },
      { address: addr, abi: erc20Abi, functionName: "symbol" as const },
      { address: addr, abi: erc20Abi, functionName: "decimals" as const },
    ]),
    query: { enabled: uniqueAddresses.length > 0 },
  });

  const tokens = useMemo<Token[]>(() => {
    const result: Token[] = [KAS_NATIVE];
    if (!metadataRaw) return result;

    for (let i = 0; i < uniqueAddresses.length; i++) {
      const base = i * 3;
      const addr = uniqueAddresses[i];
      const name = metadataRaw[base]?.result as string | undefined;
      const symbol = metadataRaw[base + 1]?.result as string | undefined;
      const decimals = metadataRaw[base + 2]?.result as number | undefined;

      result.push({
        address: addr,
        symbol: symbol ?? addr.slice(0, 8),
        name: name ?? "Unknown",
        decimals: decimals ?? 18,
        logoURI: TOKEN_LOGOS[addr.toLowerCase()],
      });
    }
    return result;
  }, [metadataRaw, uniqueAddresses]);

  const tokenMap = useMemo(() => {
    const map = new Map<string, Token>();
    for (const t of tokens) {
      if (t.address) map.set(t.address.toLowerCase(), t);
    }
    return map;
  }, [tokens]);

  const getTokenSymbol = useMemo(() => {
    return (address: string): string => {
      return tokenMap.get(address.toLowerCase())?.symbol ?? address.slice(0, 10);
    };
  }, [tokenMap]);

  return {
    tokens,
    tokenMap,
    getTokenSymbol,
    isLoading: pairsLoading || metadataLoading,
  };
}
