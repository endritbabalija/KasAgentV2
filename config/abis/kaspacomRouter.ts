import { parseAbi } from "viem";

export const kaspacomRouterAbi = parseAbi([
  // Swap — exact input (standard V2: ETH not KAS)
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])",
  "function swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[])",
  "function swapExactTokensForETH(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])",

  // Swap — exact output
  "function swapTokensForExactETH(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline) returns (uint256[])",
  "function swapETHForExactTokens(uint256 amountOut, address[] path, address to, uint256 deadline) payable returns (uint256[])",
  "function swapTokensForExactTokens(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline) returns (uint256[])",

  // View — standard 2-arg getAmountsOut (no isDiscountEligible param)
  "function getAmountsOut(uint256 amountIn, address[] path) view returns (uint256[])",
  "function getAmountsIn(uint256 amountOut, address[] path) view returns (uint256[])",
  "function WETH() view returns (address)",
  "function factory() view returns (address)",
]);
