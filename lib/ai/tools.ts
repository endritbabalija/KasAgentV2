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
import type {
  YieldOpportunity,
  RiskFlag,
  RiskLevel,
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
