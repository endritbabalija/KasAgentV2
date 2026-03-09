import { parseAbi } from "viem";

export const nftStakingAbi = parseAbi([
  "function hasStakedForRequiredDays(address user) view returns (bool)",
  "function getUserTotalPower(address user) view returns (uint256)",
  "function userStakedNFTCount(address user) view returns (uint256)",
  "function totalStakers() view returns (uint256)",
  "function requiredStakingDays() view returns (uint256)",
  "function minRequiredPower() view returns (uint256)",
  "function totalNFTsStaked() view returns (uint256)",
  "function totalPowerStaked() view returns (uint256)",
]);
