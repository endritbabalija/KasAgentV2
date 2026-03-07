"use client";

import { useMemo } from "react";
import { useAccount, useBalance, useReadContracts } from "wagmi";
import { useTokenRegistry } from "./useTokenRegistry";
import { erc20Abi } from "@/config/abis";

export interface TokenBalance {
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  address: `0x${string}` | null;
}

export function useTokenBalances() {
  const { address } = useAccount();
  const { tokens, isLoading: registryLoading } = useTokenRegistry();

  const {
    data: nativeBalance,
    isLoading: nativeLoading,
    isError: nativeError,
    refetch: nativeRefetch,
  } = useBalance({ address });

  // ERC20 tokens from registry (all non-native)
  const erc20Tokens = useMemo(
    () => tokens.filter((t) => !t.isNative && t.address),
    [tokens]
  );

  const {
    data: erc20Data,
    isLoading: erc20Loading,
    isError: erc20Error,
    refetch: erc20Refetch,
  } = useReadContracts({
    contracts: erc20Tokens.map((token) => ({
      address: token.address!,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address!] as const,
    })),
    query: { enabled: !!address && erc20Tokens.length > 0 },
  });

  const balances = useMemo<TokenBalance[]>(() => {
    const result: TokenBalance[] = [];

    // Native KAS
    const kas = tokens.find((t) => t.isNative);
    if (kas) {
      const bal = nativeBalance?.value ?? 0n;
      if (bal > 0n) {
        result.push({
          symbol: kas.symbol,
          name: kas.name,
          decimals: kas.decimals,
          balance: bal,
          address: null,
        });
      }
    }

    // ERC20 tokens — only non-zero balances
    erc20Tokens.forEach((token, i) => {
      const bal = (erc20Data?.[i]?.result as bigint) ?? 0n;
      if (bal > 0n) {
        result.push({
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          balance: bal,
          address: token.address,
        });
      }
    });

    return result;
  }, [tokens, erc20Tokens, nativeBalance, erc20Data]);

  return {
    balances,
    isLoading: registryLoading || nativeLoading || erc20Loading,
    isError: nativeError || erc20Error,
    refetch: () => {
      nativeRefetch();
      erc20Refetch();
    },
  };
}
