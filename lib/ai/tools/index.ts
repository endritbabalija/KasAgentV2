import { zealousTools } from "./zealous";
import { krokoTools } from "./kroko";
import { compareTools } from "./compare";
import { historyTools } from "./history";
import { spyTools } from "./spy";
import { oracleTools } from "./oracle";

export const aiTools = {
  ...zealousTools,
  ...krokoTools,
  ...compareTools,
  ...historyTools,
  ...spyTools,
  ...oracleTools,
};
