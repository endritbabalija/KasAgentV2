export interface SwapQuoteResult {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  path?: string[];
  route?: string;
  protocol?: string;
  error?: string;
}

export interface PoolReservesResult {
  pair: string;
  pairAddress: string;
  reserveA: string;
  reserveB: string;
  totalLpSupply: string;
  error?: string;
}

export interface FarmInfo {
  pid: number;
  lpToken: string;
  allocPoint: string;
  totalDeposited: string;
  isActive: boolean;
  poolShareBps: string;
}

export interface ActiveFarmsResult {
  rewardToken: string;
  rewardPerBlock: string;
  totalAllocPoint: string;
  farms: FarmInfo[];
  error?: string;
}

export interface InfinityPoolInfo {
  name: string;
  exchangeRate: string;
  totalStaked: string;
  zealPerBlock?: string;
  emissionsPaused?: boolean;
}

export interface InfinityPoolRatesResult {
  pools: InfinityPoolInfo[];
  error?: string;
}

export interface PrepareSwapTx {
  router: string;
  tokenInAddress: string;
  tokenOutAddress: string;
  rawAmountIn: string;
  rawAmountOut: string;
  rawAmountOutMin: string;
  path: string[];
  deadline: string;
  value: string;
}

export interface ContractInfo {
  address: string;
  functionName: string;
  description: string;
}

export interface PrepareSwapResult {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  amountOutMin: string;
  slippage: number;
  priceImpact: string;
  dexFee: string;
  gasEstimate: string;
  dexFeeAmount: string;
  feeRate: string;
  discountApplied: boolean;
  discountSource: string;
  riskFlags: RiskFlag[];
  contractInfo: ContractInfo;
  swapType: "KAS_TO_TOKEN" | "TOKEN_TO_KAS" | "TOKEN_TO_TOKEN";
  needsApproval: boolean;
  currentAllowance: string;
  tx: PrepareSwapTx;
  error?: string;
}

// --- Add Liquidity types ---

export interface PrepareAddLiquidityTx {
  router: string;
  tokenAAddress: string;
  tokenBAddress: string;
  rawAmountADesired: string;
  rawAmountBDesired: string;
  rawAmountAMin: string;
  rawAmountBMin: string;
  deadline: string;
  value: string; // non-zero if one side is KAS
}

export interface PrepareAddLiquidityResult {
  tokenA: string;
  tokenB: string;
  amountA: string;
  amountB: string;
  amountAMin: string;
  amountBMin: string;
  slippage: number;
  estimatedLpTokens: string;
  poolShare: string;
  liquidityType: "KAS_TOKEN" | "TOKEN_TOKEN";
  needsApprovalA: boolean;
  needsApprovalB: boolean;
  currentAllowanceA: string;
  currentAllowanceB: string;
  gasEstimate: string;
  riskFlags: RiskFlag[];
  contractInfo: ContractInfo;
  tx: PrepareAddLiquidityTx;
  error?: string;
}

// --- Remove Liquidity types ---

export interface PrepareRemoveLiquidityTx {
  router: string;
  tokenAAddress: string;
  tokenBAddress: string;
  pairAddress: string;
  rawLpAmount: string;
  rawAmountAMin: string;
  rawAmountBMin: string;
  deadline: string;
}

export interface PrepareRemoveLiquidityResult {
  tokenA: string;
  tokenB: string;
  lpAmount: string;
  percentage: number;
  expectedAmountA: string;
  expectedAmountB: string;
  amountAMin: string;
  amountBMin: string;
  slippage: number;
  liquidityType: "KAS_TOKEN" | "TOKEN_TOKEN";
  needsApproval: boolean;
  currentAllowance: string;
  gasEstimate: string;
  riskFlags: RiskFlag[];
  contractInfo: ContractInfo;
  tx: PrepareRemoveLiquidityTx;
  error?: string;
}

// --- Farm Stake types ---

export interface PrepareFarmStakeTx {
  masterChef: string;
  lpToken: string;
  pid: string;
  rawAmount: string;
}

export interface PrepareFarmStakeResult {
  pid: number;
  lpTokenSymbol: string;
  amount: string;
  existingStake: string;
  pendingRewards: string;
  rewardToken: string;
  lockingPeriod: string;
  needsApproval: boolean;
  currentAllowance: string;
  gasEstimate: string;
  riskFlags: RiskFlag[];
  contractInfo: ContractInfo;
  tx: PrepareFarmStakeTx;
  error?: string;
}

// --- Farm Unstake types ---

export interface PrepareFarmUnstakeTx {
  masterChef: string;
  pid: string;
  rawAmount: string;
}

export interface PrepareFarmUnstakeResult {
  pid: number;
  lpTokenSymbol: string;
  amount: string;
  pendingRewards: string;
  rewardToken: string;
  canWithdraw: boolean;
  gasEstimate: string;
  riskFlags: RiskFlag[];
  contractInfo: ContractInfo;
  tx: PrepareFarmUnstakeTx;
  error?: string;
}

// --- Infinity Stake types ---

export interface PrepareInfinityStakeTx {
  pool: string;
  tokenAddress: string;
  rawAmount: string;
}

export interface PrepareInfinityStakeResult {
  token: string;
  amount: string;
  xTokensReceived: string;
  exchangeRate: string;
  totalStaked: string;
  needsApproval: boolean;
  currentAllowance: string;
  gasEstimate: string;
  riskFlags: RiskFlag[];
  contractInfo: ContractInfo;
  tx: PrepareInfinityStakeTx;
  error?: string;
}

// --- Infinity Unstake types ---

export interface PrepareInfinityUnstakeTx {
  pool: string;
  xTokenAddress: string;
  rawXAmount: string;
}

export interface PrepareInfinityUnstakeResult {
  token: string;
  xAmount: string;
  tokensReceived: string;
  exchangeRate: string;
  totalStaked: string;
  needsApproval: boolean;
  currentAllowance: string;
  gasEstimate: string;
  riskFlags: RiskFlag[];
  contractInfo: ContractInfo;
  tx: PrepareInfinityUnstakeTx;
  error?: string;
}

// --- Yield Discovery types ---

export type OpportunityType = "farm" | "infinity_pool";
export type RiskLevel = "low" | "medium" | "high";

export interface RiskFlag {
  type: string;
  label: string;
  severity: RiskLevel;
}

export interface FarmOpportunityDetails {
  pid: number;
  lpToken: string;
  allocPercent: number;
  rewardToken: string;
  rewardPerBlock: string;
  totalDeposited: string;
  pair: string;
  reserveA: string;
  reserveB: string;
}

export interface InfinityPoolOpportunityDetails {
  token: string;
  exchangeRate: string;
  totalStaked: string;
  zealPerBlock?: string;
  emissionsPaused?: boolean;
}

export interface YieldOpportunity {
  id: string;
  type: OpportunityType;
  name: string;
  tokens: string[];
  apyPercent: number | null;
  yieldSource: string;
  tvlKas: number;
  risks: RiskFlag[];
  overallRisk: RiskLevel;
  details: FarmOpportunityDetails | InfinityPoolOpportunityDetails;
}

export interface YieldOpportunitiesResult {
  opportunities: YieldOpportunity[];
  tokenPricesInKas: Record<string, number>;
  blockTimeSeconds: number;
  fetchedAt: string;
  error?: string;
}

// --- Transaction History types ---

export interface TokenTransferInfo {
  token: string;
  from: string;
  to: string;
  amount: string;
  decimals: number;
}

export interface TransactionHistoryItem {
  hash: string;
  action: string;
  status: string;
  from: string;
  to: string;
  toLabel: string | null;
  value: string;
  fee: string;
  timestamp: string;
  blockNumber: number;
  tokenTransfers: TokenTransferInfo[];
}

export interface TransactionHistoryResult {
  transactions: TransactionHistoryItem[];
  address: string;
  explorerUrl: string;
  fetchedAt: string;
  hasMore: boolean;
  error?: string;
}

// --- Membership Status types ---

export interface MembershipInfo {
  isActive: boolean;
  isLifetime: boolean;
  expiresAt: string;
  daysRemaining: number | null;
}

export interface NftStakingInfo {
  stakedNFTCount: number;
  totalPower: string;
  minRequiredPower: string;
  meetsMinPower: boolean;
  hasStakedRequiredDays: boolean;
  isQualified: boolean;
  requiredStakingDays: number;
}

export interface NftStakingGlobalStats {
  totalStakers: string;
  totalNFTsStaked: string;
  totalPowerStaked: string;
}

export interface MembershipStatusResult {
  walletAddress: string;
  discountEligible: boolean;
  discountSource: string;
  membership: MembershipInfo;
  nftStaking: NftStakingInfo;
  nftStakingGlobals: NftStakingGlobalStats;
  error?: string;
}

// --- All Pairs Listing types ---

export interface PairListItem {
  pair: string;
  pairAddress: string;
  token0Symbol: string;
  token1Symbol: string;
  reserve0: string;
  reserve1: string;
  totalLiquidityKas: number;
}

export interface AllPairsResult {
  pairs: PairListItem[];
  totalPairsOnChain: number;
  tokenCount: number;
  minLiquidityKas: number;
  fetchedAt: string;
  error?: string;
}

// --- Token Price types ---

export interface TokenPriceResult {
  token: string;
  priceInKAS: string;
  pairAddress: string;
  liquidityKAS: string;
  liquidityToken: string;
  tokenDecimals: number;
  error?: string;
}

// --- Spy Mode (Wallet Watching) types ---

export interface SpyTokenBalance {
  symbol: string;
  balance: string;
  address: string | null; // null for native KAS
}

export interface SpyLpPosition {
  pairAddress: string;
  pair: string; // "ZEAL/WKAS"
  lpBalance: string;
  token0Symbol: string;
  token0Amount: string;
  token1Symbol: string;
  token1Amount: string;
}

export interface SpyFarmPosition {
  pid: number;
  lpTokenSymbol: string; // "ZEAL/WKAS LP"
  stakedAmount: string;
  pendingReward: string;
  rewardToken: string;
  canWithdraw: boolean;
}

export interface SpyStakingPosition {
  pool: string; // "ZEAL" | "NACHO" | "KASPER"
  xTokenBalance: string;
  underlyingAmount: string;
  exchangeRate: string;
}

export interface SpyPortfolioResult {
  address: string;
  balances: SpyTokenBalance[];
  lpPositions: SpyLpPosition[];
  farmPositions: SpyFarmPosition[];
  stakingPositions: SpyStakingPosition[];
  discountStatus: { isEligible: boolean; source: string };
  fetchedAt: string;
  error?: string;
}

// --- KrokoSwap types ---

export interface KrokoSwapQuoteResult {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  priceImpact: string;
  route: string;
  protocol: "kroko";
  error?: string;
}

export interface KrokoPrepareSwapTx {
  to: string;
  data: string;
  value: string;
}

export interface KrokoPrepareSwapResult {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  amountOutMin: string;
  slippage: number;
  priceImpact: string;
  route: string;
  gasEstimate: string;
  riskFlags: RiskFlag[];
  contractInfo: ContractInfo;
  needsTokenApproval: boolean;
  needsPermit2Approval: boolean;
  permit2Address: string;
  universalRouterAddress: string;
  tokenInAddress: string;
  isNativeIn: boolean;
  tx: KrokoPrepareSwapTx;
  error?: string;
}

// --- Swap Comparison types ---

export interface SwapComparisonQuote {
  protocol: string;
  protocolName: string;
  amountOut: string;
  priceImpact: string;
  route: string;
  isBest: boolean;
  error?: string;
}

export interface SwapComparisonResult {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  quotes: SwapComparisonQuote[];
  recommendation: string;
  error?: string;
}
