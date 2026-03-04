import { parseAbi } from "viem";

export const routerAbi = parseAbi([
  // Swap
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, address[] path, address to, uint256 deadline) returns (uint256[])",
  "function swapExactKASForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline) payable returns (uint256[])",
  "function swapTokensForExactKAS(uint256 amountOut, uint256 amountInMax, address[] path, address to, uint256 deadline) returns (uint256[])",

  // Liquidity
  "function addLiquidity(address tokenA, address tokenB, uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB, uint256 liquidity)",
  "function addLiquidityKAS(address token, uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountKASMin, address to, uint256 deadline) payable returns (uint256 amountToken, uint256 amountKAS, uint256 liquidity)",
  "function removeLiquidity(address tokenA, address tokenB, uint256 liquidity, uint256 amountAMin, uint256 amountBMin, address to, uint256 deadline) returns (uint256 amountA, uint256 amountB)",
  "function removeLiquidityKAS(address token, uint256 liquidity, uint256 amountTokenMin, uint256 amountKASMin, address to, uint256 deadline) returns (uint256 amountToken, uint256 amountKAS)",

  // View
  "function getAmountsOut(uint256 amountIn, address[] path, bool isDiscountEligible) view returns (uint256[])",
  "function getAmountsIn(uint256 amountOut, address[] path, bool isDiscountEligible) view returns (uint256[])",
  "function WKAS() view returns (address)",
]);
