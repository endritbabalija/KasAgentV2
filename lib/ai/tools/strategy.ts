import { z } from "zod";
import { tool } from "ai";
import { formatUnits, parseUnits } from "viem";
import { STRATEGY_STEP_TYPES, type StrategyPlanResult, type StrategyStep } from "../tool-types";
import {
  resolveTokenAddress,
  getTokenDecimals,
  client,
  mcResult,
} from "./shared/helpers";
import { findBestPath as zealousFindBestPath } from "./zealous/helpers";
import { findBestPath as kaspacomFindBestPath } from "./kaspacom/helpers";
import { getKrokoQuote } from "@/lib/kroko-api";
import { checkDiscountEligibility } from "@/lib/discount";
import { PROTOCOLS, type ProtocolId } from "@/config/protocols";
import { factoryAbi, pairAbi } from "@/config/abis";

// ── Internal chaining state ──

interface ChainedOutput {
  token: string;
  rawAmount: bigint;
  decimals: number;
}

// ── Protocol name display ──

const PROTOCOL_DISPLAY: Record<string, string> = {
  zealous: "ZealousSwap",
  kroko: "KrokoSwap",
  kaspacom: "KaspaCom",
};

// ── Resolve execution tool from step type + protocol ──

function resolveToolToCall(type: string, protocol: string): string {
  if (type === "swap") {
    if (protocol === "kroko") return "kroko_prepareSwap";
    if (protocol === "kaspacom") return "kaspacom_prepareSwap";
    return "zealous_prepareSwap";
  }
  const map: Record<string, string> = {
    addLiquidity: "zealous_prepareAddLiquidity",
    removeLiquidity: "zealous_prepareRemoveLiquidity",
    farmStake: "zealous_prepareFarmStake",
    farmUnstake: "zealous_prepareFarmUnstake",
    infinityStake: "zealous_prepareInfinityStake",
    infinityUnstake: "zealous_prepareInfinityUnstake",
  };
  return map[type] ?? "unknown";
}

// ── Resolve raw amount from explicit value or previous step ──

function resolveRawAmount(
  value: string | undefined,
  decimals: number,
  prev: ChainedOutput | null
): bigint | null {
  if (value === "auto") return prev?.rawAmount ?? null;
  if (value && value !== "auto") return parseUnits(value, decimals);
  // No value provided — try auto
  return prev?.rawAmount ?? null;
}

// ── Format a bigint amount to 4 significant figures ──

function fmt(raw: bigint, decimals: number): string {
  if (raw === 0n) return "0";
  const s = formatUnits(raw, decimals);
  const n = Number(s);
  if (n >= 1_000_000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (n >= 0.00000001) return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
  // Non-zero but too small for 8 decimal places — show raw string trimmed
  return s.replace(/0+$/, "").replace(/\.$/, "");
}

// ── Step processors ──

async function processSwap(
  step: { protocol: string; tokenIn: string; tokenOut: string; amountIn?: string },
  prev: ChainedOutput | null,
  isDiscountEligible: boolean
): Promise<{ computed: StrategyStep; output: ChainedOutput }> {
  const tokenIn = step.tokenIn.toUpperCase();
  const tokenOut = step.tokenOut.toUpperCase();
  const addressIn = await resolveTokenAddress(tokenIn);
  const addressOut = await resolveTokenAddress(tokenOut);
  if (!addressIn) throw new Error(`Unknown token: ${tokenIn}`);
  if (!addressOut) throw new Error(`Unknown token: ${tokenOut}`);
  if (addressIn.toLowerCase() === addressOut.toLowerCase()) {
    throw new Error(`${tokenIn} and ${tokenOut} resolve to the same on-chain address — no swap needed`);
  }

  const decimalsIn = await getTokenDecimals(tokenIn);
  const decimalsOut = await getTokenDecimals(tokenOut);

  const rawAmountIn = resolveRawAmount(step.amountIn, decimalsIn, prev);
  if (!rawAmountIn || rawAmountIn === 0n) throw new Error("Swap requires amountIn");

  let rawAmountOut: bigint;

  if (step.protocol === "kroko") {
    const quote = await getKrokoQuote({
      tokenIn: addressIn,
      tokenOut: addressOut,
      amountIn: rawAmountIn.toString(),
    });
    rawAmountOut = BigInt(quote.amountOut);
  } else if (step.protocol === "kaspacom") {
    const { amounts } = await kaspacomFindBestPath(addressIn, addressOut, rawAmountIn);
    rawAmountOut = amounts[amounts.length - 1];
  } else {
    const { amounts } = await zealousFindBestPath(addressIn, addressOut, rawAmountIn, isDiscountEligible);
    rawAmountOut = amounts[amounts.length - 1];
  }

  return {
    computed: {
      stepNumber: 0, // filled by caller
      type: "swap",
      action: `Swap ${fmt(rawAmountIn, decimalsIn)} ${tokenIn} to ${tokenOut}`,
      toolToCall: resolveToolToCall("swap", step.protocol),
      protocol: PROTOCOL_DISPLAY[step.protocol] ?? step.protocol,
      estimatedInput: `${fmt(rawAmountIn, decimalsIn)} ${tokenIn}`,
      estimatedOutput: `${fmt(rawAmountOut, decimalsOut)} ${tokenOut}`,
      tokens: [tokenIn, tokenOut],
    },
    output: { token: tokenOut, rawAmount: rawAmountOut, decimals: decimalsOut },
  };
}

async function processAddLiquidity(
  step: { protocol: string; tokenA: string; tokenB: string; amountA?: string },
  prev: ChainedOutput | null
): Promise<{ computed: StrategyStep; output: ChainedOutput }> {
  const tokenA = step.tokenA.toUpperCase();
  const tokenB = step.tokenB.toUpperCase();
  const addressA = await resolveTokenAddress(tokenA);
  const addressB = await resolveTokenAddress(tokenB);
  if (!addressA || !addressB) throw new Error(`Unknown token: ${!addressA ? tokenA : tokenB}`);

  const decimalsA = await getTokenDecimals(tokenA);
  const decimalsB = await getTokenDecimals(tokenB);

  // For pair lookup, use WKAS address (resolveTokenAddress("KAS") already returns WKAS)
  const protocol = PROTOCOLS[step.protocol as ProtocolId];
  const factory = protocol?.factoryAddress;
  if (!factory) throw new Error(`No factory for protocol ${step.protocol}`);

  const pairAddress = await client.readContract({
    address: factory,
    abi: factoryAbi,
    functionName: "getPair",
    args: [addressA, addressB],
  }) as `0x${string}`;

  const ZERO = "0x0000000000000000000000000000000000000000";
  if (!pairAddress || pairAddress === ZERO) {
    throw new Error(`No ${tokenA}/${tokenB} pair on ${PROTOCOL_DISPLAY[step.protocol]}`);
  }

  const mc = await client.multicall({
    contracts: [
      { address: pairAddress, abi: pairAbi, functionName: "getReserves" as const },
      { address: pairAddress, abi: pairAbi, functionName: "token0" as const },
      { address: pairAddress, abi: pairAbi, functionName: "totalSupply" as const },
    ],
    allowFailure: true,
  });

  const [r0, r1] = mcResult<[bigint, bigint, number]>(mc[0], [0n, 0n, 0]);
  const t0 = (mcResult<string>(mc[1], "")).toLowerCase();
  const lpTotal = mcResult<bigint>(mc[2], 0n);

  const isAToken0 = t0 === addressA.toLowerCase();
  const reserveA = isAToken0 ? r0 : r1;
  const reserveB = isAToken0 ? r1 : r0;

  // Resolve amountA — check if prev output matches tokenA or tokenB
  let rawAmountA: bigint;
  let rawAmountB: bigint;

  if (step.amountA === "auto" && prev) {
    if (prev.token.toUpperCase() === tokenB) {
      // Previous step gave us tokenB — compute matching tokenA from reserves
      rawAmountB = prev.rawAmount;
      rawAmountA = reserveB > 0n ? (rawAmountB * reserveA) / reserveB : 0n;
    } else {
      // Assume prev output is for tokenA
      rawAmountA = prev.rawAmount;
      rawAmountB = reserveA > 0n ? (rawAmountA * reserveB) / reserveA : 0n;
    }
  } else {
    rawAmountA = resolveRawAmount(step.amountA, decimalsA, prev) ?? 0n;
    rawAmountB = reserveA > 0n ? (rawAmountA * reserveB) / reserveA : 0n;
  }

  // Estimate LP tokens: min(amountA * supply / reserveA, amountB * supply / reserveB)
  let estimatedLp = 0n;
  if (lpTotal > 0n && reserveA > 0n && reserveB > 0n) {
    const lpFromA = (rawAmountA * lpTotal) / reserveA;
    const lpFromB = (rawAmountB * lpTotal) / reserveB;
    estimatedLp = lpFromA < lpFromB ? lpFromA : lpFromB;
  }

  return {
    computed: {
      stepNumber: 0,
      type: "addLiquidity",
      action: `Add ${tokenA}/${tokenB} liquidity`,
      toolToCall: "zealous_prepareAddLiquidity",
      protocol: PROTOCOL_DISPLAY[step.protocol] ?? step.protocol,
      estimatedInput: `${fmt(rawAmountA, decimalsA)} ${tokenA} + ${fmt(rawAmountB, decimalsB)} ${tokenB}`,
      estimatedOutput: `${fmt(estimatedLp, 18)} LP tokens`,
      tokens: [tokenA, tokenB],
      note: tokenA === "KAS" || tokenB === "KAS" ? "KAS automatically wraps to WKAS" : undefined,
    },
    output: { token: `${tokenA}/${tokenB} LP`, rawAmount: estimatedLp, decimals: 18 },
  };
}

function processFarmStake(
  step: { pid: number },
  prev: ChainedOutput | null
): { computed: StrategyStep; output: ChainedOutput } {
  const lpAmount = prev?.rawAmount ?? 0n;
  const lpLabel = prev?.token ?? "LP tokens";
  const tokens = lpLabel.includes("/")
    ? lpLabel.replace(" LP", "").split("/").map((t) => t.trim())
    : [];

  return {
    computed: {
      stepNumber: 0,
      type: "farmStake",
      action: `Stake ${lpLabel} in farm (PID ${step.pid})`,
      toolToCall: "zealous_prepareFarmStake",
      protocol: "ZealousSwap",
      estimatedInput: `${fmt(lpAmount, 18)} LP tokens`,
      estimatedOutput: "Earning ZEAL rewards",
      tokens,
      note: "7-day locking period applies",
    },
    output: { token: lpLabel, rawAmount: lpAmount, decimals: 18 },
  };
}

function processInfinityStake(
  step: { token: string; amount?: string },
  prev: ChainedOutput | null
): { computed: StrategyStep; output: ChainedOutput } {
  const token = step.token.toUpperCase();
  // We can't call previewStake without importing pool ABIs/addresses.
  // Use the input amount as-is — the real xToken amount comes at execution time.
  const decimals = 18; // all current infinity pool tokens are 18 decimals
  const rawAmount = resolveRawAmount(step.amount, decimals, prev) ?? 0n;

  return {
    computed: {
      stepNumber: 0,
      type: "infinityStake",
      action: `Stake ${fmt(rawAmount, decimals)} ${token} in InfinityPool`,
      toolToCall: "zealous_prepareInfinityStake",
      protocol: "ZealousSwap",
      estimatedInput: `${fmt(rawAmount, decimals)} ${token}`,
      estimatedOutput: `x${token} (calculated at execution)`,
      tokens: [token],
    },
    output: { token: `x${token}`, rawAmount, decimals },
  };
}

function processInfinityUnstake(
  step: { token: string; amount?: string },
  prev: ChainedOutput | null
): { computed: StrategyStep; output: ChainedOutput } {
  const token = step.token.toUpperCase();
  const decimals = 18;
  const rawAmount = resolveRawAmount(step.amount, decimals, prev) ?? 0n;

  return {
    computed: {
      stepNumber: 0,
      type: "infinityUnstake",
      action: `Unstake x${token} from InfinityPool`,
      toolToCall: "zealous_prepareInfinityUnstake",
      protocol: "ZealousSwap",
      estimatedInput: `${fmt(rawAmount, decimals)} x${token}`,
      estimatedOutput: `${token} (calculated at execution)`,
      tokens: [token],
    },
    output: { token, rawAmount, decimals },
  };
}

function processFarmUnstake(
  step: { pid: number },
  prev: ChainedOutput | null
): { computed: StrategyStep; output: ChainedOutput } {
  const lpAmount = prev?.rawAmount ?? 0n;
  const lpLabel = prev?.token ?? "LP tokens";
  const tokens = lpLabel.includes("/")
    ? lpLabel.replace(" LP", "").split("/").map((t) => t.trim())
    : [];

  return {
    computed: {
      stepNumber: 0,
      type: "farmUnstake",
      action: `Unstake from farm (PID ${step.pid})`,
      toolToCall: "zealous_prepareFarmUnstake",
      protocol: "ZealousSwap",
      estimatedInput: `${fmt(lpAmount, 18)} LP tokens`,
      estimatedOutput: `${lpLabel} + pending ZEAL rewards`,
      tokens,
      note: "Pending rewards auto-claimed on withdrawal",
    },
    output: { token: lpLabel, rawAmount: lpAmount, decimals: 18 },
  };
}

async function processRemoveLiquidity(
  step: { protocol: string; tokenA: string; tokenB: string; percentage?: number },
  prev: ChainedOutput | null
): Promise<{ computed: StrategyStep; output: ChainedOutput }> {
  const tokenA = step.tokenA.toUpperCase();
  const tokenB = step.tokenB.toUpperCase();
  const pct = step.percentage ?? 100;

  return {
    computed: {
      stepNumber: 0,
      type: "removeLiquidity",
      action: `Remove ${pct}% of ${tokenA}/${tokenB} liquidity`,
      toolToCall: "zealous_prepareRemoveLiquidity",
      protocol: PROTOCOL_DISPLAY[step.protocol] ?? step.protocol,
      estimatedInput: `${pct}% of LP tokens`,
      estimatedOutput: `${tokenA} + ${tokenB} (calculated at execution)`,
      tokens: [tokenA, tokenB],
    },
    output: { token: tokenA, rawAmount: prev?.rawAmount ?? 0n, decimals: 18 },
  };
}

// ── Main tool ──

export const strategyTools = {
  planStrategy: tool({
    description:
      "Create a multi-step DeFi strategy plan with real on-chain quotes. Use after researching options with discovery tools. Each step is computed with live data — swap quotes from DEX routers, LP amounts from pool reserves. Only use for 2+ step operations.",
    inputSchema: z.object({
      title: z.string().describe("Short title for the strategy (e.g. 'Farm KAS/ZEAL at 120% APY')"),
      summary: z
        .string()
        .describe("Brief explanation of why this strategy was chosen and what it achieves"),
      steps: z
        .array(
          z.object({
            stepNumber: z.number().describe("Sequential step number starting from 1"),
            type: z.enum(STRATEGY_STEP_TYPES).describe("Action type"),
            protocol: z.enum(["zealous", "kroko", "kaspacom"]).describe("Protocol ID"),
            tokenIn: z.string().optional().describe("Swap: input token symbol"),
            tokenOut: z.string().optional().describe("Swap: output token symbol"),
            amountIn: z.string().optional().describe("Swap: input amount or 'auto' to use previous step output"),
            tokenA: z.string().optional().describe("Liquidity: first token symbol"),
            tokenB: z.string().optional().describe("Liquidity: second token symbol"),
            amountA: z.string().optional().describe("Liquidity: amount of tokenA or 'auto'"),
            token: z.string().optional().describe("Staking: token symbol"),
            amount: z.string().optional().describe("Staking: amount or 'auto'"),
            pid: z.number().optional().describe("Farm: pool ID"),
            percentage: z.number().optional().describe("Remove liquidity: percentage (default 100)"),
          })
        )
        .min(2)
        .max(8)
        .describe("Ordered steps with structured parameters — the tool computes real amounts"),
      walletAddress: z.string().optional().describe("User wallet for discount-aware quotes"),
    }),
    execute: async ({ title, summary, steps, walletAddress }) => {
      // Validate sequential numbering
      for (let i = 0; i < steps.length; i++) {
        if (steps[i].stepNumber !== i + 1) {
          return {
            error: `Step numbering must be sequential. Got ${steps[i].stepNumber} at position ${i + 1}.`,
          } as StrategyPlanResult;
        }
      }

      const discount = walletAddress
        ? await checkDiscountEligibility(walletAddress)
        : { isEligible: false, source: "None" };

      let prev: ChainedOutput | null = null;
      const computedSteps: StrategyStep[] = [];
      let totalGas = 0;

      try {
        for (const step of steps) {
          let result: { computed: StrategyStep; output: ChainedOutput };

          try {
          switch (step.type) {
            case "swap": {
              if (!step.tokenIn || !step.tokenOut) {
                return { error: `Step ${step.stepNumber}: swap requires tokenIn and tokenOut` } as StrategyPlanResult;
              }
              result = await processSwap(
                { protocol: step.protocol, tokenIn: step.tokenIn, tokenOut: step.tokenOut, amountIn: step.amountIn },
                prev,
                discount.isEligible
              );
              totalGas += 0.01;
              break;
            }
            case "addLiquidity": {
              if (!step.tokenA || !step.tokenB) {
                return { error: `Step ${step.stepNumber}: addLiquidity requires tokenA and tokenB` } as StrategyPlanResult;
              }
              result = await processAddLiquidity(
                { protocol: step.protocol, tokenA: step.tokenA, tokenB: step.tokenB, amountA: step.amountA },
                prev
              );
              totalGas += 0.015;
              break;
            }
            case "removeLiquidity": {
              if (!step.tokenA || !step.tokenB) {
                return { error: `Step ${step.stepNumber}: removeLiquidity requires tokenA and tokenB` } as StrategyPlanResult;
              }
              result = await processRemoveLiquidity(
                { protocol: step.protocol, tokenA: step.tokenA, tokenB: step.tokenB, percentage: step.percentage },
                prev
              );
              totalGas += 0.015;
              break;
            }
            case "farmStake": {
              if (step.pid === undefined) {
                return { error: `Step ${step.stepNumber}: farmStake requires pid` } as StrategyPlanResult;
              }
              result = processFarmStake({ pid: step.pid }, prev);
              totalGas += 0.01;
              break;
            }
            case "farmUnstake": {
              if (step.pid === undefined) {
                return { error: `Step ${step.stepNumber}: farmUnstake requires pid` } as StrategyPlanResult;
              }
              result = processFarmUnstake({ pid: step.pid }, prev);
              totalGas += 0.01;
              break;
            }
            case "infinityStake": {
              if (!step.token) {
                return { error: `Step ${step.stepNumber}: infinityStake requires token` } as StrategyPlanResult;
              }
              result = processInfinityStake({ token: step.token, amount: step.amount }, prev);
              totalGas += 0.015;
              break;
            }
            case "infinityUnstake": {
              if (!step.token) {
                return { error: `Step ${step.stepNumber}: infinityUnstake requires token` } as StrategyPlanResult;
              }
              result = processInfinityUnstake({ token: step.token, amount: step.amount }, prev);
              totalGas += 0.015;
              break;
            }
            default:
              return { error: `Step ${step.stepNumber}: unknown type "${step.type}"` } as StrategyPlanResult;
          }

          result.computed.stepNumber = step.stepNumber;
          computedSteps.push(result.computed);
          prev = result.output;
          } catch (err) {
            return {
              error: `Step ${step.stepNumber} failed: ${err instanceof Error ? err.message : String(err)}`,
            } as StrategyPlanResult;
          }
        }
      } catch (err) {
        return {
          error: `Strategy computation failed: ${err instanceof Error ? err.message : String(err)}`,
        } as StrategyPlanResult;
      }

      return {
        title,
        summary,
        steps: computedSteps,
        estimatedTotalGas: `~${totalGas.toFixed(3)} KAS`,
        disclaimer:
          "Quotes fetched live from on-chain data. Actual amounts at execution may differ slightly due to price movement. You must approve each transaction individually. This is not financial advice.",
      } as StrategyPlanResult;
    },
  }),
};
