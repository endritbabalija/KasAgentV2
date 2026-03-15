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
import { KrokoSwapExecutionCard } from "./cards/KrokoSwapExecutionCard";
import { SwapComparisonCard } from "./cards/SwapComparisonCard";
import { StrategyPlanCard } from "./cards/StrategyPlanCard";
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
  KrokoPrepareSwapResult,
  SwapComparisonResult,
  StrategyPlanResult,
} from "@/lib/ai/tool-types";

import { useExecutionState, type ExecutionRecord } from "./ExecutionStateContext";

interface ToolPart {
  toolName: string;
  state: string;
  output?: unknown;
  errorText?: string;
  toolCallId?: string;
}

// Tool card registry: maps tool names to render functions
type CardRenderer = (output: Record<string, unknown>, toolCallId?: string, execution?: ExecutionRecord) => React.ReactNode;

const TOOL_CARD_REGISTRY: Record<string, CardRenderer> = {
  // ZealousSwap tools
  zealous_getSwapQuote: (o) => <SwapQuoteCard data={o as unknown as SwapQuoteResult} />,
  zealous_prepareSwap: (o, id, ex) => <SwapExecutionCard data={o as unknown as PrepareSwapResult} toolCallId={id} executionState={ex} />,
  zealous_getPoolReserves: (o) => <PoolReservesCard data={o as unknown as PoolReservesResult} />,
  zealous_listAllPairs: (o) => <AllPairsCard data={o as unknown as AllPairsResult} />,
  zealous_getActiveFarms: (o) => <FarmsTableCard data={o as unknown as ActiveFarmsResult} />,
  zealous_getInfinityPoolRates: (o) => <InfinityPoolRatesCard data={o as unknown as InfinityPoolRatesResult} />,
  zealous_discoverYieldOpportunities: (o) => <YieldOpportunitiesCard data={o as unknown as YieldOpportunitiesResult} />,
  zealous_prepareAddLiquidity: (o, id, ex) => <AddLiquidityCard data={o as unknown as PrepareAddLiquidityResult} toolCallId={id} executionState={ex} />,
  zealous_prepareRemoveLiquidity: (o, id, ex) => <RemoveLiquidityCard data={o as unknown as PrepareRemoveLiquidityResult} toolCallId={id} executionState={ex} />,
  zealous_prepareFarmStake: (o, id, ex) => <FarmStakeCard data={o as unknown as PrepareFarmStakeResult} toolCallId={id} executionState={ex} />,
  zealous_prepareFarmUnstake: (o, id, ex) => <FarmUnstakeCard data={o as unknown as PrepareFarmUnstakeResult} toolCallId={id} executionState={ex} />,
  zealous_prepareInfinityStake: (o, id, ex) => <InfinityStakeCard data={o as unknown as PrepareInfinityStakeResult} toolCallId={id} executionState={ex} />,
  zealous_prepareInfinityUnstake: (o, id, ex) => <InfinityUnstakeCard data={o as unknown as PrepareInfinityUnstakeResult} toolCallId={id} executionState={ex} />,
  zealous_getMembershipStatus: (o) => <MembershipStatusCard data={o as unknown as MembershipStatusResult} />,

  // KrokoSwap tools
  kroko_getSwapQuote: (o) => <SwapQuoteCard data={o as unknown as SwapQuoteResult} />,
  kroko_prepareSwap: (o, id, ex) => <KrokoSwapExecutionCard data={o as unknown as KrokoPrepareSwapResult} toolCallId={id} executionState={ex} />,

  // KaspaCom tools
  kaspacom_getSwapQuote: (o) => <SwapQuoteCard data={o as unknown as SwapQuoteResult} />,
  kaspacom_prepareSwap: (o, id, ex) => <SwapExecutionCard data={o as unknown as PrepareSwapResult} toolCallId={id} executionState={ex} />,

  // Cross-protocol tools
  compareSwapQuotes: (o) => <SwapComparisonCard data={o as unknown as SwapComparisonResult} />,
  planStrategy: (o) => <StrategyPlanCard data={o as unknown as StrategyPlanResult} />,

  // Protocol-agnostic tools
  getTransactionHistory: (o) => <TransactionHistoryCard data={o as unknown as TransactionHistoryResult} />,
  spyOnWallet: (o) => <SpyPortfolioCard data={o as unknown as SpyPortfolioResult} />,
  getTokenPrice: (o) => <PriceCard data={o as unknown as TokenPriceResult} />,
};

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

  const renderer = TOOL_CARD_REGISTRY[toolName];
  if (renderer && output) {
    return <>{renderer(output, toolCallId, execution)}</>;
  }

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
