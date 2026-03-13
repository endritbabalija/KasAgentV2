import { formatUnits } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { CONTRACTS } from "@/config/contracts";
import { getDiscoveryData } from "@/lib/token-registry";

const DEFAULT_MIN_LIQUIDITY_KAS = 100;

export const zealousPairTools = {
  zealous_listAllPairs: tool({
    description:
      "List available trading pairs on ZealousSwap with liquidity data. Filters out dust/empty pools by default. Use when the user asks what pairs exist, available swap routes, which tokens can be traded, or to see all pools. Prefer this over multiple getPoolReserves calls.",
    inputSchema: z.object({
      minLiquidityKas: z
        .number()
        .optional()
        .describe(`Minimum liquidity in KAS to include a pair (default ${DEFAULT_MIN_LIQUIDITY_KAS}). Set to 0 to show all.`),
    }),
    execute: async ({ minLiquidityKas }) => {
      try {
        const threshold = minLiquidityKas ?? DEFAULT_MIN_LIQUIDITY_KAS;
        const { tokens, pairs } = await getDiscoveryData();

        const addrToSymbol: Record<string, string> = {};
        for (const t of tokens) {
          if (t.address) addrToSymbol[t.address.toLowerCase()] = t.symbol;
        }

        const wkasAddr = CONTRACTS.WKAS.toLowerCase();

        // Two-pass price derivation (same approach as yield.ts)
        const tokenPrices: Record<string, number> = { [wkasAddr]: 1 };

        for (const p of pairs) {
          if (p.reserve0 === 0n || p.reserve1 === 0n) continue;
          const r0 = Number(formatUnits(p.reserve0, 18));
          const r1 = Number(formatUnits(p.reserve1, 18));
          if (p.token0 === wkasAddr && !tokenPrices[p.token1]) {
            tokenPrices[p.token1] = r0 / r1;
          } else if (p.token1 === wkasAddr && !tokenPrices[p.token0]) {
            tokenPrices[p.token0] = r1 / r0;
          }
        }

        for (const p of pairs) {
          if (p.reserve0 === 0n || p.reserve1 === 0n) continue;
          const r0 = Number(formatUnits(p.reserve0, 18));
          const r1 = Number(formatUnits(p.reserve1, 18));
          if (tokenPrices[p.token0] && !tokenPrices[p.token1]) {
            tokenPrices[p.token1] = (tokenPrices[p.token0] * r0) / r1;
          } else if (tokenPrices[p.token1] && !tokenPrices[p.token0]) {
            tokenPrices[p.token0] = (tokenPrices[p.token1] * r1) / r0;
          }
        }

        const pairInfos = pairs
          .map((p) => {
            const sym0 = addrToSymbol[p.token0] ?? p.token0.slice(0, 10);
            const sym1 = addrToSymbol[p.token1] ?? p.token1.slice(0, 10);
            const r0 = Number(formatUnits(p.reserve0, 18));
            const r1 = Number(formatUnits(p.reserve1, 18));
            const price0 = tokenPrices[p.token0] ?? 0;
            const price1 = tokenPrices[p.token1] ?? 0;
            const totalLiquidityKas = r0 * price0 + r1 * price1;

            return {
              pair: `${sym0}/${sym1}`,
              pairAddress: p.address,
              token0Symbol: sym0,
              token1Symbol: sym1,
              reserve0: formatUnits(p.reserve0, 18),
              reserve1: formatUnits(p.reserve1, 18),
              totalLiquidityKas: isFinite(totalLiquidityKas) ? totalLiquidityKas : 0,
            };
          })
          .filter((p) => p.totalLiquidityKas >= threshold);

        pairInfos.sort((a, b) => b.totalLiquidityKas - a.totalLiquidityKas);

        return {
          pairs: pairInfos,
          totalPairsOnChain: pairs.length,
          tokenCount: tokens.length,
          minLiquidityKas: threshold,
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
