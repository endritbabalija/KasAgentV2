import { formatEther } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { factoryAbi, pairAbi, erc20Abi, routerAbi } from "@/config/abis";
import {
  resolveTokenAddress,
  getTokenDecimals,
  addressToSymbol,
} from "@/lib/token-registry";
import { client } from "@/lib/viem-client";

export { client };

export { resolveTokenAddress, getTokenDecimals, addressToSymbol };

export async function safeRead<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

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

    const [reserves, token0] = await Promise.all([
      client.readContract({
        address: pairAddress,
        abi: pairAbi,
        functionName: "getReserves",
      }),
      client.readContract({
        address: pairAddress,
        abi: pairAbi,
        functionName: "token0",
      }),
    ]);

    const [r0, r1] = reserves as [bigint, bigint, number];
    const isToken0In =
      (token0 as string).toLowerCase() === addressIn.toLowerCase();
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

export async function estimateGasCost(gasUnits: bigint, fallback: string): Promise<string> {
  try {
    const gasPrice = await client.getGasPrice();
    return formatEther(gasUnits * gasPrice);
  } catch {
    return fallback;
  }
}

export function calculateMinAmount(rawAmount: bigint, slippagePercent: number): bigint {
  const slippageBps = BigInt(Math.round(slippagePercent * 100));
  return rawAmount - (rawAmount * slippageBps) / 10000n;
}

export async function checkAllowance(
  tokenAddress: `0x${string}`,
  owner: `0x${string}`,
  spender: `0x${string}`,
  requiredAmount: bigint
): Promise<{ needsApproval: boolean; currentAllowance: string }> {
  const allowance = (await client.readContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [owner, spender],
  })) as bigint;
  return {
    needsApproval: allowance < requiredAmount,
    currentAllowance: allowance.toString(),
  };
}
