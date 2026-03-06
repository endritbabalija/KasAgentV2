import { formatUnits, parseUnits, formatEther } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { CONTRACTS } from "@/config/contracts";
import { KASPLEX_TOKENS } from "@/config/tokens";
import {
  routerAbi,
  factoryAbi,
  pairAbi,
  erc20Abi,
} from "@/config/abis";
import type { RiskFlag, ContractInfo } from "../tool-types";
import {
  client,
  resolveTokenAddress,
  getTokenDecimals,
  calculatePriceImpact,
} from "./helpers";

export const swapTools = {
  getSwapQuote: tool({
    description:
      "Get a swap quote for exchanging one token for another on ZealousSwap. Returns the expected output amount. Supported tokens: KAS, WKAS, ZEAL, NACHO, KASPER.",
    inputSchema: z.object({
      tokenIn: z
        .string()
        .describe("Symbol of the input token (e.g. KAS, ZEAL)"),
      tokenOut: z
        .string()
        .describe("Symbol of the output token (e.g. NACHO, KASPER)"),
      amountIn: z
        .string()
        .describe("Amount of input token in human-readable form (e.g. '10')"),
    }),
    execute: async ({ tokenIn, tokenOut, amountIn }) => {
      const addressIn = resolveTokenAddress(tokenIn);
      const addressOut = resolveTokenAddress(tokenOut);
      if (!addressIn || !addressOut) {
        return {
          error: `Unknown token: ${!addressIn ? tokenIn : tokenOut}. Supported: KAS, WKAS, ZEAL, NACHO, KASPER`,
        };
      }
      if (addressIn === addressOut) {
        return { error: "Input and output tokens must be different" };
      }

      const decimalsIn = getTokenDecimals(tokenIn);
      const decimalsOut = getTokenDecimals(tokenOut);
      const rawAmount = parseUnits(amountIn, decimalsIn);

      try {
        const amounts = await client.readContract({
          address: CONTRACTS.ROUTER,
          abi: routerAbi,
          functionName: "getAmountsOut",
          args: [rawAmount, [addressIn, addressOut], false],
        });

        const amountOut = amounts[amounts.length - 1];
        return {
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: formatUnits(amountOut, decimalsOut),
          path: [addressIn, addressOut],
        };
      } catch (e) {
        return {
          error: `Failed to get quote: ${e instanceof Error ? e.message : "No liquidity or invalid pair"}`,
        };
      }
    },
  }),

  prepareSwap: tool({
    description:
      "Prepare a token swap transaction for the user to execute in their wallet. Returns all transaction parameters needed for on-chain execution. Use this when the user wants to actually swap tokens (not just check prices). Supported tokens: KAS, WKAS, ZEAL, NACHO, KASPER.",
    inputSchema: z.object({
      tokenIn: z
        .string()
        .describe("Symbol of the input token (e.g. KAS, ZEAL)"),
      tokenOut: z
        .string()
        .describe("Symbol of the output token (e.g. NACHO, KASPER)"),
      amountIn: z
        .string()
        .describe("Amount of input token in human-readable form (e.g. '10')"),
      slippage: z
        .number()
        .optional()
        .default(0.5)
        .describe("Slippage tolerance in percent (default 0.5)"),
      walletAddress: z
        .string()
        .optional()
        .describe("User wallet address for allowance check"),
    }),
    execute: async ({ tokenIn, tokenOut, amountIn, slippage, walletAddress }) => {
      const addressIn = resolveTokenAddress(tokenIn);
      const addressOut = resolveTokenAddress(tokenOut);
      if (!addressIn || !addressOut) {
        return {
          error: `Unknown token: ${!addressIn ? tokenIn : tokenOut}. Supported: KAS, WKAS, ZEAL, NACHO, KASPER`,
        };
      }
      if (addressIn === addressOut) {
        return { error: "Input and output tokens must be different" };
      }

      const decimalsIn = getTokenDecimals(tokenIn);
      const decimalsOut = getTokenDecimals(tokenOut);
      const rawAmountIn = parseUnits(amountIn, decimalsIn);

      const isNativeIn = tokenIn.toUpperCase() === "KAS";
      const isNativeOut = tokenOut.toUpperCase() === "KAS";
      const swapType: "KAS_TO_TOKEN" | "TOKEN_TO_KAS" | "TOKEN_TO_TOKEN" =
        isNativeIn ? "KAS_TO_TOKEN" : isNativeOut ? "TOKEN_TO_KAS" : "TOKEN_TO_TOKEN";

      try {
        const amounts = (await client.readContract({
          address: CONTRACTS.ROUTER,
          abi: routerAbi,
          functionName: "getAmountsOut",
          args: [rawAmountIn, [addressIn, addressOut], false],
        })) as bigint[];

        const rawAmountOut = amounts[amounts.length - 1];
        const slippageBps = BigInt(Math.round(slippage * 100));
        const rawAmountOutMin =
          rawAmountOut - (rawAmountOut * slippageBps) / 10000n;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

        // Check allowance for ERC-20 inputs
        let needsApproval = false;
        let currentAllowance = "0";
        if (!isNativeIn && walletAddress) {
          const tokenAddress = KASPLEX_TOKENS.find(
            (t) => t.symbol.toUpperCase() === tokenIn.toUpperCase()
          )?.address;
          if (tokenAddress) {
            const allowance = (await client.readContract({
              address: tokenAddress,
              abi: erc20Abi,
              functionName: "allowance",
              args: [
                walletAddress as `0x${string}`,
                CONTRACTS.ROUTER,
              ],
            })) as bigint;
            currentAllowance = allowance.toString();
            needsApproval = allowance < rawAmountIn;
          }
        }

        // Price impact
        const priceImpact = await calculatePriceImpact(
          addressIn,
          addressOut,
          rawAmountIn,
          rawAmountOut
        );

        // Gas estimation
        let gasEstimate = "0.0214"; // fallback
        try {
          const gasPrice = await client.getGasPrice();
          const gasUnits = 150000n; // conservative estimate for swap tx
          const gasCostWei = gasUnits * gasPrice;
          gasEstimate = formatEther(gasCostWei);
        } catch {
          // keep fallback
        }

        // DEX fee in token amount
        const parsedAmountIn = parseFloat(amountIn);
        const feeAmount = isNaN(parsedAmountIn) ? 0 : parsedAmountIn * 0.003;
        const dexFeeAmount = `${feeAmount.toFixed(feeAmount >= 1 ? 4 : 8)} ${tokenIn.toUpperCase()}`;

        // Risk flags
        const riskFlags: RiskFlag[] = [];
        const impactNum = parseFloat(priceImpact);
        if (impactNum > 3) {
          riskFlags.push({ type: "high_price_impact", label: `High price impact (${priceImpact}%)`, severity: "high" });
        } else if (impactNum > 1) {
          riskFlags.push({ type: "moderate_price_impact", label: `Moderate price impact (${priceImpact}%)`, severity: "medium" });
        }

        // Check pool liquidity
        try {
          const pairAddress = (await client.readContract({
            address: CONTRACTS.FACTORY,
            abi: factoryAbi,
            functionName: "getPair",
            args: [addressIn, addressOut],
          })) as `0x${string}`;

          if (pairAddress !== "0x0000000000000000000000000000000000000000") {
            const [reserves, token0] = await Promise.all([
              client.readContract({ address: pairAddress, abi: pairAbi, functionName: "getReserves" }),
              client.readContract({ address: pairAddress, abi: pairAbi, functionName: "token0" }),
            ]);
            const [r0, r1] = reserves as [bigint, bigint, number];
            const isToken0In = (token0 as string).toLowerCase() === addressIn.toLowerCase();
            const reserveIn = Number(formatUnits(isToken0In ? r0 : r1, decimalsIn));
            const reserveOut = Number(formatUnits(isToken0In ? r1 : r0, decimalsOut));
            if (reserveIn < 1000 || reserveOut < 1000) {
              riskFlags.push({ type: "low_liquidity", label: "Low pool liquidity", severity: "high" });
            }
          }
        } catch {
          // skip liquidity check on error
        }

        if (slippage > 1) {
          riskFlags.push({ type: "high_slippage", label: `High slippage tolerance (${slippage}%)`, severity: "medium" });
        }

        // Contract interaction info
        const contractInfoMap: Record<string, { functionName: string; description: string }> = {
          KAS_TO_TOKEN: { functionName: "swapExactKASForTokens", description: "Swap exact KAS for tokens via ZealousSwap Router" },
          TOKEN_TO_KAS: { functionName: "swapTokensForExactKAS", description: "Swap tokens for KAS via ZealousSwap Router" },
          TOKEN_TO_TOKEN: { functionName: "swapExactTokensForTokens", description: "Swap tokens for tokens via ZealousSwap Router" },
        };
        const contractInfo: ContractInfo = {
          address: CONTRACTS.ROUTER,
          ...contractInfoMap[swapType],
        };

        return {
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: formatUnits(rawAmountOut, decimalsOut),
          amountOutMin: formatUnits(rawAmountOutMin, decimalsOut),
          slippage,
          priceImpact,
          dexFee: "0.3",
          gasEstimate,
          dexFeeAmount,
          riskFlags,
          contractInfo,
          swapType,
          needsApproval,
          currentAllowance,
          tx: {
            router: CONTRACTS.ROUTER,
            tokenInAddress: addressIn,
            tokenOutAddress: addressOut,
            rawAmountIn: rawAmountIn.toString(),
            rawAmountOut: rawAmountOut.toString(),
            rawAmountOutMin: rawAmountOutMin.toString(),
            path: [addressIn, addressOut],
            deadline: deadline.toString(),
            value: isNativeIn ? rawAmountIn.toString() : "0",
          },
        };
      } catch (e) {
        return {
          error: `Failed to prepare swap: ${e instanceof Error ? e.message : "No liquidity or invalid pair"}`,
        };
      }
    },
  }),
};
