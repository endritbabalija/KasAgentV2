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
import type { RiskFlag, RiskLevel } from "../../tool-types";
import { client, resolveTokenAddress, getTokenDecimals, estimateGasCost } from "../shared/helpers";
import { mcResult } from "@/lib/multicall";

export const zealousStakingTools = {
  zealous_getInfinityPoolRates: tool({
    description:
      "Get the current exchange rates, total staked amounts, and emission info for all InfinityPool staking pools (ZEAL, NACHO, KASPER).",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const mc = await client.multicall({
          contracts: [
            { address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi, functionName: "getExchangeRate" as const },
            { address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi, functionName: "totalStaked" as const },
            { address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi, functionName: "zealPerBlock" as const },
            { address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi, functionName: "emissionsPaused" as const },
            { address: CONTRACTS.INFINITY_POOL_NACHO, abi: infinityPoolNachoAbi, functionName: "getExchangeRate" as const },
            { address: CONTRACTS.INFINITY_POOL_NACHO, abi: infinityPoolNachoAbi, functionName: "totalStaked" as const },
            { address: CONTRACTS.INFINITY_POOL_KASPER, abi: infinityPoolKasperAbi, functionName: "getExchangeRate" as const },
            { address: CONTRACTS.INFINITY_POOL_KASPER, abi: infinityPoolKasperAbi, functionName: "totalStaked" as const },
          ],
          allowFailure: true,
        });

        return {
          pools: [
            {
              name: "ZEAL",
              exchangeRate: formatUnits(mcResult<bigint>(mc[0], 0n), 18),
              totalStaked: formatUnits(mcResult<bigint>(mc[1], 0n), 18),
              zealPerBlock: formatUnits(mcResult<bigint>(mc[2], 0n), 18),
              emissionsPaused: mcResult<boolean>(mc[3], false),
            },
            {
              name: "NACHO",
              exchangeRate: formatUnits(mcResult<bigint>(mc[4], 0n), 18),
              totalStaked: formatUnits(mcResult<bigint>(mc[5], 0n), 18),
            },
            {
              name: "KASPER",
              exchangeRate: formatUnits(mcResult<bigint>(mc[6], 0n), 18),
              totalStaked: formatUnits(mcResult<bigint>(mc[7], 0n), 18),
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

  zealous_prepareInfinityStake: tool({
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

      const tokenAddress = await resolveTokenAddress(sym);
      if (!tokenAddress) {
        return { error: `Unknown token: ${token}` };
      }

      const decimals = await getTokenDecimals(sym);
      const rawAmount = parseUnits(amount, decimals);

      try {
        // Multicall: pool reads + optional ZEAL emissionsPaused + optional allowance
        const stakeMcContracts = [
          { address: pool.address, abi: pool.abi, functionName: "previewStake" as const, args: [rawAmount] as const },
          { address: pool.address, abi: pool.abi, functionName: "getExchangeRate" as const },
          { address: pool.address, abi: pool.abi, functionName: "totalStaked" as const },
          ...(sym === "ZEAL" ? [{ address: pool.address, abi: infinityPoolZealAbi, functionName: "emissionsPaused" as const }] : []),
          ...(walletAddress ? [{ address: tokenAddress, abi: erc20Abi, functionName: "allowance" as const, args: [walletAddress as `0x${string}`, pool.address] as const }] : []),
        ];

        const stakeMc = await client.multicall({ contracts: stakeMcContracts, allowFailure: true });

        const xTokensReceived = formatUnits(mcResult<bigint>(stakeMc[0], 0n), decimals);
        const rate = formatUnits(mcResult<bigint>(stakeMc[1], 0n), 18);
        const staked = formatUnits(mcResult<bigint>(stakeMc[2], 0n), decimals);

        let mcOffset = 3;

        const riskFlags: RiskFlag[] = [];
        if (sym === "ZEAL") {
          const paused = mcResult<boolean>(stakeMc[mcOffset], false);
          if (paused) {
            riskFlags.push({ type: "emissions_paused", label: "ZEAL emissions are currently paused", severity: "high" as RiskLevel });
          }
          mcOffset++;
        }

        let needsApproval = false;
        let currentAllowance = "0";
        if (walletAddress) {
          const allowance = mcResult<bigint>(stakeMc[mcOffset], 0n);
          needsApproval = allowance < rawAmount;
          currentAllowance = allowance.toString();
        }

        const gasEstimate = await estimateGasCost(120000n, "0.015");

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

  zealous_prepareInfinityUnstake: tool({
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

      const decimals = await getTokenDecimals(sym);
      const rawXAmount = parseUnits(amount, decimals);

      try {
        // Get xToken address (needed for balance/allowance checks)
        const xTokenAddress = (await client.readContract({
          address: pool.address,
          abi: pool.abi,
          functionName: pool.xTokenFn as "xZealToken",
        })) as `0x${string}`;

        // Multicall: pool reads + optional balance + optional allowance
        const unstakeMcContracts = [
          { address: pool.address, abi: pool.abi, functionName: "previewUnstake" as const, args: [rawXAmount] as const },
          { address: pool.address, abi: pool.abi, functionName: "getExchangeRate" as const },
          { address: pool.address, abi: pool.abi, functionName: "totalStaked" as const },
          ...(walletAddress ? [
            { address: xTokenAddress, abi: erc20Abi, functionName: "balanceOf" as const, args: [walletAddress as `0x${string}`] as const },
            { address: xTokenAddress, abi: erc20Abi, functionName: "allowance" as const, args: [walletAddress as `0x${string}`, pool.address] as const },
          ] : []),
        ];

        const unstakeMc = await client.multicall({ contracts: unstakeMcContracts, allowFailure: true });

        const tokensReceived = formatUnits(mcResult<bigint>(unstakeMc[0], 0n), decimals);
        const rate = formatUnits(mcResult<bigint>(unstakeMc[1], 0n), 18);
        const staked = formatUnits(mcResult<bigint>(unstakeMc[2], 0n), decimals);

        // Check xToken balance
        if (walletAddress) {
          const xBalance = mcResult<bigint>(unstakeMc[3], 0n);
          if (xBalance < rawXAmount) {
            return { error: `Insufficient x${sym} balance. You have ${formatUnits(xBalance, decimals)} but requested ${amount}` };
          }
        }

        // Check xToken allowance to pool
        let needsApproval = false;
        let currentAllowance = "0";
        if (walletAddress) {
          const allowance = mcResult<bigint>(unstakeMc[4], 0n);
          needsApproval = allowance < rawXAmount;
          currentAllowance = allowance.toString();
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
