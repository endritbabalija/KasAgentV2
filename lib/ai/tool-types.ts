export interface SwapQuoteResult {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
  path: string[];
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
  riskFlags: RiskFlag[];
  contractInfo: ContractInfo;
  swapType: "KAS_TO_TOKEN" | "TOKEN_TO_KAS" | "TOKEN_TO_TOKEN";
  needsApproval: boolean;
  currentAllowance: string;
  tx: PrepareSwapTx;
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
