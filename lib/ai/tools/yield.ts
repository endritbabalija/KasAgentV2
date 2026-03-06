import { formatUnits } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { CONTRACTS } from "@/config/contracts";
import { KASPLEX_TOKENS } from "@/config/tokens";
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
      const BLOCK_TIME_SECONDS = 2;
      const BLOCKS_PER_YEAR = (365.25 * 24 * 3600) / BLOCK_TIME_SECONDS; // 15,778,800

      try {
        // ===== Phase 1: Gather on-chain data in parallel =====

        // Factory: get all pairs
        const pairsLength = (await client.readContract({
          address: CONTRACTS.FACTORY,
          abi: factoryAbi,
          functionName: "allPairsLength",
        })) as bigint;

        const pairIndices = Array.from({ length: Number(pairsLength) }, (_, i) => i);
        const pairAddresses = await Promise.all(
          pairIndices.map((i) =>
            client.readContract({
              address: CONTRACTS.FACTORY,
              abi: factoryAbi,
              functionName: "allPairs",
              args: [BigInt(i)],
            })
          )
        ) as `0x${string}`[];

        // Fetch pair data + MasterChef + InfinityPools in parallel
        const [pairDataResults, farmData, infinityData] = await Promise.all([
          // All pair data
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
          // MasterChef data
          (async () => {
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
          // InfinityPool data
          (async () => {
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
              zeal: {
                exchangeRate: zealRate as bigint,
                totalStaked: zealStaked as bigint,
                zealPerBlock: zealPerBlock as bigint,
                emissionsPaused: zealPaused as boolean,
              },
              nacho: { exchangeRate: nachoRate as bigint, totalStaked: nachoStaked as bigint },
              kasper: { exchangeRate: kasperRate as bigint, totalStaked: kasperStaked as bigint },
            };
          })(),
        ]);

        // ===== Phase 2: Derive token prices from pairs =====
        const wkasAddr = CONTRACTS.WKAS.toLowerCase();
        const tokenPrices: Record<string, number> = { [wkasAddr]: 1 };

        // Build address-to-symbol map
        const addrToSymbol: Record<string, string> = {};
        for (const t of KASPLEX_TOKENS) {
          if (t.address) addrToSymbol[t.address.toLowerCase()] = t.symbol;
        }

        // First pass: pairs with WKAS on one side
        for (const pair of pairDataResults) {
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
        for (const pair of pairDataResults) {
          if (pair.reserve0 === 0n || pair.reserve1 === 0n) continue;
          const r0 = Number(formatUnits(pair.reserve0, 18));
          const r1 = Number(formatUnits(pair.reserve1, 18));
          if (tokenPrices[pair.token0] && !tokenPrices[pair.token1]) {
            tokenPrices[pair.token1] = (tokenPrices[pair.token0] * r0) / r1;
          } else if (tokenPrices[pair.token1] && !tokenPrices[pair.token0]) {
            tokenPrices[pair.token0] = (tokenPrices[pair.token1] * r1) / r0;
          }
        }

        // Build human-readable price map
        const tokenPricesInKas: Record<string, number> = {};
        for (const [addr, price] of Object.entries(tokenPrices)) {
          const sym = addrToSymbol[addr];
          if (sym) tokenPricesInKas[sym] = price;
        }
        tokenPricesInKas["KAS"] = 1;

        // Reward token info
        const rewardTokenSymbol =
          KASPLEX_TOKENS.find((t) => t.address?.toLowerCase() === farmData.rewardToken)?.symbol ?? "ZEAL";
        const rewardTokenPrice = tokenPrices[farmData.rewardToken] ?? 0;

        // ===== Phase 3: Build opportunities array =====
        const opportunities: YieldOpportunity[] = [];

        // --- Farms ---
        const knownAddresses = new Set(KASPLEX_TOKENS.filter((t) => t.address).map((t) => t.address!.toLowerCase()));
        for (let i = 0; i < farmData.poolIds.length; i++) {
          const pid = farmData.poolIds[i];
          const info = farmData.poolInfos[i];
          const lpToken = info[0].toLowerCase();
          const allocPoint = info[1];
          const totalDeposited = info[4];

          if (!info[5]) continue; // skip inactive

          // Find matching pair
          const pairData = pairDataResults.find((p) => p.address.toLowerCase() === lpToken);
          if (!pairData) continue;

          const token0Sym = addrToSymbol[pairData.token0] ?? pairData.token0.slice(0, 8);
          const token1Sym = addrToSymbol[pairData.token1] ?? pairData.token1.slice(0, 8);
          const price0 = tokenPrices[pairData.token0] ?? 0;
          const price1 = tokenPrices[pairData.token1] ?? 0;

          const r0 = Number(formatUnits(pairData.reserve0, 18));
          const r1 = Number(formatUnits(pairData.reserve1, 18));
          const lpTotalSupply = Number(formatUnits(pairData.totalSupply, 18));
          const deposited = Number(formatUnits(totalDeposited, 18));

          // LP value per token
          const lpValuePerToken = lpTotalSupply > 0
            ? (r0 * price0 + r1 * price1) / lpTotalSupply
            : 0;
          const tvlKas = deposited * lpValuePerToken;

          // APY calculation
          const allocPct = Number(allocPoint) / Number(farmData.totalAllocPoint);
          const annualRewards =
            Number(formatUnits(farmData.rewardPerBlock, 18)) * BLOCKS_PER_YEAR * allocPct;
          const apyPercent = tvlKas > 0 ? (annualRewards * rewardTokenPrice / tvlKas) * 100 : 0;

          // Risks
          const risks: RiskFlag[] = [
            { type: "impermanent_loss", label: "Impermanent loss risk", severity: "medium" as RiskLevel },
          ];
          if (tvlKas < 1000) {
            risks.push({ type: "low_liquidity", label: "Low liquidity (TVL < 1,000 KAS)", severity: "high" as RiskLevel });
          }
          if (!knownAddresses.has(pairData.token0)) {
            risks.push({ type: "unverified_token", label: `Unverified token ${token0Sym}`, severity: "high" as RiskLevel });
          }
          if (!knownAddresses.has(pairData.token1)) {
            risks.push({ type: "unverified_token", label: `Unverified token ${token1Sym}`, severity: "high" as RiskLevel });
          }

          const overallRisk: RiskLevel = risks.some((r) => r.severity === "high")
            ? "high"
            : risks.some((r) => r.severity === "medium")
            ? "medium"
            : "low";

          opportunities.push({
            id: `farm-${pid}`,
            type: "farm",
            name: `${token0Sym}/${token1Sym} Farm`,
            tokens: [token0Sym, token1Sym],
            apyPercent: isFinite(apyPercent) ? apyPercent : 0,
            yieldSource: `${rewardTokenSymbol} emissions`,
            tvlKas,
            risks,
            overallRisk,
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
          const totalStaked = Number(formatUnits(infinityData.zeal.totalStaked, 18));
          const zealPrice = tokenPrices[KASPLEX_TOKENS.find((t) => t.symbol === "ZEAL")!.address!.toLowerCase()] ?? 0;
          const tvlKas = totalStaked * zealPrice;
          const zealPerBlockNum = Number(formatUnits(infinityData.zeal.zealPerBlock, 18));

          // Same-token APY: rewards in ZEAL / staked in ZEAL
          const apyPercent = totalStaked > 0
            ? (zealPerBlockNum * BLOCKS_PER_YEAR / totalStaked) * 100
            : 0;

          const risks: RiskFlag[] = [];
          if (infinityData.zeal.emissionsPaused) {
            risks.push({ type: "emissions_paused", label: "Emissions currently paused", severity: "high" as RiskLevel });
          }
          if (tvlKas < 1000) {
            risks.push({ type: "low_liquidity", label: "Low liquidity (TVL < 1,000 KAS)", severity: "high" as RiskLevel });
          }

          const overallRisk: RiskLevel = risks.some((r) => r.severity === "high")
            ? "high"
            : risks.some((r) => r.severity === "medium")
            ? "medium"
            : "low";

          opportunities.push({
            id: "infinity-zeal",
            type: "infinity_pool",
            name: "ZEAL InfinityPool",
            tokens: ["ZEAL"],
            apyPercent: isFinite(apyPercent) ? apyPercent : 0,
            yieldSource: "ZEAL emissions",
            tvlKas,
            risks,
            overallRisk,
            details: {
              token: "ZEAL",
              exchangeRate: formatUnits(infinityData.zeal.exchangeRate, 18),
              totalStaked: formatUnits(infinityData.zeal.totalStaked, 18),
              zealPerBlock: formatUnits(infinityData.zeal.zealPerBlock, 18),
              emissionsPaused: infinityData.zeal.emissionsPaused,
            },
          });
        }

        // --- InfinityPool: NACHO (fee-based) ---
        {
          const totalStaked = Number(formatUnits(infinityData.nacho.totalStaked, 18));
          const nachoPrice = tokenPrices[KASPLEX_TOKENS.find((t) => t.symbol === "NACHO")!.address!.toLowerCase()] ?? 0;
          const tvlKas = totalStaked * nachoPrice;

          const risks: RiskFlag[] = [];
          if (tvlKas < 1000) {
            risks.push({ type: "low_liquidity", label: "Low liquidity (TVL < 1,000 KAS)", severity: "high" as RiskLevel });
          }

          opportunities.push({
            id: "infinity-nacho",
            type: "infinity_pool",
            name: "NACHO InfinityPool",
            tokens: ["NACHO"],
            apyPercent: null,
            yieldSource: "Fee-based (exchange rate appreciation)",
            tvlKas,
            risks,
            overallRisk: risks.some((r) => r.severity === "high") ? "high" : "low",
            details: {
              token: "NACHO",
              exchangeRate: formatUnits(infinityData.nacho.exchangeRate, 18),
              totalStaked: formatUnits(infinityData.nacho.totalStaked, 18),
            },
          });
        }

        // --- InfinityPool: KASPER (fee-based) ---
        {
          const totalStaked = Number(formatUnits(infinityData.kasper.totalStaked, 18));
          const kasperPrice = tokenPrices[KASPLEX_TOKENS.find((t) => t.symbol === "KASPER")!.address!.toLowerCase()] ?? 0;
          const tvlKas = totalStaked * kasperPrice;

          const risks: RiskFlag[] = [];
          if (tvlKas < 1000) {
            risks.push({ type: "low_liquidity", label: "Low liquidity (TVL < 1,000 KAS)", severity: "high" as RiskLevel });
          }

          opportunities.push({
            id: "infinity-kasper",
            type: "infinity_pool",
            name: "KASPER InfinityPool",
            tokens: ["KASPER"],
            apyPercent: null,
            yieldSource: "Fee-based (exchange rate appreciation)",
            tvlKas,
            risks,
            overallRisk: risks.some((r) => r.severity === "high") ? "high" : "low",
            details: {
              token: "KASPER",
              exchangeRate: formatUnits(infinityData.kasper.exchangeRate, 18),
              totalStaked: formatUnits(infinityData.kasper.totalStaked, 18),
            },
          });
        }

        // ===== Phase 4: Filter, sort, return =====
        let filtered = opportunities;
        if (filterToken) {
          const ft = filterToken.toUpperCase();
          filtered = opportunities.filter((o) =>
            o.tokens.some((t) => t.toUpperCase() === ft)
          );
        }

        // Sort by APY descending, nulls last
        filtered.sort((a, b) => {
          if (a.apyPercent === null && b.apyPercent === null) return 0;
          if (a.apyPercent === null) return 1;
          if (b.apyPercent === null) return -1;
          return b.apyPercent - a.apyPercent;
        });

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
