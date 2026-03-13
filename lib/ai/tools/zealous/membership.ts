import { z } from "zod";
import { tool } from "ai";
import { CONTRACTS } from "@/config/contracts";
import { membershipAbi, nftStakingAbi } from "@/config/abis";
import { checkDiscountEligibility } from "@/lib/discount";
import { client } from "../shared/helpers";
import { mcResult } from "@/lib/multicall";

export const zealousMembershipTools = {
  zealous_getMembershipStatus: tool({
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
        // Multicall all membership + NFT staking reads + discount check in parallel
        const [mc, discount] = await Promise.all([
          client.multicall({
            contracts: [
              { address: CONTRACTS.MEMBERSHIP, abi: membershipAbi, functionName: "getUserMembership" as const, args: [addr] as const },
              { address: CONTRACTS.NFT_STAKING, abi: nftStakingAbi, functionName: "getUserTotalPower" as const, args: [addr] as const },
              { address: CONTRACTS.NFT_STAKING, abi: nftStakingAbi, functionName: "hasStakedForRequiredDays" as const, args: [addr] as const },
              { address: CONTRACTS.NFT_STAKING, abi: nftStakingAbi, functionName: "userStakedNFTCount" as const, args: [addr] as const },
              { address: CONTRACTS.NFT_STAKING, abi: nftStakingAbi, functionName: "totalStakers" as const },
              { address: CONTRACTS.NFT_STAKING, abi: nftStakingAbi, functionName: "requiredStakingDays" as const },
              { address: CONTRACTS.NFT_STAKING, abi: nftStakingAbi, functionName: "minRequiredPower" as const },
              { address: CONTRACTS.NFT_STAKING, abi: nftStakingAbi, functionName: "totalNFTsStaked" as const },
              { address: CONTRACTS.NFT_STAKING, abi: nftStakingAbi, functionName: "totalPowerStaked" as const },
            ],
            allowFailure: true,
          }),
          checkDiscountEligibility(walletAddress),
        ]);

        // Membership
        const [expiresAt, isLifetime, isActive] = mcResult<[bigint, boolean, boolean]>(mc[0], [0n, false, false]);
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
        const userPowerNum = mcResult<bigint>(mc[1], 0n);
        const hasStakedDays = mcResult<boolean>(mc[2], false);
        const nftCount = mcResult<bigint>(mc[3], 0n);
        const totalStakers = mcResult<bigint>(mc[4], 0n);
        const requiredDays = mcResult<bigint>(mc[5], 0n);
        const minPowerNum = mcResult<bigint>(mc[6], 0n);
        const totalNFTs = mcResult<bigint>(mc[7], 0n);
        const totalPower = mcResult<bigint>(mc[8], 0n);
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
            stakedNFTCount: Number(nftCount),
            totalPower: Number(userPowerNum).toLocaleString("en-US"),
            minRequiredPower: Number(minPowerNum).toLocaleString("en-US"),
            meetsMinPower,
            hasStakedRequiredDays: hasStakedDays,
            isQualified: meetsMinPower && hasStakedDays,
            requiredStakingDays: Number(requiredDays),
          },
          nftStakingGlobals: {
            totalStakers: Number(totalStakers).toLocaleString("en-US"),
            totalNFTsStaked: Number(totalNFTs).toLocaleString("en-US"),
            totalPowerStaked: Number(totalPower).toLocaleString("en-US"),
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
