import { parseAbi } from "viem";

export const infinityPoolZealAbi = parseAbi([
  // Write
  "function stake(uint256 amount)",
  "function unstake(uint256 xTokenAmount)",

  // Read — core
  "function getExchangeRate() view returns (uint256)",
  "function previewStake(uint256 amount) view returns (uint256)",
  "function previewUnstake(uint256 xAmount) view returns (uint256)",
  "function totalStaked() view returns (uint256)",
  "function zealToken() view returns (address)",
  "function xZealToken() view returns (address)",

  // Read — emissions
  "function zealPerBlock() view returns (uint256)",
  "function getPendingEmissions() view returns (uint256)",
  "function getProjectedExchangeRate() view returns (uint256)",
  "function emissionsPaused() view returns (bool)",
  "function lastRewardBlock() view returns (uint256)",
]);
