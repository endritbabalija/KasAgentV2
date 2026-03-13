import { zealousSwapTools } from "./swap";
import { zealousLiquidityTools } from "./liquidity";
import { zealousPairTools } from "./pairs";
import { zealousFarmTools } from "./farms";
import { zealousStakingTools } from "./staking";
import { zealousYieldTools } from "./yield";
import { zealousMembershipTools } from "./membership";

export const zealousTools = {
  ...zealousSwapTools,
  ...zealousLiquidityTools,
  ...zealousPairTools,
  ...zealousFarmTools,
  ...zealousStakingTools,
  ...zealousYieldTools,
  ...zealousMembershipTools,
};
