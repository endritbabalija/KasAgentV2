import { parseAbi } from "viem";

export const membershipAbi = parseAbi([
  "function getUserMembership(address user) view returns (uint256 expiresAt, bool isLifetime, bool isActive)",
]);
