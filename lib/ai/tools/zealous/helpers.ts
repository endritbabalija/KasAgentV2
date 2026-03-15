import { CONTRACTS } from "@/config/contracts";
import { routerAbi } from "@/config/abis";
import { findBestPathForRouter, calculatePriceImpactForFactory } from "../shared/helpers";

export async function findBestPath(
  addressIn: `0x${string}`,
  addressOut: `0x${string}`,
  rawAmountIn: bigint,
  isDiscountEligible = false
): Promise<{ path: `0x${string}`[]; amounts: bigint[] }> {
  return findBestPathForRouter({
    router: CONTRACTS.ROUTER,
    routerAbi,
    wkas: CONTRACTS.WKAS,
    addressIn,
    addressOut,
    rawAmountIn,
    extraArgs: [isDiscountEligible],
  });
}

export async function calculatePriceImpact(
  path: `0x${string}`[],
  rawAmountIn: bigint,
  rawAmountOut: bigint
): Promise<string> {
  return calculatePriceImpactForFactory(CONTRACTS.FACTORY, path, rawAmountIn, rawAmountOut);
}
