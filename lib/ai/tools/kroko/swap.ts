import { formatUnits, parseUnits } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { PROTOCOLS } from "@/config/protocols";
import { erc20Abi, permit2Abi } from "@/config/abis";
import { getKrokoQuote, getKrokoSwapCalldata, type KrokoRouteInfo } from "@/lib/kroko-api";
import type { RiskFlag, ContractInfo } from "../../tool-types";
import {
  client,
  resolveTokenAddress,
  getTokenDecimals,
  estimateGasCost,
} from "../shared/helpers";

const KROKO = PROTOCOLS.kroko.contracts;

function formatRoute(route: KrokoRouteInfo): string {
  const protocol = route.protocols?.join("+") ?? route.protocol ?? "auto";
  return `${route.hops}-hop ${protocol}`;
}

export const krokoSwapTools = {
  kroko_getSwapQuote: tool({
    description:
      "Get a swap quote from KrokoSwap DEX (V2+V3 routing). Returns the expected output amount via the KrokoSwap API.",
    inputSchema: z.object({
      tokenIn: z.string().describe("Symbol of the input token (e.g. KAS, ZEAL)"),
      tokenOut: z.string().describe("Symbol of the output token (e.g. NACHO, KASPER)"),
      amountIn: z.string().describe("Amount of input token in human-readable form (e.g. '10')"),
    }),
    execute: async ({ tokenIn, tokenOut, amountIn }) => {
      const addressIn = await resolveTokenAddress(tokenIn);
      const addressOut = await resolveTokenAddress(tokenOut);
      if (!addressIn || !addressOut) {
        return { error: `Unknown token: ${!addressIn ? tokenIn : tokenOut}` };
      }
      if (addressIn === addressOut) {
        return { error: "Input and output tokens must be different" };
      }

      const decimalsIn = await getTokenDecimals(tokenIn);
      const decimalsOut = await getTokenDecimals(tokenOut);
      const rawAmount = parseUnits(amountIn, decimalsIn);

      try {
        const quote = await getKrokoQuote({
          tokenIn: addressIn,
          tokenOut: addressOut,
          amountIn: rawAmount.toString(),
        });

        return {
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: formatUnits(BigInt(quote.amountOut), decimalsOut),
          priceImpact: quote.priceImpact.toFixed(2),
          route: formatRoute(quote.route),
          protocol: "kroko" as const,
        };
      } catch (e) {
        return {
          error: `Failed to get KrokoSwap quote: ${e instanceof Error ? e.message : "No liquidity or invalid pair"}`,
        };
      }
    },
  }),

  kroko_prepareSwap: tool({
    description:
      "Prepare a token swap transaction on KrokoSwap DEX. Returns transaction parameters for the Universal Router with Permit2 approval status.",
    inputSchema: z.object({
      tokenIn: z.string().describe("Symbol of the input token (e.g. KAS, ZEAL)"),
      tokenOut: z.string().describe("Symbol of the output token (e.g. NACHO, KASPER)"),
      amountIn: z.string().describe("Amount of input token in human-readable form (e.g. '10')"),
      slippage: z.number().optional().default(0.5).describe("Slippage tolerance in percent (default 0.5)"),
      walletAddress: z.string().optional().describe("User wallet address for approval checks"),
    }),
    execute: async ({ tokenIn, tokenOut, amountIn, slippage, walletAddress }) => {
      const addressIn = await resolveTokenAddress(tokenIn);
      const addressOut = await resolveTokenAddress(tokenOut);
      if (!addressIn || !addressOut) {
        return { error: `Unknown token: ${!addressIn ? tokenIn : tokenOut}` };
      }
      if (addressIn === addressOut) {
        return { error: "Input and output tokens must be different" };
      }

      const decimalsIn = await getTokenDecimals(tokenIn);
      const decimalsOut = await getTokenDecimals(tokenOut);
      const rawAmountIn = parseUnits(amountIn, decimalsIn);
      const isNativeIn = tokenIn.toUpperCase() === "KAS";

      try {
        // Get quote first
        const quote = await getKrokoQuote({
          tokenIn: addressIn,
          tokenOut: addressOut,
          amountIn: rawAmountIn.toString(),
        });

        // Get swap calldata
        const recipient = walletAddress ?? "0x0000000000000000000000000000000000000000";
        const swapData = await getKrokoSwapCalldata({
          tokenIn: addressIn,
          tokenOut: addressOut,
          amountIn: rawAmountIn.toString(),
          slippage,
          recipient,
        });

        const rawAmountOut = BigInt(quote.amountOut);

        // Check Permit2 approvals (skip for native KAS input)
        let needsTokenApproval = false;
        let needsPermit2Approval = false;

        if (!isNativeIn && walletAddress) {
          const owner = walletAddress as `0x${string}`;
          const permit2Addr = KROKO.permit2;
          const universalRouter = KROKO.universalRouter;

          // Multicall: ERC-20 allowance to Permit2 + Permit2 allowance to Universal Router
          const mc = await client.multicall({
            contracts: [
              {
                address: addressIn,
                abi: erc20Abi,
                functionName: "allowance" as const,
                args: [owner, permit2Addr] as const,
              },
              {
                address: permit2Addr,
                abi: permit2Abi,
                functionName: "allowance" as const,
                args: [owner, addressIn, universalRouter] as const,
              },
            ],
            allowFailure: true,
          });

          // ERC-20 allowance to Permit2
          const tokenAllowance = mc[0].status === "success" ? (mc[0].result as bigint) : 0n;
          needsTokenApproval = tokenAllowance < rawAmountIn;

          // Permit2 allowance to Universal Router: returns (amount, expiration, nonce)
          if (mc[1].status === "success") {
            const [p2Amount, p2Expiration] = mc[1].result as [bigint, number, number];
            const now = Math.floor(Date.now() / 1000);
            needsPermit2Approval =
              BigInt(p2Amount) < rawAmountIn || Number(p2Expiration) < now;
          } else {
            needsPermit2Approval = true;
          }
        }

        // Gas estimate
        const gasEstimate = await estimateGasCost(200000n, "0.03");

        // Risk flags
        const riskFlags: RiskFlag[] = [];
        const impactNum = quote.priceImpact;
        if (impactNum > 3) {
          riskFlags.push({ type: "high_price_impact", label: `High price impact (${impactNum.toFixed(2)}%)`, severity: "high" });
        } else if (impactNum > 1) {
          riskFlags.push({ type: "moderate_price_impact", label: `Moderate price impact (${impactNum.toFixed(2)}%)`, severity: "medium" });
        }
        if (slippage > 1) {
          riskFlags.push({ type: "high_slippage", label: `High slippage tolerance (${slippage}%)`, severity: "medium" });
        }
        if (needsTokenApproval && needsPermit2Approval) {
          riskFlags.push({ type: "two_approvals", label: "Two approval transactions required (ERC-20 + Permit2)", severity: "low" });
        }

        const contractInfo: ContractInfo = {
          address: KROKO.universalRouter,
          functionName: "execute",
          description: "Swap via KrokoSwap Universal Router (V2+V3 routing)",
        };

        return {
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: formatUnits(rawAmountOut, decimalsOut),
          amountOutMin: swapData.quote.minAmountOut
            ? formatUnits(BigInt(swapData.quote.minAmountOut), decimalsOut)
            : formatUnits(rawAmountOut * (1000n - BigInt(Math.round(slippage * 10))) / 1000n, decimalsOut),
          slippage,
          priceImpact: impactNum.toFixed(2),
          route: formatRoute(quote.route),
          gasEstimate,
          riskFlags,
          contractInfo,
          needsTokenApproval,
          needsPermit2Approval,
          permit2Address: KROKO.permit2,
          universalRouterAddress: KROKO.universalRouter,
          tokenInAddress: addressIn,
          isNativeIn,
          tx: {
            to: swapData.to,
            data: swapData.data,
            value: swapData.value,
          },
        };
      } catch (e) {
        return {
          error: `Failed to prepare KrokoSwap swap: ${e instanceof Error ? e.message : "No liquidity or invalid pair"}`,
        };
      }
    },
  }),
};
