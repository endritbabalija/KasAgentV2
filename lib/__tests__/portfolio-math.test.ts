import { describe, it, expect } from "vitest";
import {
  derivePrices,
  kasValue,
  pairTotalValueKas,
  computeFarmApy,
  computeStakingApy,
  pricePortfolio,
  BLOCKS_PER_YEAR,
  type TokenMap,
} from "../portfolio-math";
import type { PairInfo } from "@/hooks/useAllPairs";

// ── Helpers ────────────────────────────────────────────────

function makePair(overrides: Partial<PairInfo> & { token0: `0x${string}`; token1: `0x${string}` }): PairInfo {
  return {
    address: "0x0000000000000000000000000000000000000001",
    reserve0: 0n,
    reserve1: 0n,
    totalSupply: 0n,
    protocolId: "zealous",
    ...overrides,
  };
}

const WKAS = "0xwkas" as `0x${string}`;
const ZEAL = "0xzeal" as `0x${string}`;
const NACHO = "0xnacho" as `0x${string}`;
const USDT = "0xusdt" as `0x${string}`;

function buildTokenMap(entries: [string, { decimals?: number; symbol?: string }][]): TokenMap {
  return new Map(entries.map(([k, v]) => [k.toLowerCase(), v]));
}

// ── derivePrices ───────────────────────────────────────────

describe("derivePrices", () => {
  it("prices WKAS at 1", () => {
    const prices = derivePrices([], new Map(), WKAS);
    expect(prices[WKAS.toLowerCase()]).toBe(1);
  });

  it("derives price from direct WKAS pair", () => {
    const tokenMap = buildTokenMap([
      [WKAS, { decimals: 18 }],
      [ZEAL, { decimals: 18 }],
    ]);
    // 1000 WKAS : 500 ZEAL => ZEAL = 2 KAS
    const pairs = [
      makePair({
        token0: WKAS,
        token1: ZEAL,
        reserve0: 1000n * 10n ** 18n,
        reserve1: 500n * 10n ** 18n,
      }),
    ];

    const prices = derivePrices(pairs, tokenMap, WKAS);
    expect(prices[ZEAL.toLowerCase()]).toBe(2);
  });

  it("derives transitive price through intermediate token", () => {
    const tokenMap = buildTokenMap([
      [WKAS, { decimals: 18 }],
      [ZEAL, { decimals: 18 }],
      [NACHO, { decimals: 18 }],
    ]);
    // WKAS/ZEAL: 1000:500 => ZEAL = 2 KAS
    // ZEAL/NACHO: 100:200 => NACHO = ZEAL * 100/200 = 1 KAS
    const pairs = [
      makePair({
        address: "0x0000000000000000000000000000000000000001",
        token0: WKAS,
        token1: ZEAL,
        reserve0: 1000n * 10n ** 18n,
        reserve1: 500n * 10n ** 18n,
      }),
      makePair({
        address: "0x0000000000000000000000000000000000000002",
        token0: ZEAL,
        token1: NACHO,
        reserve0: 100n * 10n ** 18n,
        reserve1: 200n * 10n ** 18n,
      }),
    ];

    const prices = derivePrices(pairs, tokenMap, WKAS);
    expect(prices[ZEAL.toLowerCase()]).toBe(2);
    expect(prices[NACHO.toLowerCase()]).toBe(1);
  });

  it("skips pairs with zero reserves", () => {
    const tokenMap = buildTokenMap([
      [WKAS, { decimals: 18 }],
      [ZEAL, { decimals: 18 }],
    ]);
    const pairs = [
      makePair({ token0: WKAS, token1: ZEAL, reserve0: 0n, reserve1: 0n }),
    ];

    const prices = derivePrices(pairs, tokenMap, WKAS);
    expect(prices[ZEAL.toLowerCase()]).toBeUndefined();
  });

  it("handles mixed decimals correctly", () => {
    const tokenMap = buildTokenMap([
      [WKAS, { decimals: 18 }],
      [USDT, { decimals: 6 }],
    ]);
    // 1000 WKAS (18 dec) : 500 USDT (6 dec) => USDT = 2 KAS
    const pairs = [
      makePair({
        token0: WKAS,
        token1: USDT,
        reserve0: 1000n * 10n ** 18n,
        reserve1: 500n * 10n ** 6n,
      }),
    ];

    const prices = derivePrices(pairs, tokenMap, WKAS);
    expect(prices[USDT.toLowerCase()]).toBe(2);
  });

  it("returns only WKAS price for empty pairs array", () => {
    const prices = derivePrices([], new Map(), WKAS);
    expect(Object.keys(prices)).toHaveLength(1);
    expect(prices[WKAS.toLowerCase()]).toBe(1);
  });
});

// ── kasValue ───────────────────────────────────────────────

describe("kasValue", () => {
  it("converts balance with price", () => {
    // 10 tokens at price 2 KAS each = 20 KAS
    const result = kasValue(10n * 10n ** 18n, 18, 2);
    expect(result).toBe(20);
  });

  it("returns 0 for zero balance", () => {
    expect(kasValue(0n, 18, 5)).toBe(0);
  });

  it("returns 0 for zero price", () => {
    expect(kasValue(10n * 10n ** 18n, 18, 0)).toBe(0);
  });

  it("handles 6-decimal tokens", () => {
    // 1 USDT (6 dec) at price 3 = 3 KAS
    expect(kasValue(1_000_000n, 6, 3)).toBe(3);
  });
});

// ── pairTotalValueKas ──────────────────────────────────────

describe("pairTotalValueKas", () => {
  it("sums both sides of a pair", () => {
    const tokenMap = buildTokenMap([
      [WKAS, { decimals: 18 }],
      [ZEAL, { decimals: 18 }],
    ]);
    const prices: Record<string, number> = {
      [WKAS.toLowerCase()]: 1,
      [ZEAL.toLowerCase()]: 2,
    };
    const pair = makePair({
      token0: WKAS,
      token1: ZEAL,
      reserve0: 100n * 10n ** 18n,
      reserve1: 50n * 10n ** 18n,
    });

    // 100 WKAS × 1 + 50 ZEAL × 2 = 200 KAS
    expect(pairTotalValueKas(pair, prices, tokenMap)).toBe(200);
  });

  it("returns 0 when prices are missing", () => {
    const pair = makePair({
      token0: WKAS,
      token1: ZEAL,
      reserve0: 100n * 10n ** 18n,
      reserve1: 50n * 10n ** 18n,
    });
    expect(pairTotalValueKas(pair, {}, new Map())).toBe(0);
  });
});

// ── computeFarmApy ─────────────────────────────────────────

describe("computeFarmApy", () => {
  const tokenMap = buildTokenMap([
    [WKAS, { decimals: 18 }],
    [ZEAL, { decimals: 18 }],
  ]);
  const prices: Record<string, number> = {
    [WKAS.toLowerCase()]: 1,
    [ZEAL.toLowerCase()]: 2,
  };

  it("calculates APY for a farm", () => {
    const globals = {
      rewardPerBlock: 10n * 10n ** 18n, // 10 ZEAL per block
      totalAllocPoint: 100n,
      rewardToken: ZEAL as `0x${string}`,
    };
    const farm = {
      allocPoint: 50n, // 50% of rewards
      totalDeposited: 1000n * 10n ** 18n,
    };
    // Pair: 500 WKAS + 250 ZEAL = 500 + 500 = 1000 KAS total
    const pair = makePair({
      token0: WKAS,
      token1: ZEAL,
      reserve0: 500n * 10n ** 18n,
      reserve1: 250n * 10n ** 18n,
      totalSupply: 1000n * 10n ** 18n,
    });

    const apy = computeFarmApy(globals, farm, pair, prices, tokenMap);
    // annualRewards = 10 * BLOCKS_PER_YEAR * 0.5
    // farmTvl = 1000 * (1000/1000) = 1000 KAS
    // apy = (annualRewards * 2 / 1000) * 100
    expect(apy).toBeGreaterThan(0);
    expect(isFinite(apy)).toBe(true);
  });

  it("returns 0 for zero totalAllocPoint", () => {
    const globals = { rewardPerBlock: 10n * 10n ** 18n, totalAllocPoint: 0n, rewardToken: ZEAL as `0x${string}` };
    const farm = { allocPoint: 50n, totalDeposited: 1000n * 10n ** 18n };
    const pair = makePair({ token0: WKAS, token1: ZEAL, totalSupply: 1000n * 10n ** 18n });

    expect(computeFarmApy(globals, farm, pair, prices, tokenMap)).toBe(0);
  });

  it("returns 0 for zero totalSupply", () => {
    const globals = { rewardPerBlock: 10n * 10n ** 18n, totalAllocPoint: 100n, rewardToken: ZEAL as `0x${string}` };
    const farm = { allocPoint: 50n, totalDeposited: 1000n * 10n ** 18n };
    const pair = makePair({ token0: WKAS, token1: ZEAL, totalSupply: 0n });

    expect(computeFarmApy(globals, farm, pair, prices, tokenMap)).toBe(0);
  });

  it("returns 0 for zero TVL (no reserves)", () => {
    const globals = { rewardPerBlock: 10n * 10n ** 18n, totalAllocPoint: 100n, rewardToken: ZEAL as `0x${string}` };
    const farm = { allocPoint: 50n, totalDeposited: 1000n * 10n ** 18n };
    const pair = makePair({ token0: WKAS, token1: ZEAL, reserve0: 0n, reserve1: 0n, totalSupply: 1000n * 10n ** 18n });

    expect(computeFarmApy(globals, farm, pair, prices, tokenMap)).toBe(0);
  });
});

// ── computeStakingApy ──────────────────────────────────────

describe("computeStakingApy", () => {
  it("calculates APY for emission-based pool", () => {
    const pool = {
      name: "ZEAL",
      poolAddress: "0x01" as `0x${string}`,
      xTokenAddress: "0x02" as `0x${string}`,
      exchangeRate: 10n ** 18n,
      totalStaked: 1_000_000n * 10n ** 18n,
      zealPerBlock: 5n * 10n ** 18n,
    };
    const apy = computeStakingApy(pool)!;
    // 5 * BLOCKS_PER_YEAR / 1_000_000 * 100
    const expected = (5 * BLOCKS_PER_YEAR / 1_000_000) * 100;
    expect(apy).toBeCloseTo(expected, 2);
  });

  it("returns undefined for pools without emissions", () => {
    const pool = {
      name: "NACHO",
      poolAddress: "0x01" as `0x${string}`,
      xTokenAddress: "0x02" as `0x${string}`,
      exchangeRate: 10n ** 18n,
      totalStaked: 1000n * 10n ** 18n,
    };
    expect(computeStakingApy(pool)).toBeUndefined();
  });

  it("returns 0 for zero totalStaked", () => {
    const pool = {
      name: "ZEAL",
      poolAddress: "0x01" as `0x${string}`,
      xTokenAddress: "0x02" as `0x${string}`,
      exchangeRate: 10n ** 18n,
      totalStaked: 0n,
      zealPerBlock: 5n * 10n ** 18n,
    };
    expect(computeStakingApy(pool)).toBe(0);
  });
});

// ── pricePortfolio (end-to-end) ────────────────────────────

describe("pricePortfolio", () => {
  it("computes wallet values and total", () => {
    const tokenMap = buildTokenMap([
      [WKAS, { decimals: 18, symbol: "WKAS" }],
      [ZEAL, { decimals: 18, symbol: "ZEAL" }],
    ]);

    const pairs = [
      makePair({
        token0: WKAS,
        token1: ZEAL,
        reserve0: 1000n * 10n ** 18n,
        reserve1: 500n * 10n ** 18n,
        totalSupply: 100n * 10n ** 18n,
      }),
    ];

    const result = pricePortfolio({
      wkasAddress: WKAS,
      pairs,
      tokenMap,
      getTokenSymbol: (addr) => tokenMap.get(addr.toLowerCase())?.symbol ?? addr.slice(0, 6),
      balances: [
        { symbol: "KAS", name: "Kaspa", decimals: 18, balance: 100n * 10n ** 18n, address: null },
        { symbol: "ZEAL", name: "Zeal", decimals: 18, balance: 10n * 10n ** 18n, address: ZEAL },
      ],
      lpPositions: [],
      farmPositions: [],
      farmGlobals: { rewardPerBlock: 0n, totalAllocPoint: 0n, rewardToken: ZEAL },
      stakingPositions: [],
      farms: [],
      pools: [],
    });

    // KAS: 100 × 1 = 100
    // ZEAL: 10 × 2 = 20
    expect(result.totalValueKas).toBe(120);
    expect(result.walletTokens).toHaveLength(2);
    expect(result.walletTokens[0].symbol).toBe("KAS"); // sorted by value, KAS > ZEAL
    expect(result.walletTokens[0].kasVal).toBe(100);
    expect(result.walletTokens[1].kasVal).toBe(20);
    expect(result.prices[ZEAL.toLowerCase()]).toBe(2);
  });

  it("returns empty results for no data", () => {
    const result = pricePortfolio({
      wkasAddress: WKAS,
      pairs: [],
      tokenMap: new Map(),
      getTokenSymbol: (addr) => addr.slice(0, 6),
      balances: [],
      lpPositions: [],
      farmPositions: [],
      farmGlobals: { rewardPerBlock: 0n, totalAllocPoint: 0n, rewardToken: "0x" as `0x${string}` },
      stakingPositions: [],
      farms: [],
      pools: [],
    });

    expect(result.totalValueKas).toBe(0);
    expect(result.walletTokens).toHaveLength(0);
    expect(result.positions).toHaveLength(0);
  });
});

// ── Oracle consistency (derivePrices vs old oracle formula) ─

describe("derivePrices matches old oracle formula", () => {
  /**
   * The old oracle.ts used:
   *   Number((reserveKAS * BigInt(10 ** tokenDecimals)) / reserveToken) / 10 ** 18
   *
   * derivePrices uses:
   *   Number(formatUnits(reserveKAS, 18)) / Number(formatUnits(reserveToken, tokenDecimals))
   *
   * These must produce the same result for all inputs.
   */
  function oldOracleFormula(reserveKAS: bigint, reserveToken: bigint, tokenDecimals: number): number {
    return Number((reserveKAS * BigInt(10 ** tokenDecimals)) / reserveToken) / 10 ** 18;
  }

  it("matches for round numbers (18/18 decimals)", () => {
    const reserveKAS = 1000n * 10n ** 18n;
    const reserveToken = 500n * 10n ** 18n;

    const tokenMap = buildTokenMap([[WKAS, { decimals: 18 }], [ZEAL, { decimals: 18 }]]);
    const pairs = [makePair({ token0: WKAS, token1: ZEAL, reserve0: reserveKAS, reserve1: reserveToken })];
    const newPrice = derivePrices(pairs, tokenMap, WKAS)[ZEAL.toLowerCase()];
    const oldPrice = oldOracleFormula(reserveKAS, reserveToken, 18);

    expect(newPrice).toBe(oldPrice);
  });

  it("matches for non-round reserves (18/18 decimals)", () => {
    const reserveKAS = 123456789000000000000000n;   // 123456.789 WKAS
    const reserveToken = 77777123000000000000000n;  // 77777.123 ZEAL

    const tokenMap = buildTokenMap([[WKAS, { decimals: 18 }], [ZEAL, { decimals: 18 }]]);
    const pairs = [makePair({ token0: WKAS, token1: ZEAL, reserve0: reserveKAS, reserve1: reserveToken })];
    const newPrice = derivePrices(pairs, tokenMap, WKAS)[ZEAL.toLowerCase()];
    const oldPrice = oldOracleFormula(reserveKAS, reserveToken, 18);

    // Floating point — within epsilon
    expect(Math.abs(newPrice - oldPrice)).toBeLessThan(1e-10);
  });

  it("matches for mixed decimals (18/6)", () => {
    const reserveKAS = 50000n * 10n ** 18n;
    const reserveUSDT = 25000n * 10n ** 6n;

    const tokenMap = buildTokenMap([[WKAS, { decimals: 18 }], [USDT, { decimals: 6 }]]);
    const pairs = [makePair({ token0: WKAS, token1: USDT, reserve0: reserveKAS, reserve1: reserveUSDT })];
    const newPrice = derivePrices(pairs, tokenMap, WKAS)[USDT.toLowerCase()];
    const oldPrice = oldOracleFormula(reserveKAS, reserveUSDT, 6);

    expect(Math.abs(newPrice - oldPrice)).toBeLessThan(1e-10);
  });

  it("matches for tiny prices", () => {
    const reserveKAS = 1000000000000000n;           // 0.001 WKAS
    const reserveToken = 1000000n * 10n ** 18n;     // 1,000,000 TOKEN

    const tokenMap = buildTokenMap([[WKAS, { decimals: 18 }], [ZEAL, { decimals: 18 }]]);
    const pairs = [makePair({ token0: WKAS, token1: ZEAL, reserve0: reserveKAS, reserve1: reserveToken })];
    const newPrice = derivePrices(pairs, tokenMap, WKAS)[ZEAL.toLowerCase()];
    const oldPrice = oldOracleFormula(reserveKAS, reserveToken, 18);

    expect(Math.abs(newPrice - oldPrice)).toBeLessThan(1e-15);
  });

  it("matches for huge reserves", () => {
    const reserveKAS = 1000000000n * 10n ** 18n;    // 1 billion WKAS
    const reserveToken = 500000000n * 10n ** 18n;   // 500 million TOKEN

    const tokenMap = buildTokenMap([[WKAS, { decimals: 18 }], [ZEAL, { decimals: 18 }]]);
    const pairs = [makePair({ token0: WKAS, token1: ZEAL, reserve0: reserveKAS, reserve1: reserveToken })];
    const newPrice = derivePrices(pairs, tokenMap, WKAS)[ZEAL.toLowerCase()];
    const oldPrice = oldOracleFormula(reserveKAS, reserveToken, 18);

    expect(newPrice).toBe(oldPrice);
  });

  it("derivePrices handles transitive pricing (old oracle could not)", () => {
    // WKAS/ZEAL pair exists, ZEAL/NACHO pair exists, NO WKAS/NACHO pair
    // Old oracle: "No WKAS pair found for NACHO"
    // derivePrices: prices NACHO transitively through ZEAL
    const tokenMap = buildTokenMap([
      [WKAS, { decimals: 18 }],
      [ZEAL, { decimals: 18 }],
      [NACHO, { decimals: 18 }],
    ]);
    const pairs = [
      makePair({
        address: "0x0000000000000000000000000000000000000001",
        token0: WKAS,
        token1: ZEAL,
        reserve0: 1000n * 10n ** 18n,
        reserve1: 500n * 10n ** 18n,
      }),
      makePair({
        address: "0x0000000000000000000000000000000000000002",
        token0: ZEAL,
        token1: NACHO,
        reserve0: 100n * 10n ** 18n,
        reserve1: 400n * 10n ** 18n,
      }),
    ];

    const prices = derivePrices(pairs, tokenMap, WKAS);

    // ZEAL = 2 KAS (direct)
    expect(prices[ZEAL.toLowerCase()]).toBe(2);
    // NACHO = ZEAL_price * (ZEAL_reserve / NACHO_reserve) = 2 * 100/400 = 0.5 KAS
    expect(prices[NACHO.toLowerCase()]).toBe(0.5);
    // This is the case the old oracle would have returned an error for
  });
});
