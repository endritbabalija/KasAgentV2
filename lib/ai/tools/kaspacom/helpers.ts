import { kaspacomRouterAbi } from "@/config/abis";
import { PROTOCOLS, SHARED } from "@/config/protocols";
import { findBestPathForRouter, calculatePriceImpactForFactory } from "../shared/helpers";

const ROUTER = PROTOCOLS.kaspacom.contracts.router as `0x${string}`;
const FACTORY = PROTOCOLS.kaspacom.contracts.factory as `0x${string}`;

export async function findBestPath(
  addressIn: `0x${string}`,
  addressOut: `0x${string}`,
  rawAmountIn: bigint
): Promise<{ path: `0x${string}`[]; amounts: bigint[] }> {
  return findBestPathForRouter({
    router: ROUTER,
    routerAbi: kaspacomRouterAbi,
    wkas: SHARED.WKAS,
    addressIn,
    addressOut,
    rawAmountIn,
  });
}

export async function calculatePriceImpact(
  path: `0x${string}`[],
  rawAmountIn: bigint,
  rawAmountOut: bigint
): Promise<string> {
  return calculatePriceImpactForFactory(FACTORY, path, rawAmountIn, rawAmountOut);
}
