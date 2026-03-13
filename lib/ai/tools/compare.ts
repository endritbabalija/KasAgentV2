import { formatUnits, parseUnits } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { resolveTokenAddress, getTokenDecimals } from "./shared/helpers";
import { getKrokoQuote } from "@/lib/kroko-api";
import { findBestPath } from "./zealous/helpers";
import { checkDiscountEligibility } from "@/lib/discount";
import type { SwapComparisonQuote, SwapComparisonResult } from "../tool-types";

export const compareTools = {
  compareSwapQuotes: tool({
    description:
      "Compare swap quotes across all integrated DEXes (ZealousSwap + KrokoSwap). Returns a unified comparison with a recommendation. Use when the user wants to swap and doesn't specify a protocol.",
    inputSchema: z.object({
      tokenIn: z.string().describe("Symbol of the input token (e.g. KAS, ZEAL)"),
      tokenOut: z.string().describe("Symbol of the output token (e.g. NACHO, KASPER)"),
      amountIn: z.string().describe("Amount of input token in human-readable form (e.g. '10')"),
      walletAddress: z.string().optional().describe("User wallet address for discount-aware quotes"),
    }),
    execute: async ({ tokenIn, tokenOut, amountIn, walletAddress }) => {
      const addressIn = await resolveTokenAddress(tokenIn);
      const addressOut = await resolveTokenAddress(tokenOut);
      if (!addressIn || !addressOut) {
        return { error: `Unknown token: ${!addressIn ? tokenIn : tokenOut}` } as SwapComparisonResult;
      }
      if (addressIn === addressOut) {
        return { error: "Input and output tokens must be different" } as SwapComparisonResult;
      }

      const decimalsIn = await getTokenDecimals(tokenIn);
      const decimalsOut = await getTokenDecimals(tokenOut);
      const rawAmountIn = parseUnits(amountIn, decimalsIn);

      // Query both protocols in parallel
      const [zealousResult, krokoResult] = await Promise.allSettled([
        // ZealousSwap: on-chain quote via getAmountsOut
        (async (): Promise<SwapComparisonQuote> => {
          const discount = walletAddress
            ? await checkDiscountEligibility(walletAddress)
            : { isEligible: false };
          const { path, amounts } = await findBestPath(addressIn, addressOut, rawAmountIn, discount.isEligible);
          const amountOut = amounts[amounts.length - 1];
          const isMultiHop = path.length > 2;
          return {
            protocol: "zealous",
            protocolName: "ZealousSwap",
            amountOut: formatUnits(amountOut, decimalsOut),
            priceImpact: "0",
            route: isMultiHop ? `${tokenIn} -> WKAS -> ${tokenOut}` : `${tokenIn} -> ${tokenOut}`,
            isBest: false,
          };
        })(),
        // KrokoSwap: API quote
        (async (): Promise<SwapComparisonQuote> => {
          const quote = await getKrokoQuote({
            tokenIn: addressIn,
            tokenOut: addressOut,
            amountIn: rawAmountIn.toString(),
          });
          return {
            protocol: "kroko",
            protocolName: "KrokoSwap",
            amountOut: formatUnits(BigInt(quote.amountOut), decimalsOut),
            priceImpact: quote.priceImpact.toFixed(2),
            route: `${quote.route.hops}-hop ${quote.route.protocols?.join("+") ?? quote.route.protocol ?? "auto"}`,
            isBest: false,
          };
        })(),
      ]);

      // Build quotes array
      const quotes: SwapComparisonQuote[] = [];

      if (zealousResult.status === "fulfilled") {
        quotes.push(zealousResult.value);
      } else {
        quotes.push({
          protocol: "zealous",
          protocolName: "ZealousSwap",
          amountOut: "0",
          priceImpact: "0",
          route: "",
          isBest: false,
          error: "Pair not available",
        });
      }

      if (krokoResult.status === "fulfilled") {
        quotes.push(krokoResult.value);
      } else {
        quotes.push({
          protocol: "kroko",
          protocolName: "KrokoSwap",
          amountOut: "0",
          priceImpact: "0",
          route: "",
          isBest: false,
          error: "Pair not available",
        });
      }

      // Select best option
      const validQuotes = quotes.filter((q) => !q.error && parseFloat(q.amountOut) > 0);
      let recommendation = "";

      if (validQuotes.length === 0) {
        recommendation = "No DEX has liquidity for this pair.";
      } else if (validQuotes.length === 1) {
        validQuotes[0].isBest = true;
        recommendation = `Only available on ${validQuotes[0].protocolName}.`;
      } else {
        // Compare amountOut
        const amounts = validQuotes.map((q) => parseFloat(q.amountOut));
        const maxAmount = Math.max(...amounts);
        const minAmount = Math.min(...amounts);
        const diffPercent = minAmount > 0 ? ((maxAmount - minAmount) / minAmount) * 100 : 0;

        if (diffPercent > 0.5) {
          // Clear winner
          const bestIdx = amounts.indexOf(maxAmount);
          validQuotes[bestIdx].isBest = true;
          const otherName = validQuotes[1 - bestIdx].protocolName;
          recommendation = `${validQuotes[bestIdx].protocolName} gives you ${diffPercent.toFixed(1)}% more ${tokenOut} than ${otherName}.`;
        } else {
          // Very close — prefer lower price impact
          const impacts = validQuotes.map((q) => parseFloat(q.priceImpact) || 0);
          const bestIdx = impacts[0] <= impacts[1] ? 0 : 1;
          validQuotes[bestIdx].isBest = true;
          recommendation = `Prices are very close — ${validQuotes[bestIdx].protocolName} has slightly lower price impact.`;
        }
      }

      return {
        tokenIn,
        tokenOut,
        amountIn,
        quotes,
        recommendation,
      } as SwapComparisonResult;
    },
  }),
};
