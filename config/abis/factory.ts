import { parseAbi } from "viem";

export const factoryAbi = parseAbi([
  "function getPair(address tokenA, address tokenB) view returns (address)",
  "function allPairs(uint256 index) view returns (address)",
  "function allPairsLength() view returns (uint256)",
  "function feeTo() view returns (address)",
]);
