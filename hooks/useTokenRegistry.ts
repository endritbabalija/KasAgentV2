"use client";

import { useMemo } from "react";
import { useReadContracts } from "wagmi";
import { useAllPairs } from "./useAllPairs";
import { erc20Abi } from "@/config/abis";
import { CONTRACTS } from "@/config/contracts";
import { KAS_NATIVE, TOKEN_LOGOS, type Token } from "@/config/tokens";

export function useTokenRegistry() {
  const { pairs, isLoading: pairsLoading } = useAllPairs();

  // Extract unique token addresses and WKAS-paired liquidity from all pairs
  const { uniqueAddresses, wkasLiquidity } = useMemo(() => {
    const set = new Set<string>();
    const wkasAddr = CONTRACTS.WKAS.toLowerCase();
    const liq = new Map<string, bigint>();

    for (const pair of pairs) {
      const t0 = pair.token0.toLowerCase();
      const t1 = pair.token1.toLowerCase();
      set.add(t0);
      set.add(t1);

      if (t0 === wkasAddr) {
        const prev = liq.get(t1) ?? 0n;
        if (pair.reserve0 > prev) liq.set(t1, pair.reserve0);
      } else if (t1 === wkasAddr) {
        const prev = liq.get(t0) ?? 0n;
        if (pair.reserve1 > prev) liq.set(t0, pair.reserve1);
      }
    }

    return {
      uniqueAddresses: Array.from(set) as `0x${string}`[],
      wkasLiquidity: liq,
    };
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
    if (!metadataRaw) return [KAS_NATIVE];

    // Build all tokens first
    const allTokens: Token[] = [];
    for (let i = 0; i < uniqueAddresses.length; i++) {
      const base = i * 3;
      const addr = uniqueAddresses[i];
      const name = metadataRaw[base]?.result as string | undefined;
      const symbol = metadataRaw[base + 1]?.result as string | undefined;
      const decimals = metadataRaw[base + 2]?.result as number | undefined;

      allTokens.push({
        address: addr,
        symbol: symbol ?? addr.slice(0, 8),
        name: name ?? "Unknown",
        decimals: decimals ?? 18,
        logoURI: TOKEN_LOGOS[addr.toLowerCase()],
      });
    }

    // Deduplicate by symbol — prefer deepest WKAS-paired liquidity
    const bySymbol = new Map<string, Token[]>();
    for (const token of allTokens) {
      const sym = token.symbol.toUpperCase();
      const arr = bySymbol.get(sym) ?? [];
      arr.push(token);
      bySymbol.set(sym, arr);
    }

    const deduped: Token[] = [KAS_NATIVE];
    for (const [, candidates] of bySymbol) {
      if (candidates.length === 1) {
        deduped.push(candidates[0]);
        continue;
      }
      let best = candidates[0];
      let bestLiq = wkasLiquidity.get(best.address!.toLowerCase()) ?? 0n;
      for (let i = 1; i < candidates.length; i++) {
        const liq = wkasLiquidity.get(candidates[i].address!.toLowerCase()) ?? 0n;
        if (liq > bestLiq) {
          best = candidates[i];
          bestLiq = liq;
        }
      }
      deduped.push(best);
    }

    return deduped;
  }, [metadataRaw, uniqueAddresses, wkasLiquidity]);

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
