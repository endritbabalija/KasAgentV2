import { SwapQuoteCard } from "@/components/chat/cards/SwapQuoteCard";
import { SwapExecutionCard } from "@/components/chat/cards/SwapExecutionCard";
import { PoolReservesCard } from "@/components/chat/cards/PoolReservesCard";
import { AllPairsCard } from "@/components/chat/cards/AllPairsCard";
import { FarmsTableCard } from "@/components/chat/cards/FarmsTableCard";
import { InfinityPoolRatesCard } from "@/components/chat/cards/InfinityPoolRatesCard";
import { YieldOpportunitiesCard } from "@/components/chat/cards/YieldOpportunitiesCard";
import { AddLiquidityCard } from "@/components/chat/cards/AddLiquidityCard";
import { RemoveLiquidityCard } from "@/components/chat/cards/RemoveLiquidityCard";
import { FarmStakeCard } from "@/components/chat/cards/FarmStakeCard";
import { FarmUnstakeCard } from "@/components/chat/cards/FarmUnstakeCard";
import { InfinityStakeCard } from "@/components/chat/cards/InfinityStakeCard";
import { InfinityUnstakeCard } from "@/components/chat/cards/InfinityUnstakeCard";
import { TransactionHistoryCard } from "@/components/chat/cards/TransactionHistoryCard";
import { MembershipStatusCard } from "@/components/chat/cards/MembershipStatusCard";
import { SpyPortfolioCard } from "@/components/chat/cards/SpyPortfolioCard";
import { PriceCard } from "@/components/chat/cards/PriceCard";
import { KrokoSwapExecutionCard } from "@/components/chat/cards/KrokoSwapExecutionCard";
import { SwapComparisonCard } from "@/components/chat/cards/SwapComparisonCard";
import { StrategyPlanCard } from "@/components/chat/cards/StrategyPlanCard";
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
import type { ExecutionRecord } from "@/components/chat/ExecutionStateContext";

export type CardRenderer = (
  output: Record<string, unknown>,
  toolCallId?: string,
  execution?: ExecutionRecord
) => React.ReactNode;

export const TOOL_CARD_REGISTRY: Record<string, CardRenderer> = {
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
