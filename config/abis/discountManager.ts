import { parseAbi } from "viem";

export const discountManagerAbi = parseAbi([
  "function isDiscountEligible(address user) view returns (bool)",
  "function getDiscountEligibilitySource(address user) view returns (bool, string)",
  "function nftStakingContract() view returns (address)",
  "function membershipContract() view returns (address)",
]);
