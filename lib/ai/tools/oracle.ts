import { z } from "zod";
import { tool } from "ai";
import { formatEther, formatUnits } from "viem";
import { getAllV2Factories } from "@/config/protocols";
import { CONTRACTS } from "@/config/contracts";
import { factoryAbi, pairAbi } from "@/config/abis";
import { client, resolveTokenAddress, getTokenDecimals, addressToSymbol } from "./helpers";
import { mcResult } from "@/lib/multicall";

const ZERO_PAIR = "0x0000000000000000000000000000000000000000" as `0x${string}`;

export const oracleTools = {
  getTokenPrice: tool({
    description:
      "Get the current price of a token in KAS, derived from on-chain pair reserves. Use this when users ask about token prices, e.g. 'what's the ZEAL price?' or 'how much is NACHO worth?'.",
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
            pairAddress: "N/A",
            liquidityKAS: "N/A",
            liquidityToken: "N/A",
            tokenDecimals: 18,
          };
        }

        const tokenAddress = await resolveTokenAddress(symbol);
        if (!tokenAddress) {
          return { error: `Token "${token}" not found in the registry. Try using the exact symbol.` };
        }

        const tokenDecimals = await getTokenDecimals(symbol);
        const wkas = CONTRACTS.WKAS;

        // Check WKAS pairs across ALL V2 factories for best price coverage
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

        // Find valid pairs (non-zero addresses)
        const validPairs: `0x${string}`[] = [];
        for (const r of pairResults) {
          const addr = mcResult<`0x${string}`>(r, ZERO_PAIR);
          if (addr !== ZERO_PAIR) validPairs.push(addr);
        }

        if (validPairs.length === 0) {
          return { error: `No WKAS pair found for ${symbol} on any DEX. Cannot determine price.` };
        }

        // Read reserves and token ordering for all valid pairs
        const detailCalls = validPairs.flatMap((pairAddr) => [
          { address: pairAddr, abi: pairAbi, functionName: "getReserves" as const },
          { address: pairAddr, abi: pairAbi, functionName: "token0" as const },
        ]);

        const detailResults = await client.multicall({
          contracts: detailCalls,
          allowFailure: true,
        });

        // Pick the pair with the deepest WKAS liquidity
        let bestPair = ZERO_PAIR;
        let bestReserveKAS = 0n;
        let bestReserveToken = 0n;

        for (let i = 0; i < validPairs.length; i++) {
          const base = i * 2;
          const [r0, r1] = mcResult<[bigint, bigint, number]>(detailResults[base], [0n, 0n, 0]);
          const isToken0WKAS = mcResult<string>(detailResults[base + 1], "").toLowerCase() === wkas.toLowerCase();

          const reserveKAS = isToken0WKAS ? r0 : r1;
          const reserveToken = isToken0WKAS ? r1 : r0;

          if (reserveKAS > bestReserveKAS) {
            bestPair = validPairs[i];
            bestReserveKAS = reserveKAS;
            bestReserveToken = reserveToken;
          }
        }

        if (bestReserveKAS === 0n || bestReserveToken === 0n) {
          return { error: `Pair for ${symbol} exists but has no liquidity.` };
        }

        // Calculate spot price: how many KAS per 1 token
        const kasDecimals = 18;
        const priceInKAS =
          Number((bestReserveKAS * BigInt(10 ** tokenDecimals)) / bestReserveToken) /
          10 ** kasDecimals;

        const resolvedSymbol = await addressToSymbol(tokenAddress);

        return {
          token: resolvedSymbol,
          priceInKAS: priceInKAS.toString(),
          pairAddress: bestPair,
          liquidityKAS: formatEther(bestReserveKAS),
          liquidityToken: formatUnits(bestReserveToken, tokenDecimals),
          tokenDecimals,
        };
      } catch (e) {
        return {
          error: `Failed to fetch token price: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),
};
