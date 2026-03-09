import { z } from "zod";
import { tool } from "ai";
import { CONTRACTS } from "@/config/contracts";
import { membershipAbi, nftStakingAbi } from "@/config/abis";
import { checkDiscountEligibility } from "@/lib/discount";
import { client } from "./helpers";

async function safeRead<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const membershipTools = {
  getMembershipStatus: tool({
    description:
      "Get the user's full ZealousSwap discount eligibility status including membership details, NFT staking power, and overall discount qualification.",
    inputSchema: z.object({
      walletAddress: z
        .string()
        .describe("The wallet address to check membership and discount status for"),
    }),
    execute: async ({ walletAddress }) => {
      const addr = walletAddress as `0x${string}`;

      try {
        const [
          discount,
          membershipResult,
          userPower,
          hasStakedDays,
          nftCount,
          totalStakers,
          requiredDays,
          minPower,
          totalNFTs,
          totalPower,
        ] = await Promise.all([
          checkDiscountEligibility(walletAddress),
          safeRead(
            () =>
              client.readContract({
                address: CONTRACTS.MEMBERSHIP,
                abi: membershipAbi,
                functionName: "getUserMembership",
                args: [addr],
              }),
            [0n, false, false] as [bigint, boolean, boolean]
          ),
          safeRead(
            () =>
              client.readContract({
                address: CONTRACTS.NFT_STAKING,
                abi: nftStakingAbi,
                functionName: "getUserTotalPower",
                args: [addr],
              }),
            0n
          ),
          safeRead(
            () =>
              client.readContract({
                address: CONTRACTS.NFT_STAKING,
                abi: nftStakingAbi,
                functionName: "hasStakedForRequiredDays",
                args: [addr],
              }),
            false
          ),
          safeRead(
            () =>
              client.readContract({
                address: CONTRACTS.NFT_STAKING,
                abi: nftStakingAbi,
                functionName: "userStakedNFTCount",
                args: [addr],
              }),
            0n
          ),
          safeRead(
            () =>
              client.readContract({
                address: CONTRACTS.NFT_STAKING,
                abi: nftStakingAbi,
                functionName: "totalStakers",
              }),
            0n
          ),
          safeRead(
            () =>
              client.readContract({
                address: CONTRACTS.NFT_STAKING,
                abi: nftStakingAbi,
                functionName: "requiredStakingDays",
              }),
            0n
          ),
          safeRead(
            () =>
              client.readContract({
                address: CONTRACTS.NFT_STAKING,
                abi: nftStakingAbi,
                functionName: "minRequiredPower",
              }),
            0n
          ),
          safeRead(
            () =>
              client.readContract({
                address: CONTRACTS.NFT_STAKING,
                abi: nftStakingAbi,
                functionName: "totalNFTsStaked",
              }),
            0n
          ),
          safeRead(
            () =>
              client.readContract({
                address: CONTRACTS.NFT_STAKING,
                abi: nftStakingAbi,
                functionName: "totalPowerStaked",
              }),
            0n
          ),
        ]);

        // Membership
        const [expiresAt, isLifetime, isActive] = membershipResult as [bigint, boolean, boolean];
        const expiresAtNum = Number(expiresAt);
        const expiresAtStr =
          isActive && !isLifetime && expiresAtNum > 0
            ? new Date(expiresAtNum * 1000).toISOString()
            : "N/A";
        const daysRemaining =
          isActive && !isLifetime && expiresAtNum > 0
            ? Math.max(0, Math.ceil((expiresAtNum * 1000 - Date.now()) / 86_400_000))
            : null;

        // NFT Staking
        const userPowerNum = userPower as bigint;
        const minPowerNum = minPower as bigint;
        const meetsMinPower = userPowerNum >= minPowerNum;

        return {
          walletAddress,
          discountEligible: discount.isEligible,
          discountSource: discount.source,
          membership: {
            isActive,
            isLifetime,
            expiresAt: expiresAtStr,
            daysRemaining,
          },
          nftStaking: {
            stakedNFTCount: Number(nftCount as bigint),
            totalPower: Number(userPowerNum).toLocaleString("en-US"),
            minRequiredPower: Number(minPowerNum).toLocaleString("en-US"),
            meetsMinPower,
            hasStakedRequiredDays: hasStakedDays as boolean,
            isQualified: meetsMinPower && (hasStakedDays as boolean),
            requiredStakingDays: Number(requiredDays as bigint),
          },
          nftStakingGlobals: {
            totalStakers: Number(totalStakers as bigint).toLocaleString("en-US"),
            totalNFTsStaked: Number(totalNFTs as bigint).toLocaleString("en-US"),
            totalPowerStaked: Number(totalPower as bigint).toLocaleString("en-US"),
          },
        };
      } catch (e) {
        return {
          error: `Failed to fetch membership status: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),
};
