import { client } from "@/lib/viem-client";
import { CONTRACTS } from "@/config/contracts";
import { discountManagerAbi } from "@/config/abis";

export type DiscountStatus = {
  isEligible: boolean;
  source: string;
};

export async function checkDiscountEligibility(
  userAddress: string
): Promise<DiscountStatus> {
  try {
    const [isEligible, source] = (await client.readContract({
      address: CONTRACTS.DISCOUNT_MANAGER,
      abi: discountManagerAbi,
      functionName: "getDiscountEligibilitySource",
      args: [userAddress as `0x${string}`],
    })) as [boolean, string];

    return { isEligible, source };
  } catch (err) {
    console.error("[checkDiscountEligibility] Failed:", err);
    return { isEligible: false, source: "None" };
  }
}
