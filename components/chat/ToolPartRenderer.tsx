import { ToolCardSkeleton } from "./cards/ToolCardSkeleton";
import { ToolErrorCard } from "./cards/ToolErrorCard";
import { SwapQuoteCard } from "./cards/SwapQuoteCard";
import { SwapExecutionCard } from "./cards/SwapExecutionCard";
import { PoolReservesCard } from "./cards/PoolReservesCard";
import { FarmsTableCard } from "./cards/FarmsTableCard";
import { InfinityPoolRatesCard } from "./cards/InfinityPoolRatesCard";
import { YieldOpportunitiesCard } from "./cards/YieldOpportunitiesCard";
import { AddLiquidityCard } from "./cards/AddLiquidityCard";
import { RemoveLiquidityCard } from "./cards/RemoveLiquidityCard";
import { FarmStakeCard } from "./cards/FarmStakeCard";
import { FarmUnstakeCard } from "./cards/FarmUnstakeCard";
import { InfinityStakeCard } from "./cards/InfinityStakeCard";
import { InfinityUnstakeCard } from "./cards/InfinityUnstakeCard";
import type {
  SwapQuoteResult,
  PrepareSwapResult,
  PoolReservesResult,
  ActiveFarmsResult,
  InfinityPoolRatesResult,
  YieldOpportunitiesResult,
  PrepareAddLiquidityResult,
  PrepareRemoveLiquidityResult,
  PrepareFarmStakeResult,
  PrepareFarmUnstakeResult,
  PrepareInfinityStakeResult,
  PrepareInfinityUnstakeResult,
} from "@/lib/ai/tool-types";

interface ToolPart {
  toolName: string;
  state: string;
  output?: unknown;
  errorText?: string;
}

export function ToolPartRenderer({ part }: { part: ToolPart }) {
  const { toolName, state } = part;

  // Loading states
  if (state === "input-streaming" || state === "input-available" || state === "approval-requested") {
    return <ToolCardSkeleton toolName={toolName} />;
  }

  // Error state
  if (state === "output-error") {
    return <ToolErrorCard error={part.errorText ?? "Unknown error"} toolName={toolName} />;
  }

  // Only render output for completed states
  if (state !== "output-available") {
    return null;
  }

  const output = part.output as Record<string, unknown> | undefined;

  // Check for error in output
  if (output?.error) {
    return <ToolErrorCard error={output.error as string} toolName={toolName} />;
  }

  switch (toolName) {
    case "getSwapQuote":
      return <SwapQuoteCard data={output as unknown as SwapQuoteResult} />;
    case "prepareSwap":
      return <SwapExecutionCard data={output as unknown as PrepareSwapResult} />;
    case "getPoolReserves":
      return <PoolReservesCard data={output as unknown as PoolReservesResult} />;
    case "getActiveFarms":
      return <FarmsTableCard data={output as unknown as ActiveFarmsResult} />;
    case "getInfinityPoolRates":
      return <InfinityPoolRatesCard data={output as unknown as InfinityPoolRatesResult} />;
    case "discoverYieldOpportunities":
      return <YieldOpportunitiesCard data={output as unknown as YieldOpportunitiesResult} />;
    case "prepareAddLiquidity":
      return <AddLiquidityCard data={output as unknown as PrepareAddLiquidityResult} />;
    case "prepareRemoveLiquidity":
      return <RemoveLiquidityCard data={output as unknown as PrepareRemoveLiquidityResult} />;
    case "prepareFarmStake":
      return <FarmStakeCard data={output as unknown as PrepareFarmStakeResult} />;
    case "prepareFarmUnstake":
      return <FarmUnstakeCard data={output as unknown as PrepareFarmUnstakeResult} />;
    case "prepareInfinityStake":
      return <InfinityStakeCard data={output as unknown as PrepareInfinityStakeResult} />;
    case "prepareInfinityUnstake":
      return <InfinityUnstakeCard data={output as unknown as PrepareInfinityUnstakeResult} />;
    default:
      // Fallback: render raw JSON for unknown tools
      return (
        <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl p-4">
          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">{toolName}</div>
          <pre className="text-xs text-zinc-400 font-mono overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(output, null, 2)}
          </pre>
        </div>
      );
  }
}
