import { formatUnits, parseUnits } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { CONTRACTS } from "@/config/contracts";
import {
  factoryAbi,
  pairAbi,
} from "@/config/abis";
import type { RiskFlag, RiskLevel, ContractInfo } from "../../tool-types";
import {
  client,
  resolveTokenAddress,
  getTokenDecimals,
  estimateGasCost,
  calculateMinAmount,
  checkAllowance,
} from "../shared/helpers";
import { mcResult } from "@/lib/multicall";

export const zealousLiquidityTools = {
  zealous_getPoolReserves: tool({
    description:
      "Get the current reserves and liquidity for a trading pair on ZealousSwap.",
    inputSchema: z.object({
      tokenA: z.string().describe("Symbol of the first token"),
      tokenB: z.string().describe("Symbol of the second token"),
    }),
    execute: async ({ tokenA, tokenB }) => {
      const addressA = await resolveTokenAddress(tokenA);
      const addressB = await resolveTokenAddress(tokenB);
      if (!addressA || !addressB) {
        return { error: `Unknown token: ${!addressA ? tokenA : tokenB}` };
      }

      try {
        const pairAddress = await client.readContract({
          address: CONTRACTS.FACTORY,
          abi: factoryAbi,
          functionName: "getPair",
          args: [addressA, addressB],
        });

        if (
          pairAddress === "0x0000000000000000000000000000000000000000"
        ) {
          return { error: `No pair exists for ${tokenA}/${tokenB}` };
        }

        const mc = await client.multicall({
          contracts: [
            { address: pairAddress as `0x${string}`, abi: pairAbi, functionName: "getReserves" as const },
            { address: pairAddress as `0x${string}`, abi: pairAbi, functionName: "token0" as const },
            { address: pairAddress as `0x${string}`, abi: pairAbi, functionName: "totalSupply" as const },
          ],
          allowFailure: true,
        });

        const reserves = mcResult<[bigint, bigint, number]>(mc[0], [0n, 0n, 0]);
        const token0 = mcResult<string>(mc[1], "");
        const totalSupply = mcResult<bigint>(mc[2], 0n);

        const isToken0A = token0.toLowerCase() === addressA.toLowerCase();

        const decimalsA = await getTokenDecimals(tokenA);
        const decimalsB = await getTokenDecimals(tokenB);

        return {
          pair: `${tokenA}/${tokenB}`,
          pairAddress,
          reserveA: formatUnits(
            isToken0A ? reserves[0] : reserves[1],
            decimalsA
          ),
          reserveB: formatUnits(
            isToken0A ? reserves[1] : reserves[0],
            decimalsB
          ),
          totalLpSupply: formatUnits(totalSupply, 18),
        };
      } catch (e) {
        return {
          error: `Failed to get reserves: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),

  zealous_prepareAddLiquidity: tool({
    description:
      "Prepare an add-liquidity transaction for a ZealousSwap pair. Calculates optimal amounts, checks allowances, and returns tx params.",
    inputSchema: z.object({
      tokenA: z.string().describe("Symbol of the first token (e.g. KAS, ZEAL)"),
      tokenB: z.string().describe("Symbol of the second token (e.g. NACHO, KASPER)"),
      amountA: z.string().describe("Amount of tokenA in human-readable form"),
      amountB: z.string().optional().describe("Amount of tokenB (optional — calculated from reserves ratio if omitted)"),
      slippage: z.number().optional().default(0.5).describe("Slippage tolerance in percent (default 0.5)"),
      walletAddress: z.string().optional().describe("User wallet address for allowance check"),
    }),
    execute: async ({ tokenA, tokenB, amountA, amountB, slippage, walletAddress }) => {
      const addressA = await resolveTokenAddress(tokenA);
      const addressB = await resolveTokenAddress(tokenB);
      if (!addressA || !addressB) {
        return { error: `Unknown token: ${!addressA ? tokenA : tokenB}` };
      }
      if (addressA === addressB) {
        return { error: "Tokens must be different" };
      }

      const decimalsA = await getTokenDecimals(tokenA);
      const decimalsB = await getTokenDecimals(tokenB);
      const isNativeA = tokenA.toUpperCase() === "KAS";
      const isNativeB = tokenB.toUpperCase() === "KAS";
      const liquidityType: "KAS_TOKEN" | "TOKEN_TOKEN" = isNativeA || isNativeB ? "KAS_TOKEN" : "TOKEN_TOKEN";

      try {
        // Get pair and reserves
        const pairAddress = (await client.readContract({
          address: CONTRACTS.FACTORY,
          abi: factoryAbi,
          functionName: "getPair",
          args: [addressA, addressB],
        })) as `0x${string}`;

        const isNewPair = pairAddress === "0x0000000000000000000000000000000000000000";
        const rawAmountA = parseUnits(amountA, decimalsA);
        let rawAmountB: bigint;
        let computedAmountB: string;
        let estimatedLpTokens = "0";
        let poolShare = "0";

        // Pair reserve data — hoisted so risk flags can reuse without re-reading
        let pairR0 = 0n;
        let pairR1 = 0n;
        let pairIsToken0A = false;

        if (isNewPair) {
          if (!amountB) {
            return { error: "Both token amounts are required when creating a new pair" };
          }
          rawAmountB = parseUnits(amountB, decimalsB);
          computedAmountB = amountB;
          estimatedLpTokens = "first deposit";
          poolShare = "100";
        } else {
          const pairMc = await client.multicall({
            contracts: [
              { address: pairAddress, abi: pairAbi, functionName: "getReserves" as const },
              { address: pairAddress, abi: pairAbi, functionName: "token0" as const },
              { address: pairAddress, abi: pairAbi, functionName: "totalSupply" as const },
            ],
            allowFailure: true,
          });

          [pairR0, pairR1] = mcResult<[bigint, bigint, number]>(pairMc[0], [0n, 0n, 0]);
          pairIsToken0A = mcResult<string>(pairMc[1], "").toLowerCase() === addressA.toLowerCase();
          const reserveA = pairIsToken0A ? pairR0 : pairR1;
          const reserveB = pairIsToken0A ? pairR1 : pairR0;
          const lpTotalSupply = mcResult<bigint>(pairMc[2], 0n);

          if (amountB) {
            rawAmountB = parseUnits(amountB, decimalsB);
            computedAmountB = amountB;
          } else {
            rawAmountB = reserveA > 0n ? (rawAmountA * reserveB) / reserveA : 0n;
            computedAmountB = formatUnits(rawAmountB, decimalsB);
          }

          if (lpTotalSupply > 0n && reserveA > 0n && reserveB > 0n) {
            const lpFromA = (rawAmountA * lpTotalSupply) / reserveA;
            const lpFromB = (rawAmountB * lpTotalSupply) / reserveB;
            const lpTokens = lpFromA < lpFromB ? lpFromA : lpFromB;
            estimatedLpTokens = formatUnits(lpTokens, 18);
            const newTotal = lpTotalSupply + lpTokens;
            poolShare = newTotal > 0n ? ((Number(lpTokens) / Number(newTotal)) * 100).toFixed(2) : "0";
          }
        }

        const rawAmountAMin = calculateMinAmount(rawAmountA, slippage);
        const rawAmountBMin = calculateMinAmount(rawAmountB, slippage);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

        // Check allowances
        let needsApprovalA = false;
        let needsApprovalB = false;
        let currentAllowanceA = "0";
        let currentAllowanceB = "0";

        if (walletAddress) {
          if (!isNativeA && addressA) {
            ({ needsApproval: needsApprovalA, currentAllowance: currentAllowanceA } = await checkAllowance(
              addressA,
              walletAddress as `0x${string}`,
              CONTRACTS.ROUTER,
              rawAmountA
            ));
          }
          if (!isNativeB && addressB) {
            ({ needsApproval: needsApprovalB, currentAllowance: currentAllowanceB } = await checkAllowance(
              addressB,
              walletAddress as `0x${string}`,
              CONTRACTS.ROUTER,
              rawAmountB
            ));
          }
        }

        // Gas estimate
        const gasEstimate = await estimateGasCost(200000n, "0.03");

        // Risk flags
        const riskFlags: RiskFlag[] = [
          { type: "impermanent_loss", label: "Impermanent loss risk applies to all LP positions", severity: "medium" as RiskLevel },
        ];
        if (isNewPair) {
          riskFlags.push({ type: "new_pair", label: "Creating a new liquidity pair", severity: "medium" as RiskLevel });
        }
        if (!isNewPair) {
          const reserveA = pairIsToken0A ? pairR0 : pairR1;
          const reserveB = pairIsToken0A ? pairR1 : pairR0;
          if (reserveA > 0n && reserveB > 0n) {
            const optimalB = (rawAmountA * reserveB) / reserveA;
            const diff = rawAmountB > optimalB ? rawAmountB - optimalB : optimalB - rawAmountB;
            const pctDiff = Number((diff * 10000n) / optimalB) / 100;
            if (pctDiff > 5) {
              riskFlags.push({ type: "unbalanced_deposit", label: `Deposit is ${pctDiff.toFixed(1)}% off optimal ratio`, severity: "medium" as RiskLevel });
            }
          }
          const resIn = Number(formatUnits(pairIsToken0A ? pairR0 : pairR1, decimalsA));
          const resOut = Number(formatUnits(pairIsToken0A ? pairR1 : pairR0, decimalsB));
          if (resIn < 1000 || resOut < 1000) {
            riskFlags.push({ type: "low_liquidity", label: "Low pool liquidity", severity: "high" as RiskLevel });
          }
        }

        const fnName = liquidityType === "KAS_TOKEN" ? "addLiquidityKAS" : "addLiquidity";
        const contractInfo: ContractInfo = {
          address: CONTRACTS.ROUTER,
          functionName: fnName,
          description: `Add liquidity to ${tokenA}/${tokenB} pool via ZealousSwap Router`,
        };

        let txValue = "0";
        if (isNativeA) txValue = rawAmountA.toString();
        else if (isNativeB) txValue = rawAmountB.toString();

        return {
          tokenA,
          tokenB,
          amountA,
          amountB: computedAmountB,
          amountAMin: formatUnits(rawAmountAMin, decimalsA),
          amountBMin: formatUnits(rawAmountBMin, decimalsB),
          slippage,
          estimatedLpTokens,
          poolShare,
          liquidityType,
          needsApprovalA,
          needsApprovalB,
          currentAllowanceA,
          currentAllowanceB,
          gasEstimate,
          riskFlags,
          contractInfo,
          tx: {
            router: CONTRACTS.ROUTER,
            tokenAAddress: addressA,
            tokenBAddress: addressB,
            rawAmountADesired: rawAmountA.toString(),
            rawAmountBDesired: rawAmountB.toString(),
            rawAmountAMin: rawAmountAMin.toString(),
            rawAmountBMin: rawAmountBMin.toString(),
            deadline: deadline.toString(),
            value: txValue,
          },
        };
      } catch (e) {
        return { error: `Failed to prepare add liquidity: ${e instanceof Error ? e.message : "Unknown error"}` };
      }
    },
  }),

  zealous_prepareRemoveLiquidity: tool({
    description:
      "Prepare a remove-liquidity transaction for a ZealousSwap pair. Calculates expected token outputs.",
    inputSchema: z.object({
      tokenA: z.string().describe("Symbol of the first token"),
      tokenB: z.string().describe("Symbol of the second token"),
      percentage: z.number().optional().default(100).describe("Percentage of LP to remove (1-100, default 100)"),
      slippage: z.number().optional().default(0.5).describe("Slippage tolerance in percent (default 0.5)"),
      walletAddress: z.string().optional().describe("User wallet address"),
    }),
    execute: async ({ tokenA, tokenB, percentage, slippage, walletAddress }) => {
      const addressA = await resolveTokenAddress(tokenA);
      const addressB = await resolveTokenAddress(tokenB);
      if (!addressA || !addressB) {
        return { error: `Unknown token: ${!addressA ? tokenA : tokenB}` };
      }

      const decimalsA = await getTokenDecimals(tokenA);
      const decimalsB = await getTokenDecimals(tokenB);
      const isNativeA = tokenA.toUpperCase() === "KAS";
      const isNativeB = tokenB.toUpperCase() === "KAS";
      const liquidityType: "KAS_TOKEN" | "TOKEN_TOKEN" = isNativeA || isNativeB ? "KAS_TOKEN" : "TOKEN_TOKEN";

      try {
        const pairAddress = (await client.readContract({
          address: CONTRACTS.FACTORY,
          abi: factoryAbi,
          functionName: "getPair",
          args: [addressA, addressB],
        })) as `0x${string}`;

        if (pairAddress === "0x0000000000000000000000000000000000000000") {
          return { error: `No pair exists for ${tokenA}/${tokenB}` };
        }

        if (!walletAddress) {
          return { error: "Wallet address is required for remove liquidity" };
        }

        const removeMc = await client.multicall({
          contracts: [
            { address: pairAddress, abi: pairAbi, functionName: "balanceOf" as const, args: [walletAddress as `0x${string}`] as const },
            { address: pairAddress, abi: pairAbi, functionName: "getReserves" as const },
            { address: pairAddress, abi: pairAbi, functionName: "token0" as const },
            { address: pairAddress, abi: pairAbi, functionName: "totalSupply" as const },
          ],
          allowFailure: true,
        });

        const lpBalance = mcResult<bigint>(removeMc[0], 0n);
        if (lpBalance === 0n) {
          return { error: `You have no LP tokens for ${tokenA}/${tokenB}` };
        }

        const clampedPct = Math.min(100, Math.max(1, percentage));
        const lpToRemove = (lpBalance * BigInt(clampedPct)) / 100n;

        const [r0, r1] = mcResult<[bigint, bigint, number]>(removeMc[1], [0n, 0n, 0]);
        const lpTotal = mcResult<bigint>(removeMc[3], 0n);
        const isToken0A = mcResult<string>(removeMc[2], "").toLowerCase() === addressA.toLowerCase();
        const reserveA = isToken0A ? r0 : r1;
        const reserveB = isToken0A ? r1 : r0;

        const expectedA = (lpToRemove * reserveA) / lpTotal;
        const expectedB = (lpToRemove * reserveB) / lpTotal;

        const rawAmountAMin = calculateMinAmount(expectedA, slippage);
        const rawAmountBMin = calculateMinAmount(expectedB, slippage);
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

        const { needsApproval, currentAllowance } = await checkAllowance(
          pairAddress,
          walletAddress as `0x${string}`,
          CONTRACTS.ROUTER,
          lpToRemove
        );

        const gasEstimate = await estimateGasCost(180000n, "0.025");

        const riskFlags: RiskFlag[] = [];
        const resA = Number(formatUnits(reserveA, decimalsA));
        const resB = Number(formatUnits(reserveB, decimalsB));
        if (resA < 1000 || resB < 1000) {
          riskFlags.push({ type: "low_liquidity", label: "Low pool liquidity — may receive less than expected", severity: "high" as RiskLevel });
        }
        if (slippage > 1) {
          riskFlags.push({ type: "high_slippage", label: `High slippage tolerance (${slippage}%)`, severity: "medium" as RiskLevel });
        }

        const fnName = liquidityType === "KAS_TOKEN" ? "removeLiquidityKAS" : "removeLiquidity";
        const contractInfo: ContractInfo = {
          address: CONTRACTS.ROUTER,
          functionName: fnName,
          description: `Remove liquidity from ${tokenA}/${tokenB} pool via ZealousSwap Router`,
        };

        return {
          tokenA,
          tokenB,
          lpAmount: formatUnits(lpToRemove, 18),
          percentage: clampedPct,
          expectedAmountA: formatUnits(expectedA, decimalsA),
          expectedAmountB: formatUnits(expectedB, decimalsB),
          amountAMin: formatUnits(rawAmountAMin, decimalsA),
          amountBMin: formatUnits(rawAmountBMin, decimalsB),
          slippage,
          liquidityType,
          needsApproval,
          currentAllowance,
          gasEstimate,
          riskFlags,
          contractInfo,
          tx: {
            router: CONTRACTS.ROUTER,
            tokenAAddress: addressA,
            tokenBAddress: addressB,
            pairAddress,
            rawLpAmount: lpToRemove.toString(),
            rawAmountAMin: rawAmountAMin.toString(),
            rawAmountBMin: rawAmountBMin.toString(),
            deadline: deadline.toString(),
          },
        };
      } catch (e) {
        return { error: `Failed to prepare remove liquidity: ${e instanceof Error ? e.message : "Unknown error"}` };
      }
    },
  }),
};
