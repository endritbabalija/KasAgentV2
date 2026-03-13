const API_BASE = "https://krokoswap.io/swap-api";

export interface KrokoRouteInfo {
  path: string[];
  protocol: string;
  hops: number;
  fees: number[];
  protocols: string[];
}

export interface KrokoQuoteResponse {
  amountIn: string;
  amountOut: string;
  executionPrice: number;
  priceImpact: number;
  route: KrokoRouteInfo;
  gasCost: string;
  isSplit: boolean;
  error?: string;
}

export interface KrokoSwapCalldataResponse {
  to: string;
  data: string;
  value: string;
  gasEstimate: string;
  quote: {
    amountIn: string;
    amountOut: string;
    minAmountOut: string;
    priceImpact: number;
    protocol: string;
    path: string[];
  };
  error?: string;
}

export async function getKrokoQuote(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  tradeType?: number;
}): Promise<KrokoQuoteResponse> {
  const query = new URLSearchParams({
    tokenIn: params.tokenIn,
    tokenOut: params.tokenOut,
    amountIn: params.amountIn,
    tradeType: String(params.tradeType ?? 0),
  });

  const res = await fetch(`${API_BASE}/api/v1/quote?${query}`, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`KrokoSwap quote failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`KrokoSwap quote error: ${data.error}`);
  }

  return data as KrokoQuoteResponse;
}

export async function getKrokoSwapCalldata(params: {
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  tradeType?: number;
  slippage: number;
  recipient: string;
  deadline?: number;
}): Promise<KrokoSwapCalldataResponse> {
  const res = await fetch(`${API_BASE}/api/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      tokenIn: params.tokenIn,
      tokenOut: params.tokenOut,
      amountIn: params.amountIn,
      tradeType: params.tradeType ?? 0,
      slippage: params.slippage,
      recipient: params.recipient,
      deadline: String(params.deadline ?? 1200),
    }),
  });

  if (!res.ok) {
    throw new Error(`KrokoSwap swap calldata failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(`KrokoSwap swap error: ${data.error}`);
  }

  return data as KrokoSwapCalldataResponse;
}
