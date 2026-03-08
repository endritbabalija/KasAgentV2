"use client";

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

  return {
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
    refetch: () => {
      tokenBalances.refetch();
      lpPos.refetch();
      farmPos.refetch();
      stakingPos.refetch();
    },
  };
}
