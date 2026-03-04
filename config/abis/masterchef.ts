import { parseAbi } from "viem";

export const masterchefAbi = parseAbi([
  // Write
  "function deposit(uint256 pid, uint256 amount)",
  "function withdraw(uint256 pid, uint256 amount)",
  "function claim(uint256 pid)",
  "function emergencyWithdraw(uint256 pid)",

  // Read — per-user / per-pool
  "function userInfo(uint256 pid, address user) view returns (uint256 amount, uint256 rewardDebt, uint256 lastInteraction)",
  "function poolInfo(uint256 pid) view returns (address lpToken, uint256 allocPoint, uint256 lastRewardBlock, uint256 accRewardPerShare, uint256 totalDeposited, bool isActive, bool isRemoved)",
  "function getPoolInfo(uint256 pid) view returns (address lpToken, uint256 allocPoint, uint256 lastRewardBlock, uint256 accRewardPerShare, uint256 totalDeposited, bool isActive, bool isRemoved, uint256 poolShare)",
  "function pendingReward(uint256 pid, address user) view returns (uint256)",
  "function canWithdraw(uint256 pid, address user) view returns (bool)",

  // Read — global
  "function getActivePools() view returns (uint256[])",
  "function findPoolIdByLpToken(address lpToken) view returns (uint256)",
  "function getLpTokenStatus(address lpToken) view returns (bool exists, uint256 pid, bool isRemoved)",
  "function rewardPerBlock() view returns (uint256)",
  "function totalAllocPoint() view returns (uint256)",
  "function rewardToken() view returns (address)",
  "function lockingPeriod() view returns (uint256)",
  "function poolLength() view returns (uint256)",
  "function activePoolLength() view returns (uint256)",
]);
