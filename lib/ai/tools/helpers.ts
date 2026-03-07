import { createPublicClient, http, formatEther } from "viem";
import { kasplexL2 } from "@/config/chains";
import { CONTRACTS } from "@/config/contracts";
import { KASPLEX_TOKENS } from "@/config/tokens";
import { factoryAbi, pairAbi, erc20Abi } from "@/config/abis";

export const client = createPublicClient({
  chain: kasplexL2,
  transport: http(),
});

export function resolveTokenAddress(symbol: string): `0x${string}` | null {
  const token = KASPLEX_TOKENS.find(
    (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
  );
  if (!token) return null;
  if (token.isNative) return CONTRACTS.WKAS;
  return token.address;
}

export function getTokenDecimals(symbol: string): number {
  const token = KASPLEX_TOKENS.find(
    (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
  );
  return token?.decimals ?? 18;
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

    // spot price = reserveOut / reserveIn (scaled by 1e18 for precision)
    const spotPrice = (reserveOut * BigInt(1e18)) / reserveIn;
    // execution price = amountOut / amountIn (scaled by 1e18)
    const executionPrice = (rawAmountOut * BigInt(1e18)) / rawAmountIn;
    // price impact = 1 - executionPrice / spotPrice
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

export function addressToSymbol(addr: string): string {
  return KASPLEX_TOKENS.find(t => t.address?.toLowerCase() === addr.toLowerCase())?.symbol ?? "???";
}
