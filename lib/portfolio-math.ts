import { formatUnits } from "viem";
import type { PairInfo } from "@/hooks/useAllPairs";
import type { TokenBalance } from "@/hooks/useTokenBalances";
import type { LpPosition } from "@/hooks/useLpPositions";
import type { FarmPosition } from "@/hooks/useFarmPositions";
import type { ActiveFarm, FarmGlobals } from "@/hooks/useActiveFarms";
import type { StakingPosition } from "@/hooks/useStakingPositions";
import type { InfinityPoolInfo } from "@/hooks/useInfinityPoolData";

// ── Constants ──────────────────────────────────────────────
export const BLOCK_TIME_SECONDS = 2;
export const BLOCKS_PER_YEAR = (365.25 * 24 * 3600) / BLOCK_TIME_SECONDS;

// ── Token map abstraction ──────────────────────────────────
export type TokenMeta = { decimals?: number; symbol?: string };
export type TokenMap = Map<string, TokenMeta>;

// ── Output types ───────────────────────────────────────────
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

// ── Input bag for pricePortfolio ───────────────────────────
export interface PricePortfolioInput {
  wkasAddress: string;
  pairs: PairInfo[];
  tokenMap: TokenMap;
  getTokenSymbol: (addr: string) => string;
  balances: TokenBalance[];
  lpPositions: LpPosition[];
  farmPositions: FarmPosition[];
  farmGlobals: FarmGlobals;
  stakingPositions: StakingPosition[];
  farms: ActiveFarm[];
  pools: InfinityPoolInfo[];
}

export interface PricedResult {
  prices: Record<string, number>;
  walletTokens: WalletToken[];
  positions: Position[];
  totalValueKas: number;
}

// ── Granular pure functions ────────────────────────────────

/** Convert a raw token balance to its KAS-denominated value. */
export function kasValue(balance: bigint, decimals: number, priceInKas: number): number {
  return Number(formatUnits(balance, decimals)) * priceInKas;
}

/** Total KAS value locked in a pair's reserves. */
export function pairTotalValueKas(
  pair: PairInfo,
  prices: Record<string, number>,
  tokenMap: TokenMap,
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

/** Minimal pair shape needed for pricing — satisfied by both PairInfo and PairDiscoveryData. */
export interface PricingPair {
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
}

/**
 * Two-pass AMM pricing: WKAS-direct pairs first, then transitive.
 * Returns Record<lowercaseAddress, priceInKAS>. WKAS itself is always 1.
 */
export function derivePrices(
  pairs: readonly PricingPair[],
  tokenMap: TokenMap,
  wkasAddress: string,
): Record<string, number> {
  const wkas = wkasAddress.toLowerCase();
  const byAddress: Record<string, number> = { [wkas]: 1 };

  // First pass: pairs with WKAS on one side
  for (const pair of pairs) {
    if (pair.reserve0 === 0n || pair.reserve1 === 0n) continue;
    const t0 = pair.token0.toLowerCase();
    const t1 = pair.token1.toLowerCase();
    const d0 = tokenMap.get(t0)?.decimals ?? 18;
    const d1 = tokenMap.get(t1)?.decimals ?? 18;
    const r0 = Number(formatUnits(pair.reserve0, d0));
    const r1 = Number(formatUnits(pair.reserve1, d1));
    if (t0 === wkas && !byAddress[t1]) byAddress[t1] = r0 / r1;
    else if (t1 === wkas && !byAddress[t0]) byAddress[t0] = r1 / r0;
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
}

/** Farm APY as a percentage. Returns 0 for degenerate inputs. */
export function computeFarmApy(
  farmGlobals: { rewardPerBlock: bigint; totalAllocPoint: bigint; rewardToken: string },
  farm: { allocPoint: bigint; totalDeposited: bigint },
  pair: PairInfo,
  prices: Record<string, number>,
  tokenMap: TokenMap,
): number {
  if (farmGlobals.totalAllocPoint === 0n || pair.totalSupply === 0n) return 0;

  const rewardAddr = farmGlobals.rewardToken.toLowerCase();
  const rewardPrice = prices[rewardAddr] ?? 0;
  const allocPct = Number(farm.allocPoint) / Number(farmGlobals.totalAllocPoint);
  const annualRewards = Number(formatUnits(farmGlobals.rewardPerBlock, 18)) * BLOCKS_PER_YEAR * allocPct;

  const totalPoolValue = pairTotalValueKas(pair, prices, tokenMap);
  const depositedShare = Number(formatUnits(farm.totalDeposited, 18)) / Number(formatUnits(pair.totalSupply, 18));
  const farmTvlKas = totalPoolValue * depositedShare;

  if (farmTvlKas <= 0) return 0;

  const apy = (annualRewards * rewardPrice / farmTvlKas) * 100;
  return isFinite(apy) ? apy : 0;
}

/** Single-asset staking APY as a percentage. Returns undefined for pools without emissions. */
export function computeStakingApy(pool: InfinityPoolInfo): number | undefined {
  if (pool.zealPerBlock === undefined) return undefined;
  if (pool.totalStaked === 0n) return 0;

  const totalStaked = Number(formatUnits(pool.totalStaked, 18));
  const zealPerBlock = Number(formatUnits(pool.zealPerBlock, 18));
  const apy = totalStaked > 0 ? (zealPerBlock * BLOCKS_PER_YEAR / totalStaked) * 100 : 0;
  return isFinite(apy) ? apy : 0;
}

// ── Primary entry point ────────────────────────────────────

export function pricePortfolio(input: PricePortfolioInput): PricedResult {
  const {
    wkasAddress, pairs, tokenMap, getTokenSymbol,
    balances, lpPositions, farmPositions, farmGlobals,
    stakingPositions, farms, pools,
  } = input;

  // 1. Derive prices
  const prices = derivePrices(pairs, tokenMap, wkasAddress);

  // 2. Build xToken exclusion set
  const xTokenAddresses = new Set<string>();
  for (const pool of pools) {
    if (pool.xTokenAddress !== "0x") xTokenAddresses.add(pool.xTokenAddress.toLowerCase());
  }

  // 3. Value wallet tokens
  const walletTokens: WalletToken[] = balances
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

  // 4. Build pair name lookup
  const pairNameMap = new Map<string, { name: string; token0: string; token1: string }>();
  for (const p of pairs) {
    const s0 = getTokenSymbol(p.token0);
    const s1 = getTokenSymbol(p.token1);
    pairNameMap.set(p.address.toLowerCase(), { name: `${s0}/${s1}`, token0: s0, token1: s1 });
  }

  // 5. Build positions
  const result: Position[] = [];

  const rewardAddr = farmGlobals.rewardToken.toLowerCase();
  const rewardDecimals = tokenMap.get(rewardAddr)?.decimals ?? 18;
  const rewardSymbol = tokenMap.get(rewardAddr)?.symbol ?? "???";

  // Farm positions
  for (const fp of farmPositions) {
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
    if (farmInfo && pair && lpKasVal > 0) {
      apyPercent = computeFarmApy(farmGlobals, farmInfo, pair, prices, tokenMap);
    }

    const rewardKasVal = kasValue(fp.pendingReward, rewardDecimals, prices[rewardAddr] ?? 0);

    result.push({
      id: `farm-${fp.pid}`,
      type: "farm",
      name: `${pairName} LP`,
      kasVal: lpKasVal + rewardKasVal,
      token0Symbol: pairInfo?.token0,
      token1Symbol: pairInfo?.token1,
      apyPercent,
      pendingReward: fp.pendingReward,
      rewardSymbol,
      rewardDecimals,
      canWithdraw: fp.canWithdraw,
    });
  }

  // LP positions (unstaked)
  for (const lp of lpPositions) {
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
  for (const sp of stakingPositions) {
    if (sp.xTokenBalance === 0n) continue;
    const underlyingSymbol = sp.poolName;
    const underlyingAddr = [...tokenMap.entries()].find(
      ([, t]) => t.symbol?.toUpperCase() === underlyingSymbol.toUpperCase()
    )?.[0];
    const price = underlyingAddr ? (prices[underlyingAddr] ?? 0) : 0;
    const val = kasValue(sp.underlyingAmount, 18, price);

    const pool = pools.find((p) => p.name === underlyingSymbol);
    const apyPercent = pool ? computeStakingApy(pool) : undefined;

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

  // 6. Total value
  const walletVal = walletTokens.reduce((sum, t) => sum + t.kasVal, 0);
  const posVal = result.reduce((sum, p) => sum + p.kasVal, 0);

  return {
    prices,
    walletTokens,
    positions: result,
    totalValueKas: walletVal + posVal,
  };
}
