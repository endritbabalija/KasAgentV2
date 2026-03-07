"use client";

import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { useActiveFarms } from "./useActiveFarms";
import { CONTRACTS } from "@/config/contracts";
import { masterchefAbi } from "@/config/abis";

export interface FarmPosition {
  pid: number;
  lpToken: `0x${string}`;
  stakedAmount: bigint;
  pendingReward: bigint;
  canWithdraw: boolean;
}

export function useFarmPositions() {
  const { address } = useAccount();
  const {
    activePools,
    farms,
    globals,
    isLoading: farmsLoading,
    isError: farmsError,
  } = useActiveFarms(!!address);

  const {
    data: userDataRaw,
    isLoading: userLoading,
    isError: userError,
    refetch,
  } = useReadContracts({
    contracts: activePools.flatMap((pid) => [
      {
        address: CONTRACTS.MASTER_CHEF,
        abi: masterchefAbi,
        functionName: "userInfo" as const,
        args: [BigInt(pid), address!] as const,
      },
      {
        address: CONTRACTS.MASTER_CHEF,
        abi: masterchefAbi,
        functionName: "pendingReward" as const,
        args: [BigInt(pid), address!] as const,
      },
      {
        address: CONTRACTS.MASTER_CHEF,
        abi: masterchefAbi,
        functionName: "canWithdraw" as const,
        args: [BigInt(pid), address!] as const,
      },
    ]),
    query: { enabled: !!address && activePools.length > 0 },
  });

  const positions = useMemo<FarmPosition[]>(() => {
    if (!userDataRaw) return [];
    return activePools
      .map((pid, i) => {
        const base = i * 3;
        const userInfo = userDataRaw[base]?.result as
          | readonly [bigint, bigint, bigint]
          | undefined;
        const pending = (userDataRaw[base + 1]?.result as bigint) ?? 0n;
        const canWd = (userDataRaw[base + 2]?.result as boolean) ?? false;
        const stakedAmount = userInfo?.[0] ?? 0n;
        const farm = farms.find((f) => f.pid === pid);
        return {
          pid,
          lpToken: farm?.lpToken ?? ("0x" as `0x${string}`),
          stakedAmount,
          pendingReward: pending,
          canWithdraw: canWd,
        };
      })
      .filter((p) => p.stakedAmount > 0n || p.pendingReward > 0n);
  }, [userDataRaw, activePools, farms]);

  return {
    positions,
    globals,
    isLoading: farmsLoading || userLoading,
    isError: farmsError || userError,
    refetch,
  };
}
