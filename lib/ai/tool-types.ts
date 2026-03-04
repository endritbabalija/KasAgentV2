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
