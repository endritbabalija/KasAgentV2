import { formatUnits, parseUnits } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { PROTOCOLS } from "@/config/protocols";
import type { RiskFlag, ContractInfo } from "../../tool-types";
import {
  resolveTokenAddress,
  getTokenDecimals,
  estimateGasCost,
  calculateMinAmount,
  checkAllowance,
  checkPoolLiquidity,
} from "../shared/helpers";
import { findBestPath, calculatePriceImpact } from "./helpers";

const ROUTER = PROTOCOLS.kaspacom.contracts.router as `0x${string}`;
const FACTORY = PROTOCOLS.kaspacom.contracts.factory as `0x${string}`;

export const kaspacomSwapTools = {
  kaspacom_getSwapQuote: tool({
    description:
      "Get a swap quote for exchanging one token for another on KaspaCom. Returns the expected output amount. Automatically routes through WKAS if no direct pair exists. KaspaCom has a fixed 1% swap fee.",
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
      const addressIn = await resolveTokenAddress(tokenIn);
      const addressOut = await resolveTokenAddress(tokenOut);
      if (!addressIn || !addressOut) {
        return {
          error: `Unknown token: ${!addressIn ? tokenIn : tokenOut}`,
        };
      }
      if (addressIn === addressOut) {
        return { error: "Input and output tokens must be different" };
      }

      const decimalsIn = await getTokenDecimals(tokenIn);
      const decimalsOut = await getTokenDecimals(tokenOut);
      const rawAmount = parseUnits(amountIn, decimalsIn);

      try {
        const { path, amounts } = await findBestPath(addressIn, addressOut, rawAmount);
        const amountOut = amounts[amounts.length - 1];
        const isMultiHop = path.length > 2;

        return {
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: formatUnits(amountOut, decimalsOut),
          path,
          ...(isMultiHop ? { route: `${tokenIn} → WKAS → ${tokenOut}` } : {}),
          protocol: "kaspacom" as const,
        };
      } catch (e) {
        return {
          error: `Failed to get quote: ${e instanceof Error ? e.message : "No liquidity or invalid pair"}`,
        };
      }
    },
  }),

  kaspacom_prepareSwap: tool({
    description:
      "Prepare a token swap transaction on KaspaCom for the user to execute in their wallet. Returns all transaction parameters needed for on-chain execution. KaspaCom uses standard Uniswap V2 router with a fixed 1% swap fee.",
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
      const addressIn = await resolveTokenAddress(tokenIn);
      const addressOut = await resolveTokenAddress(tokenOut);
      if (!addressIn || !addressOut) {
        return {
          error: `Unknown token: ${!addressIn ? tokenIn : tokenOut}`,
        };
      }
      if (addressIn === addressOut) {
        return { error: "Input and output tokens must be different" };
      }

      const decimalsIn = await getTokenDecimals(tokenIn);
      const decimalsOut = await getTokenDecimals(tokenOut);
      const rawAmountIn = parseUnits(amountIn, decimalsIn);

      const isNativeIn = tokenIn.toUpperCase() === "KAS";
      const isNativeOut = tokenOut.toUpperCase() === "KAS";
      const swapType: "KAS_TO_TOKEN" | "TOKEN_TO_KAS" | "TOKEN_TO_TOKEN" =
        isNativeIn ? "KAS_TO_TOKEN" : isNativeOut ? "TOKEN_TO_KAS" : "TOKEN_TO_TOKEN";

      try {
        const { path, amounts } = await findBestPath(addressIn, addressOut, rawAmountIn);
        const isMultiHop = path.length > 2;

        const rawAmountOut = amounts[amounts.length - 1];
        const rawAmountOutMin = calculateMinAmount(rawAmountOut, slippage);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

        // Check allowance for ERC-20 inputs (approval target is router directly)
        let needsApproval = false;
        let currentAllowance = "0";
        if (!isNativeIn && walletAddress && addressIn) {
          ({ needsApproval, currentAllowance } = await checkAllowance(
            addressIn,
            walletAddress as `0x${string}`,
            ROUTER,
            rawAmountIn
          ));
        }

        // Price impact
        const priceImpact = await calculatePriceImpact(
          path,
          rawAmountIn,
          rawAmountOut
        );

        // Gas estimation
        const gasEstimate = await estimateGasCost(isMultiHop ? 250000n : 150000n, isMultiHop ? "0.035" : "0.0214");

        // DEX fee — 1% fixed per hop, no discounts
        const parsedAmountIn = parseFloat(amountIn);
        const feePerHop = 0.01;
        const hops = path.length - 1;
        const totalFeePct = (1 - Math.pow(1 - feePerHop, hops)) * 100;
        const feeAmount = isNaN(parsedAmountIn) ? 0 : parsedAmountIn * (1 - Math.pow(1 - feePerHop, hops));
        const dexFeeAmount = `${feeAmount.toFixed(feeAmount >= 1 ? 4 : 8)} ${tokenIn.toUpperCase()}`;

        // Risk flags
        const riskFlags: RiskFlag[] = [];
        const impactNum = parseFloat(priceImpact);
        if (impactNum > 3) {
          riskFlags.push({ type: "high_price_impact", label: `High price impact (${priceImpact}%)`, severity: "high" });
        } else if (impactNum > 1) {
          riskFlags.push({ type: "moderate_price_impact", label: `Moderate price impact (${priceImpact}%)`, severity: "medium" });
        }

        if (isMultiHop) {
          riskFlags.push({ type: "multi_hop", label: `Multi-hop route via WKAS (${totalFeePct.toFixed(2)}% total fee)`, severity: "low" });
        }

        // Check pool liquidity for each hop — batched
        await checkPoolLiquidity(FACTORY, path, riskFlags);

        if (slippage > 1) {
          riskFlags.push({ type: "high_slippage", label: `High slippage tolerance (${slippage}%)`, severity: "medium" });
        }

        // Contract interaction info — standard V2 function names
        const contractInfoMap: Record<string, { functionName: string; description: string }> = {
          KAS_TO_TOKEN: { functionName: "swapExactETHForTokens", description: "Swap exact KAS for tokens via KaspaCom Router" },
          TOKEN_TO_KAS: { functionName: "swapExactTokensForETH", description: "Swap exact tokens for KAS via KaspaCom Router" },
          TOKEN_TO_TOKEN: { functionName: "swapExactTokensForTokens", description: "Swap tokens for tokens via KaspaCom Router" },
        };
        const contractInfo: ContractInfo = {
          address: ROUTER,
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
          dexFee: totalFeePct.toFixed(2),
          gasEstimate,
          dexFeeAmount,
          feeRate: "1.00%",
          discountApplied: false,
          discountSource: "None",
          riskFlags,
          contractInfo,
          swapType,
          needsApproval,
          currentAllowance,
          ...(isMultiHop ? { route: `${tokenIn} → WKAS → ${tokenOut}` } : {}),
          tx: {
            router: ROUTER,
            tokenInAddress: addressIn,
            tokenOutAddress: addressOut,
            rawAmountIn: rawAmountIn.toString(),
            rawAmountOut: rawAmountOut.toString(),
            rawAmountOutMin: rawAmountOutMin.toString(),
            path,
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
