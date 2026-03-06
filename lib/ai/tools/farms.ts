import { formatUnits, parseUnits, formatEther } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { CONTRACTS } from "@/config/contracts";
import { KASPLEX_TOKENS } from "@/config/tokens";
import {
  masterchefAbi,
  pairAbi,
  erc20Abi,
} from "@/config/abis";
import type { RiskFlag, RiskLevel } from "../tool-types";
import { client } from "./helpers";

export const farmTools = {
  getActiveFarms: tool({
    description:
      "Get a list of all active farming pools on ZealousSwap MasterChef, including allocation points and total deposits.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const [activePools, rewardPerBlock, totalAllocPoint, rewardToken] =
          await Promise.all([
            client.readContract({
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "getActivePools",
            }),
            client.readContract({
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "rewardPerBlock",
            }),
            client.readContract({
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "totalAllocPoint",
            }),
            client.readContract({
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "rewardToken",
            }),
          ]);

        const poolIds = (activePools as bigint[]).map(Number);
        const poolInfos = await Promise.all(
          poolIds.map((pid) =>
            client.readContract({
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "getPoolInfo",
              args: [BigInt(pid)],
            })
          )
        );

        const rewardTokenSymbol =
          KASPLEX_TOKENS.find(
            (t) =>
              t.address?.toLowerCase() ===
              (rewardToken as string).toLowerCase()
          )?.symbol ?? (rewardToken as string);

        const farms = poolIds.map((pid, i) => {
          const info = poolInfos[i] as readonly [
            string,
            bigint,
            bigint,
            bigint,
            bigint,
            boolean,
            boolean,
            bigint,
          ];
          return {
            pid,
            lpToken: info[0],
            allocPoint: info[1].toString(),
            totalDeposited: formatUnits(info[4], 18),
            isActive: info[5],
            poolShareBps: info[7].toString(),
          };
        });

        return {
          rewardToken: rewardTokenSymbol,
          rewardPerBlock: formatUnits(rewardPerBlock as bigint, 18),
          totalAllocPoint: (totalAllocPoint as bigint).toString(),
          farms,
        };
      } catch (e) {
        return {
          error: `Failed to fetch farms: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),

  prepareFarmStake: tool({
    description:
      "Prepare a farm deposit (stake LP tokens) transaction for ZealousSwap MasterChef. Checks allowance, reads pending rewards and locking period.",
    inputSchema: z.object({
      pid: z.number().describe("Pool ID"),
      amount: z.string().describe("Amount of LP tokens to stake (human-readable)"),
      walletAddress: z.string().optional().describe("User wallet address"),
    }),
    execute: async ({ pid, amount, walletAddress }) => {
      try {
        const rawAmount = parseUnits(amount, 18);
        const bigPid = BigInt(pid);

        // Read pool info
        const poolInfo = (await client.readContract({
          address: CONTRACTS.MASTER_CHEF,
          abi: masterchefAbi,
          functionName: "getPoolInfo",
          args: [bigPid],
        })) as readonly [string, bigint, bigint, bigint, bigint, boolean, boolean, bigint];

        const lpToken = poolInfo[0] as `0x${string}`;
        const isActive = poolInfo[5];
        if (!isActive) {
          return { error: `Farm pool ${pid} is not active` };
        }

        // Get locking period, reward token
        const [lockingPeriod, rewardToken] = await Promise.all([
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "lockingPeriod" }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "rewardToken" }),
        ]);

        const rewardTokenSymbol = KASPLEX_TOKENS.find(
          t => t.address?.toLowerCase() === (rewardToken as string).toLowerCase()
        )?.symbol ?? "ZEAL";

        // Get pair symbols for LP token label
        let lpTokenSymbol = "LP";
        try {
          const [t0, t1] = await Promise.all([
            client.readContract({ address: lpToken, abi: pairAbi, functionName: "token0" }),
            client.readContract({ address: lpToken, abi: pairAbi, functionName: "token1" }),
          ]);
          const addrToSym = (addr: string) => KASPLEX_TOKENS.find(t => t.address?.toLowerCase() === addr.toLowerCase())?.symbol ?? "???";
          lpTokenSymbol = `${addrToSym(t0 as string)}/${addrToSym(t1 as string)} LP`;
        } catch { /* keep fallback */ }

        // User info + pending rewards
        let existingStake = "0";
        let pendingRewards = "0";
        if (walletAddress) {
          const [userInfo, pending] = await Promise.all([
            client.readContract({
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "userInfo",
              args: [bigPid, walletAddress as `0x${string}`],
            }),
            client.readContract({
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "pendingReward",
              args: [bigPid, walletAddress as `0x${string}`],
            }),
          ]);
          const userAmount = (userInfo as [bigint, bigint, bigint])[0];
          existingStake = formatUnits(userAmount, 18);
          pendingRewards = formatUnits(pending as bigint, 18);
        }

        // Check LP allowance to MasterChef
        let needsApproval = false;
        let currentAllowance = "0";
        if (walletAddress) {
          const allowance = (await client.readContract({
            address: lpToken,
            abi: erc20Abi,
            functionName: "allowance",
            args: [walletAddress as `0x${string}`, CONTRACTS.MASTER_CHEF],
          })) as bigint;
          currentAllowance = allowance.toString();
          needsApproval = allowance < rawAmount;
        }

        let gasEstimate = "0.02";
        try {
          const gasPrice = await client.getGasPrice();
          gasEstimate = formatEther(150000n * gasPrice);
        } catch { /* keep fallback */ }

        const lockingSeconds = Number(lockingPeriod as bigint);
        const lockingHours = (lockingSeconds / 3600).toFixed(1);

        const riskFlags: RiskFlag[] = [
          { type: "locking_period", label: `Locking period: ${lockingHours} hours`, severity: "medium" as RiskLevel },
        ];
        if (parseFloat(pendingRewards) > 0) {
          riskFlags.push({
            type: "pending_rewards_claim",
            label: `Depositing will auto-claim ${parseFloat(pendingRewards).toFixed(4)} ${rewardTokenSymbol} in pending rewards`,
            severity: "low" as RiskLevel,
          });
        }

        return {
          pid,
          lpTokenSymbol,
          amount,
          existingStake,
          pendingRewards,
          rewardToken: rewardTokenSymbol,
          lockingPeriod: `${lockingHours} hours`,
          needsApproval,
          currentAllowance,
          gasEstimate,
          riskFlags,
          contractInfo: {
            address: CONTRACTS.MASTER_CHEF,
            functionName: "deposit",
            description: `Stake ${lpTokenSymbol} in MasterChef farm pool ${pid}`,
          },
          tx: {
            masterChef: CONTRACTS.MASTER_CHEF,
            lpToken,
            pid: bigPid.toString(),
            rawAmount: rawAmount.toString(),
          },
        };
      } catch (e) {
        return { error: `Failed to prepare farm stake: ${e instanceof Error ? e.message : "Unknown error"}` };
      }
    },
  }),

  prepareFarmUnstake: tool({
    description:
      "Prepare a farm withdrawal (unstake LP tokens) from ZealousSwap MasterChef. Checks if withdrawal is allowed and shows pending rewards that will be auto-claimed.",
    inputSchema: z.object({
      pid: z.number().describe("Pool ID"),
      amount: z.string().optional().describe("Amount to unstake (human-readable). Defaults to full staked balance."),
      walletAddress: z.string().optional().describe("User wallet address"),
    }),
    execute: async ({ pid, amount, walletAddress }) => {
      if (!walletAddress) {
        return { error: "Wallet address is required for farm unstake" };
      }

      try {
        const bigPid = BigInt(pid);

        const [poolInfo, userInfo, pending, canWithdrawResult, rewardToken, lockingPeriod] = await Promise.all([
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "getPoolInfo", args: [bigPid] }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "userInfo", args: [bigPid, walletAddress as `0x${string}`] }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "pendingReward", args: [bigPid, walletAddress as `0x${string}`] }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "canWithdraw", args: [bigPid, walletAddress as `0x${string}`] }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "rewardToken" }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "lockingPeriod" }),
        ]);

        const info = poolInfo as readonly [string, bigint, bigint, bigint, bigint, boolean, boolean, bigint];
        const lpToken = info[0] as `0x${string}`;
        const userStaked = (userInfo as [bigint, bigint, bigint])[0];
        const pendingRewards = formatUnits(pending as bigint, 18);
        const canWithdraw = canWithdrawResult as boolean;

        if (userStaked === 0n) {
          return { error: `You have no staked LP tokens in farm pool ${pid}` };
        }

        const rewardTokenSymbol = KASPLEX_TOKENS.find(
          t => t.address?.toLowerCase() === (rewardToken as string).toLowerCase()
        )?.symbol ?? "ZEAL";

        // LP label
        let lpTokenSymbol = "LP";
        try {
          const [t0, t1] = await Promise.all([
            client.readContract({ address: lpToken, abi: pairAbi, functionName: "token0" }),
            client.readContract({ address: lpToken, abi: pairAbi, functionName: "token1" }),
          ]);
          const addrToSym = (addr: string) => KASPLEX_TOKENS.find(t => t.address?.toLowerCase() === addr.toLowerCase())?.symbol ?? "???";
          lpTokenSymbol = `${addrToSym(t0 as string)}/${addrToSym(t1 as string)} LP`;
        } catch { /* keep fallback */ }

        const rawAmount = amount ? parseUnits(amount, 18) : userStaked;
        if (rawAmount > userStaked) {
          return { error: `Requested ${amount} but only ${formatUnits(userStaked, 18)} staked` };
        }

        if (!canWithdraw) {
          const lockSec = Number(lockingPeriod as bigint);
          return { error: `Cannot withdraw yet — locking period (${(lockSec / 3600).toFixed(1)} hours) has not elapsed since last deposit` };
        }

        let gasEstimate = "0.015";
        try {
          const gasPrice = await client.getGasPrice();
          gasEstimate = formatEther(120000n * gasPrice);
        } catch { /* keep fallback */ }

        const riskFlags: RiskFlag[] = [];
        if (parseFloat(pendingRewards) > 0) {
          riskFlags.push({
            type: "rewards_claimed",
            label: `Will auto-claim ${parseFloat(pendingRewards).toFixed(4)} ${rewardTokenSymbol} in pending rewards`,
            severity: "low" as RiskLevel,
          });
        }

        return {
          pid,
          lpTokenSymbol,
          amount: formatUnits(rawAmount, 18),
          pendingRewards,
          rewardToken: rewardTokenSymbol,
          canWithdraw,
          gasEstimate,
          riskFlags,
          contractInfo: {
            address: CONTRACTS.MASTER_CHEF,
            functionName: "withdraw",
            description: `Unstake ${lpTokenSymbol} from MasterChef farm pool ${pid}`,
          },
          tx: {
            masterChef: CONTRACTS.MASTER_CHEF,
            pid: bigPid.toString(),
            rawAmount: rawAmount.toString(),
          },
        };
      } catch (e) {
        return { error: `Failed to prepare farm unstake: ${e instanceof Error ? e.message : "Unknown error"}` };
      }
    },
  }),
};
