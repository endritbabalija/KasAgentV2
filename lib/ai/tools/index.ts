import { zealousTools } from "./zealous";
import { krokoTools } from "./kroko";
import { kaspacomTools } from "./kaspacom";
import { compareTools } from "./compare";
import { historyTools } from "./history";
import { spyTools } from "./spy";
import { oracleTools } from "./oracle";
import { strategyTools } from "./strategy";

export const aiTools = {
  ...zealousTools,
  ...krokoTools,
  ...kaspacomTools,
  ...compareTools,
  ...historyTools,
  ...spyTools,
  ...oracleTools,
  ...strategyTools,
};

// Context-aware tools factory (for future use with dataStream)
// Activate when converting spy/strategy/yield to factory pattern:
//
// import type { UIMessageStreamWriter } from "ai";
//
// export function getTools({ dataStream }: { dataStream: UIMessageStreamWriter }) {
//   return {
//     ...zealousTools,
//     ...krokoTools,
//     ...kaspacomTools,
//     ...compareTools,
//     ...historyTools,
//     ...createSpyTools({ dataStream }),
//     ...oracleTools,
//     ...createStrategyTools({ dataStream }),
//   };
// }
