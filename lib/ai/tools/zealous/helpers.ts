import { CONTRACTS } from "@/config/contracts";
import { factoryAbi, pairAbi, routerAbi } from "@/config/abis";
import { client, mcResult } from "../shared/helpers";

export async function findBestPath(
  addressIn: `0x${string}`,
  addressOut: `0x${string}`,
  rawAmountIn: bigint,
  isDiscountEligible = false
): Promise<{ path: `0x${string}`[]; amounts: bigint[] }> {
  // Try direct path first
  try {
    const amounts = (await client.readContract({
      address: CONTRACTS.ROUTER,
      abi: routerAbi,
      functionName: "getAmountsOut",
      args: [rawAmountIn, [addressIn, addressOut], isDiscountEligible],
    })) as bigint[];
    return { path: [addressIn, addressOut], amounts };
  } catch {
    // Direct path failed — try routing through WKAS
  }

  const wkas = CONTRACTS.WKAS;
  // Skip WKAS hop if either token IS WKAS
  if (addressIn.toLowerCase() === wkas.toLowerCase() || addressOut.toLowerCase() === wkas.toLowerCase()) {
    throw new Error("No liquidity path found for this pair");
  }

  const amounts = (await client.readContract({
    address: CONTRACTS.ROUTER,
    abi: routerAbi,
    functionName: "getAmountsOut",
    args: [rawAmountIn, [addressIn, wkas, addressOut], isDiscountEligible],
  })) as bigint[];
  return { path: [addressIn, wkas, addressOut], amounts };
}

export async function calculatePriceImpact(
  addressIn: `0x${string}`,
  addressOut: `0x${string}`,
  rawAmountIn: bigint,
  rawAmountOut: bigint
): Promise<string> {
  try {
    const pairAddress = (await client.readContract({
      address: CONTRACTS.FACTORY,
      abi: factoryAbi,
      functionName: "getPair",
      args: [addressIn, addressOut],
    })) as `0x${string}`;

    if (pairAddress === "0x0000000000000000000000000000000000000000") {
      return "0";
    }

    const impactMc = await client.multicall({
      contracts: [
        { address: pairAddress, abi: pairAbi, functionName: "getReserves" as const },
        { address: pairAddress, abi: pairAbi, functionName: "token0" as const },
      ],
      allowFailure: true,
    });

    const [r0, r1] = mcResult<[bigint, bigint, number]>(impactMc[0], [0n, 0n, 0]);
    const isToken0In = mcResult<string>(impactMc[1], "").toLowerCase() === addressIn.toLowerCase();
    const reserveIn = isToken0In ? r0 : r1;
    const reserveOut = isToken0In ? r1 : r0;

    if (reserveIn === 0n || reserveOut === 0n) return "0";

    const spotPrice = (reserveOut * BigInt(1e18)) / reserveIn;
    const executionPrice = (rawAmountOut * BigInt(1e18)) / rawAmountIn;
    const impact =
      spotPrice > 0n
        ? Number(((spotPrice - executionPrice) * 10000n) / spotPrice) / 100
        : 0;

    return Math.max(0, impact).toFixed(2);
  } catch {
    return "0";
  }
}
