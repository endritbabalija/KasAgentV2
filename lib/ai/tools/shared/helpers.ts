import { formatEther } from "viem";
import { erc20Abi } from "@/config/abis";
import { client } from "@/lib/viem-client";
import { mcResult } from "@/lib/multicall";
import {
  resolveTokenAddress,
  getTokenDecimals,
  addressToSymbol,
} from "@/lib/token-registry";

export { client };
export { mcResult };
export { resolveTokenAddress, getTokenDecimals, addressToSymbol };

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
