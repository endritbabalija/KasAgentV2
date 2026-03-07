import { formatUnits, parseUnits } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { CONTRACTS } from "@/config/contracts";
import {
  factoryAbi,
  pairAbi,
} from "@/config/abis";
import type { RiskFlag, ContractInfo } from "../tool-types";
import {
  client,
  resolveTokenAddress,
  getTokenDecimals,
  calculatePriceImpact,
  estimateGasCost,
  calculateMinAmount,
  checkAllowance,
  findBestPath,
} from "./helpers";

export const swapTools = {
  getSwapQuote: tool({
    description:
      "Get a swap quote for exchanging one token for another on ZealousSwap. Returns the expected output amount. Automatically routes through WKAS if no direct pair exists.",
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
      "Prepare a token swap transaction for the user to execute in their wallet. Returns all transaction parameters needed for on-chain execution. Automatically routes through WKAS if no direct pair exists.",
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

        // Check allowance for ERC-20 inputs
        let needsApproval = false;
        let currentAllowance = "0";
        if (!isNativeIn && walletAddress && addressIn) {
          ({ needsApproval, currentAllowance } = await checkAllowance(
            addressIn,
            walletAddress as `0x${string}`,
            CONTRACTS.ROUTER,
            rawAmountIn
          ));
        }

        // Price impact (use first and last tokens in path)
        const priceImpact = await calculatePriceImpact(
          addressIn,
          addressOut,
          rawAmountIn,
          rawAmountOut
        );

        // Gas estimation (multi-hop uses more gas)
        const gasEstimate = await estimateGasCost(isMultiHop ? 250000n : 150000n, isMultiHop ? "0.035" : "0.0214");

        // DEX fee — 0.3% per hop
        const parsedAmountIn = parseFloat(amountIn);
        const feePerHop = 0.003;
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

        // Check pool liquidity for each hop (KAS-denominated)
        try {
          const wkasAddr = CONTRACTS.WKAS.toLowerCase();
          for (let i = 0; i < path.length - 1; i++) {
            const pairAddress = (await client.readContract({
              address: CONTRACTS.FACTORY,
              abi: factoryAbi,
              functionName: "getPair",
              args: [path[i], path[i + 1]],
            })) as `0x${string}`;

            if (pairAddress === "0x0000000000000000000000000000000000000000") continue;

            const [reserves, token0] = await Promise.all([
              client.readContract({ address: pairAddress, abi: pairAbi, functionName: "getReserves" }),
              client.readContract({ address: pairAddress, abi: pairAbi, functionName: "token0" }),
            ]);
            const [r0, r1] = reserves as [bigint, bigint, number];
            const t0 = (token0 as string).toLowerCase();

            // If one side is WKAS, use that reserve as the KAS-denominated liquidity
            let liquidityKas: number;
            if (t0 === wkasAddr) {
              liquidityKas = Number(formatUnits(r0, 18)) * 2;
            } else if (path[i].toLowerCase() === wkasAddr || path[i + 1].toLowerCase() === wkasAddr) {
              liquidityKas = Number(formatUnits(r1, 18)) * 2;
            } else {
              // Non-WKAS pair — use raw reserve as rough estimate
              const r0Val = Number(formatUnits(r0, 18));
              const r1Val = Number(formatUnits(r1, 18));
              liquidityKas = Math.min(r0Val, r1Val) * 2;
            }

            if (liquidityKas < 1000) {
              riskFlags.push({ type: "low_liquidity", label: `Low pool liquidity on hop ${i + 1}`, severity: "high" });
              break;
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
          dexFee: totalFeePct.toFixed(2),
          gasEstimate,
          dexFeeAmount,
          riskFlags,
          contractInfo,
          swapType,
          needsApproval,
          currentAllowance,
          ...(isMultiHop ? { route: `${tokenIn} → WKAS → ${tokenOut}` } : {}),
          tx: {
            router: CONTRACTS.ROUTER,
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
