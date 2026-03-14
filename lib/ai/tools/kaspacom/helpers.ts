import { kaspacomRouterAbi } from "@/config/abis";
import { PROTOCOLS, SHARED } from "@/config/protocols";
import { client, calculatePriceImpactForFactory } from "../shared/helpers";

const ROUTER = PROTOCOLS.kaspacom.contracts.router as `0x${string}`;
const FACTORY = PROTOCOLS.kaspacom.contracts.factory as `0x${string}`;
const WKAS = SHARED.WKAS;

export async function findBestPath(
  addressIn: `0x${string}`,
  addressOut: `0x${string}`,
  rawAmountIn: bigint
): Promise<{ path: `0x${string}`[]; amounts: bigint[] }> {
  // Try direct path first
  try {
    const amounts = (await client.readContract({
      address: ROUTER,
      abi: kaspacomRouterAbi,
      functionName: "getAmountsOut",
      args: [rawAmountIn, [addressIn, addressOut]],
    })) as bigint[];
    return { path: [addressIn, addressOut], amounts };
  } catch {
    // Direct path failed — try routing through WKAS
  }

  // Skip WKAS hop if either token IS WKAS
  if (addressIn.toLowerCase() === WKAS.toLowerCase() || addressOut.toLowerCase() === WKAS.toLowerCase()) {
    throw new Error("No liquidity path found for this pair");
  }

  const amounts = (await client.readContract({
    address: ROUTER,
    abi: kaspacomRouterAbi,
    functionName: "getAmountsOut",
    args: [rawAmountIn, [addressIn, WKAS, addressOut]],
  })) as bigint[];
  return { path: [addressIn, WKAS, addressOut], amounts };
}

export async function calculatePriceImpact(
  path: `0x${string}`[],
  rawAmountIn: bigint,
  rawAmountOut: bigint
): Promise<string> {
  return calculatePriceImpactForFactory(FACTORY, path, rawAmountIn, rawAmountOut);
}
