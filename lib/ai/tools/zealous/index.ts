import { zealousSwapTools } from "./swap";
import { zealousLiquidityTools } from "./liquidity";
import { zealousPairTools } from "./pairs";
import { zealousFarmTools } from "./farms";
import { zealousStakingTools } from "./staking";
import { zealousYieldTools } from "./yield";
import { zealousMembershipTools } from "./membership";

// Tools the AI can call directly
export const zealousTools = {
  // Swaps (quote tool hidden — compareSwapQuotes handles cross-DEX quotes)
  zealous_prepareSwap: zealousSwapTools.zealous_prepareSwap,
  // Liquidity (getPoolReserves hidden — listAllPairs is the superset)
  zealous_prepareAddLiquidity: zealousLiquidityTools.zealous_prepareAddLiquidity,
  zealous_prepareRemoveLiquidity: zealousLiquidityTools.zealous_prepareRemoveLiquidity,
  // Pairs (cross-DEX discovery)
  ...zealousPairTools,
  // Farms (getActiveFarms hidden — yield tool aggregates this)
  zealous_prepareFarmStake: zealousFarmTools.zealous_prepareFarmStake,
  zealous_prepareFarmUnstake: zealousFarmTools.zealous_prepareFarmUnstake,
  // Staking (getInfinityPoolRates hidden — yield tool aggregates this)
  zealous_prepareInfinityStake: zealousStakingTools.zealous_prepareInfinityStake,
  zealous_prepareInfinityUnstake: zealousStakingTools.zealous_prepareInfinityUnstake,
  // Yield
  ...zealousYieldTools,
  // Membership
  ...zealousMembershipTools,
};

// Internal-only tools (used by other tools or available via superset tools, not exposed to AI)
export const zealousInternalTools = {
  zealous_getSwapQuote: zealousSwapTools.zealous_getSwapQuote,
  zealous_getPoolReserves: zealousLiquidityTools.zealous_getPoolReserves,
  zealous_getActiveFarms: zealousFarmTools.zealous_getActiveFarms,
  zealous_getInfinityPoolRates: zealousStakingTools.zealous_getInfinityPoolRates,
};
