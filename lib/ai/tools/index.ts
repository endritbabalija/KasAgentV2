import { swapTools } from "./swap";
import { liquidityTools } from "./liquidity";
import { farmTools } from "./farms";
import { stakingTools } from "./staking";
import { yieldTools } from "./yield";
import { historyTools } from "./history";
import { membershipTools } from "./membership";
import { spyTools } from "./spy";

export const aiTools = {
  ...swapTools,
  ...liquidityTools,
  ...farmTools,
  ...stakingTools,
  ...yieldTools,
  ...historyTools,
  ...membershipTools,
  ...spyTools,
};
