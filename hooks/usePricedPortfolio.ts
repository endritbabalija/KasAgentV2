"use client";

import { useMemo } from "react";
import { usePortfolio, type Portfolio } from "./usePortfolio";
import { useActiveFarms } from "./useActiveFarms";
import { useInfinityPoolData } from "./useInfinityPoolData";
import { useTokenRegistry } from "./useTokenRegistry";
import { useAllPairs } from "./useAllPairs";
import { CONTRACTS } from "@/config/contracts";
import { pricePortfolio, type WalletToken, type Position } from "@/lib/portfolio-math";

export type { WalletToken, Position } from "@/lib/portfolio-math";

export interface PricedPortfolio extends Portfolio {
  walletTokens: WalletToken[];
  positions: Position[];
  totalValueKas: number;
}

export function usePricedPortfolio(): PricedPortfolio {
  const portfolio = usePortfolio();
  const { farms } = useActiveFarms();
  const { pools } = useInfinityPoolData();
  const { getTokenSymbol, tokenMap } = useTokenRegistry();
  const { pairs } = useAllPairs();

  const { walletTokens, positions, totalValueKas } = useMemo(
    () =>
      pricePortfolio({
        wkasAddress: CONTRACTS.WKAS,
        pairs,
        tokenMap,
        getTokenSymbol,
        balances: portfolio.balances,
        lpPositions: portfolio.lpPositions,
        farmPositions: portfolio.farmPositions,
        farmGlobals: portfolio.farmGlobals,
        stakingPositions: portfolio.stakingPositions,
        farms,
        pools,
      }),
    [pairs, tokenMap, getTokenSymbol, portfolio.balances, portfolio.lpPositions,
     portfolio.farmPositions, portfolio.farmGlobals, portfolio.stakingPositions,
     farms, pools],
  );

  return useMemo<PricedPortfolio>(
    () => ({ ...portfolio, walletTokens, positions, totalValueKas }),
    [portfolio, walletTokens, positions, totalValueKas],
  );
}
