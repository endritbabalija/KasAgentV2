import { z } from "zod";
import { tool } from "ai";
import { formatEther, formatUnits } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { factoryAbi, pairAbi } from "@/config/abis";
import { getAllV2Factories, getProtocol } from "@/config/protocols";
import { client, resolveTokenAddress, getTokenDecimals, addressToSymbol } from "./helpers";
import { mcResult } from "@/lib/multicall";
import { getDiscoveryData } from "@/lib/token-registry";
import { derivePrices, type TokenMap } from "@/lib/portfolio-math";

const ZERO_PAIR = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export const oracleTools = {
  getTokenPrice: tool({
    description:
      "Get the current price of a token in KAS across all DEXes. Shows price, per-DEX liquidity depth, and flags where liquidity is thin or absent. Use when users ask about token prices.",
    inputSchema: z.object({
      token: z
        .string()
        .describe("The token symbol to get the price for, e.g. 'ZEAL', 'NACHO', 'KASPER'"),
    }),
    execute: async ({ token }) => {
      try {
        const symbol = token.toUpperCase();

        if (symbol === "KAS" || symbol === "WKAS") {
          return {
            token: "KAS",
            priceInKAS: "1",
            dexLiquidity: [],
            tokenDecimals: 18,
          };
        }

        const tokenAddress = await resolveTokenAddress(symbol);
        if (!tokenAddress) {
          return { error: `Token "${token}" not found in the registry. Try using the exact symbol.` };
        }

        const tokenDecimals = await getTokenDecimals(symbol);
        const wkas = CONTRACTS.WKAS;

        // Use shared pricing algorithm (same as portfolio panel)
        const { tokens, pairs } = await getDiscoveryData();
        const tokenMap: TokenMap = new Map();
        for (const t of tokens) {
          if (t.address) {
            tokenMap.set(t.address.toLowerCase(), { decimals: t.decimals, symbol: t.symbol });
          }
        }
        const prices = derivePrices(pairs, tokenMap, wkas);
        const priceInKAS = prices[tokenAddress.toLowerCase()];

        if (priceInKAS === undefined || priceInKAS === 0) {
          return { error: `No liquidity path found for ${symbol}. Cannot determine price.` };
        }

        // Check WKAS pairs on ALL DEXes for per-DEX liquidity breakdown
        const factories = getAllV2Factories();
        const getPairCalls = factories.map((f) => ({
          address: f.address,
          abi: factoryAbi,
          functionName: "getPair" as const,
          args: [tokenAddress, wkas] as const,
        }));

        const pairResults = await client.multicall({
          contracts: getPairCalls,
          allowFailure: true,
        });

        // Collect valid pairs with their protocol IDs
        const validPairs: { address: `0x${string}`; protocolId: string }[] = [];
        for (let i = 0; i < pairResults.length; i++) {
          const addr = mcResult<`0x${string}`>(pairResults[i], ZERO_PAIR);
          if (addr !== ZERO_PAIR) {
            validPairs.push({ address: addr, protocolId: factories[i].protocolId });
          }
        }

        // Read reserves for all valid pairs in one multicall
        const dexLiquidity: {
          dex: string;
          pairAddress: string;
          liquidityKAS: string;
          liquidityToken: string;
          spotPrice: string;
        }[] = [];

        let pricingMethod: "direct" | "transitive" = validPairs.length > 0 ? "direct" : "transitive";

        if (validPairs.length > 0) {
          const detailCalls = validPairs.flatMap((p) => [
            { address: p.address, abi: pairAbi, functionName: "getReserves" as const },
            { address: p.address, abi: pairAbi, functionName: "token0" as const },
          ]);

          const detailResults = await client.multicall({
            contracts: detailCalls,
            allowFailure: true,
          });

          for (let i = 0; i < validPairs.length; i++) {
            const base = i * 2;
            const [r0, r1] = mcResult<[bigint, bigint, number]>(detailResults[base], [0n, 0n, 0]);
            const isToken0WKAS = mcResult<string>(detailResults[base + 1], "").toLowerCase() === wkas.toLowerCase();

            const reserveKAS = isToken0WKAS ? r0 : r1;
            const reserveToken = isToken0WKAS ? r1 : r0;

            if (reserveKAS === 0n && reserveToken === 0n) continue;

            const protocol = getProtocol(validPairs[i].protocolId as "zealous" | "kroko" | "kaspacom");
            const spotPrice = reserveToken > 0n
              ? (Number(reserveKAS) / Number(reserveToken)).toString()
              : "0";

            dexLiquidity.push({
              dex: protocol.name,
              pairAddress: validPairs[i].address,
              liquidityKAS: formatEther(reserveKAS),
              liquidityToken: formatUnits(reserveToken, tokenDecimals),
              spotPrice,
            });
          }

          // Sort by liquidity depth (deepest first)
          dexLiquidity.sort((a, b) => parseFloat(b.liquidityKAS) - parseFloat(a.liquidityKAS));

          // If all pairs had zero reserves, it's transitive
          if (dexLiquidity.length === 0) pricingMethod = "transitive";
        }

        const resolvedSymbol = await addressToSymbol(tokenAddress);

        return {
          token: resolvedSymbol,
          tokenAddress,
          priceInKAS: priceInKAS.toString(),
          dexLiquidity,
          tokenDecimals,
          ...(pricingMethod === "transitive" ? { note: "Price derived transitively through intermediate pairs (no direct WKAS pair)." } : {}),
        };
      } catch (e) {
        return {
          error: `Failed to fetch token price: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),
};
