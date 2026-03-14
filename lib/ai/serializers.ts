import { formatUnits } from "viem";
import type { TokenBalance } from "@/hooks/useTokenBalances";
import type { LpPosition } from "@/hooks/useLpPositions";
import type { FarmPosition } from "@/hooks/useFarmPositions";
import type { StakingPosition } from "@/hooks/useStakingPositions";
import type { FarmGlobals } from "@/hooks/useActiveFarms";
import type { InfinityPoolInfo } from "@/hooks/useInfinityPoolData";

function fmt(value: bigint, decimals: number = 18): string {
  return formatUnits(value, decimals);
}

export interface SerializedPortfolio {
  address: string;
  balances: { symbol: string; balance: string }[];
  lpPositions: {
    pair: string;
    lpBalance: string;
    token0Amount: string;
    token1Amount: string;
    protocol?: string;
  }[];
  farmPositions: {
    pid: number;
    stakedAmount: string;
    pendingReward: string;
    canWithdraw: boolean;
  }[];
  farmGlobals: {
    rewardPerBlock: string;
    totalAllocPoint: string;
    rewardToken: string;
  };
  stakingPositions: {
    pool: string;
    xTokenBalance: string;
    underlyingAmount: string;
    exchangeRate: string;
  }[];
}

export function serializePortfolio(
  address: string,
  balances: TokenBalance[],
  lpPositions: LpPosition[],
  farmPositions: FarmPosition[],
  farmGlobals: FarmGlobals,
  stakingPositions: StakingPosition[],
  symbolResolver?: (address: string) => string,
  decimalsResolver?: (address: string) => number
): SerializedPortfolio {
  const resolve = symbolResolver ?? ((addr: string) => addr.slice(0, 10));
  const resolveDecimals = decimalsResolver ?? (() => 18);

  return {
    address,
    balances: balances
      .filter((b) => b.balance > 0n)
      .map((b) => ({
        symbol: b.symbol,
        balance: fmt(b.balance, b.decimals),
      })),
    lpPositions: lpPositions
      .filter((lp) => lp.lpBalance > 0n)
      .map((lp) => ({
        pair: `${resolve(lp.token0)}/${resolve(lp.token1)}`,
        lpBalance: fmt(lp.lpBalance),
        token0Amount: fmt(lp.token0Amount, resolveDecimals(lp.token0)),
        token1Amount: fmt(lp.token1Amount, resolveDecimals(lp.token1)),
        ...("protocolId" in lp && lp.protocolId ? { protocol: lp.protocolId as string } : {}),
      })),
    farmPositions: farmPositions
      .filter((fp) => fp.stakedAmount > 0n || fp.pendingReward > 0n)
      .map((fp) => ({
        pid: fp.pid,
        stakedAmount: fmt(fp.stakedAmount),
        pendingReward: fmt(fp.pendingReward),
        canWithdraw: fp.canWithdraw,
      })),
    farmGlobals: {
      rewardPerBlock: fmt(farmGlobals.rewardPerBlock),
      totalAllocPoint: farmGlobals.totalAllocPoint.toString(),
      rewardToken: resolve(farmGlobals.rewardToken),
    },
    stakingPositions: stakingPositions
      .filter((sp) => sp.xTokenBalance > 0n)
      .map((sp) => ({
        pool: sp.poolName,
        xTokenBalance: fmt(sp.xTokenBalance),
        underlyingAmount: fmt(sp.underlyingAmount),
        exchangeRate: fmt(sp.exchangeRate),
      })),
  };
}

export interface SerializedInfinityPool {
  name: string;
  exchangeRate: string;
  totalStaked: string;
  zealPerBlock?: string;
  emissionsPaused?: boolean;
}

export function serializeInfinityPools(
  pools: InfinityPoolInfo[]
): SerializedInfinityPool[] {
  return pools.map((p) => ({
    name: p.name,
    exchangeRate: fmt(p.exchangeRate),
    totalStaked: fmt(p.totalStaked),
    ...(p.zealPerBlock !== undefined
      ? { zealPerBlock: fmt(p.zealPerBlock) }
      : {}),
    ...(p.emissionsPaused !== undefined
      ? { emissionsPaused: p.emissionsPaused }
      : {}),
  }));
}
