import { z } from "zod";
import { tool } from "ai";
import { formatEther, formatUnits } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { factoryAbi, pairAbi } from "@/config/abis";
import { client, resolveTokenAddress, getTokenDecimals, addressToSymbol } from "./helpers";

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

        // Find the WKAS pair
        const pairAddress = (await client.readContract({
          address: CONTRACTS.FACTORY,
          abi: factoryAbi,
          functionName: "getPair",
          args: [tokenAddress, CONTRACTS.WKAS],
        })) as `0x${string}`;

        if (pairAddress === "0x0000000000000000000000000000000000000000") {
          return { error: `No WKAS pair found for ${symbol}. Cannot determine price.` };
        }

        // Read reserves and token ordering
        const [reserves, token0] = await Promise.all([
          client.readContract({
            address: pairAddress,
            abi: pairAbi,
            functionName: "getReserves",
          }),
          client.readContract({
            address: pairAddress,
            abi: pairAbi,
            functionName: "token0",
          }),
        ]);

        const [r0, r1] = reserves as [bigint, bigint, number];
        const isToken0WKAS =
          (token0 as string).toLowerCase() === CONTRACTS.WKAS.toLowerCase();

        const reserveKAS = isToken0WKAS ? r0 : r1;
        const reserveToken = isToken0WKAS ? r1 : r0;

        if (reserveKAS === 0n || reserveToken === 0n) {
          return { error: `Pair for ${symbol} exists but has no liquidity.` };
        }

        // Calculate spot price: how many KAS per 1 token
        // price = (reserveKAS * 10^tokenDecimals) / reserveToken / 10^kasDecimals
        // This normalizes for any decimal difference between KAS (18) and the token
        const kasDecimals = 18;
        const priceInKAS =
          Number((reserveKAS * BigInt(10 ** tokenDecimals)) / reserveToken) /
          10 ** kasDecimals;

        // Resolve actual symbol in case casing differs
        const resolvedSymbol = await addressToSymbol(tokenAddress);

        return {
          token: resolvedSymbol,
          priceInKAS: priceInKAS.toString(),
          pairAddress,
          liquidityKAS: formatEther(reserveKAS),
          liquidityToken: formatUnits(reserveToken, tokenDecimals),
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
