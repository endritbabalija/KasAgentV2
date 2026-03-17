"use client";

import { useCallback, useMemo } from "react";
import { useAccount } from "wagmi";
import { useTokenBalances, type TokenBalance } from "./useTokenBalances";
import { useLpPositions, type LpPosition } from "./useLpPositions";
import {
  useFarmPositions,
  type FarmPosition,
} from "./useFarmPositions";
import {
  useStakingPositions,
  type StakingPosition,
} from "./useStakingPositions";
import type { FarmGlobals } from "./useActiveFarms";

export interface Portfolio {
  address: `0x${string}` | undefined;
  isConnected: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  balances: TokenBalance[];
  lpPositions: LpPosition[];
  farmPositions: FarmPosition[];
  farmGlobals: FarmGlobals;
  stakingPositions: StakingPosition[];
  refetch: () => void;
}

export function usePortfolio(): Portfolio {
  const { address, isConnected } = useAccount();

  const tokenBalances = useTokenBalances();
  const lpPos = useLpPositions();
  const farmPos = useFarmPositions();
  const stakingPos = useStakingPositions();

  const refetchTokenBalances = tokenBalances.refetch;
  const refetchLpPos = lpPos.refetch;
  const refetchFarmPos = farmPos.refetch;
  const refetchStakingPos = stakingPos.refetch;

  const refetch = useCallback(() => {
    refetchTokenBalances();
    refetchLpPos();
    refetchFarmPos();
    refetchStakingPos();
  }, [refetchTokenBalances, refetchLpPos, refetchFarmPos, refetchStakingPos]);

  return useMemo<Portfolio>(() => ({
    address,
    isConnected,
    isLoading:
      tokenBalances.isLoading ||
      lpPos.isLoading ||
      farmPos.isLoading ||
      stakingPos.isLoading,
    isFetching:
      tokenBalances.isFetching ||
      lpPos.isFetching ||
      farmPos.isFetching ||
      stakingPos.isFetching,
    isError: tokenBalances.isError || lpPos.isError || farmPos.isError || stakingPos.isError,
    balances: tokenBalances.balances,
    lpPositions: lpPos.positions,
    farmPositions: farmPos.positions,
    farmGlobals: farmPos.globals,
    stakingPositions: stakingPos.positions,
    refetch,
  }), [
    address, isConnected,
    tokenBalances.isLoading, tokenBalances.isFetching, tokenBalances.isError, tokenBalances.balances,
    lpPos.isLoading, lpPos.isFetching, lpPos.isError, lpPos.positions,
    farmPos.isLoading, farmPos.isFetching, farmPos.isError, farmPos.positions, farmPos.globals,
    stakingPos.isLoading, stakingPos.isFetching, stakingPos.isError, stakingPos.positions,
    refetch,
  ]);
}
