import { formatUnits, parseUnits } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { CONTRACTS } from "@/config/contracts";
import {
  infinityPoolZealAbi,
  infinityPoolNachoAbi,
  infinityPoolKasperAbi,
  erc20Abi,
} from "@/config/abis";
import type { RiskFlag, RiskLevel } from "../tool-types";
import { client, resolveTokenAddress, getTokenDecimals, estimateGasCost, checkAllowance } from "./helpers";

export const stakingTools = {
  getInfinityPoolRates: tool({
    description:
      "Get the current exchange rates, total staked amounts, and emission info for all InfinityPool staking pools (ZEAL, NACHO, KASPER).",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const [
          zealRate,
          zealStaked,
          zealPerBlock,
          zealPaused,
          nachoRate,
          nachoStaked,
          kasperRate,
          kasperStaked,
        ] = await Promise.all([
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_ZEAL,
            abi: infinityPoolZealAbi,
            functionName: "getExchangeRate",
          }),
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_ZEAL,
            abi: infinityPoolZealAbi,
            functionName: "totalStaked",
          }),
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_ZEAL,
            abi: infinityPoolZealAbi,
            functionName: "zealPerBlock",
          }),
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_ZEAL,
            abi: infinityPoolZealAbi,
            functionName: "emissionsPaused",
          }),
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_NACHO,
            abi: infinityPoolNachoAbi,
            functionName: "getExchangeRate",
          }),
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_NACHO,
            abi: infinityPoolNachoAbi,
            functionName: "totalStaked",
          }),
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_KASPER,
            abi: infinityPoolKasperAbi,
            functionName: "getExchangeRate",
          }),
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_KASPER,
            abi: infinityPoolKasperAbi,
            functionName: "totalStaked",
          }),
        ]);

        return {
          pools: [
            {
              name: "ZEAL",
              exchangeRate: formatUnits(zealRate as bigint, 18),
              totalStaked: formatUnits(zealStaked as bigint, 18),
              zealPerBlock: formatUnits(zealPerBlock as bigint, 18),
              emissionsPaused: zealPaused as boolean,
            },
            {
              name: "NACHO",
              exchangeRate: formatUnits(nachoRate as bigint, 18),
              totalStaked: formatUnits(nachoStaked as bigint, 18),
            },
            {
              name: "KASPER",
              exchangeRate: formatUnits(kasperRate as bigint, 18),
              totalStaked: formatUnits(kasperStaked as bigint, 18),
            },
          ],
        };
      } catch (e) {
        return {
          error: `Failed to fetch InfinityPool rates: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),

  prepareInfinityStake: tool({
    description:
      "Prepare a single-sided staking transaction for a ZealousSwap InfinityPool. Supports ZEAL, NACHO, and KASPER pools.",
    inputSchema: z.object({
      token: z.string().describe("Token to stake: ZEAL, NACHO, or KASPER"),
      amount: z.string().describe("Amount to stake (human-readable)"),
      walletAddress: z.string().optional().describe("User wallet address"),
    }),
    execute: async ({ token, amount, walletAddress }) => {
      const sym = token.toUpperCase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const poolMap: Record<string, { address: `0x${string}`; abi: any }> = {
        ZEAL: { address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi },
        NACHO: { address: CONTRACTS.INFINITY_POOL_NACHO, abi: infinityPoolNachoAbi },
        KASPER: { address: CONTRACTS.INFINITY_POOL_KASPER, abi: infinityPoolKasperAbi },
      };

      const pool = poolMap[sym];
      if (!pool) {
        return { error: `Unsupported InfinityPool token: ${token}. Supported: ZEAL, NACHO, KASPER` };
      }

      const tokenAddress = resolveTokenAddress(sym);
      if (!tokenAddress) {
        return { error: `Unknown token: ${token}` };
      }

      const decimals = getTokenDecimals(sym);
      const rawAmount = parseUnits(amount, decimals);

      try {
        const [previewResult, exchangeRate, totalStaked] = await Promise.all([
          client.readContract({ address: pool.address, abi: pool.abi, functionName: "previewStake", args: [rawAmount] }),
          client.readContract({ address: pool.address, abi: pool.abi, functionName: "getExchangeRate" }),
          client.readContract({ address: pool.address, abi: pool.abi, functionName: "totalStaked" }),
        ]);

        const xTokensReceived = formatUnits(previewResult as bigint, decimals);
        const rate = formatUnits(exchangeRate as bigint, 18);
        const staked = formatUnits(totalStaked as bigint, decimals);

        // Check allowance
        let needsApproval = false;
        let currentAllowance = "0";
        if (walletAddress) {
          ({ needsApproval, currentAllowance } = await checkAllowance(
            tokenAddress,
            walletAddress as `0x${string}`,
            pool.address,
            rawAmount
          ));
        }

        const gasEstimate = await estimateGasCost(120000n, "0.015");

        const riskFlags: RiskFlag[] = [];
        if (sym === "ZEAL") {
          try {
            const paused = (await client.readContract({
              address: pool.address,
              abi: infinityPoolZealAbi,
              functionName: "emissionsPaused",
            })) as boolean;
            if (paused) {
              riskFlags.push({ type: "emissions_paused", label: "ZEAL emissions are currently paused", severity: "high" as RiskLevel });
            }
          } catch { /* skip */ }
        }

        return {
          token: sym,
          amount,
          xTokensReceived,
          exchangeRate: rate,
          totalStaked: staked,
          needsApproval,
          currentAllowance,
          gasEstimate,
          riskFlags,
          contractInfo: {
            address: pool.address,
            functionName: "stake",
            description: `Stake ${sym} in InfinityPool to receive x${sym} tokens`,
          },
          tx: {
            pool: pool.address,
            tokenAddress,
            rawAmount: rawAmount.toString(),
          },
        };
      } catch (e) {
        return { error: `Failed to prepare InfinityPool stake: ${e instanceof Error ? e.message : "Unknown error"}` };
      }
    },
  }),

  prepareInfinityUnstake: tool({
    description:
      "Prepare an unstake transaction from a ZealousSwap InfinityPool. Burns xTokens to receive underlying tokens. Supports ZEAL, NACHO, and KASPER pools.",
    inputSchema: z.object({
      token: z.string().describe("Pool token: ZEAL, NACHO, or KASPER"),
      amount: z.string().describe("Amount of xTokens to unstake (human-readable)"),
      walletAddress: z.string().optional().describe("User wallet address"),
    }),
    execute: async ({ token, amount, walletAddress }) => {
      const sym = token.toUpperCase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const poolMap: Record<string, { address: `0x${string}`; abi: any; xTokenFn: string }> = {
        ZEAL: { address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi, xTokenFn: "xZealToken" },
        NACHO: { address: CONTRACTS.INFINITY_POOL_NACHO, abi: infinityPoolNachoAbi, xTokenFn: "xNachoToken" },
        KASPER: { address: CONTRACTS.INFINITY_POOL_KASPER, abi: infinityPoolKasperAbi, xTokenFn: "xKasperToken" },
      };

      const pool = poolMap[sym];
      if (!pool) {
        return { error: `Unsupported InfinityPool token: ${token}. Supported: ZEAL, NACHO, KASPER` };
      }

      const decimals = getTokenDecimals(sym);
      const rawXAmount = parseUnits(amount, decimals);

      try {
        // Get xToken address
        const xTokenAddress = (await client.readContract({
          address: pool.address,
          abi: pool.abi,
          functionName: pool.xTokenFn as "xZealToken",
        })) as `0x${string}`;

        const [previewResult, exchangeRate, totalStaked] = await Promise.all([
          client.readContract({ address: pool.address, abi: pool.abi, functionName: "previewUnstake", args: [rawXAmount] }),
          client.readContract({ address: pool.address, abi: pool.abi, functionName: "getExchangeRate" }),
          client.readContract({ address: pool.address, abi: pool.abi, functionName: "totalStaked" }),
        ]);

        const tokensReceived = formatUnits(previewResult as bigint, decimals);
        const rate = formatUnits(exchangeRate as bigint, 18);
        const staked = formatUnits(totalStaked as bigint, decimals);

        // Check xToken balance
        if (walletAddress) {
          const xBalance = (await client.readContract({
            address: xTokenAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
          })) as bigint;
          if (xBalance < rawXAmount) {
            return { error: `Insufficient x${sym} balance. You have ${formatUnits(xBalance, decimals)} but requested ${amount}` };
          }
        }

        // Check xToken allowance to pool
        let needsApproval = false;
        let currentAllowance = "0";
        if (walletAddress) {
          ({ needsApproval, currentAllowance } = await checkAllowance(
            xTokenAddress,
            walletAddress as `0x${string}`,
            pool.address,
            rawXAmount
          ));
        }

        const gasEstimate = await estimateGasCost(120000n, "0.015");

        const riskFlags: RiskFlag[] = [];

        return {
          token: sym,
          xAmount: amount,
          tokensReceived,
          exchangeRate: rate,
          totalStaked: staked,
          needsApproval,
          currentAllowance,
          gasEstimate,
          riskFlags,
          contractInfo: {
            address: pool.address,
            functionName: "unstake",
            description: `Unstake x${sym} from InfinityPool to receive ${sym} tokens`,
          },
          tx: {
            pool: pool.address,
            xTokenAddress,
            rawXAmount: rawXAmount.toString(),
          },
        };
      } catch (e) {
        return { error: `Failed to prepare InfinityPool unstake: ${e instanceof Error ? e.message : "Unknown error"}` };
      }
    },
  }),
};
