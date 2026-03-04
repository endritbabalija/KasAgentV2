import { createPublicClient, http, formatUnits, parseUnits, formatEther } from "viem";
import { z } from "zod";
import { tool } from "ai";
import { kasplexL2 } from "@/config/chains";
import { CONTRACTS } from "@/config/contracts";
import { KASPLEX_TOKENS } from "@/config/tokens";
import {
  routerAbi,
  factoryAbi,
  pairAbi,
  erc20Abi,
  masterchefAbi,
  infinityPoolZealAbi,
  infinityPoolNachoAbi,
  infinityPoolKasperAbi,
} from "@/config/abis";
import type {
  YieldOpportunity,
  RiskFlag,
  RiskLevel,
  ContractInfo,
} from "./tool-types";

const client = createPublicClient({
  chain: kasplexL2,
  transport: http(),
});

function resolveTokenAddress(symbol: string): `0x${string}` | null {
  const token = KASPLEX_TOKENS.find(
    (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
  );
  if (!token) return null;
  if (token.isNative) return CONTRACTS.WKAS;
  return token.address;
}

function getTokenDecimals(symbol: string): number {
  const token = KASPLEX_TOKENS.find(
    (t) => t.symbol.toUpperCase() === symbol.toUpperCase()
  );
  return token?.decimals ?? 18;
}

async function calculatePriceImpact(
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

    const [reserve0, reserve1] = reserves as [bigint, bigint, number];
    const isToken0In =
      (token0 as string).toLowerCase() === addressIn.toLowerCase();
    const reserveIn = isToken0In ? reserve0 : reserve1;
    const reserveOut = isToken0In ? reserve1 : reserve0;

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

export const aiTools = {
  getSwapQuote: tool({
    description:
      "Get a swap quote for exchanging one token for another on ZealousSwap. Returns the expected output amount. Supported tokens: KAS, WKAS, ZEAL, NACHO, KASPER.",
    inputSchema: z.object({
      tokenIn: z
        .string()
        .describe("Symbol of the input token (e.g. KAS, ZEAL)"),
      tokenOut: z
        .string()
        .describe("Symbol of the output token (e.g. NACHO, KASPER)"),
      amountIn: z
        .string()
        .describe("Amount of input token in human-readable form (e.g. '10')"),
    }),
    execute: async ({ tokenIn, tokenOut, amountIn }) => {
      const addressIn = resolveTokenAddress(tokenIn);
      const addressOut = resolveTokenAddress(tokenOut);
      if (!addressIn || !addressOut) {
        return {
          error: `Unknown token: ${!addressIn ? tokenIn : tokenOut}. Supported: KAS, WKAS, ZEAL, NACHO, KASPER`,
        };
      }
      if (addressIn === addressOut) {
        return { error: "Input and output tokens must be different" };
      }

      const decimalsIn = getTokenDecimals(tokenIn);
      const decimalsOut = getTokenDecimals(tokenOut);
      const rawAmount = parseUnits(amountIn, decimalsIn);

      try {
        const amounts = await client.readContract({
          address: CONTRACTS.ROUTER,
          abi: routerAbi,
          functionName: "getAmountsOut",
          args: [rawAmount, [addressIn, addressOut], false],
        });

        const amountOut = amounts[amounts.length - 1];
        return {
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: formatUnits(amountOut, decimalsOut),
          path: [addressIn, addressOut],
        };
      } catch (e) {
        return {
          error: `Failed to get quote: ${e instanceof Error ? e.message : "No liquidity or invalid pair"}`,
        };
      }
    },
  }),

  getPoolReserves: tool({
    description:
      "Get the current reserves and liquidity for a trading pair on ZealousSwap. Supported tokens: KAS, WKAS, ZEAL, NACHO, KASPER.",
    inputSchema: z.object({
      tokenA: z.string().describe("Symbol of the first token"),
      tokenB: z.string().describe("Symbol of the second token"),
    }),
    execute: async ({ tokenA, tokenB }) => {
      const addressA = resolveTokenAddress(tokenA);
      const addressB = resolveTokenAddress(tokenB);
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

        const [reserves, token0, totalSupply] = await Promise.all([
          client.readContract({
            address: pairAddress as `0x${string}`,
            abi: pairAbi,
            functionName: "getReserves",
          }),
          client.readContract({
            address: pairAddress as `0x${string}`,
            abi: pairAbi,
            functionName: "token0",
          }),
          client.readContract({
            address: pairAddress as `0x${string}`,
            abi: pairAbi,
            functionName: "totalSupply",
          }),
        ]);

        const isToken0A =
          (token0 as string).toLowerCase() === addressA.toLowerCase();

        return {
          pair: `${tokenA}/${tokenB}`,
          pairAddress,
          reserveA: formatUnits(
            isToken0A
              ? (reserves as [bigint, bigint, number])[0]
              : (reserves as [bigint, bigint, number])[1],
            getTokenDecimals(tokenA)
          ),
          reserveB: formatUnits(
            isToken0A
              ? (reserves as [bigint, bigint, number])[1]
              : (reserves as [bigint, bigint, number])[0],
            getTokenDecimals(tokenB)
          ),
          totalLpSupply: formatUnits(totalSupply as bigint, 18),
        };
      } catch (e) {
        return {
          error: `Failed to get reserves: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),

  getActiveFarms: tool({
    description:
      "Get a list of all active farming pools on ZealousSwap MasterChef, including allocation points and total deposits.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const [activePools, rewardPerBlock, totalAllocPoint, rewardToken] =
          await Promise.all([
            client.readContract({
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "getActivePools",
            }),
            client.readContract({
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "rewardPerBlock",
            }),
            client.readContract({
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "totalAllocPoint",
            }),
            client.readContract({
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "rewardToken",
            }),
          ]);

        const poolIds = (activePools as bigint[]).map(Number);
        const poolInfos = await Promise.all(
          poolIds.map((pid) =>
            client.readContract({
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "getPoolInfo",
              args: [BigInt(pid)],
            })
          )
        );

        const rewardTokenSymbol =
          KASPLEX_TOKENS.find(
            (t) =>
              t.address?.toLowerCase() ===
              (rewardToken as string).toLowerCase()
          )?.symbol ?? (rewardToken as string);

        const farms = poolIds.map((pid, i) => {
          const info = poolInfos[i] as readonly [
            string,
            bigint,
            bigint,
            bigint,
            bigint,
            boolean,
            boolean,
            bigint,
          ];
          return {
            pid,
            lpToken: info[0],
            allocPoint: info[1].toString(),
            totalDeposited: formatUnits(info[4], 18),
            isActive: info[5],
            poolShareBps: info[7].toString(),
          };
        });

        return {
          rewardToken: rewardTokenSymbol,
          rewardPerBlock: formatUnits(rewardPerBlock as bigint, 18),
          totalAllocPoint: (totalAllocPoint as bigint).toString(),
          farms,
        };
      } catch (e) {
        return {
          error: `Failed to fetch farms: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),

  getInfinityPoolRates: tool({
    description:
      "Get the current exchange rates, total staked amounts, and emission info for all InfinityPool staking pools (ZEAL, NACHO, KASPER).",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const [
          zealRate,
          zealStaked,
          zealPerBlock,
          zealPaused,
          nachoRate,
          nachoStaked,
          kasperRate,
          kasperStaked,
        ] = await Promise.all([
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_ZEAL,
            abi: infinityPoolZealAbi,
            functionName: "getExchangeRate",
          }),
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_ZEAL,
            abi: infinityPoolZealAbi,
            functionName: "totalStaked",
          }),
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_ZEAL,
            abi: infinityPoolZealAbi,
            functionName: "zealPerBlock",
          }),
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_ZEAL,
            abi: infinityPoolZealAbi,
            functionName: "emissionsPaused",
          }),
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_NACHO,
            abi: infinityPoolNachoAbi,
            functionName: "getExchangeRate",
          }),
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_NACHO,
            abi: infinityPoolNachoAbi,
            functionName: "totalStaked",
          }),
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_KASPER,
            abi: infinityPoolKasperAbi,
            functionName: "getExchangeRate",
          }),
          client.readContract({
            address: CONTRACTS.INFINITY_POOL_KASPER,
            abi: infinityPoolKasperAbi,
            functionName: "totalStaked",
          }),
        ]);

        return {
          pools: [
            {
              name: "ZEAL",
              exchangeRate: formatUnits(zealRate as bigint, 18),
              totalStaked: formatUnits(zealStaked as bigint, 18),
              zealPerBlock: formatUnits(zealPerBlock as bigint, 18),
              emissionsPaused: zealPaused as boolean,
            },
            {
              name: "NACHO",
              exchangeRate: formatUnits(nachoRate as bigint, 18),
              totalStaked: formatUnits(nachoStaked as bigint, 18),
            },
            {
              name: "KASPER",
              exchangeRate: formatUnits(kasperRate as bigint, 18),
              totalStaked: formatUnits(kasperStaked as bigint, 18),
            },
          ],
        };
      } catch (e) {
        return {
          error: `Failed to fetch InfinityPool rates: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),

  prepareSwap: tool({
    description:
      "Prepare a token swap transaction for the user to execute in their wallet. Returns all transaction parameters needed for on-chain execution. Use this when the user wants to actually swap tokens (not just check prices). Supported tokens: KAS, WKAS, ZEAL, NACHO, KASPER.",
    inputSchema: z.object({
      tokenIn: z
        .string()
        .describe("Symbol of the input token (e.g. KAS, ZEAL)"),
      tokenOut: z
        .string()
        .describe("Symbol of the output token (e.g. NACHO, KASPER)"),
      amountIn: z
        .string()
        .describe("Amount of input token in human-readable form (e.g. '10')"),
      slippage: z
        .number()
        .optional()
        .default(0.5)
        .describe("Slippage tolerance in percent (default 0.5)"),
      walletAddress: z
        .string()
        .optional()
        .describe("User wallet address for allowance check"),
    }),
    execute: async ({ tokenIn, tokenOut, amountIn, slippage, walletAddress }) => {
      const addressIn = resolveTokenAddress(tokenIn);
      const addressOut = resolveTokenAddress(tokenOut);
      if (!addressIn || !addressOut) {
        return {
          error: `Unknown token: ${!addressIn ? tokenIn : tokenOut}. Supported: KAS, WKAS, ZEAL, NACHO, KASPER`,
        };
      }
      if (addressIn === addressOut) {
        return { error: "Input and output tokens must be different" };
      }

      const decimalsIn = getTokenDecimals(tokenIn);
      const decimalsOut = getTokenDecimals(tokenOut);
      const rawAmountIn = parseUnits(amountIn, decimalsIn);

      const isNativeIn = tokenIn.toUpperCase() === "KAS";
      const isNativeOut = tokenOut.toUpperCase() === "KAS";
      const swapType: "KAS_TO_TOKEN" | "TOKEN_TO_KAS" | "TOKEN_TO_TOKEN" =
        isNativeIn ? "KAS_TO_TOKEN" : isNativeOut ? "TOKEN_TO_KAS" : "TOKEN_TO_TOKEN";

      try {
        const amounts = (await client.readContract({
          address: CONTRACTS.ROUTER,
          abi: routerAbi,
          functionName: "getAmountsOut",
          args: [rawAmountIn, [addressIn, addressOut], false],
        })) as bigint[];

        const rawAmountOut = amounts[amounts.length - 1];
        const slippageBps = BigInt(Math.round(slippage * 100));
        const rawAmountOutMin =
          rawAmountOut - (rawAmountOut * slippageBps) / 10000n;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

        // Check allowance for ERC-20 inputs
        let needsApproval = false;
        let currentAllowance = "0";
        if (!isNativeIn && walletAddress) {
          const tokenAddress = KASPLEX_TOKENS.find(
            (t) => t.symbol.toUpperCase() === tokenIn.toUpperCase()
          )?.address;
          if (tokenAddress) {
            const allowance = (await client.readContract({
              address: tokenAddress,
              abi: erc20Abi,
              functionName: "allowance",
              args: [
                walletAddress as `0x${string}`,
                CONTRACTS.ROUTER,
              ],
            })) as bigint;
            currentAllowance = allowance.toString();
            needsApproval = allowance < rawAmountIn;
          }
        }

        // Price impact
        const priceImpact = await calculatePriceImpact(
          addressIn,
          addressOut,
          rawAmountIn,
          rawAmountOut
        );

        // Gas estimation
        let gasEstimate = "0.0214"; // fallback
        try {
          const gasPrice = await client.getGasPrice();
          const gasUnits = 150000n; // conservative estimate for swap tx
          const gasCostWei = gasUnits * gasPrice;
          gasEstimate = formatEther(gasCostWei);
        } catch {
          // keep fallback
        }

        // DEX fee in token amount
        const parsedAmountIn = parseFloat(amountIn);
        const feeAmount = isNaN(parsedAmountIn) ? 0 : parsedAmountIn * 0.003;
        const dexFeeAmount = `${feeAmount.toFixed(feeAmount >= 1 ? 4 : 8)} ${tokenIn.toUpperCase()}`;

        // Risk flags
        const riskFlags: RiskFlag[] = [];
        const impactNum = parseFloat(priceImpact);
        if (impactNum > 3) {
          riskFlags.push({ type: "high_price_impact", label: `High price impact (${priceImpact}%)`, severity: "high" });
        } else if (impactNum > 1) {
          riskFlags.push({ type: "moderate_price_impact", label: `Moderate price impact (${priceImpact}%)`, severity: "medium" });
        }

        // Check pool liquidity
        try {
          const pairAddress = (await client.readContract({
            address: CONTRACTS.FACTORY,
            abi: factoryAbi,
            functionName: "getPair",
            args: [addressIn, addressOut],
          })) as `0x${string}`;

          if (pairAddress !== "0x0000000000000000000000000000000000000000") {
            const [reserves, token0] = await Promise.all([
              client.readContract({ address: pairAddress, abi: pairAbi, functionName: "getReserves" }),
              client.readContract({ address: pairAddress, abi: pairAbi, functionName: "token0" }),
            ]);
            const [r0, r1] = reserves as [bigint, bigint, number];
            const isToken0In = (token0 as string).toLowerCase() === addressIn.toLowerCase();
            const reserveIn = Number(formatUnits(isToken0In ? r0 : r1, decimalsIn));
            const reserveOut = Number(formatUnits(isToken0In ? r1 : r0, decimalsOut));
            if (reserveIn < 1000 || reserveOut < 1000) {
              riskFlags.push({ type: "low_liquidity", label: "Low pool liquidity", severity: "high" });
            }
          }
        } catch {
          // skip liquidity check on error
        }

        if (slippage > 1) {
          riskFlags.push({ type: "high_slippage", label: `High slippage tolerance (${slippage}%)`, severity: "medium" });
        }

        // Contract interaction info
        const contractInfoMap: Record<string, { functionName: string; description: string }> = {
          KAS_TO_TOKEN: { functionName: "swapExactKASForTokens", description: "Swap exact KAS for tokens via ZealousSwap Router" },
          TOKEN_TO_KAS: { functionName: "swapTokensForExactKAS", description: "Swap tokens for KAS via ZealousSwap Router" },
          TOKEN_TO_TOKEN: { functionName: "swapExactTokensForTokens", description: "Swap tokens for tokens via ZealousSwap Router" },
        };
        const contractInfo: ContractInfo = {
          address: CONTRACTS.ROUTER,
          ...contractInfoMap[swapType],
        };

        return {
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: formatUnits(rawAmountOut, decimalsOut),
          amountOutMin: formatUnits(rawAmountOutMin, decimalsOut),
          slippage,
          priceImpact,
          dexFee: "0.3",
          gasEstimate,
          dexFeeAmount,
          riskFlags,
          contractInfo,
          swapType,
          needsApproval,
          currentAllowance,
          tx: {
            router: CONTRACTS.ROUTER,
            tokenInAddress: addressIn,
            tokenOutAddress: addressOut,
            rawAmountIn: rawAmountIn.toString(),
            rawAmountOut: rawAmountOut.toString(),
            rawAmountOutMin: rawAmountOutMin.toString(),
            path: [addressIn, addressOut],
            deadline: deadline.toString(),
            value: isNativeIn ? rawAmountIn.toString() : "0",
          },
        };
      } catch (e) {
        return {
          error: `Failed to prepare swap: ${e instanceof Error ? e.message : "No liquidity or invalid pair"}`,
        };
      }
    },
  }),

  prepareAddLiquidity: tool({
    description:
      "Prepare an add-liquidity transaction for a ZealousSwap pair. Calculates optimal amounts, checks allowances, and returns tx params. Supported tokens: KAS, WKAS, ZEAL, NACHO, KASPER.",
    inputSchema: z.object({
      tokenA: z.string().describe("Symbol of the first token (e.g. KAS, ZEAL)"),
      tokenB: z.string().describe("Symbol of the second token (e.g. NACHO, KASPER)"),
      amountA: z.string().describe("Amount of tokenA in human-readable form"),
      amountB: z.string().optional().describe("Amount of tokenB (optional — calculated from reserves ratio if omitted)"),
      slippage: z.number().optional().default(0.5).describe("Slippage tolerance in percent (default 0.5)"),
      walletAddress: z.string().optional().describe("User wallet address for allowance check"),
    }),
    execute: async ({ tokenA, tokenB, amountA, amountB, slippage, walletAddress }) => {
      const addressA = resolveTokenAddress(tokenA);
      const addressB = resolveTokenAddress(tokenB);
      if (!addressA || !addressB) {
        return { error: `Unknown token: ${!addressA ? tokenA : tokenB}. Supported: KAS, WKAS, ZEAL, NACHO, KASPER` };
      }
      if (addressA === addressB) {
        return { error: "Tokens must be different" };
      }

      const decimalsA = getTokenDecimals(tokenA);
      const decimalsB = getTokenDecimals(tokenB);
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

        if (isNewPair) {
          // New pair: both amounts required
          if (!amountB) {
            return { error: "Both token amounts are required when creating a new pair" };
          }
          rawAmountB = parseUnits(amountB, decimalsB);
          computedAmountB = amountB;
          estimatedLpTokens = "first deposit";
          poolShare = "100";
        } else {
          // Existing pair: calculate optimal B from reserves
          const [reserves, token0, totalSupply] = await Promise.all([
            client.readContract({ address: pairAddress, abi: pairAbi, functionName: "getReserves" }),
            client.readContract({ address: pairAddress, abi: pairAbi, functionName: "token0" }),
            client.readContract({ address: pairAddress, abi: pairAbi, functionName: "totalSupply" }),
          ]);

          const [r0, r1] = reserves as [bigint, bigint, number];
          const isToken0A = (token0 as string).toLowerCase() === addressA.toLowerCase();
          const reserveA = isToken0A ? r0 : r1;
          const reserveB = isToken0A ? r1 : r0;
          const lpTotalSupply = totalSupply as bigint;

          if (amountB) {
            rawAmountB = parseUnits(amountB, decimalsB);
            computedAmountB = amountB;
          } else {
            // Calculate optimal amountB: amountA * reserveB / reserveA
            rawAmountB = reserveA > 0n ? (rawAmountA * reserveB) / reserveA : 0n;
            computedAmountB = formatUnits(rawAmountB, decimalsB);
          }

          // Estimate LP tokens: min(amountA * totalSupply / reserveA, amountB * totalSupply / reserveB)
          if (lpTotalSupply > 0n && reserveA > 0n && reserveB > 0n) {
            const lpFromA = (rawAmountA * lpTotalSupply) / reserveA;
            const lpFromB = (rawAmountB * lpTotalSupply) / reserveB;
            const lpTokens = lpFromA < lpFromB ? lpFromA : lpFromB;
            estimatedLpTokens = formatUnits(lpTokens, 18);
            const newTotal = lpTotalSupply + lpTokens;
            poolShare = newTotal > 0n ? ((Number(lpTokens) / Number(newTotal)) * 100).toFixed(2) : "0";
          }
        }

        const slippageBps = BigInt(Math.round(slippage * 100));
        const rawAmountAMin = rawAmountA - (rawAmountA * slippageBps) / 10000n;
        const rawAmountBMin = rawAmountB - (rawAmountB * slippageBps) / 10000n;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

        // Check allowances
        let needsApprovalA = false;
        let needsApprovalB = false;
        let currentAllowanceA = "0";
        let currentAllowanceB = "0";

        if (walletAddress) {
          if (!isNativeA) {
            const tokenAddr = KASPLEX_TOKENS.find(t => t.symbol.toUpperCase() === tokenA.toUpperCase())?.address;
            if (tokenAddr) {
              const allowance = (await client.readContract({
                address: tokenAddr,
                abi: erc20Abi,
                functionName: "allowance",
                args: [walletAddress as `0x${string}`, CONTRACTS.ROUTER],
              })) as bigint;
              currentAllowanceA = allowance.toString();
              needsApprovalA = allowance < rawAmountA;
            }
          }
          if (!isNativeB) {
            const tokenAddr = KASPLEX_TOKENS.find(t => t.symbol.toUpperCase() === tokenB.toUpperCase())?.address;
            if (tokenAddr) {
              const allowance = (await client.readContract({
                address: tokenAddr,
                abi: erc20Abi,
                functionName: "allowance",
                args: [walletAddress as `0x${string}`, CONTRACTS.ROUTER],
              })) as bigint;
              currentAllowanceB = allowance.toString();
              needsApprovalB = allowance < rawAmountB;
            }
          }
        }

        // Gas estimate
        let gasEstimate = "0.03";
        try {
          const gasPrice = await client.getGasPrice();
          gasEstimate = formatEther(200000n * gasPrice);
        } catch { /* keep fallback */ }

        // Risk flags
        const riskFlags: RiskFlag[] = [
          { type: "impermanent_loss", label: "Impermanent loss risk applies to all LP positions", severity: "medium" as RiskLevel },
        ];
        if (isNewPair) {
          riskFlags.push({ type: "new_pair", label: "Creating a new liquidity pair", severity: "medium" as RiskLevel });
        }
        if (!isNewPair) {
          // Check for unbalanced deposit
          try {
            const pairReserves = (await client.readContract({ address: pairAddress, abi: pairAbi, functionName: "getReserves" })) as [bigint, bigint, number];
            const token0 = (await client.readContract({ address: pairAddress, abi: pairAbi, functionName: "token0" })) as string;
            const isT0A = token0.toLowerCase() === addressA.toLowerCase();
            const rA = isT0A ? pairReserves[0] : pairReserves[1];
            const rB = isT0A ? pairReserves[1] : pairReserves[0];
            if (rA > 0n && rB > 0n) {
              const optimalB = (rawAmountA * rB) / rA;
              const diff = rawAmountB > optimalB ? rawAmountB - optimalB : optimalB - rawAmountB;
              const pctDiff = Number((diff * 10000n) / optimalB) / 100;
              if (pctDiff > 5) {
                riskFlags.push({ type: "unbalanced_deposit", label: `Deposit is ${pctDiff.toFixed(1)}% off optimal ratio`, severity: "medium" as RiskLevel });
              }
            }
            const resIn = Number(formatUnits(isT0A ? pairReserves[0] : pairReserves[1], decimalsA));
            const resOut = Number(formatUnits(isT0A ? pairReserves[1] : pairReserves[0], decimalsB));
            if (resIn < 1000 || resOut < 1000) {
              riskFlags.push({ type: "low_liquidity", label: "Low pool liquidity", severity: "high" as RiskLevel });
            }
          } catch { /* skip */ }
        }

        const fnName = liquidityType === "KAS_TOKEN" ? "addLiquidityKAS" : "addLiquidity";
        const contractInfo: ContractInfo = {
          address: CONTRACTS.ROUTER,
          functionName: fnName,
          description: `Add liquidity to ${tokenA}/${tokenB} pool via ZealousSwap Router`,
        };

        // For KAS_TOKEN, native side goes as value
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

  prepareRemoveLiquidity: tool({
    description:
      "Prepare a remove-liquidity transaction for a ZealousSwap pair. Calculates expected token outputs. Supported tokens: KAS, WKAS, ZEAL, NACHO, KASPER.",
    inputSchema: z.object({
      tokenA: z.string().describe("Symbol of the first token"),
      tokenB: z.string().describe("Symbol of the second token"),
      percentage: z.number().optional().default(100).describe("Percentage of LP to remove (1-100, default 100)"),
      slippage: z.number().optional().default(0.5).describe("Slippage tolerance in percent (default 0.5)"),
      walletAddress: z.string().optional().describe("User wallet address"),
    }),
    execute: async ({ tokenA, tokenB, percentage, slippage, walletAddress }) => {
      const addressA = resolveTokenAddress(tokenA);
      const addressB = resolveTokenAddress(tokenB);
      if (!addressA || !addressB) {
        return { error: `Unknown token: ${!addressA ? tokenA : tokenB}. Supported: KAS, WKAS, ZEAL, NACHO, KASPER` };
      }

      const decimalsA = getTokenDecimals(tokenA);
      const decimalsB = getTokenDecimals(tokenB);
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

        const [userLpBalance, reserves, token0, totalSupply] = await Promise.all([
          client.readContract({ address: pairAddress, abi: pairAbi, functionName: "balanceOf", args: [walletAddress as `0x${string}`] }),
          client.readContract({ address: pairAddress, abi: pairAbi, functionName: "getReserves" }),
          client.readContract({ address: pairAddress, abi: pairAbi, functionName: "token0" }),
          client.readContract({ address: pairAddress, abi: pairAbi, functionName: "totalSupply" }),
        ]);

        const lpBalance = userLpBalance as bigint;
        if (lpBalance === 0n) {
          return { error: `You have no LP tokens for ${tokenA}/${tokenB}` };
        }

        const clampedPct = Math.min(100, Math.max(1, percentage));
        const lpToRemove = (lpBalance * BigInt(clampedPct)) / 100n;

        const [r0, r1] = reserves as [bigint, bigint, number];
        const lpTotal = totalSupply as bigint;
        const isToken0A = (token0 as string).toLowerCase() === addressA.toLowerCase();
        const reserveA = isToken0A ? r0 : r1;
        const reserveB = isToken0A ? r1 : r0;

        // Expected amounts: lpToRemove * reserve / totalSupply
        const expectedA = (lpToRemove * reserveA) / lpTotal;
        const expectedB = (lpToRemove * reserveB) / lpTotal;

        const slippageBps = BigInt(Math.round(slippage * 100));
        const rawAmountAMin = expectedA - (expectedA * slippageBps) / 10000n;
        const rawAmountBMin = expectedB - (expectedB * slippageBps) / 10000n;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

        // Check LP token allowance to router
        let needsApproval = false;
        let currentAllowance = "0";
        const lpAllowance = (await client.readContract({
          address: pairAddress,
          abi: erc20Abi,
          functionName: "allowance",
          args: [walletAddress as `0x${string}`, CONTRACTS.ROUTER],
        })) as bigint;
        currentAllowance = lpAllowance.toString();
        needsApproval = lpAllowance < lpToRemove;

        let gasEstimate = "0.025";
        try {
          const gasPrice = await client.getGasPrice();
          gasEstimate = formatEther(180000n * gasPrice);
        } catch { /* keep fallback */ }

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

  prepareFarmStake: tool({
    description:
      "Prepare a farm deposit (stake LP tokens) transaction for ZealousSwap MasterChef. Checks allowance, reads pending rewards and locking period.",
    inputSchema: z.object({
      pid: z.number().describe("Pool ID"),
      amount: z.string().describe("Amount of LP tokens to stake (human-readable)"),
      walletAddress: z.string().optional().describe("User wallet address"),
    }),
    execute: async ({ pid, amount, walletAddress }) => {
      try {
        const rawAmount = parseUnits(amount, 18);
        const bigPid = BigInt(pid);

        // Read pool info
        const poolInfo = (await client.readContract({
          address: CONTRACTS.MASTER_CHEF,
          abi: masterchefAbi,
          functionName: "getPoolInfo",
          args: [bigPid],
        })) as readonly [string, bigint, bigint, bigint, bigint, boolean, boolean, bigint];

        const lpToken = poolInfo[0] as `0x${string}`;
        const isActive = poolInfo[5];
        if (!isActive) {
          return { error: `Farm pool ${pid} is not active` };
        }

        // Get locking period, reward token
        const [lockingPeriod, rewardToken] = await Promise.all([
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "lockingPeriod" }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "rewardToken" }),
        ]);

        const rewardTokenSymbol = KASPLEX_TOKENS.find(
          t => t.address?.toLowerCase() === (rewardToken as string).toLowerCase()
        )?.symbol ?? "ZEAL";

        // Get pair symbols for LP token label
        let lpTokenSymbol = "LP";
        try {
          const [t0, t1] = await Promise.all([
            client.readContract({ address: lpToken, abi: pairAbi, functionName: "token0" }),
            client.readContract({ address: lpToken, abi: pairAbi, functionName: "token1" }),
          ]);
          const addrToSym = (addr: string) => KASPLEX_TOKENS.find(t => t.address?.toLowerCase() === addr.toLowerCase())?.symbol ?? "???";
          lpTokenSymbol = `${addrToSym(t0 as string)}/${addrToSym(t1 as string)} LP`;
        } catch { /* keep fallback */ }

        // User info + pending rewards
        let existingStake = "0";
        let pendingRewards = "0";
        if (walletAddress) {
          const [userInfo, pending] = await Promise.all([
            client.readContract({
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "userInfo",
              args: [bigPid, walletAddress as `0x${string}`],
            }),
            client.readContract({
              address: CONTRACTS.MASTER_CHEF,
              abi: masterchefAbi,
              functionName: "pendingReward",
              args: [bigPid, walletAddress as `0x${string}`],
            }),
          ]);
          const userAmount = (userInfo as [bigint, bigint, bigint])[0];
          existingStake = formatUnits(userAmount, 18);
          pendingRewards = formatUnits(pending as bigint, 18);
        }

        // Check LP allowance to MasterChef
        let needsApproval = false;
        let currentAllowance = "0";
        if (walletAddress) {
          const allowance = (await client.readContract({
            address: lpToken,
            abi: erc20Abi,
            functionName: "allowance",
            args: [walletAddress as `0x${string}`, CONTRACTS.MASTER_CHEF],
          })) as bigint;
          currentAllowance = allowance.toString();
          needsApproval = allowance < rawAmount;
        }

        let gasEstimate = "0.02";
        try {
          const gasPrice = await client.getGasPrice();
          gasEstimate = formatEther(150000n * gasPrice);
        } catch { /* keep fallback */ }

        const lockingSeconds = Number(lockingPeriod as bigint);
        const lockingHours = (lockingSeconds / 3600).toFixed(1);

        const riskFlags: RiskFlag[] = [
          { type: "locking_period", label: `Locking period: ${lockingHours} hours`, severity: "medium" as RiskLevel },
        ];
        if (parseFloat(pendingRewards) > 0) {
          riskFlags.push({
            type: "pending_rewards_claim",
            label: `Depositing will auto-claim ${parseFloat(pendingRewards).toFixed(4)} ${rewardTokenSymbol} in pending rewards`,
            severity: "low" as RiskLevel,
          });
        }

        return {
          pid,
          lpTokenSymbol,
          amount,
          existingStake,
          pendingRewards,
          rewardToken: rewardTokenSymbol,
          lockingPeriod: `${lockingHours} hours`,
          needsApproval,
          currentAllowance,
          gasEstimate,
          riskFlags,
          contractInfo: {
            address: CONTRACTS.MASTER_CHEF,
            functionName: "deposit",
            description: `Stake ${lpTokenSymbol} in MasterChef farm pool ${pid}`,
          },
          tx: {
            masterChef: CONTRACTS.MASTER_CHEF,
            lpToken,
            pid: bigPid.toString(),
            rawAmount: rawAmount.toString(),
          },
        };
      } catch (e) {
        return { error: `Failed to prepare farm stake: ${e instanceof Error ? e.message : "Unknown error"}` };
      }
    },
  }),

  prepareFarmUnstake: tool({
    description:
      "Prepare a farm withdrawal (unstake LP tokens) from ZealousSwap MasterChef. Checks if withdrawal is allowed and shows pending rewards that will be auto-claimed.",
    inputSchema: z.object({
      pid: z.number().describe("Pool ID"),
      amount: z.string().optional().describe("Amount to unstake (human-readable). Defaults to full staked balance."),
      walletAddress: z.string().optional().describe("User wallet address"),
    }),
    execute: async ({ pid, amount, walletAddress }) => {
      if (!walletAddress) {
        return { error: "Wallet address is required for farm unstake" };
      }

      try {
        const bigPid = BigInt(pid);

        const [poolInfo, userInfo, pending, canWithdrawResult, rewardToken, lockingPeriod] = await Promise.all([
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "getPoolInfo", args: [bigPid] }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "userInfo", args: [bigPid, walletAddress as `0x${string}`] }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "pendingReward", args: [bigPid, walletAddress as `0x${string}`] }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "canWithdraw", args: [bigPid, walletAddress as `0x${string}`] }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "rewardToken" }),
          client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "lockingPeriod" }),
        ]);

        const info = poolInfo as readonly [string, bigint, bigint, bigint, bigint, boolean, boolean, bigint];
        const lpToken = info[0] as `0x${string}`;
        const userStaked = (userInfo as [bigint, bigint, bigint])[0];
        const pendingRewards = formatUnits(pending as bigint, 18);
        const canWithdraw = canWithdrawResult as boolean;

        if (userStaked === 0n) {
          return { error: `You have no staked LP tokens in farm pool ${pid}` };
        }

        const rewardTokenSymbol = KASPLEX_TOKENS.find(
          t => t.address?.toLowerCase() === (rewardToken as string).toLowerCase()
        )?.symbol ?? "ZEAL";

        // LP label
        let lpTokenSymbol = "LP";
        try {
          const [t0, t1] = await Promise.all([
            client.readContract({ address: lpToken, abi: pairAbi, functionName: "token0" }),
            client.readContract({ address: lpToken, abi: pairAbi, functionName: "token1" }),
          ]);
          const addrToSym = (addr: string) => KASPLEX_TOKENS.find(t => t.address?.toLowerCase() === addr.toLowerCase())?.symbol ?? "???";
          lpTokenSymbol = `${addrToSym(t0 as string)}/${addrToSym(t1 as string)} LP`;
        } catch { /* keep fallback */ }

        const rawAmount = amount ? parseUnits(amount, 18) : userStaked;
        if (rawAmount > userStaked) {
          return { error: `Requested ${amount} but only ${formatUnits(userStaked, 18)} staked` };
        }

        if (!canWithdraw) {
          const lockSec = Number(lockingPeriod as bigint);
          return { error: `Cannot withdraw yet — locking period (${(lockSec / 3600).toFixed(1)} hours) has not elapsed since last deposit` };
        }

        let gasEstimate = "0.015";
        try {
          const gasPrice = await client.getGasPrice();
          gasEstimate = formatEther(120000n * gasPrice);
        } catch { /* keep fallback */ }

        const riskFlags: RiskFlag[] = [];
        if (parseFloat(pendingRewards) > 0) {
          riskFlags.push({
            type: "rewards_claimed",
            label: `Will auto-claim ${parseFloat(pendingRewards).toFixed(4)} ${rewardTokenSymbol} in pending rewards`,
            severity: "low" as RiskLevel,
          });
        }

        return {
          pid,
          lpTokenSymbol,
          amount: formatUnits(rawAmount, 18),
          pendingRewards,
          rewardToken: rewardTokenSymbol,
          canWithdraw,
          gasEstimate,
          riskFlags,
          contractInfo: {
            address: CONTRACTS.MASTER_CHEF,
            functionName: "withdraw",
            description: `Unstake ${lpTokenSymbol} from MasterChef farm pool ${pid}`,
          },
          tx: {
            masterChef: CONTRACTS.MASTER_CHEF,
            pid: bigPid.toString(),
            rawAmount: rawAmount.toString(),
          },
        };
      } catch (e) {
        return { error: `Failed to prepare farm unstake: ${e instanceof Error ? e.message : "Unknown error"}` };
      }
    },
  }),

  prepareInfinityStake: tool({
    description:
      "Prepare a single-sided staking transaction for a ZealousSwap InfinityPool. Supports ZEAL, NACHO, and KASPER pools.",
    inputSchema: z.object({
      token: z.string().describe("Token to stake: ZEAL, NACHO, or KASPER"),
      amount: z.string().describe("Amount to stake (human-readable)"),
      walletAddress: z.string().optional().describe("User wallet address"),
    }),
    execute: async ({ token, amount, walletAddress }) => {
      const sym = token.toUpperCase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const poolMap: Record<string, { address: `0x${string}`; abi: any }> = {
        ZEAL: { address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi },
        NACHO: { address: CONTRACTS.INFINITY_POOL_NACHO, abi: infinityPoolNachoAbi },
        KASPER: { address: CONTRACTS.INFINITY_POOL_KASPER, abi: infinityPoolKasperAbi },
      };

      const pool = poolMap[sym];
      if (!pool) {
        return { error: `Unsupported InfinityPool token: ${token}. Supported: ZEAL, NACHO, KASPER` };
      }

      const tokenAddress = resolveTokenAddress(sym);
      if (!tokenAddress) {
        return { error: `Unknown token: ${token}` };
      }

      const decimals = getTokenDecimals(sym);
      const rawAmount = parseUnits(amount, decimals);

      try {
        const [previewResult, exchangeRate, totalStaked] = await Promise.all([
          client.readContract({ address: pool.address, abi: pool.abi, functionName: "previewStake", args: [rawAmount] }),
          client.readContract({ address: pool.address, abi: pool.abi, functionName: "getExchangeRate" }),
          client.readContract({ address: pool.address, abi: pool.abi, functionName: "totalStaked" }),
        ]);

        const xTokensReceived = formatUnits(previewResult as bigint, decimals);
        const rate = formatUnits(exchangeRate as bigint, 18);
        const staked = formatUnits(totalStaked as bigint, decimals);

        // Check allowance
        let needsApproval = false;
        let currentAllowance = "0";
        if (walletAddress) {
          const allowance = (await client.readContract({
            address: tokenAddress,
            abi: erc20Abi,
            functionName: "allowance",
            args: [walletAddress as `0x${string}`, pool.address],
          })) as bigint;
          currentAllowance = allowance.toString();
          needsApproval = allowance < rawAmount;
        }

        let gasEstimate = "0.015";
        try {
          const gasPrice = await client.getGasPrice();
          gasEstimate = formatEther(120000n * gasPrice);
        } catch { /* keep fallback */ }

        const riskFlags: RiskFlag[] = [];
        if (sym === "ZEAL") {
          try {
            const paused = (await client.readContract({
              address: pool.address,
              abi: infinityPoolZealAbi,
              functionName: "emissionsPaused",
            })) as boolean;
            if (paused) {
              riskFlags.push({ type: "emissions_paused", label: "ZEAL emissions are currently paused", severity: "high" as RiskLevel });
            }
          } catch { /* skip */ }
        }

        return {
          token: sym,
          amount,
          xTokensReceived,
          exchangeRate: rate,
          totalStaked: staked,
          needsApproval,
          currentAllowance,
          gasEstimate,
          riskFlags,
          contractInfo: {
            address: pool.address,
            functionName: "stake",
            description: `Stake ${sym} in InfinityPool to receive x${sym} tokens`,
          },
          tx: {
            pool: pool.address,
            tokenAddress,
            rawAmount: rawAmount.toString(),
          },
        };
      } catch (e) {
        return { error: `Failed to prepare InfinityPool stake: ${e instanceof Error ? e.message : "Unknown error"}` };
      }
    },
  }),

  prepareInfinityUnstake: tool({
    description:
      "Prepare an unstake transaction from a ZealousSwap InfinityPool. Burns xTokens to receive underlying tokens. Supports ZEAL, NACHO, and KASPER pools.",
    inputSchema: z.object({
      token: z.string().describe("Pool token: ZEAL, NACHO, or KASPER"),
      amount: z.string().describe("Amount of xTokens to unstake (human-readable)"),
      walletAddress: z.string().optional().describe("User wallet address"),
    }),
    execute: async ({ token, amount, walletAddress }) => {
      const sym = token.toUpperCase();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const poolMap: Record<string, { address: `0x${string}`; abi: any; xTokenFn: string }> = {
        ZEAL: { address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi, xTokenFn: "xZealToken" },
        NACHO: { address: CONTRACTS.INFINITY_POOL_NACHO, abi: infinityPoolNachoAbi, xTokenFn: "xNachoToken" },
        KASPER: { address: CONTRACTS.INFINITY_POOL_KASPER, abi: infinityPoolKasperAbi, xTokenFn: "xKasperToken" },
      };

      const pool = poolMap[sym];
      if (!pool) {
        return { error: `Unsupported InfinityPool token: ${token}. Supported: ZEAL, NACHO, KASPER` };
      }

      const decimals = getTokenDecimals(sym);
      const rawXAmount = parseUnits(amount, decimals);

      try {
        // Get xToken address
        const xTokenAddress = (await client.readContract({
          address: pool.address,
          abi: pool.abi,
          functionName: pool.xTokenFn as "xZealToken",
        })) as `0x${string}`;

        const [previewResult, exchangeRate, totalStaked] = await Promise.all([
          client.readContract({ address: pool.address, abi: pool.abi, functionName: "previewUnstake", args: [rawXAmount] }),
          client.readContract({ address: pool.address, abi: pool.abi, functionName: "getExchangeRate" }),
          client.readContract({ address: pool.address, abi: pool.abi, functionName: "totalStaked" }),
        ]);

        const tokensReceived = formatUnits(previewResult as bigint, decimals);
        const rate = formatUnits(exchangeRate as bigint, 18);
        const staked = formatUnits(totalStaked as bigint, decimals);

        // Check xToken balance
        if (walletAddress) {
          const xBalance = (await client.readContract({
            address: xTokenAddress,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [walletAddress as `0x${string}`],
          })) as bigint;
          if (xBalance < rawXAmount) {
            return { error: `Insufficient x${sym} balance. You have ${formatUnits(xBalance, decimals)} but requested ${amount}` };
          }
        }

        // Check xToken allowance to pool
        let needsApproval = false;
        let currentAllowance = "0";
        if (walletAddress) {
          const allowance = (await client.readContract({
            address: xTokenAddress,
            abi: erc20Abi,
            functionName: "allowance",
            args: [walletAddress as `0x${string}`, pool.address],
          })) as bigint;
          currentAllowance = allowance.toString();
          needsApproval = allowance < rawXAmount;
        }

        let gasEstimate = "0.015";
        try {
          const gasPrice = await client.getGasPrice();
          gasEstimate = formatEther(120000n * gasPrice);
        } catch { /* keep fallback */ }

        const riskFlags: RiskFlag[] = [];

        return {
          token: sym,
          xAmount: amount,
          tokensReceived,
          exchangeRate: rate,
          totalStaked: staked,
          needsApproval,
          currentAllowance,
          gasEstimate,
          riskFlags,
          contractInfo: {
            address: pool.address,
            functionName: "unstake",
            description: `Unstake x${sym} from InfinityPool to receive ${sym} tokens`,
          },
          tx: {
            pool: pool.address,
            xTokenAddress,
            rawXAmount: rawXAmount.toString(),
          },
        };
      } catch (e) {
        return { error: `Failed to prepare InfinityPool unstake: ${e instanceof Error ? e.message : "Unknown error"}` };
      }
    },
  }),

  discoverYieldOpportunities: tool({
    description:
      "Scan all ZealousSwap yield opportunities (farms + InfinityPools), compute APYs from on-chain data, assess risks, and return a ranked comparison. Use when the user asks about yield, best returns, where to invest, or DeFi opportunities.",
    inputSchema: z.object({
      filterToken: z
        .string()
        .optional()
        .describe("Optional token symbol to filter opportunities (e.g. 'ZEAL')"),
    }),
    execute: async ({ filterToken }) => {
      const BLOCK_TIME_SECONDS = 2;
      const BLOCKS_PER_YEAR = (365.25 * 24 * 3600) / BLOCK_TIME_SECONDS; // 15,778,800

      try {
        // ===== Phase 1: Gather on-chain data in parallel =====

        // Factory: get all pairs
        const pairsLength = (await client.readContract({
          address: CONTRACTS.FACTORY,
          abi: factoryAbi,
          functionName: "allPairsLength",
        })) as bigint;

        const pairIndices = Array.from({ length: Number(pairsLength) }, (_, i) => i);
        const pairAddresses = await Promise.all(
          pairIndices.map((i) =>
            client.readContract({
              address: CONTRACTS.FACTORY,
              abi: factoryAbi,
              functionName: "allPairs",
              args: [BigInt(i)],
            })
          )
        ) as `0x${string}`[];

        // Fetch pair data + MasterChef + InfinityPools in parallel
        const [pairDataResults, farmData, infinityData] = await Promise.all([
          // All pair data
          Promise.all(
            pairAddresses.map(async (addr) => {
              const [token0, token1, reserves, totalSupply] = await Promise.all([
                client.readContract({ address: addr, abi: pairAbi, functionName: "token0" }),
                client.readContract({ address: addr, abi: pairAbi, functionName: "token1" }),
                client.readContract({ address: addr, abi: pairAbi, functionName: "getReserves" }),
                client.readContract({ address: addr, abi: pairAbi, functionName: "totalSupply" }),
              ]);
              const [r0, r1] = reserves as [bigint, bigint, number];
              return {
                address: addr,
                token0: (token0 as string).toLowerCase(),
                token1: (token1 as string).toLowerCase(),
                reserve0: r0,
                reserve1: r1,
                totalSupply: totalSupply as bigint,
              };
            })
          ),
          // MasterChef data
          (async () => {
            const [activePools, rewardPerBlock, totalAllocPoint, rewardToken] =
              await Promise.all([
                client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "getActivePools" }),
                client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "rewardPerBlock" }),
                client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "totalAllocPoint" }),
                client.readContract({ address: CONTRACTS.MASTER_CHEF, abi: masterchefAbi, functionName: "rewardToken" }),
              ]);
            const poolIds = (activePools as bigint[]).map(Number);
            const poolInfos = await Promise.all(
              poolIds.map((pid) =>
                client.readContract({
                  address: CONTRACTS.MASTER_CHEF,
                  abi: masterchefAbi,
                  functionName: "getPoolInfo",
                  args: [BigInt(pid)],
                })
              )
            );
            return {
              poolIds,
              poolInfos: poolInfos as unknown as readonly [string, bigint, bigint, bigint, bigint, boolean, boolean, bigint][],
              rewardPerBlock: rewardPerBlock as bigint,
              totalAllocPoint: totalAllocPoint as bigint,
              rewardToken: (rewardToken as string).toLowerCase(),
            };
          })(),
          // InfinityPool data
          (async () => {
            const [zealRate, zealStaked, zealPerBlock, zealPaused, nachoRate, nachoStaked, kasperRate, kasperStaked] =
              await Promise.all([
                client.readContract({ address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi, functionName: "getExchangeRate" }),
                client.readContract({ address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi, functionName: "totalStaked" }),
                client.readContract({ address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi, functionName: "zealPerBlock" }),
                client.readContract({ address: CONTRACTS.INFINITY_POOL_ZEAL, abi: infinityPoolZealAbi, functionName: "emissionsPaused" }),
                client.readContract({ address: CONTRACTS.INFINITY_POOL_NACHO, abi: infinityPoolNachoAbi, functionName: "getExchangeRate" }),
                client.readContract({ address: CONTRACTS.INFINITY_POOL_NACHO, abi: infinityPoolNachoAbi, functionName: "totalStaked" }),
                client.readContract({ address: CONTRACTS.INFINITY_POOL_KASPER, abi: infinityPoolKasperAbi, functionName: "getExchangeRate" }),
                client.readContract({ address: CONTRACTS.INFINITY_POOL_KASPER, abi: infinityPoolKasperAbi, functionName: "totalStaked" }),
              ]);
            return {
              zeal: {
                exchangeRate: zealRate as bigint,
                totalStaked: zealStaked as bigint,
                zealPerBlock: zealPerBlock as bigint,
                emissionsPaused: zealPaused as boolean,
              },
              nacho: { exchangeRate: nachoRate as bigint, totalStaked: nachoStaked as bigint },
              kasper: { exchangeRate: kasperRate as bigint, totalStaked: kasperStaked as bigint },
            };
          })(),
        ]);

        // ===== Phase 2: Derive token prices from pairs =====
        const wkasAddr = CONTRACTS.WKAS.toLowerCase();
        const tokenPrices: Record<string, number> = { [wkasAddr]: 1 };

        // Build address-to-symbol map
        const addrToSymbol: Record<string, string> = {};
        for (const t of KASPLEX_TOKENS) {
          if (t.address) addrToSymbol[t.address.toLowerCase()] = t.symbol;
        }

        // First pass: pairs with WKAS on one side
        for (const pair of pairDataResults) {
          if (pair.reserve0 === 0n || pair.reserve1 === 0n) continue;
          const r0 = Number(formatUnits(pair.reserve0, 18));
          const r1 = Number(formatUnits(pair.reserve1, 18));
          if (pair.token0 === wkasAddr && !tokenPrices[pair.token1]) {
            tokenPrices[pair.token1] = r0 / r1;
          } else if (pair.token1 === wkasAddr && !tokenPrices[pair.token0]) {
            tokenPrices[pair.token0] = r1 / r0;
          }
        }

        // Second pass: pairs where one side has a known price
        for (const pair of pairDataResults) {
          if (pair.reserve0 === 0n || pair.reserve1 === 0n) continue;
          const r0 = Number(formatUnits(pair.reserve0, 18));
          const r1 = Number(formatUnits(pair.reserve1, 18));
          if (tokenPrices[pair.token0] && !tokenPrices[pair.token1]) {
            tokenPrices[pair.token1] = (tokenPrices[pair.token0] * r0) / r1;
          } else if (tokenPrices[pair.token1] && !tokenPrices[pair.token0]) {
            tokenPrices[pair.token0] = (tokenPrices[pair.token1] * r1) / r0;
          }
        }

        // Build human-readable price map
        const tokenPricesInKas: Record<string, number> = {};
        for (const [addr, price] of Object.entries(tokenPrices)) {
          const sym = addrToSymbol[addr];
          if (sym) tokenPricesInKas[sym] = price;
        }
        tokenPricesInKas["KAS"] = 1;

        // Reward token info
        const rewardTokenSymbol =
          KASPLEX_TOKENS.find((t) => t.address?.toLowerCase() === farmData.rewardToken)?.symbol ?? "ZEAL";
        const rewardTokenPrice = tokenPrices[farmData.rewardToken] ?? 0;

        // ===== Phase 3: Build opportunities array =====
        const opportunities: YieldOpportunity[] = [];

        // --- Farms ---
        const knownAddresses = new Set(KASPLEX_TOKENS.filter((t) => t.address).map((t) => t.address!.toLowerCase()));
        for (let i = 0; i < farmData.poolIds.length; i++) {
          const pid = farmData.poolIds[i];
          const info = farmData.poolInfos[i];
          const lpToken = info[0].toLowerCase();
          const allocPoint = info[1];
          const totalDeposited = info[4];

          if (!info[5]) continue; // skip inactive

          // Find matching pair
          const pairData = pairDataResults.find((p) => p.address.toLowerCase() === lpToken);
          if (!pairData) continue;

          const token0Sym = addrToSymbol[pairData.token0] ?? pairData.token0.slice(0, 8);
          const token1Sym = addrToSymbol[pairData.token1] ?? pairData.token1.slice(0, 8);
          const price0 = tokenPrices[pairData.token0] ?? 0;
          const price1 = tokenPrices[pairData.token1] ?? 0;

          const r0 = Number(formatUnits(pairData.reserve0, 18));
          const r1 = Number(formatUnits(pairData.reserve1, 18));
          const lpTotalSupply = Number(formatUnits(pairData.totalSupply, 18));
          const deposited = Number(formatUnits(totalDeposited, 18));

          // LP value per token
          const lpValuePerToken = lpTotalSupply > 0
            ? (r0 * price0 + r1 * price1) / lpTotalSupply
            : 0;
          const tvlKas = deposited * lpValuePerToken;

          // APY calculation
          const allocPct = Number(allocPoint) / Number(farmData.totalAllocPoint);
          const annualRewards =
            Number(formatUnits(farmData.rewardPerBlock, 18)) * BLOCKS_PER_YEAR * allocPct;
          const apyPercent = tvlKas > 0 ? (annualRewards * rewardTokenPrice / tvlKas) * 100 : 0;

          // Risks
          const risks: RiskFlag[] = [
            { type: "impermanent_loss", label: "Impermanent loss risk", severity: "medium" as RiskLevel },
          ];
          if (tvlKas < 1000) {
            risks.push({ type: "low_liquidity", label: "Low liquidity (TVL < 1,000 KAS)", severity: "high" as RiskLevel });
          }
          if (!knownAddresses.has(pairData.token0)) {
            risks.push({ type: "unverified_token", label: `Unverified token ${token0Sym}`, severity: "high" as RiskLevel });
          }
          if (!knownAddresses.has(pairData.token1)) {
            risks.push({ type: "unverified_token", label: `Unverified token ${token1Sym}`, severity: "high" as RiskLevel });
          }

          const overallRisk: RiskLevel = risks.some((r) => r.severity === "high")
            ? "high"
            : risks.some((r) => r.severity === "medium")
            ? "medium"
            : "low";

          opportunities.push({
            id: `farm-${pid}`,
            type: "farm",
            name: `${token0Sym}/${token1Sym} Farm`,
            tokens: [token0Sym, token1Sym],
            apyPercent: isFinite(apyPercent) ? apyPercent : 0,
            yieldSource: `${rewardTokenSymbol} emissions`,
            tvlKas,
            risks,
            overallRisk,
            details: {
              pid,
              lpToken: info[0],
              allocPercent: allocPct * 100,
              rewardToken: rewardTokenSymbol,
              rewardPerBlock: formatUnits(farmData.rewardPerBlock, 18),
              totalDeposited: formatUnits(totalDeposited, 18),
              pair: `${token0Sym}/${token1Sym}`,
              reserveA: r0.toFixed(4),
              reserveB: r1.toFixed(4),
            },
          });
        }

        // --- InfinityPool: ZEAL (emission-based) ---
        {
          const totalStaked = Number(formatUnits(infinityData.zeal.totalStaked, 18));
          const zealPrice = tokenPrices[KASPLEX_TOKENS.find((t) => t.symbol === "ZEAL")!.address!.toLowerCase()] ?? 0;
          const tvlKas = totalStaked * zealPrice;
          const zealPerBlockNum = Number(formatUnits(infinityData.zeal.zealPerBlock, 18));

          // Same-token APY: rewards in ZEAL / staked in ZEAL
          const apyPercent = totalStaked > 0
            ? (zealPerBlockNum * BLOCKS_PER_YEAR / totalStaked) * 100
            : 0;

          const risks: RiskFlag[] = [];
          if (infinityData.zeal.emissionsPaused) {
            risks.push({ type: "emissions_paused", label: "Emissions currently paused", severity: "high" as RiskLevel });
          }
          if (tvlKas < 1000) {
            risks.push({ type: "low_liquidity", label: "Low liquidity (TVL < 1,000 KAS)", severity: "high" as RiskLevel });
          }

          const overallRisk: RiskLevel = risks.some((r) => r.severity === "high")
            ? "high"
            : risks.some((r) => r.severity === "medium")
            ? "medium"
            : "low";

          opportunities.push({
            id: "infinity-zeal",
            type: "infinity_pool",
            name: "ZEAL InfinityPool",
            tokens: ["ZEAL"],
            apyPercent: isFinite(apyPercent) ? apyPercent : 0,
            yieldSource: "ZEAL emissions",
            tvlKas,
            risks,
            overallRisk,
            details: {
              token: "ZEAL",
              exchangeRate: formatUnits(infinityData.zeal.exchangeRate, 18),
              totalStaked: formatUnits(infinityData.zeal.totalStaked, 18),
              zealPerBlock: formatUnits(infinityData.zeal.zealPerBlock, 18),
              emissionsPaused: infinityData.zeal.emissionsPaused,
            },
          });
        }

        // --- InfinityPool: NACHO (fee-based) ---
        {
          const totalStaked = Number(formatUnits(infinityData.nacho.totalStaked, 18));
          const nachoPrice = tokenPrices[KASPLEX_TOKENS.find((t) => t.symbol === "NACHO")!.address!.toLowerCase()] ?? 0;
          const tvlKas = totalStaked * nachoPrice;

          const risks: RiskFlag[] = [];
          if (tvlKas < 1000) {
            risks.push({ type: "low_liquidity", label: "Low liquidity (TVL < 1,000 KAS)", severity: "high" as RiskLevel });
          }

          opportunities.push({
            id: "infinity-nacho",
            type: "infinity_pool",
            name: "NACHO InfinityPool",
            tokens: ["NACHO"],
            apyPercent: null,
            yieldSource: "Fee-based (exchange rate appreciation)",
            tvlKas,
            risks,
            overallRisk: risks.some((r) => r.severity === "high") ? "high" : "low",
            details: {
              token: "NACHO",
              exchangeRate: formatUnits(infinityData.nacho.exchangeRate, 18),
              totalStaked: formatUnits(infinityData.nacho.totalStaked, 18),
            },
          });
        }

        // --- InfinityPool: KASPER (fee-based) ---
        {
          const totalStaked = Number(formatUnits(infinityData.kasper.totalStaked, 18));
          const kasperPrice = tokenPrices[KASPLEX_TOKENS.find((t) => t.symbol === "KASPER")!.address!.toLowerCase()] ?? 0;
          const tvlKas = totalStaked * kasperPrice;

          const risks: RiskFlag[] = [];
          if (tvlKas < 1000) {
            risks.push({ type: "low_liquidity", label: "Low liquidity (TVL < 1,000 KAS)", severity: "high" as RiskLevel });
          }

          opportunities.push({
            id: "infinity-kasper",
            type: "infinity_pool",
            name: "KASPER InfinityPool",
            tokens: ["KASPER"],
            apyPercent: null,
            yieldSource: "Fee-based (exchange rate appreciation)",
            tvlKas,
            risks,
            overallRisk: risks.some((r) => r.severity === "high") ? "high" : "low",
            details: {
              token: "KASPER",
              exchangeRate: formatUnits(infinityData.kasper.exchangeRate, 18),
              totalStaked: formatUnits(infinityData.kasper.totalStaked, 18),
            },
          });
        }

        // ===== Phase 4: Filter, sort, return =====
        let filtered = opportunities;
        if (filterToken) {
          const ft = filterToken.toUpperCase();
          filtered = opportunities.filter((o) =>
            o.tokens.some((t) => t.toUpperCase() === ft)
          );
        }

        // Sort by APY descending, nulls last
        filtered.sort((a, b) => {
          if (a.apyPercent === null && b.apyPercent === null) return 0;
          if (a.apyPercent === null) return 1;
          if (b.apyPercent === null) return -1;
          return b.apyPercent - a.apyPercent;
        });

        return {
          opportunities: filtered,
          tokenPricesInKas,
          blockTimeSeconds: BLOCK_TIME_SECONDS,
          fetchedAt: new Date().toISOString(),
        };
      } catch (e) {
        return {
          opportunities: [],
          tokenPricesInKas: {},
          blockTimeSeconds: 2,
          fetchedAt: new Date().toISOString(),
          error: `Failed to discover yield opportunities: ${e instanceof Error ? e.message : "Unknown error"}`,
        };
      }
    },
  }),
};
