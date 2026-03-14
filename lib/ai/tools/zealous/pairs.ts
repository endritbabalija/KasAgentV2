import { formatUnits } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { CONTRACTS } from "@/config/contracts";
import { getDiscoveryData } from "@/lib/token-registry";

const DEFAULT_MIN_LIQUIDITY_KAS = 100;

export const zealousPairTools = {
  zealous_listAllPairs: tool({
    description:
      "List available trading pairs across all DEXes (ZealousSwap, KrokoSwap, KaspaCom) with liquidity data. Discovers pairs from all V2 factories on-chain. Filters out dust/empty pools by default. Use when the user asks what pairs exist, available swap routes, which tokens can be traded, or to see all pools on any DEX. Prefer this over multiple getPoolReserves calls.",
    inputSchema: z.object({
      minLiquidityKas: z
        .number()
        .optional()
        .describe(`Minimum liquidity in KAS to include a pair (default ${DEFAULT_MIN_LIQUIDITY_KAS}). Set to 0 to show all.`),
      protocolId: z
        .string()
        .optional()
        .describe("Filter by DEX protocol: 'zealous', 'kroko', or 'kaspacom'. Omit to show all DEXes."),
    }),
    execute: async ({ minLiquidityKas, protocolId }) => {
      try {
        const threshold = minLiquidityKas ?? DEFAULT_MIN_LIQUIDITY_KAS;
        const { tokens, pairs } = await getDiscoveryData();

        const addrToSymbol: Record<string, string> = {};
        const addrToDecimals: Record<string, number> = {};
        for (const t of tokens) {
          if (t.address) {
            addrToSymbol[t.address.toLowerCase()] = t.symbol;
            addrToDecimals[t.address.toLowerCase()] = t.decimals;
          }
        }

        const wkasAddr = CONTRACTS.WKAS.toLowerCase();

        // Two-pass price derivation (same approach as yield.ts)
        const tokenPrices: Record<string, number> = { [wkasAddr]: 1 };

        for (const p of pairs) {
          if (p.reserve0 === 0n || p.reserve1 === 0n) continue;
          const d0 = addrToDecimals[p.token0] ?? 18;
          const d1 = addrToDecimals[p.token1] ?? 18;
          const r0 = Number(formatUnits(p.reserve0, d0));
          const r1 = Number(formatUnits(p.reserve1, d1));
          if (p.token0 === wkasAddr && !tokenPrices[p.token1]) {
            tokenPrices[p.token1] = r0 / r1;
          } else if (p.token1 === wkasAddr && !tokenPrices[p.token0]) {
            tokenPrices[p.token0] = r1 / r0;
          }
        }

        for (const p of pairs) {
          if (p.reserve0 === 0n || p.reserve1 === 0n) continue;
          const d0 = addrToDecimals[p.token0] ?? 18;
          const d1 = addrToDecimals[p.token1] ?? 18;
          const r0 = Number(formatUnits(p.reserve0, d0));
          const r1 = Number(formatUnits(p.reserve1, d1));
          if (tokenPrices[p.token0] && !tokenPrices[p.token1]) {
            tokenPrices[p.token1] = (tokenPrices[p.token0] * r0) / r1;
          } else if (tokenPrices[p.token1] && !tokenPrices[p.token0]) {
            tokenPrices[p.token0] = (tokenPrices[p.token1] * r1) / r0;
          }
        }

        const filteredPairs = protocolId
          ? pairs.filter((p) => p.protocolId === protocolId)
          : pairs;

        const pairInfos = filteredPairs
          .map((p) => {
            const sym0 = addrToSymbol[p.token0] ?? p.token0.slice(0, 10);
            const sym1 = addrToSymbol[p.token1] ?? p.token1.slice(0, 10);
            const d0 = addrToDecimals[p.token0] ?? 18;
            const d1 = addrToDecimals[p.token1] ?? 18;
            const r0 = Number(formatUnits(p.reserve0, d0));
            const r1 = Number(formatUnits(p.reserve1, d1));
            const price0 = tokenPrices[p.token0] ?? 0;
            const price1 = tokenPrices[p.token1] ?? 0;
            const totalLiquidityKas = r0 * price0 + r1 * price1;

            return {
              pair: `${sym0}/${sym1}`,
              pairAddress: p.address,
              token0Symbol: sym0,
              token1Symbol: sym1,
              reserve0: formatUnits(p.reserve0, d0),
              reserve1: formatUnits(p.reserve1, d1),
              totalLiquidityKas: isFinite(totalLiquidityKas) ? totalLiquidityKas : 0,
              protocolId: p.protocolId,
            };
          })
          .filter((p) => p.totalLiquidityKas >= threshold);

        pairInfos.sort((a, b) => b.totalLiquidityKas - a.totalLiquidityKas);

        return {
          pairs: pairInfos,
          totalPairsOnChain: filteredPairs.length,
          tokenCount: tokens.length,
          minLiquidityKas: threshold,
          ...(protocolId ? { protocolId } : {}),
          fetchedAt: new Date().toISOString(),
        };
      } catch (e) {
        return {
          pairs: [],
          totalPairsOnChain: 0,
          tokenCount: 0,
          minLiquidityKas: minLiquidityKas ?? DEFAULT_MIN_LIQUIDITY_KAS,
          fetchedAt: new Date().toISOString(),
          error: `Failed to list pairs: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),
};
