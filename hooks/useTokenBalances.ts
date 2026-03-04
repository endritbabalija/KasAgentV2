"use client";

import { useAccount, useBalance, useReadContracts } from "wagmi";
import { KASPLEX_TOKENS } from "@/config/tokens";
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

  const {
    data: nativeBalance,
    isLoading: nativeLoading,
    isError: nativeError,
    refetch: nativeRefetch,
  } = useBalance({ address });

  const erc20Tokens = KASPLEX_TOKENS.filter((t) => !t.isNative && t.address);

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
    query: { enabled: !!address },
  });

  const balances: TokenBalance[] = [];

  const kas = KASPLEX_TOKENS.find((t) => t.isNative);
  if (kas) {
    balances.push({
      symbol: kas.symbol,
      name: kas.name,
      decimals: kas.decimals,
      balance: nativeBalance?.value ?? 0n,
      address: null,
    });
  }

  erc20Tokens.forEach((token, i) => {
    balances.push({
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      balance: (erc20Data?.[i]?.result as bigint) ?? 0n,
      address: token.address,
    });
  });

  return {
    balances,
    isLoading: nativeLoading || erc20Loading,
    isError: nativeError || erc20Error,
    refetch: () => {
      nativeRefetch();
      erc20Refetch();
    },
  };
}
