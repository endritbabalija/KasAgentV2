import { formatUnits } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { CONTRACTS } from "@/config/contracts";
import {
  factoryAbi,
  pairAbi,
  masterchefAbi,
  infinityPoolZealAbi,
  infinityPoolNachoAbi,
  infinityPoolKasperAbi,
} from "@/config/abis";
import type {
  YieldOpportunity,
  RiskFlag,
  RiskLevel,
} from "../tool-types";
import { client } from "./helpers";
import { getAllTokens, addressToSymbol } from "@/lib/token-registry";

const BLOCK_TIME_SECONDS = 2;
const BLOCKS_PER_YEAR = (365.25 * 24 * 3600) / BLOCK_TIME_SECONDS;

type PairData = {
  address: `0x${string}`;
  token0: string;
  token1: string;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply: bigint;
};

type FarmData = {
  poolIds: number[];
  poolInfos: readonly [string, bigint, bigint, bigint, bigint, boolean, boolean, bigint][];
  rewardPerBlock: bigint;
  totalAllocPoint: bigint;
  rewardToken: string;
};

type InfinityData = {
  zeal: { exchangeRate: bigint; totalStaked: bigint; zealPerBlock: bigint; emissionsPaused: boolean };
  nacho: { exchangeRate: bigint; totalStaked: bigint };
  kasper: { exchangeRate: bigint; totalStaked: bigint };
};

function resolveOverallRisk(risks: RiskFlag[]): RiskLevel {
  if (risks.some((r) => r.severity === "high")) return "high";
  if (risks.some((r) => r.severity === "medium")) return "medium";
  return "low";
}

// ===== Fetch all on-chain data in parallel =====
async function fetchOnChainData(): Promise<[PairData[], FarmData, InfinityData]> {
  const pairsLength = (await client.readContract({
    address: CONTRACTS.FACTORY,
    abi: factoryAbi,
    functionName: "allPairsLength",
  })) as bigint;

  const pairAddresses = await Promise.all(
    Array.from({ length: Number(pairsLength) }, (_, i) =>
      client.readContract({
        address: CONTRACTS.FACTORY,
        abi: factoryAbi,
        functionName: "allPairs",
        args: [BigInt(i)],
      })
    )
  ) as `0x${string}`[];

  return Promise.all([
    Promise.all(
      pairAddresses.map(async (addr) => {
        const [token0, token1, reserves, totalSupply] = await Promise.all([
          client.readContract({ address: addr, abi: pairAbi, functionName: "token0" }),
          client.readContract({ address: addr, abi: pairAbi, functionName: "token1" }),
          client.readContract({ address: addr, abi: pairAbi, functionName: "getReserves" }),
          client.readContract({ address: addr, abi: pairAbi, functionName: "totalSupply" }),
        ]);
        const [r0, r1] = reserves as [bigint, bigint, number];
        return {
          address: addr,
          token0: (token0 as string).toLowerCase(),
          token1: (token1 as string).toLowerCase(),
          reserve0: r0,
          reserve1: r1,
          totalSupply: totalSupply as bigint,
        };
      })
    ),
    (async (): Promise<FarmData> => {
      const [activePools, rewardPerBlock, totalAllocPoint, rewardToken] =
        await Promise.all([
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "getActivePools" }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "rewardPerBlock" }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "totalAllocPoint" }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "rewardToken" }),
        ]);
      const poolIds = (activePools as bigint[]).map(Number);
      const poolInfos = await Promise.all(
        poolIds.map((pid) =>
          client.readContract({
            address: CONTRACTS.MASTER_CHEF,
            abi: masterchefAbi,
            functionName: "getPoolInfo",
            args: [BigInt(pid)],
          })
        )
      );
      return {
        poolIds,
        poolInfos: poolInfos as unknown as readonly [string, bigint, bigint, bigint, bigint, boolean, boolean, bigint][],
        rewardPerBlock: rewardPerBlock as bigint,
        totalAllocPoint: totalAllocPoint as bigint,
        rewardToken: (rewardToken as string).toLowerCase(),
      };
    })(),
    (async (): Promise<InfinityData> => {
      const [zealRate, zealStaked, zealPerBlock, zealPaused, nachoRate, nachoStaked, kasperRate, kasperStaked] =
        await Promise.all([
          client.readContract({ address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi, functionName: "getExchangeRate" }),
          client.readContract({ address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi, functionName: "totalStaked" }),
          client.readContract({ address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi, functionName: "zealPerBlock" }),
          client.readContract({ address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi, functionName: "emissionsPaused" }),
          client.readContract({ address: CONTRACTS.INFINITY_POOL_NACHO, abi: infinityPoolNachoAbi, functionName: "getExchangeRate" }),
          client.readContract({ address: CONTRACTS.INFINITY_POOL_NACHO, abi: infinityPoolNachoAbi, functionName: "totalStaked" }),
          client.readContract({ address: CONTRACTS.INFINITY_POOL_KASPER, abi: infinityPoolKasperAbi, functionName: "getExchangeRate" }),
          client.readContract({ address: CONTRACTS.INFINITY_POOL_KASPER, abi: infinityPoolKasperAbi, functionName: "totalStaked" }),
        ]);
      return {
        zeal: { exchangeRate: zealRate as bigint, totalStaked: zealStaked as bigint, zealPerBlock: zealPerBlock as bigint, emissionsPaused: zealPaused as boolean },
        nacho: { exchangeRate: nachoRate as bigint, totalStaked: nachoStaked as bigint },
        kasper: { exchangeRate: kasperRate as bigint, totalStaked: kasperStaked as bigint },
      };
    })(),
  ]);
}

// ===== Derive token prices from pair reserves =====
async function derivePrices(pairs: PairData[]) {
  const wkasAddr = CONTRACTS.WKAS.toLowerCase();
  const tokenPrices: Record<string, number> = { [wkasAddr]: 1 };

  // Build address-to-symbol map from discovered tokens
  const allTokens = await getAllTokens();
  const addrToSym: Record<string, string> = {};
  for (const t of allTokens) {
    if (t.address) addrToSym[t.address.toLowerCase()] = t.symbol;
  }

  // First pass: pairs with WKAS on one side
  for (const pair of pairs) {
    if (pair.reserve0 === 0n || pair.reserve1 === 0n) continue;
    const r0 = Number(formatUnits(pair.reserve0, 18));
    const r1 = Number(formatUnits(pair.reserve1, 18));
    if (pair.token0 === wkasAddr && !tokenPrices[pair.token1]) {
      tokenPrices[pair.token1] = r0 / r1;
    } else if (pair.token1 === wkasAddr && !tokenPrices[pair.token0]) {
      tokenPrices[pair.token0] = r1 / r0;
    }
  }

  // Second pass: pairs where one side has a known price
  for (const pair of pairs) {
    if (pair.reserve0 === 0n || pair.reserve1 === 0n) continue;
    const r0 = Number(formatUnits(pair.reserve0, 18));
    const r1 = Number(formatUnits(pair.reserve1, 18));
    if (tokenPrices[pair.token0] && !tokenPrices[pair.token1]) {
      tokenPrices[pair.token1] = (tokenPrices[pair.token0] * r0) / r1;
    } else if (tokenPrices[pair.token1] && !tokenPrices[pair.token0]) {
      tokenPrices[pair.token0] = (tokenPrices[pair.token1] * r1) / r0;
    }
  }

  const tokenPricesInKas: Record<string, number> = { KAS: 1 };
  for (const [addr, price] of Object.entries(tokenPrices)) {
    const sym = addrToSym[addr];
    if (sym) tokenPricesInKas[sym] = price;
  }

  return { tokenPrices, tokenPricesInKas, addrToSymbol: addrToSym };
}

// ===== Build opportunities array =====
async function buildOpportunities(
  pairs: PairData[],
  farmData: FarmData,
  infinityData: InfinityData,
  tokenPrices: Record<string, number>,
  addrToSym: Record<string, string>,
): Promise<YieldOpportunity[]> {
  const opportunities: YieldOpportunity[] = [];

  const rewardTokenSymbol = await addressToSymbol(farmData.rewardToken);
  const rewardTokenPrice = tokenPrices[farmData.rewardToken] ?? 0;

  // --- Farms ---
  for (let i = 0; i < farmData.poolIds.length; i++) {
    const pid = farmData.poolIds[i];
    const info = farmData.poolInfos[i];
    const lpToken = info[0].toLowerCase();
    const allocPoint = info[1];
    const totalDeposited = info[4];

    if (!info[5]) continue;

    const pairData = pairs.find((p) => p.address.toLowerCase() === lpToken);
    if (!pairData) continue;

    const token0Sym = addrToSym[pairData.token0] ?? pairData.token0.slice(0, 8);
    const token1Sym = addrToSym[pairData.token1] ?? pairData.token1.slice(0, 8);
    const price0 = tokenPrices[pairData.token0] ?? 0;
    const price1 = tokenPrices[pairData.token1] ?? 0;

    const r0 = Number(formatUnits(pairData.reserve0, 18));
    const r1 = Number(formatUnits(pairData.reserve1, 18));
    const lpTotalSupply = Number(formatUnits(pairData.totalSupply, 18));
    const deposited = Number(formatUnits(totalDeposited, 18));

    const lpValuePerToken = lpTotalSupply > 0 ? (r0 * price0 + r1 * price1) / lpTotalSupply : 0;
    const tvlKas = deposited * lpValuePerToken;

    const allocPct = Number(allocPoint) / Number(farmData.totalAllocPoint);
    const annualRewards = Number(formatUnits(farmData.rewardPerBlock, 18)) * BLOCKS_PER_YEAR * allocPct;
    const apyPercent = tvlKas > 0 ? (annualRewards * rewardTokenPrice / tvlKas) * 100 : 0;

    const risks: RiskFlag[] = [
      { type: "impermanent_loss", label: "Impermanent loss risk", severity: "medium" as RiskLevel },
    ];
    if (tvlKas < 1000) {
      risks.push({ type: "low_liquidity", label: "Low liquidity (TVL < 1,000 KAS)", severity: "high" as RiskLevel });
    }

    opportunities.push({
      id: `farm-${pid}`,
      type: "farm",
      name: `${token0Sym}/${token1Sym} Farm`,
      tokens: [token0Sym, token1Sym],
      apyPercent: isFinite(apyPercent) ? apyPercent : 0,
      yieldSource: `${rewardTokenSymbol} emissions`,
      tvlKas,
      risks,
      overallRisk: resolveOverallRisk(risks),
      details: {
        pid,
        lpToken: info[0],
        allocPercent: allocPct * 100,
        rewardToken: rewardTokenSymbol,
        rewardPerBlock: formatUnits(farmData.rewardPerBlock, 18),
        totalDeposited: formatUnits(totalDeposited, 18),
        pair: `${token0Sym}/${token1Sym}`,
        reserveA: r0.toFixed(4),
        reserveB: r1.toFixed(4),
      },
    });
  }

  // --- InfinityPool: ZEAL (emission-based) ---
  {
    const allTokens = await getAllTokens();
    const zealToken = allTokens.find((t) => t.symbol === "ZEAL");
    const zealAddr = zealToken?.address?.toLowerCase();
    const totalStaked = Number(formatUnits(infinityData.zeal.totalStaked, 18));
    const zealPrice = zealAddr ? (tokenPrices[zealAddr] ?? 0) : 0;
    const tvlKas = totalStaked * zealPrice;
    const zealPerBlockNum = Number(formatUnits(infinityData.zeal.zealPerBlock, 18));
    const apyPercent = totalStaked > 0 ? (zealPerBlockNum * BLOCKS_PER_YEAR / totalStaked) * 100 : 0;

    const risks: RiskFlag[] = [];
    if (infinityData.zeal.emissionsPaused) {
      risks.push({ type: "emissions_paused", label: "Emissions currently paused", severity: "high" as RiskLevel });
    }
    if (tvlKas < 1000) {
      risks.push({ type: "low_liquidity", label: "Low liquidity (TVL < 1,000 KAS)", severity: "high" as RiskLevel });
    }

    opportunities.push({
      id: "infinity-zeal",
      type: "infinity_pool",
      name: "ZEAL InfinityPool",
      tokens: ["ZEAL"],
      apyPercent: isFinite(apyPercent) ? apyPercent : 0,
      yieldSource: "ZEAL emissions",
      tvlKas,
      risks,
      overallRisk: resolveOverallRisk(risks),
      details: {
        token: "ZEAL",
        exchangeRate: formatUnits(infinityData.zeal.exchangeRate, 18),
        totalStaked: formatUnits(infinityData.zeal.totalStaked, 18),
        zealPerBlock: formatUnits(infinityData.zeal.zealPerBlock, 18),
        emissionsPaused: infinityData.zeal.emissionsPaused,
      },
    });
  }

  // --- Fee-based InfinityPools (NACHO, KASPER) ---
  {
    const allTokens = await getAllTokens();
    const feeBasedPools = [
      { id: "infinity-nacho", tokenSymbol: "NACHO", data: infinityData.nacho },
      { id: "infinity-kasper", tokenSymbol: "KASPER", data: infinityData.kasper },
    ] as const;

    for (const pool of feeBasedPools) {
      const tokenDef = allTokens.find((t) => t.symbol === pool.tokenSymbol);
      const tokenAddr = tokenDef?.address?.toLowerCase();
      const totalStaked = Number(formatUnits(pool.data.totalStaked, 18));
      const price = tokenAddr ? (tokenPrices[tokenAddr] ?? 0) : 0;
      const tvlKas = totalStaked * price;

      const risks: RiskFlag[] = [];
      if (tvlKas < 1000) {
        risks.push({ type: "low_liquidity", label: "Low liquidity (TVL < 1,000 KAS)", severity: "high" as RiskLevel });
      }

      opportunities.push({
        id: pool.id,
        type: "infinity_pool",
        name: `${pool.tokenSymbol} InfinityPool`,
        tokens: [pool.tokenSymbol],
        apyPercent: null,
        yieldSource: "Fee-based (exchange rate appreciation)",
        tvlKas,
        risks,
        overallRisk: resolveOverallRisk(risks),
        details: {
          token: pool.tokenSymbol,
          exchangeRate: formatUnits(pool.data.exchangeRate, 18),
          totalStaked: formatUnits(pool.data.totalStaked, 18),
        },
      });
    }
  }

  return opportunities;
}

// ===== Filter and sort =====
function rankAndFilter(opportunities: YieldOpportunity[], filterToken?: string) {
  let filtered = opportunities;
  if (filterToken) {
    const ft = filterToken.toUpperCase();
    filtered = opportunities.filter((o) => o.tokens.some((t) => t.toUpperCase() === ft));
  }

  filtered.sort((a, b) => {
    if (a.apyPercent === null && b.apyPercent === null) return 0;
    if (a.apyPercent === null) return 1;
    if (b.apyPercent === null) return -1;
    return b.apyPercent - a.apyPercent;
  });

  return filtered;
}

export const yieldTools = {
  discoverYieldOpportunities: tool({
    description:
      "Scan all ZealousSwap yield opportunities (farms + InfinityPools), compute APYs from on-chain data, assess risks, and return a ranked comparison. Use when the user asks about yield, best returns, where to invest, or DeFi opportunities.",
    inputSchema: z.object({
      filterToken: z
        .string()
        .optional()
        .describe("Optional token symbol to filter opportunities (e.g. 'ZEAL')"),
    }),
    execute: async ({ filterToken }) => {
      try {
        const [pairs, farmData, infinityData] = await fetchOnChainData();
        const { tokenPrices, tokenPricesInKas, addrToSymbol: addrToSym } = await derivePrices(pairs);
        const opportunities = await buildOpportunities(pairs, farmData, infinityData, tokenPrices, addrToSym);
        const filtered = rankAndFilter(opportunities, filterToken);

        return {
          opportunities: filtered,
          tokenPricesInKas,
          blockTimeSeconds: BLOCK_TIME_SECONDS,
          fetchedAt: new Date().toISOString(),
        };
      } catch (e) {
        return {
          opportunities: [],
          tokenPricesInKas: {},
          blockTimeSeconds: 2,
          fetchedAt: new Date().toISOString(),
          error: `Failed to discover yield opportunities: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),
};
