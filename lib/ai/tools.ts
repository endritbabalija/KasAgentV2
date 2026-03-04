import { createPublicClient, http, formatUnits, parseUnits } from "viem";
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

        return {
          tokenIn,
          tokenOut,
          amountIn,
          amountOut: formatUnits(rawAmountOut, decimalsOut),
          amountOutMin: formatUnits(rawAmountOutMin, decimalsOut),
          slippage,
          priceImpact,
          dexFee: "0.3",
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
};
