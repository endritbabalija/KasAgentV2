import { parseAbi } from "viem";

export const infinityPoolNachoAbi = parseAbi([
  "function stake(uint256 amount)",
  "function unstake(uint256 xTokenAmount)",
  "function getExchangeRate() view returns (uint256)",
  "function previewStake(uint256 amount) view returns (uint256)",
  "function previewUnstake(uint256 xAmount) view returns (uint256)",
  "function totalStaked() view returns (uint256)",
  "function nachoToken() view returns (address)",
  "function xNachoToken() view returns (address)",
]);

export const infinityPoolKasperAbi = parseAbi([
  "function stake(uint256 amount)",
  "function unstake(uint256 xTokenAmount)",
  "function getExchangeRate() view returns (uint256)",
  "function previewStake(uint256 amount) view returns (uint256)",
  "function previewUnstake(uint256 xAmount) view returns (uint256)",
  "function totalStaked() view returns (uint256)",
  "function kasperToken() view returns (address)",
  "function xKasperToken() view returns (address)",
]);
