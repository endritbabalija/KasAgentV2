import { parseAbi } from "viem";

/**
 * Combined V2 swap ABI for execution cards.
 * Includes both ZealousSwap (KAS-named) and standard V2 (ETH-named) function variants.
 * All variants share identical parameter signatures — only the function names differ.
 */
export const v2SwapAbi = parseAbi([
  // ZealousSwap naming (KAS)
  "function swapExactKASForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[])",
  "function swapExactTokensForKAS(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])",

  // Standard V2 naming (ETH) — used by KaspaCom
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[])",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])",

  // Shared — identical across all V2 forks
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])",
]);
