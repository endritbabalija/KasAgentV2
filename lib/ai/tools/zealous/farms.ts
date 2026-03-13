import { formatUnits, parseUnits } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { CONTRACTS } from "@/config/contracts";
import {
  masterchefAbi,
  pairAbi,
  erc20Abi,
} from "@/config/abis";
import type { RiskFlag, RiskLevel } from "../../tool-types";
import { client, estimateGasCost, addressToSymbol } from "../shared/helpers";
import { mcResult } from "@/lib/multicall";

export const zealousFarmTools = {
  zealous_getActiveFarms: tool({
    description:
      "Get a list of all active farming pools on ZealousSwap MasterChef, including allocation points and total deposits.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        // Multicall 1: all MasterChef globals
        const mc1 = await client.multicall({
          contracts: [
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "getActivePools" as const },
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "rewardPerBlock" as const },
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "totalAllocPoint" as const },
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "rewardToken" as const },
          ],
          allowFailure: true,
        });

        const activePools = mcResult<bigint[]>(mc1[0], []);
        const rewardPerBlock = mcResult<bigint>(mc1[1], 0n);
        const totalAllocPoint = mcResult<bigint>(mc1[2], 0n);
        const rewardToken = mcResult<string>(mc1[3], "");

        const poolIds = activePools.map(Number);

        // Multicall 2: getPoolInfo per pool
        const mc2 = poolIds.length > 0
          ? await client.multicall({
              contracts: poolIds.map((pid) => ({
                address: CONTRACTS.MASTER_CHEF,
                abi: masterchefAbi,
                functionName: "getPoolInfo" as const,
                args: [BigInt(pid)] as const,
              })),
              allowFailure: true,
            })
          : [];

        const poolInfos = mc2.map((r) =>
          mcResult<readonly [string, bigint, bigint, bigint, bigint, boolean, boolean, bigint]>(
            r,
            ["0x0000000000000000000000000000000000000000", 0n, 0n, 0n, 0n, false, false, 0n]
          )
        );

        const rewardTokenSymbol = await addressToSymbol(rewardToken);

        const farms = poolIds.map((pid, i) => {
          const info = poolInfos[i];
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
          rewardPerBlock: formatUnits(rewardPerBlock, 18),
          totalAllocPoint: totalAllocPoint.toString(),
          farms,
        };
      } catch (e) {
        return {
          error: `Failed to fetch farms: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),

  zealous_prepareFarmStake: tool({
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

        // Multicall 1: pool info + masterchef globals
        const stakeMc1 = await client.multicall({
          contracts: [
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "getPoolInfo" as const, args: [bigPid] as const },
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "lockingPeriod" as const },
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "rewardToken" as const },
          ],
          allowFailure: true,
        });

        const poolInfo = mcResult<readonly [string, bigint, bigint, bigint, bigint, boolean, boolean, bigint]>(
          stakeMc1[0],
          ["0x0000000000000000000000000000000000000000", 0n, 0n, 0n, 0n, false, false, 0n]
        );
        const lockingPeriod = mcResult<bigint>(stakeMc1[1], 0n);
        const rewardToken = mcResult<string>(stakeMc1[2], "");

        const lpToken = poolInfo[0] as `0x${string}`;
        const isActive = poolInfo[5];
        if (!isActive) {
          return { error: `Farm pool ${pid} is not active` };
        }

        const rewardTokenSymbol = await addressToSymbol(rewardToken);

        // Multicall 2: LP pair symbols + user info + allowance (all in one batch)
        const stakeMc2Contracts = [
          { address: lpToken, abi: pairAbi, functionName: "token0" as const },
          { address: lpToken, abi: pairAbi, functionName: "token1" as const },
          ...(walletAddress ? [
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "userInfo" as const, args: [bigPid, walletAddress as `0x${string}`] as const },
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "pendingReward" as const, args: [bigPid, walletAddress as `0x${string}`] as const },
            { address: lpToken, abi: erc20Abi, functionName: "allowance" as const, args: [walletAddress as `0x${string}`, CONTRACTS.MASTER_CHEF] as const },
          ] : []),
        ];

        const stakeMc2 = await client.multicall({
          contracts: stakeMc2Contracts,
          allowFailure: true,
        });

        let lpTokenSymbol = "LP";
        try {
          const t0 = mcResult<string>(stakeMc2[0], "");
          const t1 = mcResult<string>(stakeMc2[1], "");
          if (t0 && t1) {
            const [s0, s1] = await Promise.all([addressToSymbol(t0), addressToSymbol(t1)]);
            lpTokenSymbol = `${s0}/${s1} LP`;
          }
        } catch { /* keep fallback */ }

        let existingStake = "0";
        let pendingRewards = "0";
        let needsApproval = false;
        let currentAllowance = "0";
        if (walletAddress) {
          const userInfo = mcResult<[bigint, bigint, bigint]>(stakeMc2[2], [0n, 0n, 0n]);
          existingStake = formatUnits(userInfo[0], 18);
          pendingRewards = formatUnits(mcResult<bigint>(stakeMc2[3], 0n), 18);
          const allowance = mcResult<bigint>(stakeMc2[4], 0n);
          needsApproval = allowance < rawAmount;
          currentAllowance = allowance.toString();
        }

        const gasEstimate = await estimateGasCost(150000n, "0.02");

        const lockingSeconds = Number(lockingPeriod);
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

  zealous_prepareFarmUnstake: tool({
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

        // Multicall: all farm unstake reads in one batch
        const unstakeMc = await client.multicall({
          contracts: [
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "getPoolInfo" as const, args: [bigPid] as const },
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "userInfo" as const, args: [bigPid, walletAddress as `0x${string}`] as const },
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "pendingReward" as const, args: [bigPid, walletAddress as `0x${string}`] as const },
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "canWithdraw" as const, args: [bigPid, walletAddress as `0x${string}`] as const },
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "rewardToken" as const },
            { address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "lockingPeriod" as const },
          ],
          allowFailure: true,
        });

        const info = mcResult<readonly [string, bigint, bigint, bigint, bigint, boolean, boolean, bigint]>(
          unstakeMc[0],
          ["0x0000000000000000000000000000000000000000", 0n, 0n, 0n, 0n, false, false, 0n]
        );
        const lpToken = info[0] as `0x${string}`;
        const userStaked = mcResult<[bigint, bigint, bigint]>(unstakeMc[1], [0n, 0n, 0n])[0];
        const pendingRewards = formatUnits(mcResult<bigint>(unstakeMc[2], 0n), 18);
        const canWithdraw = mcResult<boolean>(unstakeMc[3], false);

        if (userStaked === 0n) {
          return { error: `You have no staked LP tokens in farm pool ${pid}` };
        }

        const rewardToken = mcResult<string>(unstakeMc[4], "");
        const lockingPeriod = mcResult<bigint>(unstakeMc[5], 0n);
        const rewardTokenSymbol = await addressToSymbol(rewardToken);

        // LP label — multicall token0 + token1
        let lpTokenSymbol = "LP";
        try {
          const lpMc = await client.multicall({
            contracts: [
              { address: lpToken, abi: pairAbi, functionName: "token0" as const },
              { address: lpToken, abi: pairAbi, functionName: "token1" as const },
            ],
            allowFailure: true,
          });
          const t0 = mcResult<string>(lpMc[0], "");
          const t1 = mcResult<string>(lpMc[1], "");
          if (t0 && t1) {
            const [s0, s1] = await Promise.all([addressToSymbol(t0), addressToSymbol(t1)]);
            lpTokenSymbol = `${s0}/${s1} LP`;
          }
        } catch { /* keep fallback */ }

        const rawAmount = amount ? parseUnits(amount, 18) : userStaked;
        if (rawAmount > userStaked) {
          return { error: `Requested ${amount} but only ${formatUnits(userStaked, 18)} staked` };
        }

        if (!canWithdraw) {
          const lockSec = Number(lockingPeriod);
          return { error: `Cannot withdraw yet — locking period (${(lockSec / 3600).toFixed(1)} hours) has not elapsed since last deposit` };
        }

        const gasEstimate = await estimateGasCost(120000n, "0.015");

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
