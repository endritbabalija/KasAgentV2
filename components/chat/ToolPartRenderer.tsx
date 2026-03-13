import { ToolCardSkeleton } from "./cards/ToolCardSkeleton";
import { ToolErrorCard } from "./cards/ToolErrorCard";
import { SwapQuoteCard } from "./cards/SwapQuoteCard";
import { SwapExecutionCard } from "./cards/SwapExecutionCard";
import { PoolReservesCard } from "./cards/PoolReservesCard";
import { AllPairsCard } from "./cards/AllPairsCard";
import { FarmsTableCard } from "./cards/FarmsTableCard";
import { InfinityPoolRatesCard } from "./cards/InfinityPoolRatesCard";
import { YieldOpportunitiesCard } from "./cards/YieldOpportunitiesCard";
import { AddLiquidityCard } from "./cards/AddLiquidityCard";
import { RemoveLiquidityCard } from "./cards/RemoveLiquidityCard";
import { FarmStakeCard } from "./cards/FarmStakeCard";
import { FarmUnstakeCard } from "./cards/FarmUnstakeCard";
import { InfinityStakeCard } from "./cards/InfinityStakeCard";
import { InfinityUnstakeCard } from "./cards/InfinityUnstakeCard";
import { TransactionHistoryCard } from "./cards/TransactionHistoryCard";
import { MembershipStatusCard } from "./cards/MembershipStatusCard";
import { SpyPortfolioCard } from "./cards/SpyPortfolioCard";
import { PriceCard } from "./cards/PriceCard";
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
  TransactionHistoryResult,
  MembershipStatusResult,
  SpyPortfolioResult,
  TokenPriceResult,
  AllPairsResult,
} from "@/lib/ai/tool-types";

import { useExecutionState } from "./ExecutionStateContext";

interface ToolPart {
  toolName: string;
  state: string;
  output?: unknown;
  errorText?: string;
  toolCallId?: string;
}

export function ToolPartRenderer({ part }: { part: ToolPart }) {
  const { getExecutionState } = useExecutionState();
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
  const toolCallId = part.toolCallId;
  const execution = toolCallId ? getExecutionState(toolCallId) : undefined;

  // Check for error in output
  if (output?.error) {
    return <ToolErrorCard error={output.error as string} toolName={toolName} />;
  }

  switch (toolName) {
    case "getSwapQuote":
      return <SwapQuoteCard data={output as unknown as SwapQuoteResult} />;
    case "prepareSwap":
      return <SwapExecutionCard data={output as unknown as PrepareSwapResult} toolCallId={toolCallId} executionState={execution} />;
    case "getPoolReserves":
      return <PoolReservesCard data={output as unknown as PoolReservesResult} />;
    case "listAllPairs":
      return <AllPairsCard data={output as unknown as AllPairsResult} />;
    case "getActiveFarms":
      return <FarmsTableCard data={output as unknown as ActiveFarmsResult} />;
    case "getInfinityPoolRates":
      return <InfinityPoolRatesCard data={output as unknown as InfinityPoolRatesResult} />;
    case "discoverYieldOpportunities":
      return <YieldOpportunitiesCard data={output as unknown as YieldOpportunitiesResult} />;
    case "prepareAddLiquidity":
      return <AddLiquidityCard data={output as unknown as PrepareAddLiquidityResult} toolCallId={toolCallId} executionState={execution} />;
    case "prepareRemoveLiquidity":
      return <RemoveLiquidityCard data={output as unknown as PrepareRemoveLiquidityResult} toolCallId={toolCallId} executionState={execution} />;
    case "prepareFarmStake":
      return <FarmStakeCard data={output as unknown as PrepareFarmStakeResult} toolCallId={toolCallId} executionState={execution} />;
    case "prepareFarmUnstake":
      return <FarmUnstakeCard data={output as unknown as PrepareFarmUnstakeResult} toolCallId={toolCallId} executionState={execution} />;
    case "prepareInfinityStake":
      return <InfinityStakeCard data={output as unknown as PrepareInfinityStakeResult} toolCallId={toolCallId} executionState={execution} />;
    case "prepareInfinityUnstake":
      return <InfinityUnstakeCard data={output as unknown as PrepareInfinityUnstakeResult} toolCallId={toolCallId} executionState={execution} />;
    case "getTransactionHistory":
      return <TransactionHistoryCard data={output as unknown as TransactionHistoryResult} />;
    case "getMembershipStatus":
      return <MembershipStatusCard data={output as unknown as MembershipStatusResult} />;
    case "spyOnWallet":
      return <SpyPortfolioCard data={output as unknown as SpyPortfolioResult} />;
    case "getTokenPrice":
      return <PriceCard data={output as unknown as TokenPriceResult} />;
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
