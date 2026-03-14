import { zealousTools } from "./zealous";
import { krokoTools } from "./kroko";
import { kaspacomTools } from "./kaspacom";
import { compareTools } from "./compare";
import { historyTools } from "./history";
import { spyTools } from "./spy";
import { oracleTools } from "./oracle";

export const aiTools = {
  ...zealousTools,
  ...krokoTools,
  ...kaspacomTools,
  ...compareTools,
  ...historyTools,
  ...spyTools,
  ...oracleTools,
};
