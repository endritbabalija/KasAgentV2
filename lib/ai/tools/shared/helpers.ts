import { formatEther, formatUnits } from "viem";
import { erc20Abi, factoryAbi, pairAbi } from "@/config/abis";
import { SHARED } from "@/config/protocols";
import { client } from "@/lib/viem-client";
import { mcResult } from "@/lib/multicall";
import {
  resolveTokenAddress,
  getTokenDecimals,
  addressToSymbol,
} from "@/lib/token-registry";
import type { RiskFlag } from "../../tool-types";

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

/**
 * Calculate price impact for a V2 swap path against any factory.
 * Compares spot price (from reserves) to execution price (actual amounts).
 */
export async function calculatePriceImpactForFactory(
  factoryAddress: `0x${string}`,
  path: `0x${string}`[],
  rawAmountIn: bigint,
  rawAmountOut: bigint
): Promise<string> {
  try {
    const hops = path.length - 1;
    if (hops === 0) return "0";

    const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as `0x${string}`;

    // Multicall 1: resolve pair address for each hop
    const pairMc = await client.multicall({
      contracts: Array.from({ length: hops }, (_, i) => ({
        address: factoryAddress,
        abi: factoryAbi,
        functionName: "getPair" as const,
        args: [path[i], path[i + 1]] as const,
      })),
      allowFailure: true,
    });

    const pairAddresses = pairMc.map((r) => mcResult<`0x${string}`>(r, ZERO_ADDR));
    if (pairAddresses.some((a) => a === ZERO_ADDR)) return "0";

    // Multicall 2: getReserves + token0 for each pair
    const detailMc = await client.multicall({
      contracts: pairAddresses.flatMap((addr) => [
        { address: addr, abi: pairAbi, functionName: "getReserves" as const },
        { address: addr, abi: pairAbi, functionName: "token0" as const },
      ]),
      allowFailure: true,
    });

    let combinedSpot = BigInt(1e18);

    for (let i = 0; i < hops; i++) {
      const base = i * 2;
      const [r0, r1] = mcResult<[bigint, bigint, number]>(detailMc[base], [0n, 0n, 0]);
      const t0 = mcResult<string>(detailMc[base + 1], "").toLowerCase();

      const isToken0In = t0 === path[i].toLowerCase();
      const reserveIn = isToken0In ? r0 : r1;
      const reserveOut = isToken0In ? r1 : r0;

      if (reserveIn === 0n || reserveOut === 0n) return "0";

      combinedSpot = (combinedSpot * reserveOut) / reserveIn;
    }

    const executionPrice = (rawAmountOut * BigInt(1e18)) / rawAmountIn;
    const impact =
      combinedSpot > 0n
        ? Number(((combinedSpot - executionPrice) * 10000n) / combinedSpot) / 100
        : 0;

    return Math.max(0, impact).toFixed(2);
  } catch {
    return "0";
  }
}

/**
 * Check pool liquidity for each hop in a V2 swap path.
 * Pushes low_liquidity risk flags if any pool has <1000 KAS equivalent.
 */
export async function checkPoolLiquidity(
  factoryAddress: `0x${string}`,
  path: `0x${string}`[],
  riskFlags: RiskFlag[]
): Promise<void> {
  const hops = path.length - 1;
  if (hops === 0) return;

  try {
    const wkasAddr = SHARED.WKAS.toLowerCase();

    const pairMc = await client.multicall({
      contracts: Array.from({ length: hops }, (_, i) => ({
        address: factoryAddress,
        abi: factoryAbi,
        functionName: "getPair" as const,
        args: [path[i], path[i + 1]] as const,
      })),
      allowFailure: true,
    });

    const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as `0x${string}`;
    const hopPairs = pairMc.map((r) => mcResult<`0x${string}`>(r, ZERO_ADDR));
    const validHopIndices = hopPairs
      .map((addr, i) => (addr !== ZERO_ADDR ? i : -1))
      .filter((i) => i >= 0);

    if (validHopIndices.length === 0) return;

    const detailMc = await client.multicall({
      contracts: validHopIndices.flatMap((idx) => [
        { address: hopPairs[idx], abi: pairAbi, functionName: "getReserves" as const },
        { address: hopPairs[idx], abi: pairAbi, functionName: "token0" as const },
        { address: path[idx] as `0x${string}`, abi: erc20Abi, functionName: "decimals" as const },
        { address: path[idx + 1] as `0x${string}`, abi: erc20Abi, functionName: "decimals" as const },
      ]),
      allowFailure: true,
    });

    for (let j = 0; j < validHopIndices.length; j++) {
      const hopIdx = validHopIndices[j];
      const base = j * 4;
      const [r0, r1] = mcResult<[bigint, bigint, number]>(detailMc[base], [0n, 0n, 0]);
      const t0 = mcResult<string>(detailMc[base + 1], "").toLowerCase();

      let liquidityKas: number;
      if (t0 === wkasAddr) {
        liquidityKas = Number(formatUnits(r0, 18)) * 2;
      } else if (path[hopIdx].toLowerCase() === wkasAddr || path[hopIdx + 1].toLowerCase() === wkasAddr) {
        liquidityKas = Number(formatUnits(r1, 18)) * 2;
      } else {
        const d0 = mcResult<number>(detailMc[base + 2], 18);
        const d1 = mcResult<number>(detailMc[base + 3], 18);
        const isT0First = t0 === path[hopIdx].toLowerCase();
        const r0Val = Number(formatUnits(r0, isT0First ? d0 : d1));
        const r1Val = Number(formatUnits(r1, isT0First ? d1 : d0));
        liquidityKas = Math.min(r0Val, r1Val) * 2;
      }

      if (liquidityKas < 1000) {
        riskFlags.push({ type: "low_liquidity", label: `Low pool liquidity on hop ${hopIdx + 1}`, severity: "high" });
        break;
      }
    }
  } catch {
    // skip liquidity check on error
  }
}
