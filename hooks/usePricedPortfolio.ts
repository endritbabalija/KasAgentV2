"use client";

import { useMemo } from "react";
import { formatUnits } from "viem";
import { usePortfolio, type Portfolio } from "./usePortfolio";
import { useActiveFarms } from "./useActiveFarms";
import { useInfinityPoolData } from "./useInfinityPoolData";
import { useTokenRegistry } from "./useTokenRegistry";
import { useAllPairs, type PairInfo } from "./useAllPairs";
import { CONTRACTS } from "@/config/contracts";

const BLOCK_TIME_SECONDS = 2;
const BLOCKS_PER_YEAR = (365.25 * 24 * 3600) / BLOCK_TIME_SECONDS;

/** Convert a token balance to its KAS value. */
function kasValue(balance: bigint, decimals: number, priceInKas: number): number {
  return Number(formatUnits(balance, decimals)) * priceInKas;
}

/** Compute the total KAS value of a pair's reserves. */
function pairTotalValueKas(
  pair: PairInfo,
  prices: Record<string, number>,
  tokenMap: Map<string, { decimals?: number }>,
): number {
  const t0 = pair.token0.toLowerCase();
  const t1 = pair.token1.toLowerCase();
  const d0 = tokenMap.get(t0)?.decimals ?? 18;
  const d1 = tokenMap.get(t1)?.decimals ?? 18;
  const r0 = Number(formatUnits(pair.reserve0, d0));
  const r1 = Number(formatUnits(pair.reserve1, d1));
  const p0 = prices[t0] ?? 0;
  const p1 = prices[t1] ?? 0;
  return r0 * p0 + r1 * p1;
}

export interface WalletToken {
  symbol: string;
  name: string;
  decimals: number;
  balance: bigint;
  address: `0x${string}` | null;
  kasVal: number;
}

export interface Position {
  id: string;
  type: "lp" | "farm" | "staking";
  name: string;
  kasVal: number;
  token0Symbol?: string;
  token1Symbol?: string;
  apyPercent?: number;
  pendingReward?: bigint;
  rewardSymbol?: string;
  rewardDecimals?: number;
  canWithdraw?: boolean;
  xTokenBalance?: bigint;
  underlyingAmount?: bigint;
  underlyingSymbol?: string;
  exchangeRate?: bigint;
}

export interface PricedPortfolio extends Portfolio {
  walletTokens: WalletToken[];
  positions: Position[];
  totalValueKas: number;
}

export function usePricedPortfolio(): PricedPortfolio {
  const portfolio = usePortfolio();
  const { farms } = useActiveFarms();
  const { pools } = useInfinityPoolData();
  const { getTokenSymbol, tokenMap } = useTokenRegistry();
  const { pairs } = useAllPairs();

  // Token prices in KAS (derived from AMM pair reserves)
  const prices = useMemo(() => {
    const wkasAddr = CONTRACTS.WKAS.toLowerCase();
    const byAddress: Record<string, number> = { [wkasAddr]: 1 };

    // First pass: pairs with WKAS on one side
    for (const pair of pairs) {
      if (pair.reserve0 === 0n || pair.reserve1 === 0n) continue;
      const t0 = pair.token0.toLowerCase();
      const t1 = pair.token1.toLowerCase();
      const d0 = tokenMap.get(t0)?.decimals ?? 18;
      const d1 = tokenMap.get(t1)?.decimals ?? 18;
      const r0 = Number(formatUnits(pair.reserve0, d0));
      const r1 = Number(formatUnits(pair.reserve1, d1));
      if (t0 === wkasAddr && !byAddress[t1]) byAddress[t1] = r0 / r1;
      else if (t1 === wkasAddr && !byAddress[t0]) byAddress[t0] = r1 / r0;
    }

    // Second pass: transitive pricing via known prices
    for (const pair of pairs) {
      if (pair.reserve0 === 0n || pair.reserve1 === 0n) continue;
      const t0 = pair.token0.toLowerCase();
      const t1 = pair.token1.toLowerCase();
      const d0 = tokenMap.get(t0)?.decimals ?? 18;
      const d1 = tokenMap.get(t1)?.decimals ?? 18;
      const r0 = Number(formatUnits(pair.reserve0, d0));
      const r1 = Number(formatUnits(pair.reserve1, d1));
      if (byAddress[t0] && !byAddress[t1]) byAddress[t1] = (byAddress[t0] * r0) / r1;
      else if (byAddress[t1] && !byAddress[t0]) byAddress[t0] = (byAddress[t1] * r1) / r0;
    }

    return byAddress;
  }, [pairs, tokenMap]);

  // xToken addresses to exclude from wallet display (shown as staking positions)
  const xTokenAddresses = useMemo(() => {
    const set = new Set<string>();
    for (const pool of pools) {
      if (pool.xTokenAddress !== "0x") set.add(pool.xTokenAddress.toLowerCase());
    }
    return set;
  }, [pools]);

  // Wallet tokens with KAS values, xTokens filtered, sorted by value
  const walletTokens = useMemo<WalletToken[]>(() => {
    return portfolio.balances
      .filter((b) => !b.address || !xTokenAddresses.has(b.address.toLowerCase()))
      .map((b) => {
        const price = b.address ? (prices[b.address.toLowerCase()] ?? 0) : 1;
        return {
          symbol: b.symbol,
          name: b.name,
          decimals: b.decimals,
          balance: b.balance,
          address: b.address as `0x${string}` | null,
          kasVal: kasValue(b.balance, b.decimals, price),
        };
      })
      .sort((a, b) => b.kasVal - a.kasVal);
  }, [portfolio.balances, xTokenAddresses, prices]);

  // Pair name lookup
  const pairNameMap = useMemo(() => {
    const map = new Map<string, { name: string; token0: string; token1: string }>();
    for (const p of pairs) {
      const s0 = getTokenSymbol(p.token0);
      const s1 = getTokenSymbol(p.token1);
      map.set(p.address.toLowerCase(), { name: `${s0}/${s1}`, token0: s0, token1: s1 });
    }
    return map;
  }, [pairs, getTokenSymbol]);

  // Enriched positions (farm, LP, staking) with KAS values and APY
  const positions = useMemo<Position[]>(() => {
    const result: Position[] = [];

    const rewardAddr = portfolio.farmGlobals.rewardToken.toLowerCase();
    const rewardDecimals = tokenMap.get(rewardAddr)?.decimals ?? 18;
    const rewardSymbol = tokenMap.get(rewardAddr)?.symbol ?? "???";

    // Farm positions
    for (const fp of portfolio.farmPositions) {
      const pairInfo = pairNameMap.get(fp.lpToken.toLowerCase());
      const pairName = pairInfo?.name ?? `Pool #${fp.pid}`;

      const pair = pairs.find((p) => p.address.toLowerCase() === fp.lpToken.toLowerCase());
      let lpKasVal = 0;
      if (pair && pair.totalSupply > 0n) {
        const totalValue = pairTotalValueKas(pair, prices, tokenMap);
        const share = Number(formatUnits(fp.stakedAmount, 18)) / Number(formatUnits(pair.totalSupply, 18));
        lpKasVal = totalValue * share;
      }

      let apyPercent = 0;
      const farmInfo = farms.find((f) => f.lpToken.toLowerCase() === fp.lpToken.toLowerCase());
      if (farmInfo && portfolio.farmGlobals.totalAllocPoint > 0n && lpKasVal > 0) {
        const allocPct = Number(farmInfo.allocPoint) / Number(portfolio.farmGlobals.totalAllocPoint);
        const annualRewards = Number(formatUnits(portfolio.farmGlobals.rewardPerBlock, 18)) * BLOCKS_PER_YEAR * allocPct;
        const rewardPrice = prices[rewardAddr] ?? 0;
        let farmTvlKas = 0;
        if (pair && pair.totalSupply > 0n) {
          const totalPoolValue = pairTotalValueKas(pair, prices, tokenMap);
          const depositedShare = Number(formatUnits(farmInfo.totalDeposited, 18)) / Number(formatUnits(pair.totalSupply, 18));
          farmTvlKas = totalPoolValue * depositedShare;
        }
        if (farmTvlKas > 0) {
          apyPercent = (annualRewards * rewardPrice / farmTvlKas) * 100;
        }
      }

      const rewardKasVal = kasValue(fp.pendingReward, rewardDecimals, prices[rewardAddr] ?? 0);

      result.push({
        id: `farm-${fp.pid}`,
        type: "farm",
        name: `${pairName} LP`,
        kasVal: lpKasVal + rewardKasVal,
        token0Symbol: pairInfo?.token0,
        token1Symbol: pairInfo?.token1,
        apyPercent: isFinite(apyPercent) ? apyPercent : 0,
        pendingReward: fp.pendingReward,
        rewardSymbol,
        rewardDecimals,
        canWithdraw: fp.canWithdraw,
      });
    }

    // LP positions (unstaked, not in farms)
    for (const lp of portfolio.lpPositions) {
      const pairInfo = pairNameMap.get(lp.pairAddress.toLowerCase());
      const pairName = pairInfo?.name ?? lp.pairAddress.slice(0, 10);

      const t0 = lp.token0.toLowerCase();
      const t1 = lp.token1.toLowerCase();
      const d0 = tokenMap.get(t0)?.decimals ?? 18;
      const d1 = tokenMap.get(t1)?.decimals ?? 18;
      const p0 = prices[t0] ?? 0;
      const p1 = prices[t1] ?? 0;
      const v0 = kasValue(lp.token0Amount, d0, p0);
      const v1 = kasValue(lp.token1Amount, d1, p1);

      result.push({
        id: `lp-${lp.pairAddress}`,
        type: "lp",
        name: `${pairName} LP`,
        kasVal: v0 + v1,
        token0Symbol: pairInfo?.token0,
        token1Symbol: pairInfo?.token1,
      });
    }

    // Staking positions (InfinityPools)
    for (const sp of portfolio.stakingPositions) {
      if (sp.xTokenBalance === 0n) continue;
      const underlyingSymbol = sp.poolName;
      const underlyingAddr = [...tokenMap.entries()].find(
        ([, t]) => t.symbol?.toUpperCase() === underlyingSymbol.toUpperCase()
      )?.[0];
      const price = underlyingAddr ? (prices[underlyingAddr] ?? 0) : 0;
      const val = kasValue(sp.underlyingAmount, 18, price);

      let apyPercent: number | undefined;
      if (underlyingSymbol === "ZEAL") {
        const zealPool = pools.find((p) => p.name === "ZEAL");
        if (zealPool && zealPool.totalStaked > 0n && zealPool.zealPerBlock) {
          const totalStaked = Number(formatUnits(zealPool.totalStaked, 18));
          const zealPerBlock = Number(formatUnits(zealPool.zealPerBlock, 18));
          apyPercent = totalStaked > 0 ? (zealPerBlock * BLOCKS_PER_YEAR / totalStaked) * 100 : 0;
          if (!isFinite(apyPercent)) apyPercent = 0;
        }
      }

      result.push({
        id: `staking-${sp.poolName}`,
        type: "staking",
        name: `${underlyingSymbol} Staking`,
        kasVal: val,
        xTokenBalance: sp.xTokenBalance,
        underlyingAmount: sp.underlyingAmount,
        underlyingSymbol,
        exchangeRate: sp.exchangeRate,
        apyPercent,
      });
    }

    result.sort((a, b) => b.kasVal - a.kasVal);
    return result;
  }, [
    portfolio.farmPositions, portfolio.farmGlobals, portfolio.lpPositions, portfolio.stakingPositions,
    pairNameMap, pairs, farms, pools, prices, tokenMap,
  ]);

  // Total portfolio value in KAS
  const totalValueKas = useMemo(() => {
    const walletVal = walletTokens.reduce((sum, t) => sum + t.kasVal, 0);
    const posVal = positions.reduce((sum, p) => sum + p.kasVal, 0);
    return walletVal + posVal;
  }, [walletTokens, positions]);

  return useMemo<PricedPortfolio>(() => ({
    ...portfolio,
    walletTokens,
    positions,
    totalValueKas,
  }), [portfolio, walletTokens, positions, totalValueKas]);
}
